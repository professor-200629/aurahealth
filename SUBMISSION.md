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
AuraHealth is a free Android app that helps a family understand health questions and act in the first minutes of an emergency at home. Everything was built during the hackathon, from 29 October. It is a research prototype: no clinician has reviewed it and no real patient has used it.

THE PROBLEM
When someone collapses at home in India, the nearest person is often untrained, alone and scared. Indian studies found bystanders started CPR in only 1.3% to 9.8% of cases. On ordinary days, families get a report, a number or a symptom and have nobody to explain it.

WHAT IT DOES
- Ask in everyday words. "His HbA1c is 7.5" or "loose motions since yesterday" gets a direct answer, a next step, warning signs and sources you can open.
- Live answers in seconds. Meta's Muse Spark, through the Meta Model API, answers from MedlinePlus passages, called from the phone itself.
- Instant answers, even offline. Meta's open Muse Glimmer wrote 371 answers in advance for 207 health topics from MedlinePlus, and code checked each one. They open in under a second and say they were written in advance.
- Emergency words, readings (temperature, BP, sugar, HbA1c, oxygen), common medicine questions and first-aid steps are answered on the phone, with no AI and no internet.
- Reads a photo of a report or medicine. Muse Spark reads each line, flags it against the report's own range and says what it measures.
- SOS on every screen. It takes a second tap, and the app never calls 112 by itself.
- 17 first-aid guides adapted from the Red Cross (IFRC 2020), read aloud step by step and saved with the time, which become a handoff record for the ambulance crew.
- Medicine reminders that text a chosen guardian if a dose is not marked taken, and an optional night guard: knock three times, and if nobody taps "I'm OK", it phones and texts the people you chose.

HOW IT IS CHECKED
Every AI answer passes code checks before it shows: only sources it really retrieved; sentences with medicine amounts, start or stop directions, false comfort or a stated diagnosis are removed; Call 112 is forced on emergency words.
On 60 synthetic questions, moving live answers from a free host to Muse Spark took the median from 35 s to 3.9 s, and all 60 were answered instead of 55. No urgent question missed its Call 112.
I also tried to break it with 49 fresh emergency phrases never used for tuning. With no internet, word rules put Call 112 on top for only 22, and the others get a softer Call button. With live Muse Spark, 47 of 49 got Call 112, with 1 false alarm in 25 ordinary messages. These are my own automatic checks, not clinical results. What has and has not been run is in QA_AND_EVALUATION.md.

TRY IT
No install and no key: https://professor-200629.github.io/aurahealth/ (this web demo has no live AI).
Android app: https://github.com/professor-200629/aurahealth/releases/latest/download/AuraHealth-prototype.apk (no key inside; live AI needs your own key).
```

## Public GitHub Repository

https://github.com/professor-200629/aurahealth

## 3-Minute Demo Video

[YouTube link]

## Describe your use of Meta products to build the submitted project (limit 3,000 characters)

```text
AuraHealth uses two Meta models, each for what it does best.

1. MUSE SPARK 1.1, THROUGH THE META MODEL API: LIVE ANSWERS AND PHOTOS
For anything personal, the phone itself calls the Meta Model API's Responses endpoint, with JSON output and passages retrieved from a bundled pack of 208 MedlinePlus topics. No laptop or server of mine is needed. The model returns a direct answer, next step, warning signs and reasons, and code checks them before they show. Its image input also reads a report or medicine photo line by line and flags values against the report's own range. For now, photos are for synthetic samples only.
I chose the version by testing. On 60 questions, Muse Spark 1.1 at low effort beat 1.3 at minimal effort: median 3.9 s against 4.8 s, and 112 of 113 expected concepts against 106. Muse Spark 1.3 at low effort took 8 to 12 s in a small test.

2. MUSE GLIMMER 30B (OPEN WEIGHTS, APACHE 2.0): ANSWERS THAT WORK OFFLINE
scripts/build_prepared.py gives Muse Glimmer each MedlinePlus topic and keeps 371 answers for 207 topics. Each passes the same code checks as a live answer. They ship inside the app, so common questions open in under a second with no internet. Muse Glimmer ran on NVIDIA's hosted copy, because it does not fit my laptop. With an NVIDIA key instead of a Meta key, the app also uses it for live answers, which took 27 to 72 s on one phone.

WHERE THE KEY STAYS
The Meta key is saved only in the app's private storage on the phone. It is not in the repo or the public APK, so the public builds have no live AI unless you add your own key.

WHAT I DID NOT USE
I did not use Muse Code. The code was written with an AI coding assistant (Claude Code), as the commit history shows.
```

## Why are Meta's models important to your solution? (limit 3,000 characters)

```text
Two Meta models solve two different problems in this app.

SPEED CHANGED WHAT THE APP CAN DO
A scared person cannot wait a minute. On a free host, live answers took a median of 35 s, and 5 of 60 timed out. On the Meta Model API, Muse Spark answered all 60, with a median of 3.9 s and a slowest of 6.5 s.
That also changed safety. Word rules alone put Call 112 on top for 22 of 49 fresh emergency phrases. With live Muse Spark, 47 of 49 got Call 112, including Hindi and Telugu mixes the rules missed. All 7 fresh crisis messages got a Call 112 or crisis reply.

OPEN WEIGHTS KEEP IT WORKING
Families often have a poor network, and a health app should not depend on one company's service. Muse Glimmer's open weights let me write checked answers ahead of time and ship them in the app, so common questions open in under a second with no network. Under Apache 2.0, the same model can move to another host or my own servers, with nobody's permission.

TEXT AND IMAGES
Families often hold a paper report, not typed numbers. Muse Spark read all 6 lines and flags on my sample report in about 5 seconds, and its explanation goes through the same checks.

THE LIMITS
Two fresh emergencies still got no Call 112: "there is blood in what she coughed up" and "hot cooking oil went all over her chest". Longer answers score higher on my word checks partly for being longer, and no clinician has judged any of this.
```

## Provide feedback from your experience using partner technologies (limit 150 characters)

```text
Baseten and Modal credits had closed when I asked, so I used the Meta Model API and NVIDIA's free host. I can't review those partners.
```

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
