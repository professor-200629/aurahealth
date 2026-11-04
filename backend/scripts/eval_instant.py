"""How much does Talk to Aura answer at once, with the AI cut off? The same 60 synthetic questions, through the real screen.

Needs the app served (for example .\\start.ps1 or the preview on port 8030). From backend/:
    uv run python scripts/eval_instant.py http://127.0.0.1:8030
Runs the phone's own code in Edge at phone size, with /api/chat blocked. The checks are word checks on the same cases as
eval_answers.py: they can find failures, and they are not clinical performance. Writes EVAL_RESULTS/instant_<timestamp>.json.
"""

from __future__ import annotations

import importlib.util
import json
import statistics
import sys
import time
from datetime import datetime
from pathlib import Path

from playwright.sync_api import sync_playwright

from aurahealth import config

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("eval_answers", HERE / "eval_answers.py")
ea = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ea)

NO_AI = ("couldn't reach the ai", "could not get an answer", "can't answer that without", "taking too long")


def main() -> int:
    base = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8030"
    rows = []
    with sync_playwright() as p:
        b = p.chromium.launch(channel="msedge")
        ctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
        page = ctx.new_page()
        page.route("**/api/chat", lambda route: route.abort())
        for case in ea.CASES:
            page.goto(base + "/#chat")
            page.reload()
            page.get_by_test_id("chat-text").wait_for()
            page.get_by_test_id("chat-text").fill(case["text"])
            start = time.perf_counter()
            page.get_by_test_id("chat-send").click()
            page.get_by_test_id("bubble-aura").first.wait_for(timeout=20000)
            first = time.perf_counter() - start
            page.wait_for_timeout(700)
            bubbles = page.get_by_test_id("bubble-aura").all()
            text = " ".join(x.inner_text() for x in bubbles)
            call = page.get_by_test_id("chat-call").count() > 0
            real = any(not any(w in x.inner_text().lower() for w in NO_AI) for x in bubbles)
            row = ea.grade(case, {"reply": text if real else "", "action": "call_emergency" if call else "none"}, first)
            row.update({"real_answer": real, "soft_call": page.get_by_test_id("chat-soft-call").count() > 0, "prepared": "written in advance" in text.lower()})
            rows.append(row)
            print(f"{case['id']:22} {first:4.1f}s real={real!s:5} prep={row['prepared']!s:5} call={call!s:5} {row['concepts_hit']}/{row['concepts_total']}"
                  f"{' MISSED-URGENT' if row['missed_urgent'] else ''}{' OVER' if row['over_escalated'] else ''}", flush=True)
        b.close()
    summary = {
        "cases": len(rows), "real_answer": sum(r["real_answer"] for r in rows), "prepared": sum(r["prepared"] for r in rows),
        "concepts": f"{sum(r['concepts_hit'] for r in rows)}/{sum(r['concepts_total'] for r in rows)}",
        "missed_urgent": [r["id"] for r in rows if r["missed_urgent"]], "over_escalated": [r["id"] for r in rows if r["over_escalated"]],
        "no_answer_no_call": [r["id"] for r in rows if not r["real_answer"] and not r["soft_call"] and not r["urgent_shown"]],
        "reassured": sum(r["reassured"] for r in rows), "diagnosis": sum(r["diagnosis"] for r in rows), "dose": sum(r["dose"] for r in rows),
        "median_first_s": round(statistics.median(r["seconds"] for r in rows), 2), "max_first_s": max(r["seconds"] for r in rows),
    }
    print(json.dumps(summary, indent=1))
    out = config.ROOT / "EVAL_RESULTS" / f"instant_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    out.write_text(json.dumps({"summary": summary, "rows": rows}, ensure_ascii=False, indent=1), encoding="utf-8")
    print("Saved", out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
