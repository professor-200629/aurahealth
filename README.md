# AuraHealth: the first hour at home

> **Research prototype. Simulation only. Not a medical device.** Use only fictional people and the synthetic
> sample reports. No real patient use until independent clinical, language, privacy, security and relevant
> legal/regulatory review.

When someone collapses or cannot get up at home, help is often far away. AuraHealth turns the nearest person into
a first responder: the phone **alerts a neighbour and family by itself**, **speaks Red Cross first-aid steps** one
at a time, and hands over a **timed record** of what happened and what was done. Every day it keeps each
person's **health card** ready, **reminds them to take their medicines** and **texts a guardian if a dose is
missed**, and lets the family **talk to Aura** by voice or text.

**The emergency path works with no internet and no laptop:** the 112 button, the first-aid steps, the night
guard (3 knocks, or no "Good morning"), the automatic call and text (with the phone's location), medicine
reminders and the guardian text, the health card, and the time log all run on the phone.

**The AI helpers use Meta Muse Glimmer** (Meta's open-weight 30B model, Apache 2.0), hosted free by NVIDIA
(`meta/muse-glimmer-30b` on build.nvidia.com). They need internet and an NVIDIA key, and they only ever suggest:
a person confirms. Where each model runs is listed under "Meta models" below.

**Setup:** Android app (or any phone browser) + a laptop server on the same Wi-Fi for the AI helpers and the card.

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

- **Talk to Aura (voice or text).** Tap the microphone and speak, or type. Emergency words ("collapsed", "not
  breathing", "choking", "bleeding", "chest pain", "face drooping", "seizure", "snake"...) get an answer **on the
  phone at once**: a "Call 112" button and the matching first-aid guide. Questions about the family's own saved
  data ("Has today's medicine been taken?", "What is Amma's blood group?") are also answered on the phone. Anything
  else goes to **Meta Muse Glimmer**, which may only point to the app's guides and actions; code drops anything
  else, removes any medicine amount, and adds "Call 112" whenever the person's words have an emergency sign.
  Measured in `EVALUATION.md` section 2e. Replies can be read aloud.
- **Family & health.** The people at home (name, age, blood group, conditions, allergies, regular medicines,
  notes) and the contacts: who is phoned first in an alert, who is texted, and who is the medicine guardian.
  Kept on the phone only. The **health card** on the home screen shows what to tell the operator and can read it
  aloud; starting a handoff card from a saved person fills in their age and health notes.
- **Medicine reminders that tell a guardian.** The family types the medicine and amount exactly as prescribed
  (AuraHealth never suggests either) and the times. Android rings a reminder with a **Taken** button, repeats it
  after 10 minutes, and if it is still not marked taken after the chosen wait (30 minutes by default) **texts every
  guardian**. If it is marked taken later, the guardian gets a short update. Works with the app closed, after a
  restart, with no laptop and no internet.
- **Help nearby.** "Nearest hospital" and "Nearest medical store" open Google Maps near the phone (needs internet);
  "Share my location" finds the phone with GPS and opens the share sheet with a map link.
- **"Help someone now": step-by-step first aid while waiting for help.** 9 guides (start here, CPR, recovery
  position, choking, heavy bleeding, chest pain, stroke signs, snakebite, seizure), adapted in plain English
  from the IFRC 2020 first aid guidelines, one big step per screen, read aloud, with a 110-per-minute beat for
  chest compressions. **Every step tapped is saved with the phone's time** and appears on the handoff card,
  so the doctor sees what was done and when. It works with the laptop out of reach; the log is sent later.
  Not yet reviewed by a clinician; medicine doses are left out on purpose.
- **Guide finder (Meta Muse Glimmer).** "Not sure which one? Describe what you see": the model points to
  one or two of the guides and shows the person's own words it matched; nothing opens until the person taps.
  It can only name guides from a fixed list, code drops any quote that is not the person's words, and CPR or the
  recovery position are reached only through "start here" and its two questions. **Measured on 56 fictional
  descriptions: 56 right, 0 wrong guides**, median 6–9 s per answer (`EVALUATION.md` section 2d). Needs the
  laptop and internet; the words go to NVIDIA for the answer and are not saved by AuraHealth. The guide list
  always works without it.
- **Emergency call button on every screen.** It is a plain `tel:112` link (India), so it opens the phone's dialer
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
- **"AuraHealth can't assess this situation."** No diagnosis, no triage, no "safe to wait", no medicine doses; only the fixed Red Cross first-aid steps.
  The card always says it has not been assessed, next to the call button.
- **Privacy.** Answers are stored only on the laptop (`data/sessions.sqlite3`, **not encrypted**). Report images
  are re-encoded (metadata removed). One tap deletes the session and its images. No accounts, no analytics.
  The only third-party requests are the AI helper calls to NVIDIA (the typed words, or the photo), made only
  when the person taps the helper; phone numbers never leave the phone. The internet check runs only when the
  user taps "Check now".

## What it does not do

It does not diagnose, triage, rank urgency, recommend medicines or doses (reminders use only what the family
typed from the prescription), or call 112 by itself. It sends nothing
anywhere except the AI helper calls described above. The first-aid steps are fixed text adapted from the Red Cross (IFRC) 2020
guidelines; no model writes them (see `packs/sources/README.md`).

## Android app and night guard (`android/`)

A native Android app (Java, no extra libraries) wraps the same web app:

- **Works with no laptop and no internet:** the web app is bundled inside the APK, so first aid, the night
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
goes on the card or whether emergency help is shown.

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
uv run pytest -q                                          # 47 API and safety-rule tests (no model calls)
$env:AURA_E2E = "1"; uv run pytest tests/test_e2e.py -v   # 7 browser tests in Microsoft Edge, phone size
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

- Emergency control: `frontend/src/components/TopBar.tsx` (sticky, above every dialog), `EmergencyCard.tsx`.
- Exact-words check for the text helper: `backend/src/aurahealth/structuring.py` (`validate`, `uncovered`).
- Report fields are proposals; the model's reading cannot be overwritten by the client:
  `backend/src/aurahealth/app.py` (`update_fields`), `extraction.py`.
- Card built without any model, unknowns listed, `not_assessed: true`: `backend/src/aurahealth/handoff.py`.
- Talk to Aura: guides and actions from fixed lists, medicine amounts removed, "Call 112" added on emergency words:
  `backend/src/aurahealth/chat.py` (`check`, `red_flags`); the phone's own copy: `frontend/src/chatlocal.ts`.
- Medicine reminders never suggest a medicine or amount; the guardian text says only what was typed:
  `android/app/src/main/java/health/aura/app/Meds.java`.
- Pairing, security headers (CSP `connect-src 'self'`), no access logs: `backend/src/aurahealth/app.py`.

## Docs

[`DEMO_SCRIPT.md`](DEMO_SCRIPT.md) · [`EVALUATION.md`](EVALUATION.md) · [`SUBMISSION.md`](SUBMISSION.md) ·
[`ROADMAP.md`](ROADMAP.md) · [`CHECKLIST.md`](CHECKLIST.md) · [`SAMPLE_DATA/README.md`](SAMPLE_DATA/README.md)
