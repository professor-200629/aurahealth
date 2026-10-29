# Guidance sources

## First-aid guides (`packs/guides/en.json`)

The 9 guides (a "start here" check plus CPR, recovery position, choking, heavy bleeding, chest pain, stroke
signs, snakebite and seizure) are written in plain English by the AuraHealth developer from:

- **International first aid, resuscitation and education guidelines 2020**, International Federation of Red
  Cross and Red Crescent Societies (IFRC):
  https://www.ifrc.org/document/international-first-aid-resuscitation-and-education-guidelines
- Reuse terms, from the copyright page of the guidelines: copies of all or part may be made for **non-commercial
  use, providing the source is acknowledged**; the IFRC would appreciate receiving details of its use.
- Every guide lists the guideline pages it comes from (`source_pages`).

Rules for these guides:

- The steps are fixed text. No model writes, translates or changes them. A model may only suggest which guide
  matches what a person describes, and the person confirms.
- Medicine doses are left out on purpose (for example the aspirin step for chest pain). The guide says to ask
  the 112 operator.
- Status: `adapted_unreviewed` until a clinician has checked every step against the guidelines. Then set
  `meta.review`, and record who reviewed and when.
- English only. Any translation needs a qualified translator and a clinician before it is offered.

## Region guidance cards (`packs/regions/*.json`, `guidance_cards`)

None. No India-specific guidance is bundled: for example, the Ministry of Home Affairs website policy does not
allow reproducing its content without permission. Only the emergency number and its source are used.
