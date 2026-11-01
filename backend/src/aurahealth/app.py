"""AuraHealth local server: JSON API + the built web app, all on this laptop."""

from __future__ import annotations

import secrets
import shutil
import socket
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, RedirectResponse
from pydantic import BaseModel, Field

from . import ai, chat, config, extraction, firstaid, guidefinder, handoff, ollama, packs, store, structuring

app = FastAPI(title="AuraHealth", version=config.APP_VERSION, docs_url=None, redoc_url=None, openapi_url=None)

STATE = {"lan": False, "pair_code": secrets.token_urlsafe(6)}
LOOPBACK = {"127.0.0.1", "::1", "localhost", "testclient"}
COOKIE = "aura_pair"

CSP = (
    "default-src 'self'; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; "
    "script-src 'self'; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'"
)


@app.middleware("http")
async def guard(request: Request, call_next):
    host = request.client.host if request.client else ""
    if STATE["lan"] and host not in LOOPBACK:
        if request.url.path == "/pair":
            code = request.query_params.get("code", "")
            if secrets.compare_digest(code, STATE["pair_code"]):
                resp = RedirectResponse("/", status_code=303)
                resp.set_cookie(COOKIE, STATE["pair_code"], httponly=True, samesite="lax")
                return resp
        if not secrets.compare_digest(request.cookies.get(COOKIE, ""), STATE["pair_code"]):
            return HTMLResponse(
                "<!doctype html><meta name=viewport content='width=device-width'><body style='font-family:system-ui;"
                "padding:24px'><h1>AuraHealth</h1><p>Open the pairing link shown in the laptop window to use this "
                "device.</p><p><a href='tel:112' style='font-size:22px'>Emergency (India): 112</a></p></body>",
                status_code=401,
            )
    response = await call_next(request)
    response.headers["Content-Security-Policy"] = CSP
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Cache-Control"] = "no-store" if request.url.path.startswith("/api") else "no-cache"
    return response


# ---------- status and packs ----------

@app.get("/api/health")
def health():
    models = ollama.status()
    helper = ai.status()
    ready = extraction.readers()
    models.update({"text": helper["ready"], "text_model": helper["model"], "ai_provider": helper["provider"],
                   "ai_online": helper["online"],
                   "vision_runnable": ready["local"], "online_reader": ready["online"], "online_model": config.META_MODEL,
                   "ocr_reader": ready["ocr"], "glimmer_reader": ready["glimmer"]})
    return {"ok": True, "version": config.APP_VERSION, "models": models, "lan": STATE["lan"]}


@app.get("/api/packs")
def get_packs():
    return packs.summary()


@app.get("/api/i18n/{code}")
def get_language(code: str):
    langs = packs.languages()
    if code not in langs:
        raise HTTPException(404, "language not implemented")
    return langs[code]


@app.post("/api/internet-check")
def internet_check():
    """Only on request: one TCP connection attempt to 1.1.1.1:443. No data is sent."""
    try:
        with socket.create_connection(("1.1.1.1", 443), timeout=2.5):
            return {"reachable": True, "method": "TCP connect to 1.1.1.1:443"}
    except OSError:
        return {"reachable": False, "method": "TCP connect to 1.1.1.1:443"}


# ---------- session ----------

class NewSession(BaseModel):
    region: str = "IN"
    language: str = "en"


class SessionPatch(BaseModel):
    language: str | None = None
    who: dict | None = None
    age: str | None = Field(default=None)
    description: dict | None = None
    onset: dict | None = None
    details: dict | None = None
    clear_age: bool = False


@app.get("/api/session")
def get_session():
    return {"session": store.get()}


@app.post("/api/session")
def new_session(body: NewSession):
    region = packs.regions().get(body.region)
    if not region or body.language not in region["languages"]:
        raise HTTPException(400, "region or language not implemented")
    return {"session": store.create(body.region, body.language)}


@app.put("/api/session")
def patch_session(body: SessionPatch):
    session = _require_session()
    if body.language is not None:
        if body.language not in packs.regions()[session["region"]]["languages"]:
            raise HTTPException(400, "language not implemented for this region")
        session["language"] = body.language
    if body.who is not None:
        choice = body.who.get("choice")
        session["who"] = {"choice": choice if choice in ("me", "someone") else None,
                          "label": str(body.who.get("label") or "")[:60]}
    if body.age is not None or body.clear_age:
        session["age"] = body.age if body.age in handoff.AGE_KEYS | {"unknown"} else None
    if body.description is not None:
        session["description"] = _clean_description(body.description)
    if body.onset is not None:
        choice = body.onset.get("choice")
        session["onset"] = {"choice": choice if choice in handoff.ONSET_KEYS | {"unknown", "other"} else None,
                            "other_text": str(body.onset.get("other_text") or "")[:200]}
    if body.details is not None:
        session["details"] = {k: str(body.details.get(k) or "")[:500] for k in handoff.DETAIL_KEYS}
    return {"session": store.save(session)}


