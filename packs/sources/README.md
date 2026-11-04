# Guidance sources

## First-aid guides (`packs/guides/en.json`)

The 17 guides (start here, CPR, recovery position, choking, heavy bleeding, chest pain, stroke signs, snakebite, seizure, low blood
sugar, breathing difficulty, severe allergic reaction, poisoning, burns, head injury, feeling faint, fever) were prepared in plain English
by the developer with an AI coding assistant from:

- **International first aid, resuscitation and education guidelines 2020**, International Federation of Red
  Cross and Red Crescent Societies (IFRC):
  https://www.ifrc.org/document/international-first-aid-resuscitation-and-education-guidelines
- Reuse terms, from the copyright page of the guidelines: copies of all or part may be made for **non-commercial
  use, providing the source is acknowledged**; the IFRC would appreciate receiving details of its use.
- Every guide lists the guideline pages it comes from (`source_pages`).

Rules for these guides:

- While the app runs, the steps are fixed text: no model writes, translates or changes them. Some wording followed suggestions from another AI app (`docs/GUIDE_CHANGES.md`). A model may only suggest which guide
  matches what a person describes, and the person confirms.
- Medicine doses are left out on purpose (for example the aspirin step for chest pain). The guide says to ask
  the 112 operator.
- Status: `adapted_unreviewed` until a clinician has checked every step against the guidelines. Then set
  `meta.review`, and record who reviewed and when.
- English only. Any translation needs a qualified translator and a clinician before it is offered.

## Region guidance cards (`packs/regions/*.json`, `guidance_cards`)

None. No India-specific guidance is bundled: for example, the Ministry of Home Affairs website policy does not
allow reproducing its content without permission. Only the emergency number and its source are used.

## Talk to Aura evidence (`packs/knowledge/`)

- `medlineplus_en.json`: topic summaries from MedlinePlus (National Library of Medicine), which MedlinePlus says are public domain. Credit: "Source: MedlinePlus, National Library of Medicine". Do not use its logo or imply endorsement. Its A.D.A.M. encyclopedia and drug monographs are copyrighted and must not be added. Written for the US. Built by `scripts/build_knowledge.py`.
- `aliases.json`: everyday and Indian words pointing to topics. Written by the AI assistant. Unreviewed.

## Rules and thresholds

- `packs/ai/emergency_rules.json` and the filters in `packs/ai/aura_chat.json`: written by the AI assistant. Unreviewed.
- Reading thresholds (`frontend/src/readings.ts`): see the comment at the top of that file and `CLINICAL_SAFETY.md`.
- Crisis line: `packs/regions/IN.json`.
