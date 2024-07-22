---
title: Using Tek 571s at WSU
description: Or how I lost some confidence in the EECS department at WSU
date: 2024-07-22
tags: computers wsu college
---

Here's a (possibly cringeworthy) story from my EECS undergrad experience at WSU. I didn't my schooling here for a variety of reasons, but this is just one of the reasons why.

While getting my degree, I had several electrical engineering courses with labs. During one of the early labs, we were using curve tracers to characterize diodes. Many of y'all know the drill: plug in a diode or transitor into a curve tracer, it sweeps the voltage and displays the output. Our curve tracers are... _antiquated_. We're using some dusty Tek 571s, which were due for calibration about thirty years ago. I am surprised that our lab equipment is so outdated, but this might be [related to the fact that our university's presidents and coaches are some of the state's top paid employees](https://opengovwa.com/employee).

![CRT of a Tek 571](/assets/images/2024-07-22-tek.png)

Anyway, a requirement of this specific lab was to take pictures of the curve tracer CRT display and embed them in our report. I think we were to put tangents over the curves (in post) and grab some fitment params, or something along those lines. This isn't the most accurate method, considering the CRTs are convex and have a rolling shutter effect, so it's actually quite hard to get a good image of the curves. But hey, it's for an undergrad class, so it truly doesn't matter.

Since I'm putting in the effort into [typesetting my reports in TeX](https://github.com/kevinhikaruevans/old-homeworks/blob/main/EE362/lab5/lab5_report.pdf), I wondered if there was a better way of grabbing the image. I noticed that there's a print feature on the curve tracers with parallel ports in the rear. I drafted a quick email to the lab director asking if they would mind if I grabbed the print outputs using a microcontroller:

> In the EE352 lab the other day, we were using the Tek 571 curve tracers and were taking snapshots of the CRTs on our phones. There were a couple of students that weren't able to take photos because of the screen flicker and mismatched refresh rates between the camera/CRTs. [My instructor's name] mentioned there were dot matrix printers setup previously, but [the department] had switched away from those because of their incredibly slow printing speed.

> I was wondering, since there are parallel ports available, would it be possible to setup a microcontroller to act as an printer client (basically bitbanging the IBM or Epson FX80 protocol) and dump the printer data as a file on a USB drive? I'm thinking it would only need a couple 5v to a 3.3v logic level converters (and maybe a parallel to serial register) and a microcontroller. Is there someone I could talk to about getting the permission to try implementing this?

It seems the lab director thought it wasn't a good idea, as he responded with telling me:

> I am not in favor of adding additional custom-made hardware to the lab at this time.

Then he CC'd some other folks in the department. I can understand why he said this, given that our budget is limited enough to use 30-year-old curve tracers---there's only a few of these in the department's arsenal. But this attitude seems to stifle creativity and innovation in students.

This could've been a cool learning and mentorship experience. Plus, it could've helped other engineering students who had trouble capturing the displays. But instead, we're continuing to take these pictures of CRTs. Instead, _we're not engineering anything_ but strictly following the course guidelines. Can't go beyond those guidelines, eh. Well, hey, I thought it would've been a cool project. 


