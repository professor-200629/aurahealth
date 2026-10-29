# AuraHealth: the Offline Emergency Bridge

> **Research prototype. Simulation only. Not a medical device.** Use only fictional people and the synthetic
> sample reports. No real patient use until independent clinical, language, privacy, security and relevant
> legal/regulatory review.

AuraHealth helps a worried person turn "what happened" into a clear **handoff card** they can read out or show
to an emergency operator or a doctor. It works **without internet**: the phone talks only to a laptop on the
same Wi-Fi, and the Meta Llama models run on that laptop.

**Setup: Phone interface + local laptop server.** The phone does not run a model.

## What it does

- **"Help someone now": step-by-step first aid while waiting for help.** 9 guides (start here, CPR, recovery
  position, choking, heavy bleeding, chest pain, stroke signs, snakebite, seizure), adapted in plain English
  from the IFRC 2020 first aid guidelines, one big step per screen, read aloud, with a 110-per-minute beat for
  chest compressions. **Every step tapped is saved with the phone's time** and appears on the handoff card,
  so the doctor sees what was done and when. It works with the laptop out of reach; the log is sent later.
  Not yet reviewed by a clinician; medicine doses are left out on purpose.
- **Emergency call button on every screen.** It is a plain `tel:112` link (India), so it opens the phone's dialer
  even if the laptop or the models are down. It never places a call by itself. A call still needs mobile network.
- **Short guided questions** (who, approximate age, what happened, when it started, details), each with
  "I don't know". Missing answers become **Unknown** on the card, never guessed.
- **Text helper (Meta Llama 3.2 3B, local).** Splits the user's own description into points. Code checks that
  every point is the user's exact words; anything else is dropped and counted. Words the helper leaves out are
  kept as written. English (Latin script) only; Telugu text is refused, not "translated".
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
  are re-encoded (metadata removed). One tap deletes the session and its images. No accounts, no analytics,
  no third-party requests. The internet check runs only when the user taps "Check now".

## What it does not do

It does not diagnose, triage, rank urgency, recommend medicine doses, call 112 by itself, send data anywhere, or
work as a phone-only app (yet). The first-aid steps are fixed text adapted from the Red Cross (IFRC) 2020
guidelines; no model writes them (see `packs/sources/README.md`).

## Android app and night guard (`android/`)

A native Android app (Java, no extra libraries) wraps the same web app:

- **Works with no laptop and no internet:** the web app is bundled inside the APK, so first aid, the night
  guard, check-ins and the time log work on the phone alone. When the laptop is reachable (Status → Laptop AI
  helper), its copy is used instead, with the Llama helpers, and the phone's saved log is sent to it.
- **Night guard:** a foreground service listens for **3 knocks** (sharp sounds, each 0.12–1.5 s apart, all within
  3 s; speech and music are ignored). Audio is processed in memory, never recorded or sent; only loudness numbers
  go to the Android debug log. Then a loud alarm and a full-screen **"Are you OK?"** countdown (30 s). If nobody
  taps "I'm OK", it **phones the neighbour** and **texts the family** (numbers stay on the phone). It cannot call
  112 by itself: Android does not allow apps to; the big button opens the dialer.
- **Check-ins:** "Good night" / "Good morning" give the card a **last seen well** time.
- **Voice:** steps are read with the phone's own text-to-speech.

Build and install (phone on USB with USB debugging on):

```powershell
powershell -ExecutionPolicy Bypass -File .\android\build-apk.ps1
```

Knock detector check on the laptop (made-up sounds): see `android/tools/KnockDetectorCheck.java`.

## How it fits together

```
 Phone browser (any modern phone)            Laptop (Windows, no internet needed after setup)
 ┌──────────────────────────────┐  Wi-Fi   ┌──────────────────────────────────────────────┐
 │ React web app                │ ───────► │ FastAPI server (Python)                      │
 │  - tel:112 always visible    │  pairing │  - session store: SQLite file                │
 │  - packs bundled in the app  │  cookie  │  - deterministic handoff builder (no model)  │
 └──────────────────────────────┘          │  - Ollama ──► Llama 3.2 3B   (text helper)   │
                                           │          └──► Llama 3.2 Vision 11B (reader)  │
                                           └──────────────────────────────────────────────┘
```

The handoff card is built by plain code from what the user typed, chose or confirmed. No model decides what
goes on the card or whether emergency help is shown.

## Meta models

| Role | Model (Ollama tag) | Download | Status on the developer laptop (29 Oct 2026) |
| --- | --- | --- | --- |
| Text helper | Llama 3.2 3B (`llama3.2:3b`) | ~2.0 GB | Installed, measured (see `EVALUATION.md`) |
| Report reader | Llama 3.2 Vision 11B (`llama3.2-vision:11b`) | ~7.8 GB | **Not installed, not measured** |

Llama 3.2 Vision supports English only for image+text tasks. On a laptop CPU it may take minutes per image;
measure it with `backend/scripts/eval_reader.py` before saying anything about speed or accuracy.

## Run it on Windows

Prerequisites (setup needs internet once): [uv](https://docs.astral.sh/uv/), Node.js 22 or newer (only to build
the web app), and [Ollama](https://ollama.com). Developed with uv 0.12.9, Node 24.14, Ollama 0.32.3.

```powershell
ollama pull llama3.2:3b                 # ~2.0 GB, text helper
ollama pull llama3.2-vision:11b         # ~7.8 GB, optional report reader (close other apps; needs RAM)

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
uv run pytest -q                                          # 19 API and safety-rule tests (no model calls)
$env:AURA_E2E = "1"; uv run pytest tests/test_e2e.py -v   # 3 browser tests in Microsoft Edge, phone size
uv run python scripts/eval_splitter.py                    # real Llama 3.2 3B calls on fictional text
uv run python scripts/eval_reader.py                      # real Llama 3.2 Vision calls (needs the model)
```

Results and what was *not* tested are in [`EVALUATION.md`](EVALUATION.md).

## Languages

| Language | Status |
| --- | --- |
| English | Baseline, written by the developer. Not clinically reviewed. |
| Telugu (తెలుగు) | **Unreviewed draft**, written with AI help. Not checked by a native-speaker translator or a clinician. The app labels it, and shows the English line under every safety-critical sentence. |

The text helper and the report reader work in English only. Voice input and read-aloud are not included,
because browser speech features are not guaranteed to work offline.

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
- Pairing, security headers (CSP `connect-src 'self'`), no access logs: `backend/src/aurahealth/app.py`.

## Docs

[`DEMO_SCRIPT.md`](DEMO_SCRIPT.md) · [`EVALUATION.md`](EVALUATION.md) · [`SUBMISSION.md`](SUBMISSION.md) ·
[`ROADMAP.md`](ROADMAP.md) · [`CHECKLIST.md`](CHECKLIST.md) · [`SAMPLE_DATA/README.md`](SAMPLE_DATA/README.md)
