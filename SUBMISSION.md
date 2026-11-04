# Submission answers (Meta Global AI Developer Hackathon, indie track)

Deadline: **4 Nov 2026, 9:00 PM ET = 5 Nov 2026, 07:30 IST.** No edits after that. The headings below follow the real form, read on 5 Nov.
Check every number against `QA_AND_EVALUATION.md` before pasting. The submitter pastes these and presses Submit.

## Team Name

AuraHealth

## Team Members

Balu Thota, alone.

## Which track?

Indie Developer Track

## Which problem statement?

Build for Your World

## Most Viral Track: X post link (optional)

[link to your own post on X. Most engagement by 8 Nov, 11:59 PM ET wins.]

## Project Description (limit 3,000 characters)

```text
AuraHealth is a free Android app that helps a family understand health questions, act in the first minutes of an emergency, and follow a doctor's plan day by day. Everything was built during the hackathon, from 29 October. It is a research prototype: no clinician has reviewed it and no real patient has used it.

THE PROBLEM
4.5 billion people are not fully covered by essential health services (WHO and World Bank, 2023). When someone collapses at home in India, the nearest person is often untrained: Indian studies found bystanders started CPR in only 1.3% to 9.8% of cases. After the clinic, families forget medicines and advice, and nobody explains the report.

WHAT IT DOES
- Ask anything in everyday words. Meta's Muse Spark, through the Meta Model API, answers from the phone in seconds, with a next step and sources. It understands Hindi and Telugu mixes and replies in English.
- Works offline. Meta's open Muse Glimmer wrote 371 answers in advance for 207 health topics, shipped in the app. Emergency words, readings, common medicine questions and 17 Red Cross-based first-aid guides need no AI or internet.
- Call 112 shows only when it could really be an emergency, and the app never calls by itself. SOS is on every screen.
- Doctor's plan. Photograph the doctor's paper, and Muse Spark copies it into a plan: medicines, food, exercise, what to avoid. The family checks every line. Reminders ring on time and stop when the course ends.
- Today dashboard. Progress and "Day 12 of 30", also in the phone's status bar. A daily check-in records feeling, BP, sugar, temperature and weight, shown day by day, ready to send to the doctor.
- A guardian gets a text if a medicine is not marked taken.
- Reads a report photo line by line against its own ranges.
- Night guard (optional): knock three times, and if nobody taps "I'm OK", it phones and texts the people you chose.

HOW IT IS CHECKED
Every AI answer passes code checks: only sources it really retrieved; medicine amounts, start or stop directions, false comfort or a stated diagnosis are removed.
On 60 synthetic questions, moving from a free host to Muse Spark took the median from 35 s to 3.9 s, and all 60 were answered instead of 55, with no urgent one missed.
I tried to break it with 49 fresh emergency phrases. With no internet, word rules put Call 112 on top for only 22. With live Muse Spark, 47 got it, with 1 false alarm in 25 ordinary messages. These are my own checks on one phone, not clinical results: see QA_AND_EVALUATION.md.

TRY IT
No install: https://professor-200629.github.io/aurahealth/ . For live AI, enter this code on its home screen: [JUDGE CODE]
Android app: https://github.com/professor-200629/aurahealth/releases/latest/download/AuraHealth-prototype.apk (no key inside).
```

## Public GitHub Repository

https://github.com/professor-200629/aurahealth

## 3-Minute Demo Video

[YouTube link]

## Describe your use of Meta products to build the submitted project (limit 3,000 characters)

