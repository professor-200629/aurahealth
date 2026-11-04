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
- Put `SAMPLE_DATA/reports/ranges_report.png` and `SAMPLE_DATA/reports/doctor_note.png` on the phone, so you can pick them. Keep your own photos out of the shot.
- Turn on Do Not Disturb for other apps' notifications, but test that AuraHealth's reminder still shows. Remove sample days after filming.
- Practise the knock: 3 sharp knocks on the bedside table, within 3 seconds.
- With the Meta key saved on the phone, live answers take seconds. Record them uncut. Never show the key on screen.
- Screen-record the phone for the app parts, and film the phone with another camera for the knock and the ringing.

## Script

| Time | Screen / action | Say |
| --- | --- | --- |
| 0:00 | Title card | "AuraHealth. Everything shown was built during the hackathon, with Meta's Muse Spark and open Muse Glimmer." |
| 0:06 | Numbers on screen (sources in README) | "4.5 billion people are not fully covered by essential health services. In India, when someone collapses at home, bystanders start CPR in only 1 to 10 cases out of 100." |
| 0:17 | Taps **Good night**, Night guard on | "Asha is 72 and lives alone. At night, the guard listens for three knocks. The sound never leaves the phone." |
| 0:25 | Dark room. She **knocks 3 times**. Alarm, **"Are you OK?"** countdown. Nobody taps | "One arm is weak and she can't speak. She can't reach the phone, but she can knock." |
| 0:37 | Ravi's phone **rings**. Kiran's phone gets the **text** | "AuraHealth phones the neighbour and texts her son by itself. It never calls 112 by itself: that's one tap." |
| 0:47 | Ravi types in the Home box: *"her face is drooping and she can't speak properly"*. **Answer at once**, Call 112 on top, stroke guide read aloud | "Emergency words get an answer at once, with no AI and no internet. Each step is read aloud and saved with the time, for the ambulance crew." |
| 1:02 | Types the Telugu mix *"tata padipoyaru lechi matladatledu"*. Call 112 in seconds | "Word rules miss many real emergencies, in many languages. Muse Spark, through the Meta Model API, catches them in about four seconds." |
| 1:13 | Asks *"my son has a cold"*, then *"can I eat curd at night"*. Good answers, no 112 | "And for ordinary questions it just answers, like a friend who knows, without shouting 'call 112'. Common ones even work offline, because Muse Glimmer wrote them in advance." |
| 1:28 | **Today** tab → **Add from a photo of the doctor's paper**, pick `doctor_note.png`. The plan appears in seconds. Scroll the lines | "After the clinic, families forget what the doctor said. Photograph the paper, and Muse Spark copies it into a plan: medicines, food, exercise, what to avoid. You check every line. It never adds anything." |
| 1:50 | Save. Reminder rings, tap **Done**. Show the status bar progress | "Reminders ring on time, stop when the course ends, and the day's progress stays in the status bar. If a dose isn't marked taken, the guardian gets a text." |
| 2:05 | Tap **See sample days** (the banner says made up). Day 12 of 30, 14-day chart, how she felt, BP and sugar. Tap **Send this record** | "These are sample days, to show what it looks like after two weeks: daily progress, how she felt, and her readings, ready to send to the doctor." |
| 2:22 | **Read a report or medicine photo**, sample report. Lines with high and low flags | "It also reads a report, line by line, against the lab's own range." |
| 2:32 | Eval numbers on screen: 35 s to 3.9 s, then 22 of 49 to 47 of 49 | "We measured it, and tried to break it. On 49 fresh emergency phrases, word rules alone caught 22. With live Muse Spark, 47. It's a prototype: no clinician has reviewed it yet, and it was tested on one phone." |
| 2:48 | SOS button, then an end card with the repo and web demo links. Do not show the judge code | "SOS is on every screen, even offline. Next: a doctor's review, and a pilot with families. You can try it now at this link." |

**If you have one phone:** at 0:50, use the night guard's **test** mode, which rings no one, and show its alert screen. Say: "In a real alert it phones the neighbour and texts the family."

## Honesty rules for the video

- Say **"prototype"**, and show the "not approved or registered as a medical device" line once.
- Do not call AuraHealth a doctor, and do not say it diagnoses.
- Only show numbers from `QA_AND_EVALUATION.md` and the README's sourced facts.
- If you trim an AI wait in the edit, say so on screen. Do not imply the free service is instant.
- Real calls and texts in the video go only to people who agreed in advance. Never call 112 for the demo.
