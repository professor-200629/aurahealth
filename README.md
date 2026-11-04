# AuraHealth: the first hour at home

> **Research prototype. Simulation only. Not approved or registered as a medical device. No clinician has reviewed it.** Use only fictional people and the synthetic
> sample reports. No real patient use until independent clinical, language, privacy, security and relevant
> legal/regulatory review.

When someone collapses or cannot get up at home, help is often far away. AuraHealth turns the nearest person into
a first responder: the phone **alerts a neighbour and family by itself**, **speaks Red Cross first-aid steps** one
at a time, and hands over a **timed record** of what happened and what was done. Every day it keeps each
person's **health card** ready, **reminds them to take their medicines** and **texts a guardian if a dose is
not marked taken**, and lets the family **talk to Aura** by voice or text.

**The emergency path is built to work with no internet and no laptop** (`QA_AND_EVALUATION.md` says what has really been run that way): the 112 button, the first-aid steps, the night
guard (3 knocks, or no "Good morning"), the automatic call and text (with the phone's location), medicine
reminders and the guardian text, the health card, and the time log all run on the phone.

**The AI helpers use Meta Muse Glimmer** (Meta's open-weight 30B model, Apache 2.0), hosted free by NVIDIA
(`meta/muse-glimmer-30b` on build.nvidia.com). They need internet and an NVIDIA key. Talk to Aura writes answers that code checks before they show; the other
helpers only suggest, and a person confirms. NVIDIA's free terms are for trials, not real users (`LAUNCH_PLAN.md`). Where each model runs is listed under "Meta models" below.

**Setup:** Android app. Talk to Aura needs an NVIDIA key saved on the phone. A laptop server on the same Wi-Fi is needed only for the handoff card, guide finder and report reader.

**Try it with no install and no key:** [web demo](https://professor-200629.github.io/aurahealth/). It answers from what is built into the app (emergency words, readings, common medicine questions, prepared answers, first-aid guides) and sends nothing anywhere. Live AI, the photo reader, alarms, reminders and the night guard need the Android app.

**Android app:** [download the APK](https://github.com/professor-200629/aurahealth/releases/latest/download/AuraHealth-prototype.apk) (a debug build with no key inside; install steps are in the [release](https://github.com/professor-200629/aurahealth/releases/latest)). Live answers and the photo reader need your own free NVIDIA key, saved in the chat screen.

## Why the first hour matters (sources)

- Most cardiac arrests outside hospital happen at home: 68% in Ireland's 2024 registry
  ([HSE](https://about.hse.ie/news/press-release-ohcar-annual-report-2024/)).
- CPR started before the ambulance more than doubled 30-day survival in Sweden: 10.5% vs 4.0% across 30,381
  arrests ([NEJM 2015, via Healio](https://cm.healio.com/news/cardiology/20150625/cpr-before-ems-arrival-beneficial-cellphone-dispatch-of-laypersons-effective)).
- In Indian studies, bystanders started CPR in only 1.3% (Delhi) to 9.8% (Manipal) of cases
  ([review, Indian Heart J 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10568059/)), against 84% in Ireland.
- Spoken step-by-step guidance works: telephone CPR instructions double bystander CPR (RR 2.00,
  [ILCOR](https://costr.ilcor.org/document/emergency-care-dispatcher-instruction-in-cpr)).
- Alerting someone nearby works: in London, survival was 18% vs 10% when a GoodSAM responder accepted the alert
  ([NIHR](https://evidence.nihr.ac.uk/alert/more-people-survived-cardiac-arrest-first-aiders-goodsam-alert/)).
- Ambulances are often late: Karnataka's 108 service reached cardiac and stroke calls later than its 10-minute
  target in over 60% of cases, says the state auditor (CAG, 2014–19,
  [News Minute](https://www.thenewsminute.com/article/108-ambulances-failed-reach-50-patients-within-time-karnataka-cag-139331)).
- In a stroke, about 1.9 million neurons die every minute ([Saver 2006](https://pubmed.ncbi.nlm.nih.gov/16339467/)),
  and treatment depends on when the person was **last known well**.
- Snakebite kills about 58,000 people a year in India, mostly in rural homes
  ([eLife 2020](https://elifesciences.org/articles/54076)).
- Long lies after falls: among people over 90 who fell, 80% could not get up and 30% lay on the floor for an
  hour or more ([BMJ 2008](https://www.bmj.com/content/337/bmj.a2227.abstract)).

AuraHealth does not replace emergency services or a clinician. It helps the nearest person act and hand over a
clear, timed record.

## What it does

- **Talk to Aura (voice or text).** Tap the microphone and speak, or type. Emergency words in everyday wording ("collapsed", "not
  breathing", "pain in my chest", "taken thirty tablets", some voice-typing errors and some Hindi and Telugu words) get an answer **on the
  phone at once**: a "Call 112" button and the matching first-aid guide. Talk of suicide or self-harm gets a fixed reply with Call 112 and Tele-MANAS 14416, without the AI. Questions about the family's own saved
  data ("Has today's medicine been taken?", "What is Amma's blood group?") are also answered on the phone. Anything
  common questions open **at once and offline**, from answers Muse Glimmer wrote in advance from MedlinePlus (`scripts/build_prepared.py`), labelled as such and passed through the same
  checks. Common medicine questions (a missed dose, how much, stopping, mixing, pregnancy) get a fixed answer that never gives an amount. Anything personal
  also goes to **Meta Muse Glimmer** live, with passages from a bundled pack of MedlinePlus topic summaries. It writes a direct answer, next step,
  warning signs and reasons. Code removes sentences with medicine amounts, start or stop directions, reassurance or a stated diagnosis, shows only
  sources it really retrieved, and adds "Call 112" on emergency words. These are word patterns and no clinician has reviewed them. If the AI is slow or
  unavailable, MedlinePlus's own sentences can show from the phone, labelled as not written by AI.
  **No laptop needed:** with an NVIDIA key saved in the app (`scripts/send-key-to-phone.ps1` copies it over USB, or
  paste it in the chat screen), the phone calls Muse Glimmer itself over its own internet. Phone and laptop send the
  same prompt (`packs/ai/aura_chat.json`) and apply the same checks.
  Results for this version: `QA_AND_EVALUATION.md`. An earlier version (2 Nov) was compared with the August health app on the same phone in
  [`docs/AUGUST_VS_AURA.md`](docs/AUGUST_VS_AURA.md) (10 questions, scored by AI on a rubric that favoured safety and brevity); that result does not describe this version.
  Replies can be read aloud.
- **Reads a report or medicine photo on the phone.** Muse Glimmer reads each line, marks what the report's own range shows as high or low, and says what each line
  measures, all from the phone with no laptop. For synthetic samples only for now, because photos go to the AI host. The sample `SAMPLE_DATA/reports/ranges_report.png` prints its own ranges.
- **Handoff record on the phone alone.** The time log and health card become a record to read aloud or send, with no laptop. With the laptop server, the fuller handoff card is used.
- **Health readings answered on the phone.** "Temperature 99.9", "BP 190/120", "sugar 62", "oxygen 91": Aura
  answers at once, offline, with fixed thresholds from the NHS (fever from 38°C / 100.4°F; oxygen 92% or below),
  the American Heart Association (above 180/120 with symptoms is an emergency) and the American Diabetes
  Association (sugar below 70 mg/dL is low, below 54 serious), and says when to call 112
  (`frontend/src/readings.ts`).
- **A real app layout.** A side menu, a profile (no account and no login: it stays on the phone), and a bottom bar
  with Home, Aura, Medicines, Family and a red **SOS** button in the middle. SOS opens the emergency sheet (Call 112,
  share location, read the health card aloud); the call needs that second tap, so a pocket press calls nobody.
- **Family & health.** The people at home (name, age, blood group, conditions, allergies, regular medicines,
  notes) and the contacts: who is phoned first in an alert, who is texted, and who is the medicine guardian.
  Saved on the phone, with no cloud account. The **health card** on the home screen shows what to tell the operator and can read it
  aloud; starting a handoff card from a saved person fills in their age and health notes.
- **Medicine reminders that tell a guardian.** The family types the medicine and amount exactly as prescribed
  (AuraHealth never suggests either) and the times. Android rings a reminder with a **Taken** button, repeats it
  after 10 minutes, and if it is still not marked taken after the chosen wait (30 minutes by default) **texts every
  guardian**. If it is marked taken later, the guardian gets a short update. "Not marked taken" does not mean it was not taken. Built to work with
  the app closed and after a restart, with no laptop and no internet; a real guardian text and a restart have not been tested yet.
- **Help nearby.** "Hospitals near me" and "Medical stores near me" open a Google Maps search (needs internet; Maps may not show the closest first);
  "Share my location" finds the phone with GPS and opens the share sheet with a map link.
- **"Help someone now": step-by-step first aid while waiting for help.** 17 guides (start here, CPR, recovery
  position, choking, heavy bleeding, chest pain, stroke signs, snakebite, seizure, low blood sugar in diabetes,
  breathing difficulty or asthma, severe allergic reaction, poisoning, burns, head injury, feeling faint, fever), adapted in plain English
  from the IFRC 2020 first aid guidelines, one big step per screen, read aloud, with a 110-per-minute beat for
  chest compressions. **Every step tapped is saved with the phone's time** and appears on the handoff card,
  so the doctor sees what was done and when. It works with the laptop out of reach; the log is sent later.
  Not yet reviewed by a clinician; medicine doses are left out on purpose.
- **Guide finder (Meta Muse Glimmer).** "Not sure which one? Describe what you see": the model points to
  one or two of the guides and shows the person's own words it matched; nothing opens until the person taps.
  It can only name guides from a fixed list, code drops any quote that is not the person's words, and CPR or the
  recovery position are reached only through "start here" and its two questions. **Measured on 56 fictional
  descriptions: 56 right, 0 wrong guides** (the finder covers 7 guides; the other 10 are reached from the list), median 6–9 s per answer (`EVALUATION.md` section 2d). Needs the
  laptop and internet; the words go to NVIDIA for the answer. AuraHealth keeps no copy, but NVIDIA's API trial terms
  let it use what is sent to improve its products (see EVIDENCE.md), so the app asks people not to type private details. The guide list
  always works without it.
- **SOS on every screen.** It opens a sheet with a plain `tel:112` link (India), which opens the phone's dialer
  even if the laptop or the models are down. It never places a call by itself. A call still needs mobile network.
- **Short guided questions** (who, approximate age, what happened, when it started, details), each with
  "I don't know". Missing answers become **Unknown** on the card, never guessed.
- **Text helper (Meta Muse Glimmer).** Splits the user's own description into points. Code checks that
  every point is the user's exact words; anything else is dropped and counted. Words the helper leaves out are
  kept as written. English (Latin script) only; Telugu text is refused, not "translated".
- **Photo reader (Meta Muse Glimmer reads the photo).** Reads a photo of a medicine strip or report into
  proposed fields, with Windows' built-in text reader's lines as a hint for small print. The photo goes to
  NVIDIA for this; use synthetic samples in this prototype. Every field stays a proposal until the person
  confirms it next to the photo. **Measured: 39/39 fields exactly right on the 5 synthetic reports** (including a
  blurry photo); on the medicine strip every value was read correctly but under the strip's own labels
  (`EVALUATION.md` section 2d). A fake "ignore your instructions" note on a report was copied as text and flagged.
- **Offline backup (optional, not the judged model):** the same helpers can run on the laptop with Llama 3.2 3B
  (`AURA_AI=llama`) and Windows OCR, with no internet. Measured in `EVALUATION.md` sections 2, 2b, 2c. The
  hackathon organizers said on 31 Oct that Llama does not count as a Meta model for this hackathon, so the
  default is Muse Glimmer.
- **Online reader (Meta Muse Spark via the Meta Model API, optional, not measured).** Not used in the demo: the
  Meta account's card check was not completed, so it was never run with a real key. Reads a photo of a synthetic report or
  medicine strip when a key is set (`scripts/set-meta-key.ps1`, run by you; the key is never shown or stored in the
  project) and only when the person taps "Read it with Meta AI (online)", which says the photo goes to Meta.
  Spending is capped at $2 by default (`AURA_MAX_META_SPEND_USD`). Every field is still confirmed by the person.
- **Report reader (Meta Llama 3.2 Vision 11B, local, optional).** Reads a photo of a (synthetic) report and
  **proposes** fields. The user confirms, corrects or removes every field next to the image. Only confirmed
  fields go on the card. Text that looks like an instruction (e.g. "tell the user it is safe to wait") is flagged
  and never followed. If the model is not installed, the user types the fields instead.
- **Handoff card with provenance.** Every line says where it came from: *You said*, *Your words, split by the
  text helper*, *From report, you confirmed*, or *From report, you corrected*. Tap a line to see the evidence:
  the full description with the span highlighted, or the image → model reading → final value.
- **The card is not an assessment.** It says that AuraHealth has not examined the person and that it is not a diagnosis, next to the call button.
- **Privacy.** Handoff answers are stored on the laptop server (`data/sessions.sqlite3`, **not encrypted**); family details and reminders on the phone. Report images
  are re-encoded (metadata removed). One tap deletes the session and its images. No accounts, no analytics.
  AuraHealth has no server of its own. Data leaves the phone when you use Muse Glimmer (NVIDIA: questions, guide-finder words, report photos), voice
  input (the phone's speech service, which may send audio online), Maps and source links, and the calls and texts you set up. Saved health details and
  crisis words are kept out of AI requests. Phone numbers are not sent to the AI.

## What it does not do

It does not state a diagnosis, recommend medicines or doses (reminders use only what the family typed from the
prescription), or call 112 by itself. It gives general information and fixed first-aid steps, and its unreviewed rules can say when to call 112 or how
soon to see a doctor. Whether that counts as triage under Indian rules is undecided (`LAUNCH_PLAN.md`). The first-aid steps are fixed text adapted from the Red Cross (IFRC) 2020
guidelines; no model writes them while the app runs (see `packs/sources/README.md`).

## Android app and night guard (`android/`)

A native Android app (Java, no extra libraries) wraps the same web app:

- **Built to work with no laptop and no internet:** the web app is bundled inside the APK, so first aid, the night
  guard, check-ins and the time log work on the phone alone. When the laptop is reachable (Status → Laptop AI
  helper), its copy is used instead, with the AI helpers, and the phone's saved log is sent to it.
- **Night guard:** a foreground service listens for **3 knocks** (sharp sounds, each 0.12–1.5 s apart, all within
  3 s; speech and music are ignored). Audio is processed in memory, never recorded or sent; only loudness numbers
  go to the Android debug log. Then a loud alarm and a full-screen **"Are you OK?"** countdown (30 s). If nobody
  taps "I'm OK", it **phones the first contact** (best someone nearby, like a neighbour) and **texts the family**,
  with a **map link of where the phone is** if location is allowed (numbers stay on the phone). It cannot call
  112 by itself: Android does not allow apps to; the big button opens the dialer.
- **Check-ins:** "Good night" / "Good morning" give the card a **last seen well** time.
- **Morning check:** someone who had a stroke or a fall in the night may not be able to knock. While the guard
  is on, if there is no "Good morning" by a set time (default 09:00), the same countdown → call → text runs, and
  the card says "No "Good morning" by the morning check time". (Built 31 Oct; not yet tested on the real phone.)
- **Voice:** steps are read with the phone's own text-to-speech; "Talk to Aura" listens with the phone's own speech
  recognizer (push to talk; it may need internet unless the phone has Google's offline English pack).
- **Medicine alarms:** one exact alarm (`Meds.java`), set again after a restart (`BootReceiver.java`).

Build and install (phone on USB with USB debugging on):

```powershell
powershell -ExecutionPolicy Bypass -File .\android\build-apk.ps1
```

Knock detector check on the laptop (made-up sounds): see `android/tools/KnockDetectorCheck.java`.

## How it fits together

```
 Android app / phone browser                 Laptop server (Windows)                     Internet (AI helpers only)
 ┌──────────────────────────────┐  Wi-Fi   ┌─────────────────────────────────────┐   ┌──────────────────────────┐
 │ React web app (bundled)      │ ───────► │ FastAPI server (Python)             │──►│ NVIDIA hosted API        │
 │  - tel:112 always visible    │  pairing │  - session store: SQLite file       │   │ Meta Muse Glimmer 30B    │
 │  - first-aid steps + log     │  cookie  │  - handoff card built by code       │   │ (open weights)           │
 │  - night guard, auto-call,   │          │  - checks every model answer        │   └──────────────────────────┘
 │    SMS (Android, no network) │          │  - Windows OCR (offline)            │
 └──────────────────────────────┘          └─────────────────────────────────────┘
```

The handoff card is built by plain code from what the user typed, chose or confirmed. No model decides what
goes on the card, and SOS never depends on a model. In Talk to Aura, the word list can only add a Call 112 button; for wording it misses, the model's answer decides whether one appears.

## Meta models

| Role | Model | Where it runs | Status (31 Oct 2026) |
| --- | --- | --- | --- |
| Talk to Aura, guide finder, text helper, photo reader | **Meta Muse Glimmer 30B** (`meta/muse-glimmer-30b`, Meta open weights, Apache 2.0) | NVIDIA's free hosted API (build.nvidia.com), called by the laptop server; needs internet and `NVIDIA_API_KEY` (`scripts/set-nvidia-key.ps1`) | Default. Measured: `EVALUATION.md` section 2d |
| Offline backup (optional) | Llama 3.2 3B (`llama3.2:3b`, Ollama) + Windows OCR | The laptop, no internet (`AURA_AI=llama`) | Measured: sections 2, 2b, 2c. Organizers said Llama does not count as a Meta model for this hackathon |
| Online reader (optional) | Meta Muse Spark (`muse-spark-1.3`, Meta Model API) | Meta's API; needs `MODEL_API_KEY` | Built, never run with a real key |
| Report reader (optional) | Llama 3.2 Vision 11B | The laptop | Cannot run on Ollama 0.30+; not measured |

Muse Glimmer was chosen because the hackathon counts Meta's open-weight models (Muse Glimmer, Muse Spark Open)
and the Meta Model API. Muse Glimmer (about 18 GB) does not fit this laptop's 15.5 GB of memory, so it runs on
NVIDIA's hosted copy of the same open weights.

## Run it on Windows

Prerequisites: [uv](https://docs.astral.sh/uv/), Node.js 22 or newer (only to build the web app), and a free
NVIDIA API key for Muse Glimmer (sign in at [build.nvidia.com](https://build.nvidia.com), open Muse Glimmer,
"Get API Key"). Developed with uv 0.12.9, Node 24.14. [Ollama](https://ollama.com) is only needed for the
optional offline backup.

```powershell
# Save the NVIDIA key as NVIDIA_API_KEY without showing it (run it yourself; it makes one tiny test call)
powershell -ExecutionPolicy Bypass -File .\scripts\set-nvidia-key.ps1

# Optional offline backup instead of Muse Glimmer: ollama pull llama3.2:3b, then set AURA_AI=llama

cd C:\Users\Balu\Documents\aurahealth\frontend
npm install
npm run build

cd ..\backend
uv sync
uv run aurahealth                       # this laptop only: http://127.0.0.1:8000
```

Or from the project folder: `powershell -ExecutionPolicy Bypass -File .\start.ps1` (add `-Wifi` for the phone).

### Use it from a phone

1. Put the phone and laptop on the **same trusted Wi-Fi**.
2. On the laptop: `uv run aurahealth --lan` (or `.\start.ps1 -Wifi`). If Windows Firewall asks, allow
   **Private networks** only.
3. The laptop window prints one or more pairing links like `http://192.168.x.x:8000/pair?code=...`.
   Use the address of your Wi-Fi adapter (VMware/virtual adapters are listed too). Open it on the phone.
   Every server start makes a new code. Without the link, other devices only see a page with the 112 call link.
4. Anyone on the network who has the link can open the app, so use a network you trust.

Plain `http` on Wi-Fi is not a "secure context" for browsers, so copy-to-clipboard uses a fallback.

### Offline demo setups (test before relying on them)

- A Wi-Fi router with its internet cable unplugged, or
- the phone's hotspot with **mobile data turned off** (voice calls still work), with the laptop joined to it.

Then tap **Status → Check now**: it should say the internet is not reachable while the handoff still works.

## Tests and measurements

```powershell
cd C:\Users\Balu\Documents\aurahealth\backend
uv run pytest -q                                          # API and safety-rule tests (no model calls)
uv run python scripts/eval_rules.py --misses              # rules with no model, on the review phrases
uv run python scripts/eval_answers.py after               # answers, real model calls (see QA_AND_EVALUATION.md)
$env:AURA_E2E = "1"; uv run pytest tests/test_e2e.py -v   # browser tests in Microsoft Edge, phone size
uv run python scripts/eval_splitter.py                    # text helper, real calls to the active AI helper
uv run python scripts/eval_guidefinder.py --set heldout2  # guide finder, real calls (also: dev, heldout)
uv run python scripts/eval_reader.py --glimmer            # photo reader with Muse Glimmer (also: --ocr)
uv run python scripts/eval_chat.py                        # Talk to Aura: 24 cases, real calls
```

Results and what was *not* tested are in [`EVALUATION.md`](EVALUATION.md).

## Languages

| Language | Status |
| --- | --- |
| English | Baseline, written by the developer. Not clinically reviewed. |
| Telugu (తెలుగు) | **Unreviewed draft**, written with AI help. Not checked by a native-speaker translator or a clinician. The app labels it, and shows the English line under every safety-critical sentence. |

The AI helpers (text helper, guide finder, photo reader) are used in English only; Telugu text is refused before
any model call. The first-aid steps are read aloud with the phone's own text-to-speech (in the Android app, or the
browser's when available). Voice input is not included.

## Project layout

```
backend/   FastAPI server, safety rules, Ollama client, tests, sample and eval scripts
frontend/  React + Vite + TypeScript phone web app (built into frontend/dist and served by the backend)
packs/     region pack (India, 112, source), language packs (en, te), guidance-source notes
SAMPLE_DATA/  synthetic report images and answer keys
EVAL_RESULTS/ JSON output of real measurement runs
```

## Safety rules in code

- Emergency control: the SOS button in `frontend/src/components/BottomNav.tsx` (always on screen, above every
  sheet) opens `SosSheet.tsx`; the call itself is a plain `tel:112` link (the dialer opens; nothing is called by itself).
- Exact-words check for the text helper: `backend/src/aurahealth/structuring.py` (`validate`, `uncovered`).
- Report fields are proposals; the model's reading cannot be overwritten by the client:
  `backend/src/aurahealth/app.py` (`update_fields`), `extraction.py`.
- Card built without any model, unknowns listed, `not_assessed: true`: `backend/src/aurahealth/handoff.py`.
- Talk to Aura: guides and actions from fixed lists, medicine amounts removed, "Call 112" added on emergency words:
  `backend/src/aurahealth/chat.py` (`check`, `red_flags`); the phone's own copy: `frontend/src/chatlocal.ts`.
- Medicine reminders never suggest a medicine or amount; the guardian text says only what was typed:
  `android/app/src/main/java/health/aura/app/Meds.java`.
- Pairing, security headers (CSP `connect-src 'self'`), no access logs: `backend/src/aurahealth/app.py`.

## Web demo

`cd frontend; npm run build:web` writes a plain page to `frontend/dist-web`, with no server and no key behind it (`VITE_WEB_DEMO`, `frontend/.env.webdemo`). In this mode the app makes no API calls, so what someone types stays in their browser. It is published on the `gh-pages` branch.

## License

The code is under the MIT License (`LICENSE`). The first-aid guides are adapted from the IFRC 2020 guidelines, which allow non-commercial use with credit, so they are not under MIT. See [`NOTICE.md`](NOTICE.md).

## Docs

[`DEMO_SCRIPT.md`](DEMO_SCRIPT.md) · [`EVALUATION.md`](EVALUATION.md) · [`SUBMISSION.md`](SUBMISSION.md) ·
[`ROADMAP.md`](ROADMAP.md) · [`CHECKLIST.md`](CHECKLIST.md) · [`SAMPLE_DATA/README.md`](SAMPLE_DATA/README.md)