```text
AuraHealth uses two Meta models, each for what it does best.

1. MUSE SPARK 1.1, THROUGH THE META MODEL API: LIVE ANSWERS AND PHOTOS
For any question the app cannot answer by itself, the phone calls the Meta Model API's Responses endpoint, with JSON output and passages retrieved from a bundled pack of 208 MedlinePlus topics. No laptop or server of mine is needed. The model returns a direct answer, next step, warning signs and reasons, and code checks them before they show.
Its image input does two more jobs. It reads a report or medicine photo line by line against the report's own ranges. And it copies a photo of a doctor's advice into a care plan: medicines, times from notes like 1-0-1, food, exercise, what to avoid and how long, as written, for the family to check line by line before anything is saved. On one synthetic note this took about 5 seconds. For now, photos are for synthetic samples only.
I chose the version by testing. On 60 questions, Muse Spark 1.1 at low effort beat 1.3 at minimal effort: median 3.9 s against 4.8 s, and 112 of 113 expected concepts against 106. Muse Spark 1.3 at low effort took 8 to 12 s in a small test.

2. MUSE GLIMMER 30B (OPEN WEIGHTS, APACHE 2.0): ANSWERS THAT WORK OFFLINE
scripts/build_prepared.py gives Muse Glimmer each MedlinePlus topic and keeps 371 answers for 207 topics. Each passes the same code checks as a live answer. They ship inside the app, so common questions open in under a second with no internet. Muse Glimmer ran on NVIDIA's hosted copy, because it does not fit my laptop. With an NVIDIA key instead of a Meta key, the app also uses it for live answers, which took 27 to 72 s on one phone.

WHERE THE KEY STAYS
The Meta key is saved in the app's private storage on my phone, and on a small Vercel server (live-server/) that lets judges try live AI from the web demo with a code. That server has fixed prompts, rate limits and a stop date. The key is not in the repo or the public APK.

WHAT I DID NOT USE
I did not use Muse Code. The code was written with an AI coding assistant (Claude Code), as the commit history shows.
```

## Why are Meta's models important to your solution? (limit 3,000 characters)

```text
Two Meta models solve two different problems in this app.

SPEED CHANGED WHAT THE APP CAN DO
A scared person cannot wait a minute. On a free host, live answers took a median of 35 s, and 5 of 60 timed out. On the Meta Model API, Muse Spark answered all 60, with a median of 3.9 s and a slowest of 6.3 s.
That also changed safety. Word rules alone put Call 112 on top for 22 of 49 fresh emergency phrases. With live Muse Spark, 47 of 49 got Call 112, including Hindi and Telugu mixes the rules missed. All 7 fresh crisis messages got a Call 112 or crisis reply.
Speed also let me remove warnings. With the model deciding in seconds, ordinary questions no longer need a Call button "just in case": on the phone, 0 of 15 everyday questions mentioned 112, and all 3 emergencies tested still got it.

OPEN WEIGHTS KEEP IT WORKING
Families often have a poor network, and a health app should not depend on one company's service. Muse Glimmer's open weights let me write checked answers ahead of time and ship them in the app, so common questions open in under a second with no network. Under Apache 2.0, the same model can move to another host or my own servers, with nobody's permission.

TEXT AND IMAGES
Families hold paper, not typed numbers. Muse Spark read all 6 lines and flags on my sample report in about 5 seconds, and turned a sample doctor's note into a checkable 30-day plan with reminders, reading "1-0-1" as morning and night and keeping a once-a-week medicine weekly.

THE LIMITS
Two fresh emergencies still got no Call 112: "there is blood in what she coughed up" and "hot cooking oil went all over her chest". Longer answers score higher on my word checks partly for being longer, and no clinician has judged any of this.
```

## Provide feedback from your experience using partner technologies (limit 150 characters)

```text
Baseten and Modal credits had closed when I asked, so I used the Meta Model API and NVIDIA's free host. I can't review those partners.
```

## The judge code

Replace `[JUDGE CODE]` above with the code yourself, in the form only. Do not put the code in this public file or in the video.

## Rating questions and the permission box

These are the submitter's own opinions. The box gives Meta and Cerebral Valley permission to use, publish, share and promote the submitted materials.

## Honesty notes

Research prototype. Not approved or registered as a medical device. **No clinician has reviewed it and it has not been used by real patients.** Tested with fictional
people, on one phone (Samsung Galaxy A36). The word-check scores are not clinical performance. Telugu screens are an unreviewed draft. Asked
questions go to Meta, or to NVIDIA if an NVIDIA key is saved, and NVIDIA's trial terms let it use what is sent.

## What's next

A registered clinician's review, an AI service whose terms allow real users, native-speaker review of Telugu and Hindi, and an adviser's view
on Indian medical-device and telemedicine rules. See `LAUNCH_PLAN.md`.

## Before you submit (your actions)

- [x] Approve making the repository public, under the MIT License.
- [ ] Record the video from `DEMO_SCRIPT.md`.
- [ ] Post the demo on X yourself, and put the link in the form.
- [ ] Fill in the submission form yourself. Keep the repo public through judging.
