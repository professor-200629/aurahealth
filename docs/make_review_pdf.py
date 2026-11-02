"""Turn packs/guides/en.json into a printable review sheet for a clinician (HTML, then PDF with Microsoft Edge).

Run from the project folder:  python docs/make_review_pdf.py
"""

import html
import json
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
pack = json.loads((ROOT / "packs" / "guides" / "en.json").read_text(encoding="utf-8"))
number = json.loads((ROOT / "packs" / "regions" / "IN.json").read_text(encoding="utf-8"))["emergency"]["number"]
meta = pack["meta"]
esc = lambda s: html.escape(s.replace("{number}", number))

parts = []
for n, g in enumerate(pack["guides"], 1):
    rows = []
    for i, s in enumerate(g["steps"], 1):
        extra = ""
        if s.get("choices"):
            extra = "<div class='choices'>Answers: " + " / ".join(esc(c["label"]) for c in s["choices"]) + "</div>"
        kind = {"call": "Call", "cpr": "CPR beat", "question": "Question", "action": "Step"}[s["kind"]]
        rows.append(
            f"<tr><td class='n'>{i}</td><td class='k'>{kind}</td><td>{esc(s['text'])}{extra}</td>"
            "<td class='box'>&#9744; OK<br>&#9744; Change<br>&#9744; Remove</td><td class='c'></td></tr>")
    donts = "".join(f"<li>{esc(d)}</li>" for d in g.get("do_not", []))
    notes = "".join(f"<li>{esc(d)}</li>" for d in g.get("notes", []))
    parts.append(f"""
<section class="guide">
  <h2>{n}. {esc(g['title'])}</h2>
  <p class="when"><b>When:</b> {esc(g['when'])} &nbsp;·&nbsp; <b>IFRC 2020 pages:</b> {esc(g['source_pages'])}</p>
  <table>
    <tr><th>#</th><th>Type</th><th>What the app says (read aloud)</th><th>Your check</th><th>Comments</th></tr>
    {''.join(rows)}
  </table>
  {f'<div class="dont"><b>Do not</b><ul>{donts}</ul></div>' if donts else ''}
  {f'<div class="note"><b>Good to know</b><ul>{notes}</ul></div>' if notes else ''}
  {f'<div class="note"><b>Shown first in "Talk to Aura"</b> (when someone describes this emergency in the chat, before they open the guide): {esc(g["chat_now"])} &nbsp; &#9744; OK &#9744; Change</div>' if g.get('chat_now') else ''}
  <p class="overall">Overall for this guide: &#9744; Approve &nbsp; &#9744; Approve with the changes above &nbsp; &#9744; Do not use</p>
</section>""")

doc = f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>AuraHealth first-aid guides for clinical review</title>
<style>
  @page {{ size: A4; margin: 14mm; }}
  body {{ font-family: "Segoe UI", Arial, sans-serif; color: #12302e; font-size: 11pt; line-height: 1.4; }}
  h1 {{ font-size: 20pt; margin: 0 0 4px; }} h2 {{ font-size: 14pt; margin: 18px 0 4px; color: #1f6f68; }}
  .lead {{ background: #e3f0ee; border-radius: 8px; padding: 10px 12px; }}
  table {{ width: 100%; border-collapse: collapse; margin-top: 6px; }}
  th, td {{ border: 1px solid #c9c3b6; padding: 6px; vertical-align: top; text-align: left; }}
  th {{ background: #f1ede4; font-size: 9.5pt; }}
  td.n {{ width: 18px; }} td.k {{ width: 62px; font-size: 9.5pt; color: #5d6e6c; }}
  td.box {{ width: 78px; font-size: 9.5pt; white-space: nowrap; }} td.c {{ width: 30%; }}
  .choices {{ color: #5d6e6c; font-size: 9.5pt; margin-top: 3px; }}
  .dont {{ background: #fbeae8; border-radius: 6px; padding: 6px 10px; margin-top: 6px; }}
  .note {{ background: #f6f4ef; border-radius: 6px; padding: 6px 10px; margin-top: 6px; }}
  ul {{ margin: 4px 0; padding-left: 18px; }}
  .guide {{ page-break-inside: avoid; }} .overall {{ font-size: 10pt; }}
  .sign td {{ height: 30px; }}
</style></head><body>
<h1>AuraHealth: first-aid guides for clinical review</h1>
<p class="lead">AuraHealth is a free research prototype (simulation only, not a medical device). While someone waits for
an ambulance, it shows these steps one at a time and reads them aloud, and it saves the time of each step for the
doctor. The steps are fixed text written in plain English from the <b>{esc(meta['source']['publisher'])}</b>,
<i>{esc(meta['source']['title'])}</i>. No AI writes or changes them. {esc(meta['scope_note'])} {esc(meta['left_out'])}
The emergency number shown is {number} (India).</p>
<p><b>Please check each step:</b> is it correct, safe and clear for an ordinary person under stress? Tick OK, Change
or Remove, and write the change in Comments. Anything missing that a bystander should do (or must not do), please add.</p>
{''.join(parts)}
<h2>Reviewer</h2>
<table class="sign"><tr><td>Name</td><td></td></tr><tr><td>Qualification / registration</td><td></td></tr>
<tr><td>Date</td><td></td></tr><tr><td>May we say on our demo video that you reviewed these steps? (Yes / No)</td><td></td></tr>
<tr><td>Signature</td><td></td></tr></table>
</body></html>"""

out_html = ROOT / "docs" / "AuraHealth_first_aid_guides_for_review.html"
out_pdf = out_html.with_suffix(".pdf")
out_html.write_text(doc, encoding="utf-8")
edge = shutil.which("msedge") or r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
subprocess.run([edge, "--headless", "--disable-gpu", "--no-pdf-header-footer", f"--print-to-pdf={out_pdf}", out_html.as_uri()],
               check=True, timeout=120)
print(out_pdf)
