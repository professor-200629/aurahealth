# AuraHealth clinical safety notes

Draft of 4 Nov 2026, written by the developer's AI assistant. **No clinician has reviewed anything in this project, including this
file.** It is a working list of hazards, not a safety case.

**Intended use (proposed):** help adults and family caregivers understand health information, prepare for care and act in the first
minutes of an emergency, in a supervised pilot only. Not for diagnosis or treatment decisions. Whether this counts as a regulated
medical purpose in India is an open question (`LAUNCH_PLAN.md`). **Until review, use only fictional people.**

## Content status

| Content | Source | Status |
| --- | --- | --- |
| 17 first-aid guides | IFRC 2020 guidelines, adapted | Unreviewed. The IFRC allows non-commercial use with credit; a company would need permission |
| Reading thresholds | Some from the NHS, American Heart Association and American Diabetes Association (38°C, 180/120, 70 and 54 mg/dL, 92%; the oxygen figure is from NHS COVID-19 home leaflets). Others (40°C, 35°C, 37.5°C, 180 and 300 mg/dL) are the developer's own cut-offs | Unreviewed. Foreign thresholds, not personal targets |
| Evidence pack | MedlinePlus topic summaries (public domain per MedlinePlus) | Published by NLM, written for the US. Not reviewed for use here. Drug monographs are excluded, but the Calcium and Vitamin D topics list recommended amounts; the dose filter removes such sentences from AI answers only. A clinician should decide whether those two stay |
| AI prompt, filters, emergency rules, Hindi and Telugu trigger words | Written by the AI assistant | Unreviewed. Tuned against their own test phrases, so new wording will do worse |
| Crisis reply and Tele-MANAS number | Own words; number from web search results | Unreviewed. Call the number once to confirm it before any pilot |
| Evaluation expectations | Written by the AI assistant | Unreviewed |

**Lifecycle to adopt:** draft → clinical review → approved version → published → superseded or withdrawn. Today everything is at
"draft". The evidence pack and rules carry `review: unreviewed`, the guides carry `adapted_unreviewed`, and the app's source note and About screen say no clinician has reviewed it. An automated test or AI score must never move content forward.

## Hazards and what is in place

| Hazard | What is in place | What can still go wrong |
| --- | --- | --- |
| Emergency not recognised | Emergency words answered on the phone before any AI; the AI is told to escalate; Call 112 added if words match; a Call button shows while the AI is thinking and whenever it fails | **The word rules caught 22 of 49 fresh phrases (`QA_AND_EVALUATION.md`).** New wording can get past the patterns and the AI |
| Help delayed | SOS is on every screen and needs no AI. Two taps by design, to stop pocket presses | The second tap costs a moment. Needs user testing |
| False reassurance | Sentences such as "nothing to worry about" are removed | Different wording gets through. Reassurance can be implied |
| Diagnosis stated | "You have X" patterns removed. Common causes may be named generally | People may read a listed cause as their diagnosis |
| Wrong medicine advice | Amounts and start or stop directions removed. Only "do not double" warnings are kept | Patterns can miss wording. Interaction answers rest on general knowledge |
| Wrong citation | Only retrieved passages can be cited, and they must share words with the answer | Sharing words does not prove support for each claim |
| Foreign guidance | The source note says it is written for the US | Medicines and services differ in India |
| AI service down or slow | First-aid guides, readings and saved facts still answer. The app says when the AI could not answer | Questions with no matching topic get only the error |
| Self-harm | Fixed reply, Call 112 and Tele-MANAS, with no AI. Those words and the reply are kept out of later AI requests | Indirect wording may not match, and ordinary sentences can trigger it. The wording needs expert review |
| Speech errors | The AI is told to expect them. The transcript is shown | Emergency patterns may miss a misheard word |
| Over-reliance on guardian text | The words say "not marked taken" | The SMS can fail. Delivery is not confirmed to the person |
| Night guard listening | Off by default, on-device, started by the person, foreground notification | **See below** |
| Private data sent to the AI | A note under the Home box and on the chat screen asks people not to type names. Answers built from saved details are kept out of AI requests | NVIDIA's trial terms allow it to use what is sent. People may still type private details |
| Testing harms real people | Tests use fictional data. Real SMS and call tests need the owner's approval each time | Test mode must stay clearly separate before any pilot |

## Open decision: the night guard

The product brief says not to ship "continuous microphone surveillance". The night guard listens for three knocks through the
microphone while it is on. It is off by default, started by the person, and processes audio on the device without storing it, but it
does listen, and it can automatically phone and text the chosen contacts. CDSCO's guidance also lists early-sign detection as a
medical purpose. **The owner must decide** whether it stays for the pilot, stays only as a labelled experiment, or goes.

## Release blockers before any real person uses this

1. A registered clinician reviews the guides, thresholds, prompt, filters and crisis wording.
2. An AI service whose terms allow production use and do not use people's data to improve products.
3. An adviser's view on CDSCO software classification and NMC limits on AI counselling.
4. Privacy notice and consent; the data flow reviewed against the DPDP Rules.
5. Tele-MANAS number confirmed by calling it.
6. Reminder, SMS and call behaviour tested on pilot phones.
7. Permission to use IFRC content if the project becomes a company.

Any dangerous regression in the evaluation (`QA_AND_EVALUATION.md`) blocks release. A clean run does not show that the risk is zero.
