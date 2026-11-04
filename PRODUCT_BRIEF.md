# AuraHealth product brief

Draft of 4 Nov 2026. AuraHealth is a research prototype. No clinician has reviewed it and it has had no real users.

**Promise:** AuraHealth helps you understand health information, prepare for care and involve the people you choose.

**First users:** adults and consenting family caregivers in a supervised India pilot, in English first. Telugu screens exist as an
unreviewed draft (labelled in the app); Telugu and Hindi answers are not offered. Children, pregnancy and older adults get
general information and a push to get care, with no individual dosing.

## What it does now

| Need | What AuraHealth does | Limits |
| --- | --- | --- |
| Understand a health question | Direct answer, next step, warning signs, reasons and sources | AI-written and needs internet and a saved key; word checks only; sources are US-written |
| Understand a number | Temperature, BP, sugar, oxygen answered on the phone with fixed thresholds | No personal targets |
| Emergency | SOS sheet, Call 112, 17 first-aid guides read aloud, location share | Opening the dialer is not a call being answered. No dispatch |
| Follow a care plan | Medicine reminders; a guardian is texted if a dose is not marked taken | "Not marked taken" does not mean it was not taken |
| Family | Health cards, chosen contacts | Saved on this phone, with no cloud account. Texts and calls reach the chosen contacts |
| Night guard (off by default) | Knock 3 times: if nobody taps "I'm OK", it phones and texts chosen contacts | Listens through the microphone while on. See `CLINICAL_SAFETY.md` |

## Not offered

Diagnosis, doses, starting or stopping medicines, reading scans, ECGs or skin photos, automatic ambulance dispatch, silent heart
attack or stroke detection, or any claim that it saved a life. "Available in many countries" is not offered either: only India's
emergency details have been checked, and the country choice is India only.

## What is different

- The answer comes first, then the next step and the warning signs, in everyday Indian English ("sugar", "BP", "motions").
- Emergencies, readings and first aid are answered by the phone itself, with no AI. See `QA_AND_EVALUATION.md` for what has been run with internet off.
- Sources come from a bundled MedlinePlus pack that no clinician has reviewed. They are never written by the model.
- The product states what has and has not been tested or reviewed.

## Pilot hypotheses (to measure, not claims)

1. Caregivers can say the correct next step after reading an answer, at a rate agreed with a clinician first.
2. Reviewing clinicians find fewer unsafe or useless answers than in the earlier version, on the same cases.
3. A first-time user reaches Call 112 within a time agreed in advance, including under stress in a simulation.
4. Reminders arrive on time on the real pilot phones, including after a restart and with battery saving on.

## Free to use, and sustainable

Keep it free for families, with no selling of health data and no paid ranking of care options. Possible support: grants, or clinic and
NGO partnerships. See `LAUNCH_PLAN.md`, including the blocker that the current free AI service is for trial use only.
