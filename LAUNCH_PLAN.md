# AuraHealth launch plan

Draft of 4 Nov 2026. Not legal or medical advice. Nothing here says the app complies with, or is exempt from, any rule. No clinician has reviewed the app. Every item marked "Adviser" must be confirmed by a qualified adviser before the pilot. Sources and gaps: see EVIDENCE.md.

## Phases

1. Phase 0 (now): fix the blockers below. No real users.
2. Phase 1: supervised India pilot with a small named group, with a clinician and an adviser on call.
3. Phase 2: public India release, only after Phase 1 review and adviser sign-off.
4. Phase 3: each other market on its own plan (EU, US, others). Nothing in Phase 1 carries over by default.

## Blockers to settle before any real user

- API key: it is stored on the phone and copied over USB. A public app needs a server in between, and the native bridge must not be reachable from plain HTTP pages.

- AI service terms: NVIDIA's free trial terms say trial use only, not production, and say user content may be used to improve NVIDIA products (EVIDENCE N1). A pilot with real families likely does not fit. Meaning for the app: get a production route with clear data terms, or run the pilot with no personal data sent to the AI. Adviser confirms.
- No clinician has reviewed the guides, the chat answers or the 112 handoff card.
- Source text: do not reuse WHO text in a possible company app (non-commercial licence). NHS text is under the Open Government Licence with attribution and refresh rules, and you may not charge for access to it (EVIDENCE N2, N3).

## India items

| Item | What the source says | What it may mean for this app | Confirm |
|---|---|---|---|
| CDSCO software class | Software for a medical purpose is a device under MDR-2017. Wellness software that avoids disease claims is outside. Triage or early-sign detection counts as medical purpose. CDSCO confirms the class. Document is awareness only (EVIDENCE row 9) | First-aid guides and reminders may sit differently from the symptom chat and any "what could this be" feature. The chat and the night guard may be the risky parts. The intended-use wording matters | Adviser |
| NMC telemedicine | Primary text not read (404). Law-firm notes say AI platforms may not counsel patients or prescribe medicines | The chat must not diagnose, counsel on treatment or suggest drug doses. Reminders must only repeat what a doctor already prescribed | Adviser; read primary text |
| DPDP | Not read from MeitY (403). Summaries say Rules notified 13 Nov 2025, with duties like notice, safeguards and breach reporting starting about 18 months later | Health data and a guardian's phone number are personal data. Plan for notice, consent, deletion and breach reporting before the pilot, not after | Adviser; confirm dates |
| Play health declaration | All developers complete the Health apps declaration. Non-device health apps carry a "not a medical device" line. Remind users to see a professional (EVIDENCE row 18) | Fill the form truthfully. Do not claim approval or accuracy. Listing text must match the CDSCO position | Adviser |
| SMS and call permissions | SEND_SMS is restricted. An exception exists for apps that send emergency SMS alerts, and needs the Permissions Declaration Form. CALL_PHONE is not in the tables. A dial intent needs no CALL_PHONE (EVIDENCE row 18b) | Missed-dose SMS to a guardian may or may not fit the emergency exception. Consider dial intent for 112 and an SMS compose intent the user sends. Real SMS is untested on a phone | Adviser; Play review |

## Clinical review

- Find a registered Indian doctor to review all 17 guides, the reading thresholds, the chat prompt and filters, the crisis wording and the 112 card.
- Review the chat's refusal rules and its India-specific emergency numbers.
- Record reviewer name, date and changes. Do not call the app "clinically validated" until a real study exists.
- Re-review whenever a guide or the model changes.

## Incident response

- One named owner, one contact address shown in the app.
- Log harmful or wrong answers with time and version. Keep no more personal data than needed.
- Rule: stop the AI chat with a server switch within the hour if a harmful answer is confirmed.
- Tell the clinician and adviser the same day. Ask the adviser what must be reported and to whom.
- Review each incident and update guides, prompt and tests.

## Pilot steps

1. Fix blockers above. Ask the adviser to confirm the CDSCO and NMC positions in writing.
2. Write plain consent and privacy notices in English and one local language.
3. Limit to a small group of adults who agree to join. Check the guardian agrees to get texts.
4. Test reminders and SMS on the pilot phones, including battery saver and reboot (Android restricts background starts, EVIDENCE row 14).
5. Check contrast of text at 4.5:1 and large text at 3:1.
6. Run for a fixed short period with weekly check-ins.
7. Stop rules: any serious harm, a missed emergency, or adviser objection.
8. Review results with clinician and adviser before any wider release.

## Operating costs

Measured on 4 Nov 2026: one AI answer used about 1,800 input and 340 output tokens (mean of 55). Evidence search, readings and first aid run on the phone and cost nothing.

| Scenario, AI answers a day | Input tokens a month | Output tokens a month |
| --- | --- | --- |
| Low, 100 | 5.4 million | 1 million |
| Medium, 1,000 | 54 million | 10 million |
| High, 10,000 | 540 million | 100 million |

Assumes 30 days and every answer being an AI answer. **Prices are not filled in:** NVIDIA's free trial is not for production, and no price for a production host of Muse Glimmer has been verified. Add the host's published price, plus a server for the key, SMS (the user's own plan today) and storage (none today, as data stays on the phone). The Claude subscriber credits apply only to eligible plans and are bounded; they are not hosting, and Claude is not a Meta model, so they do not fit the hackathon entry.
