# Submission draft (Meta Global AI Developer Hackathon, indie track)

Deadline: **4 Nov 2026, 9:00 PM EST = 5 Nov 2026, 07:30 IST.** Check every claim against `QA_AND_EVALUATION.md` and
`EVALUATION.md` before pasting. Replace the `[…]` parts yourself.

## Name

AuraHealth

## One line

A free Android app that helps families understand health information, act in the first minutes of an emergency and look after each
other at home, using Meta's open Muse Glimmer model, with the emergency path working without AI or internet.

## The problem

When someone collapses or falls at home, the nearest person is often untrained, alone and scared. On ordinary days, families get a
report, a number or a symptom and have nobody to explain it. Most apps either answer vaguely or sound more certain than they should.

## What it does

- **Ask anything, in everyday words.** "His HbA1c is 7.5", "loose motions since yesterday". Aura answers directly, then gives the next
  step, the warning signs, its reasons and sources you can open.
- **Answers that work without AI.** Emergency words, readings (temperature, BP, sugar, oxygen) and first-aid steps are answered on the
  phone at once. If the AI is slow or down, it shows MedlinePlus's own words from the phone and says so.
- **SOS on every screen.** It opens Call 112, location sharing and the health card to read aloud. It takes a second tap, so a pocket press
  calls nobody, and the app never calls 112 by itself.
- **17 first-aid guides** adapted from the Red Cross (IFRC 2020) and read aloud step by step.
- **Medicine reminders** that text a chosen guardian if a dose is not marked taken.
- **Night guard (optional).** Knock three times: if nobody taps "I'm OK", it phones and texts the people you chose.
- **Handoff card** with a timed record for the doctor or the ambulance crew (needs the optional laptop server).

## How we built it

Android (Java WebView), React + TypeScript, with a FastAPI server for the optional laptop features (handoff card, guide finder, report reader). With an
NVIDIA API key saved in the app, the phone calls Muse Glimmer directly. Every AI answer goes through code checks before it is shown: only sources it really
retrieved, sentences with medicine amounts, directions to start or stop a medicine, reassurance or a stated diagnosis removed, and Call 112 forced on
emergency words. Fixed answers and MedlinePlus's own sentences are shown as written. The checks are word patterns and they can miss things.
Sources come from a bundled pack of 156 MedlinePlus topic summaries, plus everyday Indian English, Hindi and Telugu words.

## Meta tools used

**Meta Muse Glimmer 30B** (open weights, Apache 2.0), hosted by NVIDIA, for Talk to Aura, the guide finder and the report reader.

## Evidence

On 60 synthetic questions, same model, before and after the rebuild: refusals to explain fell from 6 to 0, answers with a source rose from 0 to 38 of 55, and no urgent
question that was answered missed its Call 112. Answers got slower (median 19 s to 35 s) and 5 of 60 timed out on the free API. The scores are automatic word checks written
by us, and longer answers score higher partly for being longer.

The word rules that work without AI caught 220 of 221 plain-English phrases they were tuned on, but only **22 of 49 fresh phrases**. So they are not the only safety net: the
AI is also told to escalate, SOS is on every screen, and a Call button shows while the AI is thinking and whenever it fails.

On one phone (Galaxy A36), real AI answers took 27 to 72 s. With Airplane mode on, emergency answers, readings, SOS and the first-aid guides kept working, and a message the
rules missed got a Call button but no first-aid steps.

No clinician or real user has judged any of this. See `QA_AND_EVALUATION.md`.

## Challenges

- Comparing with another health app showed our answers felt less useful. The first version was vague: its rules forced three short sentences, and
  a filter mistook "mg/dL" for a medicine dose. We rebuilt the answers and measured the same 60 questions before and after.
- Our own review broke the rules: "has taken thirty sleeping tablets" got a reminder message, and an age was read as a blood sugar. Fresh test phrases showed that word rules miss about half of emergencies in new wording, which changed the design.
- The free AI service can take over a minute, so nothing important waits for it.
- Testing on a real phone found what the browser did not: the Call button was hidden behind the typing box.

## What's next

A registered clinician's review, an AI service whose terms allow real users, native-speaker review of Telugu and Hindi, and an adviser's view
on Indian medical-device and telemedicine rules. See `LAUNCH_PLAN.md`.

## Honesty notes to include

Research prototype. Not approved or registered as a medical device. **No clinician has reviewed it and it has not been used by real patients.** Tested with fictional
people, on one phone (Samsung Galaxy A36). The word-check scores are not clinical performance. Telugu screens are an unreviewed draft. Asked
questions go to NVIDIA, whose trial terms let it use what is sent.

## Links

- Code: [repo link, once you approve making it public; the hackathon requires a public repo]
- Video: [link]

## Before you submit (your actions)

- [ ] Approve making the repository public, and choose a license.
- [ ] Record the video from `DEMO_SCRIPT.md`.
- [ ] Fill in the submission form yourself.
