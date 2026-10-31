# Running checklist

Kept up to date so work can resume if context is lost. `[x]` = done and checked, `[ ]` = not done,
`[~]` = partly done (see note). Last update: 29 Oct 2026.

## Phase 1: inspect the environment, choose the path

- [x] Windows 11, Intel Core Ultra 5 125U, 15.5 GB RAM, integrated graphics, ~490 GB free disk
- [x] uv 0.12.9 / Python 3.11, Node 24.14, Ollama 0.32.3, Microsoft Edge (for browser tests)
- [x] Path: React + Vite phone web app, FastAPI laptop server, Ollama for Meta Llama models, SQLite file

## Phase 2: core journey with manual input and handoff

- [x] Always-visible emergency control (`tel:112`, opens the dialer, never calls by itself)
- [x] Questions: who, approximate age, what happened, onset, details; "I don't know" everywhere it fits
- [x] Deterministic handoff card with provenance per line, unknowns list, "not assessed" line
- [x] Evidence view (full description with highlighted span; image → model read → final value)
- [x] Copy (with non-secure-context fallback), download .txt, print
- [x] Delete session (also removes report images)

## Phase 3: real local Meta model integration

- [x] Llama 3.2 3B text helper via Ollama, exact-words check, dropped count, left-out words kept
- [x] Live-tested in the app and in `scripts/eval_splitter.py` (8 cases, real calls)
- [~] Llama 3.2 Vision 11B report reader: code, background job, polling UI and eval script done;
      **model not installed, not measured**. 29 Oct: download approved, but `ollama pull` failed 5 times on the
      Jio mobile hotspot (drops every few minutes, restarts from zero). Stopped at the developer's request; he
      will run `ollama pull llama3.2-vision:11b` himself on 30 Oct morning. A resumable partial copy (0.35 GB)
      is in `C:\Users\Balu\ollama-import\` with `import_vision.py`; delete that folder if `ollama pull` works.
      After install: `uv run python scripts/eval_reader.py` (close other apps first, ~8 GB RAM needed)
- [x] Manual-entry fallback when the reader is missing or fails

## Phase 4: source/region architecture and safe fallback

- [x] Region pack India: 112 with source reference and reuse note; only `implemented` packs are offered
- [x] Language packs en (baseline) and te (unreviewed draft), key-completeness check
- [x] No guidance cards (no source with suitable reuse terms); honest "can't assess" message instead
- [x] Packs bundled into the app, so the emergency card works with the server down

## Phase 5: design and mobile usability

- [x] Phone-first layout, large tap targets, sticky top bar above dialogs, side-by-side report studio on wide screens
- [x] System fonts only (Noto Sans Telugu / Nirmala UI fallbacks), no remote fonts or icons
- [x] Reduced-motion and print styles, focus outlines, screen place kept in the URL (reload/back work)
- [x] Real phone check, 29 Oct: Samsung Galaxy A36 5G, Android 16, Chrome, laptop on the phone's hotspot
      (full flow; 3 problems found and fixed: pairing cookie, keyboard hiding the top bar, confusing label box)
- [ ] Telugu, download and print on the real phone; other browsers and iPhone

## Phase 6: test the actual application and fix failures

- [x] 19 API/safety tests pass (`uv run pytest -q`)
- [x] 3 browser tests pass in Edge (`$env:AURA_E2E="1"; uv run pytest tests/test_e2e.py -v`)
- [x] Fixed: crash on first screen change (effect cleanup), cramped card lines, blank sample thumbnails,
      emergency pill hidden behind dialogs, text helper silently dropping a sentence
- [ ] Manual no-internet test on a real phone (steps in `EVALUATION.md`; phone hotspot with mobile data off)

## Phase 7: demo, evaluation and submission files

- [x] `README.md`, `DEMO_SCRIPT.md` (90 s and 3 min), `EVALUATION.md`, `SUBMISSION.md`, `ROADMAP.md`
- [x] `SAMPLE_DATA/` with 5 synthetic reports, answer keys and README
- [x] `start.ps1` (laptop only, or `-Wifi` for the phone)
- [ ] Demo video (developer)

## Phase 8: commands and honest report

- [x] Commands in `README.md`
- [x] First local commit 11ca51a on 29 Oct (developer's OK). Not pushed; no remote, no license chosen yet

## v2 "first hour" (see PLAN_V2.md)

- [x] 30 Oct work, started 29 Oct evening: 9 first-aid guides from IFRC 2020 (`packs/guides/en.json`, sourced,
      no doses, `adapted_unreviewed`), "Help someone now" screen, one-step-per-screen player, read-aloud,
      110/min CPR beat, every step saved with phone time (kept on the phone if the laptop is unreachable),
      time log on the handoff card; 24 API + 5 browser tests pass
- [x] Real-phone check of the guides: read-aloud (Google TTS) and the CPR beat sound play on the Galaxy A36
- [ ] Doctor review of the 9 guides (developer's doctor friend)
- [x] Android app (Java, WebView + bridge, bundled web app, laptop optional), night guard (knock detector,
      alarm, full-screen countdown, auto-call neighbour, SMS family), check-ins, premium home and guard design;
      tested on the real phone with played sounds (see EVALUATION.md section 6)
- [x] Real auto-call + SMS to the developer's 2 numbers after 3 played knocks (29 Oct 20:40 IST)
- [ ] A whole night with the screen off and battery saving on
- [~] Vision model downloaded 29 Oct but Ollama 0.32.3 cannot load it (mllama dropped in 0.30). Developer chose
      Meta online (Muse Spark): reader built with a spend cap and a "sends photo to Meta" notice, medicine-strip
      sample, `scripts/set-meta-key.ps1`, `eval_reader.py --online`; 29 API + 6 browser tests pass.
      Waiting: the developer runs the key script; then a real measured run
- [x] Doctor review sheet: docs/AuraHealth_first_aid_guides_for_review.pdf (made by docs/make_review_pdf.py)
- [x] Real knock by the developer: heard at 20:48 IST, he tapped I'm OK
- [x] IFRC email sent to first.aid@ifrc.org from the developer's Gmail on 29 Oct (his approval)
- [x] 31 Oct: guide finder (Llama 3.2 3B points to a guide with the person's own words; never CPR/recovery directly;
      person taps). Held-out set 2: 20/24 right, 0 wrong guides; 34 API + 7 browser tests pass. Not yet in the APK
      (needs the laptop anyway); not yet tried on the real phone
- [ ] Make the repository public on GitHub before submitting (organizers, 31 Oct: must be public at submit time)
- [x] 31 Oct: Meta API dropped (card check needs a ₹1,198 hold; developer's choice). Free offline photo reader
      built instead: Windows OCR + Llama 3.2 3B, values copied exactly, person confirms; 28/45 fields on the 6
      samples (EVALUATION 2c); 38 API tests pass
- [~] 31 Oct: morning check (no "Good morning" by 09:00 while the guard is on → same alert chain); APK built,
      **not yet tested on the phone**
- [x] Asked organizers (31 Oct, #questions): their bot answered "Llama is not part of this hackathon and does not
      count as a Meta model". AI helpers switched to **Meta Muse Glimmer** via NVIDIA's free hosted API
      (`backend/src/aurahealth/ai.py`, `scripts/set-nvidia-key.ps1`); Llama kept as an opt-in offline backup.
      Key saved by the developer; 42 API + 7 browser tests pass with Glimmer live
- [x] DEMO_SCRIPT.md rewritten: stroke at night (knock) → auto-call + SMS → guide finder → card; morning check;
      opening line "built during the hackathon"

## Open decisions for the developer

- Download `llama3.2-vision:11b` (~7.8 GB) and measure it?
- Commit and/or publish the repository? Which license?
