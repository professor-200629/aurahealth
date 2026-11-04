# AuraHealth build status

Last update: 4 Nov 2026. Branch `product-v2`, off `master`. Nothing here is production-ready, clinically validated or compliance-checked.

## Real, simulated, absent

| Feature | State | Notes |
| --- | --- | --- |
| Talk to Aura, from the phone | Real | Muse Glimmer on NVIDIA. Needs the phone's internet and a key copied over USB. Free trial terms: no production use |
| Evidence pack, source links | Real | 208 MedlinePlus summaries in the app. Word matching, not semantic search |
| Answer checks | Real | Word patterns, reviewed by nobody |
| Emergency words, readings, crisis reply | Real, offline | On the phone before any AI |
| 17 first-aid guides, read aloud | Real, offline | IFRC 2020, adapted, unreviewed |
| SOS, Call 112, Tele-MANAS links | Real | They open the dialer. No dispatch, no delivery proof |
| Medicine reminders, guardian SMS | Built | Test reminder shown and cleared. No guardian text has been sent, test or real. "Taken" tap untested |
| Family and health cards | Real, on this phone | No cloud account, sharing links or revocation. Saved details stay out of AI requests, but alerts and reminders text the chosen contacts, and the handoff card uses the laptop server |
| Location share, nearby hospital | Real | Opens Maps or the share sheet. No claim about beds or ambulances |
| Night guard, morning check | Real, off by default | A real call and text worked once on 29 Oct on an earlier build, with knocks played from a speaker. This build is untested. Open decision in `CLINICAL_SAFETY.md` |
| Voice input | Real on Android | A spoken question is still untested. Transcript shows while listening |
| Prepared answers | Real, offline | 371 answers for 207 topics, written in advance by Muse Glimmer (`scripts/build_prepared.py`), unreviewed, not personal |
| Fixed medicine answers | Real, offline | `frontend/src/medicine.ts`. Never gives an amount. Unreviewed |
| Report and medicine photo on the phone | Real, for synthetic samples | Muse Spark with a Meta key, Muse Glimmer with an NVIDIA key, online. The picker itself was opened and cancelled on the phone; the reading was tested with a sample given to the app |
| Handoff record on the phone | Real | Built from the phone's time log and health card |
| Fuller handoff card, guide finder, older report reader | Needs the laptop server | Optional |
| Web demo for judges | Real, limited | No key in the page. Answers from what is built in, plus live AI and the photo reader with a judge code, through `live-server/`. No alarms, reminders or night guard |
| Telugu | Screens only, unreviewed | First aid and answers are in English |
| Hindi | Absent | Only a few search words |
| Login, Gmail or OTP | Absent | Profile with no login, the owner's choice |
| Countries other than India | Absent | `packs/regions/IN.json` holds the capability record |
| Visit-preparation note, Care Card sharing links | Absent | Next candidates |

## How an answer is made (phone)

1. Crisis words → fixed reply. 2. Emergency words (`packs/ai/emergency_rules.json`) → guide's first steps and Call 112. 3. Readings → thresholds; if the
message says more, the AI is asked too. 4. App or saved-data questions → local answer. 5. Fever or dizziness → guide's first steps at once. 6. Retrieve evidence
(`knowledge.ts`). 7. Ask the model with evidence (`aura.ts`); for a general question, after 6 s show MedlinePlus's words from the phone. 8. Check the reply and show
it. If the AI fails, show matching MedlinePlus sentences with a way to call, and say the AI could not answer.

## Known problems

- **The AI key sits in app-private storage on the phone** and was copied over USB. That is fine for one developer's test phone and wrong for a
  public app: a real release needs a server in between.
- `usesCleartextTraffic` is on, for the laptop link over Wi-Fi. Turn it off for a release without the laptop.
- `SEND_SMS` is a restricted permission on Google Play and `CALL_PHONE` needs a good reason; see `LAUNCH_PLAN.md`.
- The answer logic exists twice (TypeScript and Python). The pack files share the prompt, filters and rules, but the code must be kept in step by hand.
- The full native bridge is exposed to pages loaded over plain HTTP in laptop mode. Remove laptop page loading from any public build.
- After an alert, the app can stay open over the lock screen.
- No automated test runs the TypeScript filters directly. They are exercised by browser tests and on the phone.
- The name "AuraHealth" is close to Aura Health, Inc. (see `docs/brand/BRAND.md`).

## Run and build

```powershell
# Tests, from backend\
uv run pytest tests/test_api.py -q
$env:AURA_E2E="1"; uv run pytest tests/test_e2e.py -q
# Laptop app, from the project root
.\start.ps1
# Answer evaluation, from backend\ (calls the real model, needs the NVIDIA key)
uv run python scripts/eval_answers.py after dev
# APK
.\android\build-apk.ps1
adb install -r android\app\build\outputs\apk\debug\app-debug.apk
```

## Next checkpoint

See `QA_AND_EVALUATION.md` for what was tested, including on the phone with internet off. In order: (1) make the repo public, with the owner's OK; (2) record the video; (3) submit; (4) after the hackathon, the blockers in `CLINICAL_SAFETY.md`.
