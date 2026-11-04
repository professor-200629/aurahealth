# Demo script (3 minutes)

Fictional people and synthetic samples only. Three phones: **Asha's** (the developer's Galaxy A36 with the
AuraHealth app), **Ravi's** (the neighbour, a borrowed phone) and **Kiran's** (her son, a borrowed phone).
Talk to Aura uses **Meta Muse Glimmer** (Meta open weights) from the phone through NVIDIA's free hosted API, so it needs the
phone's internet and no laptop. The guide finder, report reader and card use the laptop server.

Opening line (organizers ask for it): *"Everything shown was built during the hackathon, from 29 October."*

Why a stroke and not a cardiac arrest for the night scene: a person in cardiac arrest cannot knock. Someone
having a stroke or lying after a fall is often awake but cannot reach or use the phone. For stroke, the time she
was **last seen well** decides treatment (clot-busting treatment is given within 4.5 h of last known well).

## Before recording

- Asha's phone: AuraHealth installed (`android\build-apk.ps1`), contacts set (Ravi = neighbour, Kiran = family),
  battery saving off for AuraHealth, volume up. Night guard **on**; morning check on.
- Laptop: server running in the Terminal panel (`uv run aurahealth --lan`), Asha's phone paired to it.
- Kiran knows a test SMS is coming. Ravi answers the call on speaker.
- Practice the knock (3 sharp knocks on the bedside table, within 3 seconds).

## Script

| Time | Screen / action | Say |
| --- | --- | --- |
| 0:00 | Title card | "Everything shown was built during the hackathon. AuraHealth: the first hour at home." |
| 0:05 | Numbers on screen (sources in README) | "When someone collapses at home in India, almost nobody nearby starts CPR: 1 to 10 out of 100. Ambulances are often late. For a stroke, every minute counts." |
| 0:20 | Asha's phone, evening: taps **Good night**; Night guard on | "Asha is 72 and lives alone. At 22:40 she says good night. The night guard listens for three knocks. The sound never leaves the phone." |
| 0:35 | 02:14, dark room. Asha can't speak properly; she **knocks 3 times** | "At 2 a.m. she can't speak and one arm is weak. She can't reach the phone, but she can knock." |
| 0:45 | Alarm + full-screen **"Are you OK?"** 30-second countdown | "If she is fine, one tap stops it. Nobody taps." |
| 0:55 | Ravi's phone **rings** (auto-call). Kiran's phone gets the **SMS** | "AuraHealth phones the neighbour by itself and texts her son. It can't call 112 itself; Android doesn't allow that, so the big button opens the dialer." |
| 1:10 | Ravi arrives, taps **First aid now** → **Not sure which one? Describe what you see** → types *"she can't speak properly and her face is drooping"* | "Ravi isn't trained. He just types what he sees." |
| 1:20 | Muse Glimmer suggests **Signs of a stroke** and shows his words | "Meta's Muse Glimmer can only point to one of 7 fixed guides adapted from Red Cross guidelines, and must quote his own words. Code checks both. It doesn't say what illness she has; he chooses." |
| 1:35 | Stroke guide: steps read aloud; Ravi taps each step; **Call 112** | "Each step is read aloud, one at a time, and saved with the time." |
| 1:55 | (Optional, 15 s) Witnessed-collapse cut: **Start here** → no response → not breathing → **CPR** with the 110-per-minute beat | "If someone collapses in front of you, two questions lead to CPR, with a beat to follow." |
| 2:10 | **Handoff card** on the phone / laptop | "When the ambulance arrives, the card says: last seen well 22:40, knock alert 02:14, Ravi phoned 02:15, son texted, each step and its time, her medicines and allergies, and what is unknown." |
| 2:25 | Earlier clip: medicine strip photo → **Read it with Meta Muse Glimmer** → fields → person confirms | "Her medicines were read from the strip by Muse Glimmer earlier, and she confirmed every field." |
| 2:30 | Next day. Kiran on the Home screen types *"her hba1c is 7.5"* → answer, next step, **Why, and sources** → opens the source | "On ordinary days the family can just ask. Aura answers directly, with a next step and sources it really found. Code checks every AI answer before it shows." |
| 2:40 | Morning check setting | "And if she can't even knock: no 'good morning' by 9, the same alert runs." |
| 2:48 | Closing card | "SOS, emergency answers and the first-aid steps kept working when we turned the internet off. The AI uses Meta's open Muse Glimmer. It's a prototype: no clinician has reviewed it yet, and it was tested on one phone." |

## Honesty rules for the video

- Say **"prototype"**, show the "not approved or registered as a medical device" line once.
- Do not say "doctor", "triage" or "diagnosis" about AuraHealth.
- Only show numbers from `EVALUATION.md` (guide finder, reader) and the README's sourced facts.
- The AI can take over a minute on the free service: trim the wait in the video and say so. If a live AI call is slow or fails while recording, show the saved MedlinePlus answer or the guide list, and say why.
- Real calls and texts in the video go only to people who agreed in advance. Never call 112 for the demo.
