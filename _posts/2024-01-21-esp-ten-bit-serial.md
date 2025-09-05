---
title: 10-bit serial on the ESP32
description: Hacking together 10-bit serial using the RMT peripheral
date: 2024-01-21
tags: esp32 computers
---


Recently, I was working on integrating with a device that appears to use a bidirectional 10-bit serial interface at exactly 100 kHz. The manufacturer does not give _any_ information on their proprietary format, so I guess I'll have to hack something together.

To begin, the master initiates the sequence by sending several 10-bit frames and slaves respond by driving the line low and responding with their own packets. On my logic analyzer, it looks something like this:

![10 bit serial screenshot](/assets/images/2024-01-25-bits.png)

Unfortunately, I don't own anything that natively supports 10-bit serial. All of my chips only support up to 8-bit and one even supports 9-bit (addressed) serial.

Ideally, I would like to use an ESP32-S3, mostly because I've been working with ESP-IDF lately and find it good enough for a project like this.

### Attempt 1: Bitbanging serial

I attempted to just bitbang serial using several timers on the ESP32. I initially tried the high-resolution timer, but it is unable to reach a 10 us resolution and silently fails (d'oh). This is documented on their [docs](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/system/esp_timer.html), but I must've missed it.

Then I tried the general purpose (GP) timer and while it's able to reach 10 us periods, it sometime skewed more than a microsecond or two! This is not acceptable for this application since there is no external clock.

### Attempt 2: ✨ RMT peripheral ✨

After consulting the ESP32 forum, I tried the [remote control transceiver (RMT) peripheral](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/peripherals/rmt.html). To my surprise, this worked wonderfully. It is made for controlling remote control signals, but has numerous applications outside of that realm.

It's a pain to set this up, as it requires you to manually encode and decode pulses at a fixed period. But, this peripheral is fairly precise and accurate and can hit 10 us right on the money.

The RMT also allows you to transmit bidirectionally on the same line, using `is_loop_back=true`.

Here's my tester code that I used. It's ugly and definitely not ready for production, but the bones are all there. It's roughly based on the [RMT NEC example](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/peripherals/rmt.html#customize-rmt-encoder-for-nec-protocol) on the Espressif website.

It initializes the RMT with:

- a transmitter
- an encoder to convert the lower 10-bits of ushorts into pulse structures for the underlying RMT
- a loopback receiver
- an ugly decoder that performs some rounding (e.g. rounding 8 us to 10 us)

{% raw %}

```c
#include "freertos/FreeRTOS.h"
#include "freertos/task.h" 
#include "freertos/queue.h"
#include "driver/rmt_tx.h"
#include "driver/rmt_rx.h"
#include "driver/rmt_encoder.h"

#include "esp_check.h"
#include "esp_log.h"
#include "driver/gpio.h"
#include <stdint.h>

#define SERIAL_FREQ_HZ 1000000
#define SERIAL_TX_GPIO_NUM 6
#define SERIAL_RX_GPIO_NUM 7

static const char TAG[] = "main";

static rmt_channel_handle_t tx_channel_handle = NULL;
static rmt_channel_handle_t rx_channel_handle = NULL;
static const rmt_transmit_config_t tx_config = {
  .loop_count = 0,
  .flags.eot_level = 0, // stop bit: note inverted
};
static rmt_encoder_handle_t encoder = NULL;

const static rmt_symbol_word_t bits[2] = {
  // inverted!

  /* 0 */ {
    .level0 = 1,
    .duration0 = 5,
    .level1 = 1,
    .duration1 = 5,
  },
  /* 1 */ {
    .level0 = 0,
    .duration0 = 5,
    .level1 = 0,
    .duration1 = 5
  },
};


// #define RMT_ENCODING_RESET 0

typedef struct {
  rmt_encoder_t base;
  rmt_encoder_t *copy_encoder;
  rmt_symbol_word_t start_bit;
  int state;
  rmt_symbol_word_t end_bit;
} rmt_curtis_encoder_t;


static size_t rmt_encode_curtis(rmt_encoder_t *encoder, rmt_channel_handle_t channel, const void *primary_data, size_t data_size, rmt_encode_state_t *out_state) {
  rmt_curtis_encoder_t *curtis_encoder = __containerof(encoder, rmt_curtis_encoder_t, base);
  rmt_encode_state_t session_state = RMT_ENCODING_RESET;
  rmt_encode_state_t state = RMT_ENCODING_RESET;
  size_t encoded_symbols = 0;

  uint16_t raw = *((uint16_t *)primary_data);
  rmt_encoder_t *copy_encoder = curtis_encoder->copy_encoder;

  switch(curtis_encoder->state) {
    case 0: // send start bit
      encoded_symbols += copy_encoder->encode(copy_encoder, channel, &curtis_encoder->start_bit, sizeof(rmt_symbol_word_t), &session_state);
      if (session_state & RMT_ENCODING_COMPLETE) {
        curtis_encoder->state = 1; // go to next state
      }
      if (session_state & RMT_ENCODING_MEM_FULL) {
        state |= RMT_ENCODING_MEM_FULL;
        goto out;
      }
    
    // fall-through
    case 1: // send data symbols
      for(int i = 0; i < 10; i++) {
        // iterate through bits in data
        bool bit = (raw >> i) & 0b1;
        rmt_symbol_word_t symbol = bits[bit];
        encoded_symbols += copy_encoder->encode(copy_encoder, channel, &symbol, sizeof(rmt_symbol_word_t), &session_state);

        if (session_state & RMT_ENCODING_MEM_FULL) {
          state |= RMT_ENCODING_MEM_FULL;
          goto out;
        }
      }
      // data is encoded :)
      curtis_encoder->state = 2;
      state |= RMT_ENCODING_COMPLETE;

    // fall through
    case 2: // end end bit
      encoded_symbols += copy_encoder->encode(copy_encoder, channel, &curtis_encoder->end_bit, sizeof(rmt_symbol_word_t), &session_state);
      if (session_state & RMT_ENCODING_COMPLETE) {
        curtis_encoder->state = RMT_ENCODING_RESET; // go to next state
        state |= RMT_ENCODING_COMPLETE;
      }
      if (session_state & RMT_ENCODING_MEM_FULL) {
        state |= RMT_ENCODING_MEM_FULL;
        goto out;
      }
      // all done!
  }

out:
  *out_state = state;
  return encoded_symbols;
}

static esp_err_t rmt_del_curtis_encoder(rmt_encoder_t *encoder) {
  rmt_curtis_encoder_t *curtis_encoder = __containerof(encoder, rmt_curtis_encoder_t, base);
  rmt_del_encoder(curtis_encoder->copy_encoder);
  free(curtis_encoder);
  return ESP_OK;
}

static esp_err_t rmt_curtis_encoder_reset(rmt_encoder_t *encoder) {
  rmt_curtis_encoder_t *curtis_encoder = __containerof(encoder, rmt_curtis_encoder_t, base);
  rmt_encoder_reset(curtis_encoder->copy_encoder);
  curtis_encoder->state = RMT_ENCODING_RESET;
  return ESP_OK;
}

esp_err_t rmt_new_curtis_encoder(rmt_encoder_handle_t *out_encoder) {
  rmt_curtis_encoder_t *curtis_encoder = calloc(1, sizeof(rmt_curtis_encoder_t));
  // TODO: error check
  curtis_encoder->state = 0;
  curtis_encoder->base.encode = rmt_encode_curtis;
  curtis_encoder->base.del = rmt_del_curtis_encoder;
  curtis_encoder->base.reset = rmt_curtis_encoder_reset;

  rmt_copy_encoder_config_t copy_encoder_config = {};
  rmt_new_copy_encoder(&copy_encoder_config, &curtis_encoder->copy_encoder);

  // construct start, end bit
  curtis_encoder->start_bit = bits[0];
  curtis_encoder->end_bit = bits[1];

  *out_encoder = &curtis_encoder->base;

  return ESP_OK;

}

static bool rmt_rx_done_callback(rmt_channel_handle_t channel, const rmt_rx_done_event_data_t *edata, void *user_data)
{
    BaseType_t high_task_wakeup = pdFALSE;
    QueueHandle_t receive_queue = (QueueHandle_t)user_data;
    // send the received RMT symbols to the parser task
    xQueueSendFromISR(receive_queue, edata, &high_task_wakeup);
    return high_task_wakeup == pdTRUE;
}

static unsigned int round_duration(unsigned int duration) {
  int mod = duration % 10;
  
  if (mod == 0) {
    return duration;
  }

  if (mod >= 5) {
    return duration + (10 - mod);
  }
  return duration - mod;
}
static int extract_level(uint16_t *data, int index, const unsigned int level, const unsigned int duration) {
  if (level == 1) {
    // this is inverted, so this is a zero. we can just increase index
    return index + duration / 10;
  }

  for(int i = 0; i < duration / 10; i++) {
    *data |= 1 << index;
    index++;
  }

  return index;
}

static void round_symbol_word(rmt_symbol_word_t *word) {
  word->duration0 = round_duration(word->duration0);
  word->duration1 = round_duration(word->duration1);
}

uint16_t sequence[] = {
  0x3BA,
  0x2,
  0x2,
  0x3E2,
  0x2,
  0x102,
  0x15A
};

uint16_t master_seq[] = {
  0x2E8,
  0x202,
  0x002,
  0x3E2,
  0x002,
  0x002,
  0x05A
};

static void parse_frame(rmt_symbol_word_t *rmt_symbols, size_t symbol_num)
{
    // printf("frame start---\r\n");
    uint16_t data = 0;
    int data_idx = 0;

    for (size_t i = 0; i < symbol_num; i++) {
      rmt_symbol_word_t symbol = rmt_symbols[i];
      // round_symbol_word(&symbol);

      data_idx = extract_level(&data, data_idx, symbol.level0, symbol.duration0);
      data_idx = extract_level(&data, data_idx, symbol.level1, symbol.duration1);

      
      // printf("{%d:%d},{%d:%d}\r\n", symbol.level0, symbol.duration0,
      //         symbol.level1, symbol.duration1);

    }

    while(data_idx < 14) {
      // stick in remaining bits
      data |= 1 << data_idx;
      data_idx++;
    }

    data = (data >> 1) & 0b1111111111;

    if (data == 0x5A) {
      for(uint16_t i = 0; i < 7; i++) {
        rmt_transmit(tx_channel_handle, encoder, (void *)&sequence[i], sizeof(uint16_t), &tx_config);
      }
      // rmt_tx_wait_all_done(tx_channel_handle, 5);
      
    }
    // ESP_LOGI(TAG, ">> data = %x", (data >> 1) & 0b1111111111);
    // // printf("---frame end: ");
}


static void parse_all_frames(rmt_symbol_word_t *rmt_symbols, size_t symbol_num) {
  // breaks up frames into smaller ones

  int current_duration = 0;
  size_t current_size = 0;

  rmt_symbol_word_t *start = NULL;

  for(size_t i = 0; i < symbol_num; i++) {
    rmt_symbol_word_t *word = &rmt_symbols[i];

    if (start == NULL) {
      start = word;
    }

    round_symbol_word(word);
    current_duration += word->duration0 + word->duration1;
    current_size++;

    if (current_duration / 10 >= 12) {
      // ship it
      parse_frame(start, current_size);

      current_duration = 0;
      current_size = 0;
      start = NULL;
    }
  }

  if (start != NULL) {
    parse_frame(start, current_size);
  }
}

void app_main() {
  ESP_LOGI(TAG, "create rmt tx channel");

  // init rx channel
  rmt_rx_channel_config_t rx_channel_config = {
    .clk_src=RMT_CLK_SRC_DEFAULT,
    .gpio_num=SERIAL_TX_GPIO_NUM,
    .mem_block_symbols=64,
    .resolution_hz=SERIAL_FREQ_HZ,
    .flags.invert_in=true,
    .flags.with_dma=false,
    .flags.io_loop_back=true,
  };
  ESP_ERROR_CHECK(rmt_new_rx_channel(&rx_channel_config, &rx_channel_handle));

  // init tx channel
  rmt_tx_channel_config_t tx_channel_config = {
    .clk_src=RMT_CLK_SRC_DEFAULT,
    .gpio_num = SERIAL_TX_GPIO_NUM,
    .mem_block_symbols=64,
    .resolution_hz=SERIAL_FREQ_HZ,
    .trans_queue_depth=3,
    .flags.invert_out=true,
    .flags.with_dma=false,
    .flags.io_loop_back=true,
    .flags.io_od_mode=true
  };
  
  ESP_ERROR_CHECK(rmt_new_tx_channel(&tx_channel_config, &tx_channel_handle));
  
  // set gpio modes
  // gpio_set_pull_mode(SERIAL_TX_GPIO_NUM, GPIO_FLOATING);
  // gpio_set_pull_mode(SERIAL_TX_GPIO_NUM, GPIO_MODE_INPUT);
  // gpio_set_drive_capability(SERIAL_TX_GPIO_NUM, GPIO_DRIVE_CAP_0);

  // init rx queue and callbacks
  QueueHandle_t receive_queue = xQueueCreate(10, sizeof(rmt_rx_done_event_data_t));

  rmt_rx_event_callbacks_t cbs = {
    .on_recv_done=rmt_rx_done_callback
  };
  ESP_ERROR_CHECK(rmt_rx_register_event_callbacks(rx_channel_handle, &cbs, receive_queue));

  rmt_receive_config_t receive_config = {
    .signal_range_min_ns=7*1000, // start bit only
    .signal_range_max_ns=12*10*1000 + 7*1000
  };

  // create tx encoder
  
  rmt_new_curtis_encoder(&encoder);
  
  ESP_ERROR_CHECK(rmt_enable(tx_channel_handle));
  ESP_ERROR_CHECK(rmt_enable(rx_channel_handle));
  
  rmt_symbol_word_t raw_symbols[64] = {0}; // more than enough
  rmt_rx_done_event_data_t rx_data;

  ESP_ERROR_CHECK(rmt_receive(rx_channel_handle, raw_symbols, sizeof(raw_symbols), &receive_config ));


  
  for(;;) {
    if (xQueueReceive(receive_queue, &rx_data, pdMS_TO_TICKS(10)) == pdPASS) {
        // ESP_LOGI(TAG, "received data");
        parse_all_frames(rx_data.received_symbols, rx_data.num_symbols);
          // start receive again
        ESP_ERROR_CHECK(rmt_receive(rx_channel_handle, raw_symbols, sizeof(raw_symbols), &receive_config));
        

        // vTaskDelay(5);
    } else {
      // for(uint16_t i = 0; i < 7; i++) {
      //   rmt_transmit(tx_channel_handle, encoder, (void *)&master_seq[i], sizeof(uint16_t), &tx_config);
      // }
    }
  }
}
```
{% endraw %}
