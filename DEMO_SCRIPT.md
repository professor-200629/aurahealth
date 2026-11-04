# Demo script (3 minutes)

Fictional people and synthetic samples only. **Everything runs on the phone. No laptop in the video.**
You need the Galaxy A36 with the app. A second phone that rings on camera is much stronger, but "If you have one phone" below works too.

Say near the start, as the organizers ask: *"Everything shown was built during the hackathon, from 29 October."*

Why a stroke and not a cardiac arrest for the night scene: a person in cardiac arrest cannot knock. Someone having a stroke or lying
after a fall is often awake but cannot reach or use the phone. For a stroke, the time she was **last seen well** decides treatment.

## Before recording

- Phone: this build installed, volume up, Do Not Disturb off, battery saving off for AuraHealth.
- **Family & health:** add a fictional Asha (72, diabetes, allergic to penicillin, a made-up medicine). Contacts: Ravi (phone in an alert), Kiran (text in an alert). Use numbers of people who agreed, and tell them a test is coming.
- **Clear the chat** and the old handoff record, so that the screens are clean.
- Put `SAMPLE_DATA/reports/ranges_report.png` on the phone, so you can pick it. Keep your own photos out of the shot.
- Practise the knock: 3 sharp knocks on the bedside table, within 3 seconds.
- If the OpenRouter key is saved, live answers take seconds. If not, trim the wait in the edit and say so on screen.
- Screen-record the phone for the app parts, and film the phone with another camera for the knock and the ringing.

## Script

| Time | Screen / action | Say |
| --- | --- | --- |
| 0:00 | Title card | "AuraHealth: the first hour at home. Everything shown was built during the hackathon, on this phone, with Meta's open Muse Glimmer." |
| 0:08 | Numbers on screen (sources in README) | "When someone collapses at home in India, almost nobody nearby starts CPR: 1 to 10 out of 100. Ambulances are often late. For a stroke, every minute counts." |
| 0:20 | Taps **Good night**, Night guard on | "Asha is 72 and lives alone. At 22:40 she says good night. The night guard listens for three knocks. The sound never leaves the phone." |
| 0:32 | Dark room. She **knocks 3 times** | "At 2 a.m. one arm is weak and she can't speak properly. She can't reach the phone, but she can knock." |
| 0:40 | Alarm, full-screen **"Are you OK?"** countdown | "If she is fine, one tap stops it. Nobody taps." |
| 0:50 | Ravi's phone **rings**. Kiran's phone gets the **text** with the location | "AuraHealth phones the neighbour and texts her son by itself. It never calls 112 by itself: that's one tap, on a button that's always there." |
| 1:02 | Ravi arrives, types in the Home box: *"her face is drooping and she can't speak properly"*. **Answer in under a second**, Call 112 on top, stroke guide | "Ravi isn't trained. He types what he sees. Emergency words get an answer at once, on the phone, with no AI and no internet." |
| 1:15 | Opens the guide: steps read aloud, taps each one | "Each step is read aloud and saved with the time." |
| 1:30 | Menu → **Handoff card**: the times, her medicines and allergies | "When help arrives, it's all here: last seen well, the knock, the call, every step and its time. He can read it aloud or send it." |
| 1:45 | Next day. Taps the example **Loose motions since yesterday**, then **His HbA1c is 7.5**. Instant answers | "On ordinary days the family can just ask, in everyday words. Common questions open instantly, because Muse Glimmer wrote and checked them in advance, from MedlinePlus. It works offline too." |
| 2:02 | Types a personal question. Live Muse Glimmer adds **For your situation**, with a next step | "For anything personal, the live model adds to it. Code checks every AI answer: no doses, no stated diagnosis, no false comfort, and only sources it really found." |
| 2:15 | **Read a report or medicine photo**, picks the sample. Lines appear with high and low flags and what each means | "Muse Glimmer reads a report or a medicine strip right on the phone, and explains each line against the lab's own range." |
| 2:30 | Eval numbers on screen from `QA_AND_EVALUATION.md`, including 22 of 49 | "We measured it, and tried to break it. Word rules caught only 22 of 49 fresh emergency phrases. So there's always a Call button while the AI thinks, and SOS on every screen." |
| 2:45 | **SOS** button, then Airplane-mode clip, then an end card with the repo and web demo links | "SOS and first aid kept working with the internet off. It's a prototype: no clinician has reviewed it yet, and it was tested on one phone. Next: a doctor's review, and a pilot with families. You can try it now at this link, with no install." |

**If you have one phone:** at 0:50, use the night guard's **test** mode, which rings no one, and show its alert screen. Say: "In a real alert it phones the neighbour and texts the family."

## Honesty rules for the video

- Say **"prototype"**, and show the "not approved or registered as a medical device" line once.
- Do not call AuraHealth a doctor, and do not say it diagnoses.
- Only show numbers from `QA_AND_EVALUATION.md` and the README's sourced facts.
- If you trim an AI wait in the edit, say so on screen. Do not imply the free service is instant.
- Real calls and texts in the video go only to people who agreed in advance. Never call 112 for the demo.
