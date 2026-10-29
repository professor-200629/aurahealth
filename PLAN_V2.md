# AuraHealth v2 plan: "the first hour" (agreed 29 Oct 2026, not built yet)

Deadline: 5 Nov 2026, 07:30 IST. Nothing in this file is done unless `CHECKLIST.md` says so.

## Pitch (no "doctor", no "triage", no "diagnosis")

When someone collapses at home, the ambulance is 20–30 minutes away. AuraHealth turns the nearest person
into a first responder: it alerts family and neighbours, speaks Red Cross first-aid steps out loud, and hands
the doctor a timed record, even without internet.

Why the wording matters: Meta's Llama 3.2 use policy forbids "the unauthorized or unlicensed practice of any
profession including ... medical/health". AuraHealth never diagnoses; first-aid steps are fixed text from the
IFRC 2020 guidelines; the model only picks which guide matches and reads documents, and a person confirms.

## The one demo story (3 minutes)

1. Night. "Asha" (fictional, 72) lives alone. She tapped "Good night" at 22:40. Phone is on the bedside table,
   Night guard on.
2. 02:14 she can't speak; she knocks 3 times on the table. Phone: loud "Are you OK? Tap to cancel" countdown.
3. No answer: the phone **calls the neighbour automatically** and alerts her son. Its screen shows a huge
   "Call 112" button and "Tap here to help her".
4. The neighbour arrives, taps "Help her", says or picks what they see ("not answering, not breathing
   normally") → the CPR guide (user confirms) → steps read aloud in Hindi or English, a 110-per-minute beat,
   every step time-stamped.
5. The ambulance arrives: the handoff card shows last seen well 22:40, knock alert 02:14, neighbour called
   02:15, CPR started 02:19, her medicines (read from the strip photos by Llama Vision, confirmed by her
   earlier), allergies, unknowns.
6. Her son (abroad) gets the same card.

## What exists vs what is new

| Piece | Status |
| --- | --- |
| Handoff card with provenance, unknowns, delete, pairing | built, tested on a real phone |
| Llama 3.2 3B exact-words splitter | built, measured |
| Llama 3.2 Vision reader | code built; model not installed (he pulls 30 Oct) |
| First-aid step player (IFRC cards, read aloud, CPR beat, time log) | new |
| Android app shell (WebView + native calls, SMS, mic service) | new |
| Night guard (knock pattern, countdown, auto-call neighbour, alert son) | new |
| Good-night / good-morning check-ins ("last seen well") | new |
| Medicine list from strip photos + daily tick + weekly chart + missed-dose alert | new |
| Language | **English only** for v2 (his decision 29 Oct). Telugu UI stays as the labelled unreviewed draft; no Hindi. |

## Architecture

- **Phone (Android, native Kotlin app):** the emergency path works on the phone alone, with no laptop and no
  internet: night guard, countdown, auto-call to the neighbour (normal number; apps cannot call 112 by
  themselves), alert to the son, the 112 dialer button, first-aid cards (bundled text), time log, the card.
  The UI is the existing React app bundled into the APK and shown in a WebView, with a small native bridge.
- **Home AI hub (the laptop, same Wi-Fi):** Llama 3.2 3B (pick the matching guide from the person's words,
  English/Hindi) and Llama 3.2 Vision (read medicine strips). If the hub is unreachable, the person picks the
  guide from a list and types medicines.
- Optional later: Meta API online for speed when internet is there; Llama on the phone itself.

## First-aid guides for v2 (IFRC 2020, non-commercial use with credit)

1. Unresponsive, not breathing normally → CPR (100–120 compressions per minute, about 5 cm deep; IFRC p134)
2. Unresponsive, breathing normally → recovery position
3. Choking
4. Severe bleeding (direct pressure; tourniquet only if pressure fails on a limb; IFRC p187)
5. Stroke signs (FAST; no oxygen; IFRC p271)
6. Chest pain (call 112, rest, help with their own prescribed medicine; IFRC p264). **No aspirin step in v2**
   (medicine dosing is left to 112 and doctors).
7. Snakebite (keep still, immobilise, carry; no tourniquet, cutting, suction, ice; IFRC p254)
8. Seizure (protect from injury; check breathing after; IFRC p295)

Each guide: short steps adapted from IFRC "key actions", credited, labelled "adapted, not reviewed by a
clinician" until the doctor review happens.

## Day plan

| Day | Work |
| --- | --- |
| 30 Oct | Guide content (8 guides, English + Hindi draft); step player with read-aloud, CPR beat, time log; card timeline. He pulls the vision model; run `eval_reader.py`. |
| 31 Oct | Android app: WebView with the bundled app, native bridge (dial 112, auto-call contact, SMS), contacts setup, check-ins, medicine list + tick + chart. |
| 1 Nov | Night guard: foreground mic service, knock-pattern detector, countdown, alert chain; false-alarm tests (TV, talking, door, fan). |
| 2 Nov | Medicine strip reading (Vision via the hub) → confirm → card; guide picking by Llama 3B (English/Hindi) with confirm; "on the way" check-ins. |
| 3 Nov | Proof: doctor/nurse reviews the guides (his task), 3–5 people test (time to start CPR with vs without the app); fix; tests; docs. |
| 4 Nov | Record the video, write the submission, buffer. Submit before 5 Nov 07:30 IST. |

Cut if late, in this order: SMS (keep the call), "on the way" mode, Hindi read-aloud (keep Hindi text),
strip reading (keep typed medicines).

## Decisions (29 Oct, from him)

- Demo phones: his Galaxy A36 is grandma's phone; he can borrow **2 more** (neighbour, son).
- A doctor he knows will review the 8 guides and say one sentence on video.
- **English only**; no Hindi work. Steps that said "Hindi" now mean English.
- Start building 30 Oct, following this plan.

## What he needs to arrange

- The 2 borrowed phones on demo day; their numbers go into the app's contacts.
- Data for the 7.8 GB vision model.
- The doctor review (aim for 3 Nov at the latest).
- 3–5 people for a 10-minute test.
- Send the IFRC email (drafted for him).

## Honest risks

- Samsung battery saving may stop the night guard; the app must be exempted, and this must be tested overnight.
- Knock detection can false-alarm (TV, door) or miss a weak knock; the countdown limits false calls.
- Offline Hindi text-to-speech depends on the phone having the Hindi voice installed.
- Six days for one developer is tight; the cut list above is the plan B.
