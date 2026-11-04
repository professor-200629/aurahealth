# Live AI for the web demo

A small Vercel function that lets judges try Meta Muse Spark from the web demo, without any key in the page.

- `api/ask.js` holds the limits: a judge code (only its hash is here), fixed prompts, short inputs, rate limits, and a stop date of 10 Nov 2026.
- `prompts.json` is built from `packs/ai/aura_chat.json` by `scripts/build_live_prompts.py`.
- The key is the `MODEL_API_KEY` environment variable on Vercel. It is never in this repo.

The rate limits are kept in memory, so they apply to each running copy of the server. They are not a perfect hard cap. To stop it at once, delete the key from the Meta account or the Vercel project.

The Android app does not use this server. It calls Meta directly with a key saved on the phone.
