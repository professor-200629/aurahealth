# Changes to the first-aid guides

The guides in `packs/guides/en.json` are adapted from the IFRC 2020 guidelines and are **not yet reviewed by a
clinician**. This file lists every change after the first version (29 Oct 2026).

## 2 Nov 2026: wording, after suggestions from August

The developer pasted each guide into **August**, a consumer health chatbot app, and asked it to check the steps.
August's replies are kept word for word in `August_replies_AuraHealth_first_aid.md` (outside the repository). August
called all 9 guides correct and safe and suggested wording changes. **This is not a clinical review**: August is an
AI app, not a doctor or a first-aid trainer.

Only suggestions that match standard first-aid teaching and the IFRC guidelines were taken. Each change makes a step
clearer or says why it matters; none changes what to do.

| Guide | Step | Change |
|---|---|---|
| Someone collapsed | safe | "Go to the person only when it is safe" (was "Then go to the person") |
| CPR | compress | "push hard", and "let the chest come all the way back up" |
| Recovery position | side | says why: keeps the airway open and stops choking if they vomit |
| Recovery position | watch | "If they stop breathing normally, start CPR" |
| Choking | do not | says why blind finger sweeps are wrong: they can push the object further down |
| Heavy bleeding | lie | "so they do not faint and fall" |
| Chest pain | watch | "If they stop responding and are not breathing normally, start CPR" |
| Stroke | call | "If you don't know [when the signs started], say so" |
| Stroke | do not (new) | "Do not give them anything to eat or drink: swallowing may not be safe" |
| Seizure | do not (new) | "Do not give them food, drink or medicine until they are fully awake" |

### Suggestions not taken

- Chest pain: "sit leaning slightly forward". Not in the IFRC guidance; a comfortable position is kept.
- Heavy bleeding: August read "The time is saved for the doctor" as "saves time for the doctor". The step means the
  app saves the time the tourniquet went on; the wording is kept.
- CPR: "think of the song Stayin' Alive". The app already plays a 110-per-minute beat.
- Snakebite: "keep the limb at or below heart level" and "no alcohol or caffeine". Not in the IFRC 2020 snakebite
  steps the guide is based on; left for the clinician review.
- Many small rewordings that said the same thing in more words. The guides stay short on purpose, because they are
  read aloud one step at a time.

The review PDF for a clinician (`docs/AuraHealth_first_aid_guides_for_review.pdf`) was made again after these changes.

## 2 Nov 2026: "what to do first" lines for Talk to Aura

After the August-vs-Aura test (`docs/AUGUST_VS_AURA.md`), each guide the chat can point to got a `chat_now` line:
the first one to three things to do, shown at once when someone describes that emergency in "Talk to Aura". Each
line only repeats steps that are already in the same guide (for choking and heavy bleeding the hands-on step comes
before the call). They are in the review PDF under "Shown first in Talk to Aura" for the clinician to check.

## 2 Nov 2026: new guide "Low blood sugar (diabetes)"

The August-vs-Aura test showed that for "My father is diabetic and is sweating and confused" Aura said to call
112 but not to give sugar. A 10th guide was added from the IFRC 2020 guidelines, "Diabetic emergency", pages
291-294: ask first whether the person is awake and able to swallow (if not, go to "Someone collapsed"); help them sit
down; give something sugary (their own glucose tablets, fruit juice or a sugary non-diet drink, sugar or sweets);
again after 15 minutes if still unwell; call 112 if not clearly better in about 30 minutes or if they get more
drowsy, have a fit or stop responding; afterwards something more filling. Do not: food or drink only if awake and
able to swallow; no diet or sugar-free drinks. The IFRC's amount (15-20 g of glucose) is left out, like all amounts
in AuraHealth. The chat points to this guide when "diabetic" comes with sweating, shaking, confusion or drowsiness,
or when someone says the sugar is low now. The guide finder's list was not changed (it was measured as it is).

