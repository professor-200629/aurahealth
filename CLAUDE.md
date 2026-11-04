# AuraHealth: facts for future sessions

- Stack: `frontend/` React + Vite + TS; `backend/` FastAPI + SQLite (uv, Python 3.11); `android/` Java WebView with the `AuraNative` bridge; shared content in `packs/`.
- AI: Meta Muse Glimmer (`meta/muse-glimmer-30b`) on NVIDIA's API. The Meta hackathon requires a Meta model, so do not swap it for that entry. Keys never go in chat, logs or git.
- Answer logic is written twice and must stay in step: `frontend/src/aura.ts` + `knowledge.ts` (phone) and `backend/src/aurahealth/chat.py` + `knowledge.py` (laptop). The prompt and filters are shared in `packs/ai/aura_chat.json`.
- Evidence pack: `packs/knowledge/medlineplus_en.json`, rebuilt by `scripts/build_knowledge.py`. Topic summaries only. Never add A.D.A.M. or drug monographs (copyrighted).
- Tests, from `backend/`: `uv run pytest tests/test_api.py -q`; browser: `$env:AURA_E2E="1"; uv run pytest tests/test_e2e.py -q`.
- Answer evaluation, from `backend/`: `uv run python scripts/eval_answers.py <label> dev`. Do not tune on the `held` cases in `backend/eval/answer_cases.json`.
- APK: `npm run build` in `frontend/`, copy `dist` to `android/app/src/main/assets/web`, then the Gradle 9.3.1 wrapper with `assembleDebug` (JAVA_HOME = Android Studio's `jbr`).
- Status and next step: `BUILD_STATUS.md`. Safety and blockers: `CLINICAL_SAFETY.md`. Results: `QA_AND_EVALUATION.md`.
- Rules from the owner: ask before every commit, push or publish. Real SMS or call tests need approval each time. Never claim clinical validation, compliance or doctor equivalence. No clinician has reviewed this app.
