# Roadmap

Ordered by what most reduces risk. Nothing here is done unless `CHECKLIST.md` says so.

## Before the hackathon deadline (5 Nov 2026, 07:30 IST)

- Measure the report reader: install `llama3.2-vision:11b`, run `backend/scripts/eval_reader.py`, put the real
  numbers in `EVALUATION.md` (or say clearly that it was not measured).
- Run the manual offline check on a real phone with no internet and write down the result.
- Record the demo video with fictional data only (`DEMO_SCRIPT.md`).

## Next (needs other people)

- **Clinical review** of every user-facing sentence, especially the emergency and "can't assess" text.
- **Native-speaker review** of the Telugu draft, then mark it reviewed in `packs/i18n/te.json` (`meta.review`).
- **Licensed guidance source**: find first-aid content whose terms allow bundling, with permission in writing,
  reviewed for this use, then add it as `guidance_cards` in the region pack with its source.
- **Usability test** with real people using fictional scenarios; measure time to a usable card.
- **Accessibility** check with TalkBack/VoiceOver and large text.
- **Security review** of the Wi-Fi mode and storage.

## Later (engineering)

- Encrypt the local session file, or keep sessions in memory only, with a clear choice for the user.
- HTTPS on the local network (local certificate) so the phone gets a secure context (clipboard, service worker).
- A service worker so the phone keeps the app shell when the laptop is off (needs a secure context).
- More region packs (number, source, languages) through the same validated pack format.
- Offline speech input with a local model, labelled per language, measured before it is offered.
- Smaller or faster vision options if the 11B model is too slow on ordinary laptops; measure before switching.
- Print layout tuned for A4 and a QR code that carries the card text (no network needed).
