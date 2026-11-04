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
- Instant answers, even offline. Meta's Muse Glimmer wrote 371 answers in advance for 207 health topics from MedlinePlus, and code checked each one. They open in under a second and say they were written in advance. For anything personal, the live model adds an answer for that situation.
- Emergency words, readings (temperature, BP, sugar, HbA1c, oxygen), common medicine questions and first-aid steps are answered on the phone, with no AI and no internet.
- Reads a photo of a report or medicine. Muse Glimmer reads each line on the phone, flags it against the report's own range and says what it measures.
- SOS on every screen. It takes a second tap, and the app never calls 112 by itself.
- 17 first-aid guides adapted from the Red Cross (IFRC 2020), read aloud step by step and saved with the time, which become a handoff record for the ambulance crew.
- Medicine reminders that text a chosen guardian if a dose is not marked taken, and an optional night guard: knock three times, and if nobody taps "I'm OK", it phones and texts the people you chose.

HOW IT IS CHECKED
Every AI answer passes code checks before it shows: only sources it really retrieved; sentences with medicine amounts, start or stop directions, false comfort or a stated diagnosis are removed; Call 112 is forced on emergency words.
On 60 synthetic questions, before and after my rebuild, refusals to explain fell from 6 to 0, answers with a source rose from 0 to 38 of 55, and no urgent question that was answered missed its Call 112. Live answers got slower, and 5 of 60 timed out on the free service.
I also tried to break it. The word rules that work without AI caught only 22 of 49 fresh emergency phrases, so a Call button stays in view while the AI thinks and whenever it fails. These are my own automatic checks on one phone, not clinical results. What has and has not been run is in QA_AND_EVALUATION.md.

TRY IT
No install and no key: https://professor-200629.github.io/aurahealth/ (this web demo has no live AI).
Android app: https://github.com/professor-200629/aurahealth/releases/latest/download/AuraHealth-prototype.apk (no key inside; live AI needs your own free NVIDIA key).
```

## Public GitHub Repository

https://github.com/professor-200629/aurahealth

## 3-Minute Demo Video

[YouTube link]

## Describe your use of Meta products to build the submitted project (limit 3,000 characters)

```text
Meta Muse Glimmer 30B (open weights, Apache 2.0) is the only AI model in AuraHealth. It does three jobs.

1. ANSWERS WRITTEN IN ADVANCE
scripts/build_prepared.py gives Muse Glimmer each MedlinePlus topic and keeps 371 answers for 207 topics. Each passes the same code checks as a live answer. They ship inside the app, so common questions open in under a second with no internet.

2. LIVE ANSWERS
For anything personal, the phone calls Muse Glimmer over its own internet, with JSON output and passages retrieved from a bundled pack of 208 MedlinePlus topics. The model returns a direct answer, next step, warning signs and reasons, and code checks them before they show.

3. READING PHOTOS
Muse Glimmer's image input reads a report or medicine photo on the phone, line by line, and flags values against the report's own range. For now this is for synthetic samples only, because photos go to the AI host.

WHERE IT RUNS
On NVIDIA's free hosted API (meta/muse-glimmer-30b). No laptop or server of mine is needed. The free service took 27 to 72 seconds per live answer on one phone, which is why I rebuilt the app so that nothing important waits for it. NVIDIA's free terms are for trials, so a real launch needs a paid host or self-hosting.

WHAT I DID NOT USE
The $150 Meta Model API credits are on my account, but my card's verification hold failed, so the app does not call the Meta Model API. I did not use Muse Code. The code was written with an AI coding assistant (Claude Code), as the commit history shows.
```

## Why are Meta's models important to your solution? (limit 3,000 characters)

```text
Muse Glimmer fits this app in three ways.

OPEN WEIGHTS
A family health app should not depend on one company's service staying cheap and available. Under Apache 2.0, the same model can move to a paid host or to my own servers, with nobody's permission. That also keeps a path open to controlling where people's health questions go, which matters more here than in most apps.

TEXT AND IMAGES IN ONE MODEL
Families often hold a paper report, not typed numbers. The same 30B model answers questions and reads photos, so the app needs one prompt style and one set of checks.

IT CAN WRITE AHEAD OF TIME
The free service can take over a minute, and a scared person cannot wait. So Muse Glimmer writes clear answers in advance from a trusted source, code checks them, and they ship in the app. The model's quality reaches someone in under a second, even with no network, while the live model handles what is personal.

It also changed the quality of the answers. When I stopped forcing short replies and gave Muse Glimmer MedlinePlus passages, expected concepts rose from 85% to 99% on 60 synthetic questions, and refusals to explain fell from 6 to 0. Longer answers score higher partly for being longer, and no clinician has judged them, but "His HbA1c is 7.5" went from "only his doctor can explain" to an answer a family can use, with a next step and a source.
```

## Provide feedback from your experience using partner technologies (limit 150 characters)

```text
Baseten and Modal credits had closed when I asked, so I ran Muse Glimmer on NVIDIA's free API. I can't review those partners.
```

## Rating questions and the permission box

These are the submitter's own opinions. The box gives Meta and Cerebral Valley permission to use, publish, share and promote the submitted materials.

## Honesty notes

Research prototype. Not approved or registered as a medical device. **No clinician has reviewed it and it has not been used by real patients.** Tested with fictional
people, on one phone (Samsung Galaxy A36). The word-check scores are not clinical performance. Telugu screens are an unreviewed draft. Asked
questions go to NVIDIA, whose trial terms let it use what is sent.

## What's next

A registered clinician's review, an AI service whose terms allow real users, native-speaker review of Telugu and Hindi, and an adviser's view
on Indian medical-device and telemedicine rules. See `LAUNCH_PLAN.md`.

## Before you submit (your actions)

- [x] Approve making the repository public, under the MIT License.
- [ ] Record the video from `DEMO_SCRIPT.md`.
- [ ] Post the demo on X yourself, and put the link in the form.
- [ ] Fill in the submission form yourself. Keep the repo public through judging.