@app.delete("/api/session")
def delete_session():
    store.delete()
    return {"deleted": True}


def _require_session() -> dict:
    session = store.get()
    if not session:
        raise HTTPException(409, "no session; start a handoff first")
    return session


def _clean_description(desc: dict) -> dict:
    """Points marked as the text helper's split must really be spans of the description; otherwise they are the user's own edit."""
    text = str(desc.get("text") or "")[: config.MAX_DESCRIPTION_CHARS]
    norm_text = structuring.normalise(text)
    points = []
    for p in (desc.get("points") or [])[:30]:
        ptext = str((p or {}).get("text") or "")[:400].strip()
        if not ptext:
            continue
        source = (p or {}).get("source")
        if source == "user_split" and structuring.normalise(ptext) not in norm_text:
            source = "user"
        points.append({"id": str((p or {}).get("id") or secrets.token_hex(6))[:16], "text": ptext,
                       "source": "user_split" if source == "user_split" else "user",
                       "kept": bool((p or {}).get("kept", True)),
                       "flag_instruction": bool(extraction.INSTRUCTION_LIKE.search(ptext))})
    assist = desc.get("assist")
    if isinstance(assist, dict):
        assist = {k: assist.get(k) for k in ("status", "model", "dropped") if k in assist}
    return {"text": text, "points": points, "assist": assist}


# ---------- first-aid time log ----------

class GuideEvent(BaseModel):
    id: str
    kind: str
    guide: str | None = None
    step: str | None = None
    choice: str | None = None
    role: str | None = None
    at: str


class EventBatch(BaseModel):
    events: list[GuideEvent]


@app.post("/api/session/events")
def add_events(body: EventBatch):
    """The phone may send the same event again after a lost connection; ids make that harmless."""
    session = _require_session()
    events = session.setdefault("events", [])
    known = {e["id"] for e in events}
    number = packs.regions()[session["region"]]["emergency"]["number"]
    accepted = rejected = 0
    for raw in body.events[:50]:
        if raw.id in known:
            accepted += 1
            continue
        entry = firstaid.describe(raw.model_dump(), packs.guides(), number)
        if entry is None or len(events) >= firstaid.MAX_EVENTS:
            rejected += 1
            continue
        events.append(entry)
        known.add(entry["id"])
        accepted += 1
    return {"session": store.save(session), "accepted": accepted, "rejected": rejected}


# ---------- text helper (Llama 3.2 3B) ----------

class SplitRequest(BaseModel):
    text: str


@app.post("/api/structure")
def structure(body: SplitRequest):
    return structuring.split(body.text)


@app.post("/api/guide-finder")
def guide_finder(body: SplitRequest):
    """Suggests which first-aid guide to open. The words are not saved; no session is needed."""
    return guidefinder.find(body.text)


class ChatTurn(BaseModel):
    role: str
    text: str = Field(max_length=2000)


class ChatRequest(BaseModel):
    messages: list[ChatTurn] = Field(max_length=40)
    region: str = "IN"


@app.post("/api/chat")
def chat_reply(body: ChatRequest):
    """Talk to Aura. The conversation is sent to the AI helper and not saved; no session is needed."""
    region = packs.regions().get(body.region) or packs.regions()["IN"]
    return chat.reply([t.model_dump() for t in body.messages], region["emergency"]["number"])


# ---------- report image + reader (Llama 3.2 Vision) ----------

@app.post("/api/document")
async def upload_document(file: UploadFile = File(...)):
    session = _require_session()
    data = await file.read(config.MAX_UPLOAD_BYTES + 1)
    try:
        doc = extraction.save_upload(data, file.filename or "report")
    except extraction.UploadError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {"session": _attach_document(session, doc, is_sample=False)}


@app.post("/api/document/sample/{name}")
def use_sample(name: str):
    session = _require_session()
    samples = {p.stem: p for p in (config.SAMPLE_DIR / "reports").glob("*.png")}
    if name not in samples:
        raise HTTPException(404, "unknown sample")
    doc = extraction.save_upload(samples[name].read_bytes(), samples[name].name)
    return {"session": _attach_document(session, doc, is_sample=True)}


def _attach_document(session: dict, doc: dict, is_sample: bool) -> dict:
    old = session.get("document")
    if old and old.get("id"):
        extraction.image_path(old["id"]).unlink(missing_ok=True)
    doc["is_sample"] = is_sample
    session["document"] = doc
    return store.save(session)


@app.delete("/api/document")
def remove_document():
    session = _require_session()
    old = session.get("document")
    if old and old.get("id"):
        extraction.image_path(old["id"]).unlink(missing_ok=True)
    session["document"] = None
    return {"session": store.save(session)}


@app.get("/api/document/image/{doc_id}")
def document_image(doc_id: str):
    try:
        path = extraction.image_path(doc_id)
    except extraction.UploadError as exc:
        raise HTTPException(400, str(exc)) from exc
    if not path.exists():
        raise HTTPException(404, "no such image")
    return FileResponse(path, media_type="image/jpeg")


