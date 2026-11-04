"""Measure the rules that run without the model on synthetic messages (backend/eval/rules_corpus.json). No network.

Run from backend/:  uv run python scripts/eval_rules.py [--misses]
The phrases were written by review agents to break the rules. Rules were then tuned against them, so these numbers show
what the rules now catch on this set, not how they will do on new wording. Nobody clinical has reviewed them.
"""

from __future__ import annotations

import json
import sys

from aurahealth import chat, config

CORPUS = json.loads((config.ROOT / "backend" / "eval" / "rules_corpus.json").read_text(encoding="utf-8"))
SHOW = "--misses" in sys.argv


def walk(node, path=()):
    if isinstance(node, list):
        yield path, node
    elif isinstance(node, dict):
        for k, v in node.items():
            yield from walk(v, path + (k,))


def main() -> int:
    totals: dict[str, list[int]] = {}
    print("Emergency messages that must fire")
    for path, items in walk(CORPUS["emergency"]):
        hits = [t for t in items if chat.red_flags(t)[0]]
        kind = path[-1]
        totals.setdefault(kind, [0, 0])
        totals[kind][0] += len(hits)
        totals[kind][1] += len(items)
        if SHOW:
            for t in items:
                if t not in hits:
                    print(f"  MISS {'/'.join(path)}: {t}")
    for kind, (a, b) in totals.items():
        print(f"  {kind:10} {a}/{b}")
    print("Ordinary messages that must not fire")
    for path, items in walk(CORPUS["false_alarm"]):
        hits = [t for t in items if chat.red_flags(t)[0]]
        print(f"  {'/'.join(path):16} {len(hits)} false alarms of {len(items)}")
        if SHOW:
            for t in hits:
                print(f"  FALSE {t}")
    print("Crisis wording")
    for path, items in walk(CORPUS["crisis"]):
        hits = [t for t in items if chat.crisis_text(t, "112")]
        print(f"  {'/'.join(path):24} {len(hits)}/{len(items)}")
        if SHOW:
            for t in items:
                if t not in hits:
                    print(f"  {'MISS' if 'not' not in path[-1] and 'false' not in path[-1] else 'ok'} {path[-1]}: {t}")
    print("Unsafe sentences that must be removed")
    for path, items in walk(CORPUS["filters"]):
        kept = [t for t in items if not chat.sentence_problem(t)]
        print(f"  {'/'.join(path):32} kept {len(kept)} of {len(items)}")
        if SHOW:
            for t in kept:
                print(f"  KEPT {path[-1]}: {t}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
