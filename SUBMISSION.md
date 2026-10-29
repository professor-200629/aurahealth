# Submission draft (Meta Global AI Developer Hackathon, indie track)

Deadline: **4 Nov 2026, 9:00 PM EST = 5 Nov 2026, 07:30 IST.** Draft text below; check every claim against
`EVALUATION.md` before pasting. Replace the `[…]` parts yourself.

## Name

AuraHealth: the Offline Emergency Bridge

## One line

An offline phone + laptop assistant, powered by local Meta Llama models, that turns a panicked description into
an honest, source-labelled handoff card for emergency services, without diagnosing anything.

## The problem

When someone collapses or falls next to you, you must explain what happened to a stranger on the phone, under
stress. People forget details, guess, or repeat advice from an app. In many places the internet is weak or
absent exactly when it matters, and cloud AI is not an option.

## What it does

- A **Call 112** button is visible on every screen. It opens the dialer; it never calls by itself.
- Short questions with "I don't know". Unknown stays unknown on the card.
- **Llama 3.2 3B** (local, via Ollama) splits the person's own words into points. Code checks every point is
  their exact words, and keeps any words the model left out.
- **Llama 3.2 Vision 11B** (local, optional) reads a photo of a report and only *proposes* fields; the person
  confirms or corrects each one next to the image. [Only if measured: "On my laptop it took … per report and read
  … of … fields correctly on 5 synthetic reports."]
- The handoff card shows where every line came from (*you said*, *your words split by the helper*, *from report,
  you confirmed / corrected*) with a tap-to-see evidence view.
- It always says "AuraHealth can't assess this situation": no diagnosis, no triage, no "safe to wait".
- Data stays on the laptop; one tap deletes it. No accounts, no analytics.

## How we built it

React + TypeScript phone web app served by a FastAPI server on the laptop. Ollama runs the Meta models locally.
A deterministic builder (no model) makes the card. Safety rules are enforced in code and covered by 19 API tests
and 3 browser tests (all passing): the emergency control is reachable on every screen, all requests stay on the
laptop, invented "split" points are rejected, model readings cannot be overwritten, embedded instructions are
flagged and change nothing. A full run on a real Android phone (Samsung Galaxy A36, Chrome) found three problems,
all fixed: pairing links opened from other apps failed, the keyboard pushed the call button off screen, and one
question was misread.

## Meta tools used

- Llama 3.2 3B (open weights) — text helper, measured on a laptop CPU: 1.7–5.5 s per description (8 cases).
- Llama 3.2 Vision 11B (open weights) — report reader. [Measured: … / Not measured yet: say so.]

## Challenges

- Making a model useful without letting it decide anything: every model output is a proposal checked by code.
- Measuring honestly: our own test found the 3B model silently dropped a sentence ("I don't know her
  temperature"); we changed the server so the user's words can never be lost.
- No reusable medical guidance source with suitable terms, so we show an honest "can't assess" instead.

## What's next

Clinical and native-language review, a licensed guidance source, real-phone offline testing, encrypted storage.
See `ROADMAP.md`.

## Honesty notes to include

Research prototype, simulation only, fictional people and synthetic reports. Not a medical device, not
clinically validated. Telugu UI is an unreviewed AI-assisted draft. Setup: phone interface + local laptop server.

## Links

- Code: [repo link, after you decide to publish it]
- Video: [link]

## Before you submit (your actions)

- [ ] Decide whether to publish the repository, and add a license if you do.
- [ ] Install and measure the vision model, or keep the "not measured" wording.
- [ ] Run the manual offline check on your phone and note the result.
- [ ] Record the video from `DEMO_SCRIPT.md`.
- [ ] Fill in the submission form yourself.