class ExtractRequest(BaseModel):
    engine: str = "local"   # "online" sends the photo to Meta's servers: only when the person chose it
    # "ocr" = Windows' built-in text reader + Llama 3.2 3B, on this laptop


@app.post("/api/document/extract")
def extract_document(body: ExtractRequest | None = None):
    session = _require_session()
    doc = session.get("document")
    if not doc:
        raise HTTPException(409, "no document")
    engine = body.engine if body else "local"
    ready = extraction.readers()
    model = extraction.reader_model(engine)
    if not ready.get(engine):
        doc["extraction"] = {"status": "reader_missing", "model": model, "engine": engine}
        store.save(session)
        return {"job": None, "status": "reader_missing", "session": session}
    job_id = extraction.start_job(doc["id"], engine)
    doc["extraction"] = {"status": "running", "job": job_id, "model": model, "engine": engine}
    store.save(session)
    return {"job": job_id, "status": "running"}


@app.get("/api/document/extract/{job_id}")
def extract_status(job_id: str):
    job = extraction.job(job_id)
    if job is None:
        raise HTTPException(404, "no such job")
    session = _require_session()
    doc = session.get("document")
    if job["status"] != "running" and doc and doc.get("id") == job["doc_id"] and \
            (doc.get("extraction") or {}).get("job") == job_id and doc["extraction"].get("status") == "running":
        user_fields = [f for f in doc.get("fields", []) if f.get("origin") == "user"]
        doc["fields"] = job.get("fields", []) + user_fields
        doc["extraction"] = {"status": job["status"], "job": job_id,
                             "model": job.get("model") or doc["extraction"].get("model"), "engine": job.get("engine"),
                             "timing": job.get("timing"), "error": job.get("error"), "ocr_text": job.get("ocr_text")}
        session = store.save(session)
    return {"status": job["status"], "session": session}


class FieldsPatch(BaseModel):
    fields: list[dict]
    current: str | None = None


@app.put("/api/document/fields")
def update_fields(body: FieldsPatch):
    session = _require_session()
    doc = session.get("document")
    if not doc:
        raise HTTPException(409, "no document")
    stored = {f["id"]: f for f in doc.get("fields", [])}
    updated = []
    for f in body.fields[: config.MAX_FIELDS]:
        fid = str(f.get("id") or "")[:16]
        status = f.get("status") if f.get("status") in ("proposed", "confirmed", "removed") else "proposed"
        label = extraction.clean(f.get("label", ""), config.MAX_FIELD_LABEL)
        value = extraction.clean(f.get("value", ""), config.MAX_FIELD_VALUE)
        if fid in stored and stored[fid].get("origin") == "model":
            base = stored[fid]   # the model's original reading cannot be rewritten by the client
            updated.append({**base, "label": label or base["label"], "value": value, "status": status,
                            "flag_instruction": bool(extraction.INSTRUCTION_LIKE.search(f"{label} {value}"))
                            or base.get("flag_instruction", False)})
        else:
            updated.append({"id": fid or secrets.token_hex(6), "label": label, "model_value": None, "value": value,
                            "status": status, "origin": "user",
                            "flag_instruction": bool(extraction.INSTRUCTION_LIKE.search(f"{label} {value}"))})
    doc["fields"] = updated
    doc["current"] = body.current if body.current in ("yes", "no") else None
    return {"session": store.save(session)}


# ---------- handoff ----------

@app.get("/api/handoff")
def get_handoff():
    return handoff.build(_require_session())


@app.get("/api/samples")
def list_samples():
    folder = config.SAMPLE_DIR / "reports"
    return {"samples": sorted(p.stem for p in folder.glob("*.png"))}


@app.get("/api/samples/{name}.png")
def sample_image(name: str):
    path = config.SAMPLE_DIR / "reports" / f"{Path(name).name}.png"
    if not path.exists():
        raise HTTPException(404, "unknown sample")
    return FileResponse(path, media_type="image/png")


# ---------- web app ----------

@app.get("/{path:path}")
def web_app(path: str):
    if path.startswith("api/"):
        raise HTTPException(404)
    dist = config.FRONTEND_DIST
    target = (dist / path).resolve()
    if path and target.is_file() and dist.resolve() in target.parents:
        return FileResponse(target)
    index = dist / "index.html"
    if not index.exists():
        return HTMLResponse("<h1>AuraHealth</h1><p>Frontend not built. Run: cd frontend &amp;&amp; npm run build</p>", 503)
    return FileResponse(index)


@app.exception_handler(packs.PackError)
def pack_error(_: Request, exc: packs.PackError):
    return JSONResponse({"detail": f"pack error: {exc}"}, status_code=500)


def reset_for_tests(lan: bool = False) -> None:
    STATE["lan"] = lan
    if config.UPLOAD_DIR.exists():
        shutil.rmtree(config.UPLOAD_DIR, ignore_errors=True)
