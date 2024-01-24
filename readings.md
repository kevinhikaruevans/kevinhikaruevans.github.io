---
title: Readings
---

Here's a list of things that I'm currently reading or will read at some point.

- [beej's network programming guide](https://github.com/beejjorgensen/bgnet)
- [Math refresher for scientists and engineers](https://ieeexplore.ieee.org/book/5237539)
- [Conventional commits](https://www.conventionalcommits.org/en/v1.0.0/)
- [ESP-IDF's style guide](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/contribute/style-guide.html)
  - functions have brace on a newline
  - never commit commented-out function -> I need to get better at this
  - Astyle can be used to format C using pre-commit
  - typedefs (even non std) end in _t
  - enums should always be typedef'd (why? to save the extra 4 chars? I feel like this is less explicit and might be ambiguous, but w/e)
  - assert bit is good: https://docs.espressif.com/projects/esp-idf/en/latest/esp32/contribute/style-guide.html
  - should start doing extern "C" for libs
  - would be nice to create a template repo for this
- [Coert Vonk's physics archives](https://coertvonk.com/category/physics)
