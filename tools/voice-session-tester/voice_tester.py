#!/usr/bin/env python3
"""Sequential synthetic voice sessions for the public Talk with AI frontend API.

Python 3.11+, standard library only. Defaults to preparing audio without network
traffic. Pass --live to call your deployment. Never fabricates provider metrics.
"""
from __future__ import annotations

import argparse
import array
import csv
import io
import json
import math
import random
import re
import shlex
import shutil
import ssl
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import wave
from datetime import datetime, timezone
from pathlib import Path

BASE = "https://parla-con-intelligenza-artificiale.onrender.com"
RATE = 16000
FIELDS = [
    "request_time", "run_id", "agent_id", "conversation_id", "turn", "endpoint",
    "method", "model", "api_key_label", "status_code", "time_to_first_token_ms",
    "time_to_first_byte_ms", "time_to_first_reply_ms", "latency_ms", "input_tokens",
    "output_tokens", "audio_seconds", "request_id", "render_request_id",
    "provider_request_id", "test_request_id", "error", "synthetic",
]

# Each row is a conversation. Rows 2–5 deliberately refer to earlier replies.
SCENARIOS = [
    {"name": "ai-research", "turns": [
        "Tell me about a few recent developments in artificial intelligence research. Explain them in everyday language and mention your sources.",
        "Tell me more about the last development you mentioned. What problem are researchers trying to solve with it?",
        "How does that compare with the earlier approaches you described? Give me a concrete example so I can understand the difference.",
        "What are the main limitations of that approach? Which claims should I treat as preliminary rather than established results?",
        "Please summarize what we discussed in three practical takeaways. Which of those developments should I read about first?",
    ]},
    {"name": "reading-printed-text", "turns": [
        "What tools can help a blind person read printed text? Compare a few different approaches and explain what each one does.",
        "Tell me more about the last option you mentioned. How would someone use it to read a letter at home?",
        "Would that same option work with a restaurant menu? Explain which difficulties might make it less reliable in that situation.",
        "Compare it with using a phone camera. What would someone gain or lose by choosing one approach over the other?",
        "Could you recap the comparison using plain language? Please include one useful question to ask before trying either approach.",
    ]},
    {"name": "phone-accessibility", "turns": [
        "I want to understand the accessibility features on a smartphone. Explain how a screen reader differs from simply making text larger.",
        "Tell me more about the screen reader you just described. What changes about the way someone moves around the screen?",
        "Could you walk me through a simple example of reading a message with it? Describe each step slowly and clearly.",
        "What is a common beginner mistake in that example? Explain how someone could recover without losing their place.",
        "Please recap the main gestures from our conversation. Keep the recap short enough that someone could remember it while practicing.",
    ]},
    {"name": "weeknight-cooking", "turns": [
        "Suggest a few simple vegetarian dinners for a busy evening. I have rice, beans, onions and some frozen vegetables at home.",
        "Tell me more about the last dinner you suggested. What order should I prepare the ingredients in so everything finishes together?",
        "Could I make that recipe with one pot instead? Explain what would change about the steps and the cooking time.",
        "How could I adjust the same meal for someone who dislikes spicy food? Suggest changes without making it bland.",
        "Please give me a short shopping list and a recap of the version we settled on. Include only ingredients I do not already have.",
    ]},
    {"name": "learning-a-language", "turns": [
        "Help me make a small daily routine for learning Italian as a beginner. I can practice for about fifteen minutes each day.",
        "Tell me more about the last exercise you suggested. Show me an example of what I would actually say out loud.",
        "How should I adapt that exercise if I forget a word? Give me a practical way to keep the conversation going.",
        "Could you turn that into a short practice dialogue? Use simple words and explain any expression we have not discussed yet.",
        "Summarize the routine we built and suggest how I could tell whether I am improving after a week of practice.",
    ]},
]
DETAILS = [
    "I'm pretty new to this, so a simple example would help.",
    "I'd find an example easier to follow than a long list.",
    "I'm mostly trying to understand what this means in practice.",
    "I don't need every detail, just enough to get started.",
    "I'm listening rather than reading, so could you keep it fairly simple?",
    "If there's something people often misunderstand about this, I'd like to know.",
]

# Concise variants let a five-second recording contain a complete question.
SHORT_TURNS = {
    "ai-research": ["What's new in AI research? Could you explain a few examples?", "Tell me more about the last development you mentioned.", "How does that compare with the earlier approaches?", "What are the main limitations of that approach?", "Which of those developments should I read about first?"],
    "reading-printed-text": ["What tools help blind people read printed text?", "How would I use that last option at home?", "Would that work with a restaurant menu too?", "How does that compare with a phone camera?", "What should I ask before trying either option?"],
    "phone-accessibility": ["How is a screen reader different from larger text?", "How would I move around the screen with it?", "How would I read a message with it?", "What's a common beginner mistake with that?", "Could you recap the main gestures we discussed?"],
    "weeknight-cooking": ["What vegetarian dinners could I make with rice and beans?", "What order should I prepare those ingredients in?", "Could I make that recipe with one pot?", "How could I make that meal less spicy?", "What else would I need to buy for that?"],
    "learning-a-language": ["How could I practice Italian for fifteen minutes daily?", "What would I actually say in that last exercise?", "What should I do if I forget a word?", "Could you show me a short practice dialogue?", "How could I check my progress after a week?"],
}
FOLLOW_UPS = [
    "Could you explain the last point in a different way?",
    "What would you suggest I try first, based on that?",
    "Could you give me another example of what you mean?",
    "What is a common mistake people make with that?",
    "How would I know whether that approach is working?",
    "What should I do if that first step doesn't work?",
    "Is there a simpler alternative to the approach you described?",
    "Which part of that advice matters most for a beginner?",
    "Could you compare those options with a practical example?",
    "What should I remember most from what we've discussed?",
]


def random_stream(seed=None):
    """Fresh OS entropy by default; explicit seeds support reproducible tests."""
    resolved = random.SystemRandom().getrandbits(128) if seed is None else seed
    return resolved, random.Random(resolved)


def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


def safe_error(value):
    """Prevent common credential formats from leaking into diagnostic text."""
    text = str(value)
    text = re.sub(r"(?i)bearer\s+\S+", "Bearer [REDACTED]", text)
    text = re.sub(r"\b(?:gsk_|sk-)[A-Za-z0-9_\-]+", "[REDACTED]", text)
    text = re.sub(r"(?i)(api[_-]?key|token|password|secret|authorization)([\s\"':=]+)[^\s,}\"]+",
                  r"\1\2[REDACTED]", text)
    return text[:600]


def duration(path):
    with wave.open(str(path), "rb") as wav:
        if (wav.getnchannels(), wav.getsampwidth(), wav.getframerate(), wav.getcomptype()) != (1, 2, RATE, "NONE"):
            raise ValueError(f"{path.name}: expected uncompressed mono 16 kHz, 16-bit PCM WAV")
        return wav.getnframes() / RATE


def augment_wav(source, destination, rng, minimum, maximum, noise, *, target_seconds=None, leading=None, trailing=None):
    """Add small microphone-style variations, measuring actual file duration."""
    with wave.open(str(source), "rb") as wav:
        duration(source)  # validates format
        samples = array.array("h", wav.readframes(wav.getnframes()))
    if sys.byteorder != "little":
        samples.byteswap()
    if not samples or max(abs(x) for x in samples) < 32:
        raise ValueError("Speech synthesis produced empty or silent audio; use an installed voice or --tts-command")
    spoken_seconds = len(samples) / RATE
    if target_seconds is None and spoken_seconds > maximum - 0.2:
        raise ValueError("Generated speech exceeds the duration bound; it will not be cut mid-sentence")
    lead = rng.uniform(0.10, 0.35) if leading is None else leading
    tail = rng.uniform(0.15, 0.55) if trailing is None else trailing
    if target_seconds is not None:
        if not minimum <= target_seconds <= maximum:
            raise ValueError("Audio target is outside the configured bounds")
        wanted = round(target_seconds * RATE) - round(lead * RATE) - round(tail * RATE)
        ratio = wanted / len(samples)
        if not .90 <= ratio <= 1.10:
            raise ValueError("Speech must be synthesized closer to its target before the final timing adjustment")
        # A small timing/pitch adjustment keeps the whole spoken sentence. No
        # clipping and no long silence added to manufacture a duration.
        step = (len(samples) - 1) / max(1, wanted - 1)
        resized = array.array("h")
        for i in range(wanted):
            position = i * step
            left = int(position)
            right = min(left + 1, len(samples) - 1)
            fraction = position - left
            resized.append(round(samples[left] * (1 - fraction) + samples[right] * fraction))
        samples = resized
        spoken_seconds = len(samples) / RATE
    if spoken_seconds + lead + tail < minimum:
        tail += minimum - spoken_seconds - lead - tail
    if lead + tail > 1.2:
        raise ValueError("Speech is too short; refusing to fill the requested duration with silence")
    if spoken_seconds + lead + tail > maximum:
        tail = maximum - spoken_seconds - lead
    frames = array.array("h", [0]) * round(lead * RATE)
    frames.extend(samples)
    frames.extend(array.array("h", [0]) * round(tail * RATE))
    # Account for rounding at the exact lower bound.
    while len(frames) < math.ceil(minimum * RATE):
        frames.append(0)
    gain = rng.uniform(0.84, 0.99)
    sigma = noise * 32767
    for i, value in enumerate(frames):
        frames[i] = max(-32768, min(32767, round(value * gain + (rng.gauss(0, sigma) if sigma else 0))))
    if sys.byteorder != "little":
        frames.byteswap()
    with wave.open(str(destination), "wb") as wav:
        wav.setparams((1, 2, RATE, 0, "NONE", "not compressed"))
        wav.writeframes(frames.tobytes())
    actual = duration(destination)
    if not minimum <= actual <= maximum:
        raise ValueError(f"Generated duration {actual:.3f}s is outside {minimum}–{maximum}s")
    return actual


class AudioFactory:
    def __init__(self, args, rng):
        self.args, self.rng = args, rng
        if not args.tts_command and not (shutil.which("say") and shutil.which("afconvert")):
            raise ValueError("Built-in speech generation needs macOS say + afconvert. On other systems use --tts-command (see README).")

    def make(self, base_text, folder, stem, short_text=None):
        # Uniform draw at WAV sample precision, including both bounds. It is
        # independent of sentence length and does not forbid legitimate repeats.
        target = self.rng.randrange(math.ceil(self.args.audio_min * RATE), math.floor(self.args.audio_max * RATE) + 1) / RATE
        leading = self.rng.uniform(.12, .25)
        trailing = self.rng.uniform(.18, .35)
        wanted_speech = target - round(leading * RATE) / RATE - round(trailing * RATE) / RATE
        rate = self.rng.randint(125, 175)
        if short_text is None:
            short_text = re.split(r"(?<=[.!?])\s+", base_text)[0]
        core = short_text if len(base_text.split()) > wanted_speech * rate / 60 else base_text
        parts = [core]
        details = self.rng.sample(DETAILS, len(DETAILS))
        target_words = wanted_speech * rate / 60
        for detail in details:
            if len(" ".join(parts).split()) >= target_words:
                break
            parts.append(detail)
        raw = folder / (stem + ".raw.wav")
        aiff = folder / (stem + ".aiff")
        final = folder / (stem + ".wav")
        attempts = []
        try:
            for attempt in range(10):
                text = " ".join(parts)
                raw.unlink(missing_ok=True)
                aiff.unlink(missing_ok=True)
                if self.args.tts_command:
                    command = [part.replace("{wav}", str(raw)).replace("{rate}", str(rate))
                               for part in shlex.split(self.args.tts_command)]
                    subprocess.run(command, input=text, text=True, check=True, capture_output=True, timeout=90)
                else:
                    command = ["say", "-r", str(rate), "-o", str(aiff)]
                    if self.args.voice:
                        command += ["-v", self.args.voice]
                    subprocess.run(command + [text], check=True, capture_output=True, timeout=90)
                    subprocess.run(["afconvert", "-f", "WAVE", "-d", "LEI16@16000", "-c", "1", str(aiff), str(raw)],
                                   check=True, capture_output=True, timeout=30)
                actual = duration(raw)
                attempts.append({"target_seconds": target, "speech_seconds": actual, "wanted_speech_seconds": wanted_speech,
                                 "rate": rate, "words": len(text.split())})
                if actual == 0:
                    raise ValueError("Speech synthesizer returned a zero-length recording; check the installed voice and OS speech permissions")
                if .90 <= wanted_speech / actual <= 1.10:
                    seconds = augment_wav(raw, final, self.rng, self.args.audio_min, self.args.audio_max, self.args.noise,
                                          target_seconds=target, leading=leading, trailing=trailing)
                    return {"text": text, "wav": str(final), "audio_seconds": round(seconds, 4),
                            "audio_target_seconds": round(target, 6), "speech_rate_wpm": rate, "synthesis_attempts": len(attempts)}
                next_rate = round(rate * actual / wanted_speech)
                can_control_rate = not self.args.tts_command or "{rate}" in self.args.tts_command
                # Measure at the nearest speed bound before changing content;
                # macOS speech duration is not perfectly inversely proportional
                # to its nominal rate (punctuation adds pauses).
                if can_control_rate and next_rate < 100 and rate > 100:
                    rate = 100
                    continue
                if can_control_rate and next_rate > 220 and rate < 220:
                    rate = 220
                    continue
                if next_rate < 100 or (not can_control_rate and actual < wanted_speech):
                    extra = next((d for d in details if d not in parts), None)
                    if extra is None:
                        raise ValueError("Not enough distinct spoken content to fill the sampled target")
                    parts.append(extra)
                    rate = max(100, min(220, next_rate))
                elif next_rate > 220 or (not can_control_rate and actual > wanted_speech):
                    if len(parts) > 1:
                        parts.pop()
                    elif parts[0] != short_text:
                        parts[0] = short_text
                    else:
                        raise ValueError("Cannot fit this question to the sampled audio target; provide shorter wording or TTS rate control")
                    rate = min(220, max(100, next_rate))
                else:
                    rate = next_rate if next_rate != rate else rate + (1 if actual > wanted_speech else -1)
            raise ValueError(f"Could not match target {target:.3f}s after ten synthesis attempts; see {stem}.synthesis.json")
        except Exception:
            (folder / (stem + ".synthesis.json")).write_text(json.dumps(attempts, indent=2) + "\n")
            raise
        finally:
            raw.unlink(missing_ok=True)
            aiff.unlink(missing_ok=True)


class Journal:
    def __init__(self, folder):
        self.rows = []
        self.jsonl = (folder / "requests.jsonl").open("a", encoding="utf-8")
        self.csvfile = (folder / "requests.csv").open("w", newline="", encoding="utf-8")
        self.writer = csv.DictWriter(self.csvfile, fieldnames=FIELDS, extrasaction="ignore")
        self.writer.writeheader()

    def write(self, row):
        self.rows.append(row)
        self.jsonl.write(json.dumps(row, ensure_ascii=False) + "\n")
        self.jsonl.flush()
        self.writer.writerow(row)
        self.csvfile.flush()

    def close(self):
        self.jsonl.close()
        self.csvfile.close()


class APIError(Exception):
    def __init__(self, message, status=None):
        super().__init__(message)
        self.status = status


class Client:
    def __init__(self, base, journal, run_id, timeout=120):
        self.base, self.journal, self.run_id, self.timeout = base.rstrip("/"), journal, run_id, timeout
        # Python.org macOS installations may have no configured CA bundle until
        # their certificate installer runs. Use the existing OS trust bundle.
        paths = ssl.get_default_verify_paths()
        system_bundle = Path("/etc/ssl/cert.pem")
        cafile = str(system_bundle) if not paths.cafile and not paths.capath and sys.platform == "darwin" and system_bundle.is_file() else None
        self.ssl_context = ssl.create_default_context(cafile=cafile)

    def call(self, path, *, agent_id, conversation_id=None, turn=None, body=None,
             content_type=None, audio_seconds=None, ndjson=False, binary=False):
        method = "POST" if body is not None else "GET"
        started, tick = utc_now(), time.perf_counter()
        test_id = str(uuid.uuid4())
        row = dict.fromkeys(FIELDS)
        row.update(request_time=started, run_id=self.run_id, agent_id=agent_id,
                   conversation_id=conversation_id, turn=turn, endpoint=path, method=method,
                   audio_seconds=audio_seconds, test_request_id=test_id, synthetic=True)
        headers = {"User-Agent": "VoiceSessionTester/1.0 (synthetic QA)", "X-Anon-Id": agent_id,
                   "X-Test-Run-Id": self.run_id, "X-Test-Request-Id": test_id, "X-Synthetic-Test": "true"}
        headers.update(getattr(self, "extra_headers", {}))
        if content_type:
            headers["Content-Type"] = content_type
        if isinstance(body, dict):
            body = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = content_type or "application/json"
        request = urllib.request.Request(self.base + path, data=body, headers=headers, method=method)
        result, error, raw = {}, None, bytearray()
        pending = b""
        first_event = None
        events = []

        def elapsed():
            return round((time.perf_counter() - tick) * 1000, 3)

        def event(line):
            nonlocal result, first_event
            if not line.strip():
                return
            item = json.loads(line)
            if not isinstance(item, dict):
                raise ValueError("Expected a JSON object in the chat stream")
            kind = item.get("type")
            events.append(kind)
            if kind == "reply":
                first_event = elapsed() if first_event is None else first_event
                result = item
            elif kind == "error":
                result = item
                raise APIError("stream error: " + safe_error(item.get("error", "unknown")), 429 if item.get("error") == "limit" else None)

        try:
            with urllib.request.urlopen(request, timeout=self.timeout, context=self.ssl_context) as response:
                row["status_code"] = response.status
                # Keep only correlation headers. Never serialize all response headers.
                row["request_id"] = response.headers.get("x-request-id")
                row["render_request_id"] = response.headers.get("rndr-id")
                row["provider_request_id"] = response.headers.get("x-groq-request-id")
                while True:
                    chunk = response.read1(65536)
                    if not chunk:
                        break
                    if row["time_to_first_byte_ms"] is None:
                        row["time_to_first_byte_ms"] = elapsed()
                    raw.extend(chunk)
                    if len(raw) > 20 * 1024 * 1024:
                        raise ValueError("Response exceeds 20 MiB limit")
                    if ndjson:
                        pending += chunk
                        while b"\n" in pending:
                            line, pending = pending.split(b"\n", 1)
                            event(line)
                if ndjson:
                    event(pending)
                    if first_event is None:
                        raise ValueError("Chat stream ended without a reply event")
                    if not isinstance(result.get("text", ""), str) or (not result.get("text", "").strip() and not result.get("end")):
                        raise ValueError("Chat reply is empty or has no text")
                    result.setdefault("text", "")
                elif not binary and "json" in response.headers.get("content-type", "") and raw:
                    result = json.loads(raw)
                    if not isinstance(result, dict):
                        raise ValueError("Expected a JSON object response")
                elif binary:
                    result = {"bytes": len(raw)}
                else:
                    result = {"text": raw.decode("utf-8", errors="replace")}
        except urllib.error.HTTPError as exc:
            row["status_code"] = exc.code
            row["request_id"] = exc.headers.get("x-request-id")
            row["render_request_id"] = exc.headers.get("rndr-id")
            detail = ""
            try:
                document = json.loads(exc.read(16384))
                if isinstance(document, dict):
                    result = document
                provider_error = document.get("error", {}) if isinstance(document, dict) else {}
                if isinstance(provider_error, dict):
                    detail = " ".join(str(provider_error.get(k, "")) for k in ("code", "type", "message")).strip()
                elif isinstance(provider_error, str):
                    detail = provider_error
            except (ValueError, OSError):
                pass
            error = APIError(f"HTTP {exc.code} {exc.reason}" + (": " + safe_error(detail) if detail else ""), exc.code)
            exc.close()
        except Exception as exc:
            error = exc
        finally:
            row["latency_ms"] = elapsed()
            row["time_to_first_reply_ms"] = first_event
            # The site's stream emits completed reply events, NOT token deltas.
            # TTFT remains unknown unless the server publishes a measured value.
            if not isinstance(result, dict):
                result = {}
            telemetry = result.get("telemetry", {})
            if not isinstance(telemetry, dict):
                telemetry = {}
            for field in ("model",):
                value = telemetry.get(field, result.get(field))
                if isinstance(value, str):
                    row[field] = safe_error(value)
            for field in ("input_tokens", "output_tokens", "time_to_first_token_ms"):
                value = telemetry.get(field)
                if isinstance(value, (int, float)) and not isinstance(value, bool) and value >= 0:
                    row[field] = value
            usage = result.get("usage", {})
            if isinstance(usage, dict):
                for target, names in (("input_tokens", ("input_tokens", "prompt_tokens")),
                                      ("output_tokens", ("output_tokens", "completion_tokens"))):
                    for name in names:
                        value = usage.get(name)
                        if row[target] is None and isinstance(value, int) and not isinstance(value, bool) and value >= 0:
                            row[target] = value
            if isinstance(telemetry.get("provider_request_id"), str):
                row["provider_request_id"] = safe_error(telemetry["provider_request_id"])
            # api_key_label intentionally remains null: no credentials requested or read.
            row["error"] = safe_error(error) if error else None
            row["event_types"] = events
            row["qa_usage"] = telemetry.get("qa")
            self.journal.write(row)
        if error:
            raise APIError(row["error"], getattr(error, "status", row["status_code"])) from error
        return result


def make_plan(args, rng, folder):
    factory = AudioFactory(args, rng)
    scenarios = SCENARIOS
    if args.scenarios:
        scenarios = json.loads(Path(args.scenarios).read_text(encoding="utf-8"))
    if not isinstance(scenarios, list) or not scenarios:
        raise ValueError("Scenarios must be a nonempty JSON array of {name, turns}")
    for scenario in scenarios:
        if not isinstance(scenario, dict) or not isinstance(scenario.get("name"), str) or not isinstance(scenario.get("turns"), list) or not scenario["turns"]:
            raise ValueError("Each scenario needs a name and at least one text turn")
        if not all(isinstance(t, str) and t.strip() for t in scenario["turns"]):
            raise ValueError("Scenario turns must be nonempty text strings")
    agents = []
    audio = folder / "audio"
    audio.mkdir()
    for agent in range(args.agents):
        identity = str(uuid.uuid4())
        conversations = []
        choices = []
        while len(choices) < args.conversations:
            choices.extend(rng.sample(scenarios, len(scenarios)))
        for index, scenario in enumerate(choices[:args.conversations]):
            count = rng.randint(args.turns_min, args.turns_max)
            conversation_id = str(uuid.uuid4())
            print(f"Preparing user {agent + 1}, conversation {index + 1}: {scenario['name']}, {count} turns", flush=True)
            texts = list(scenario["turns"])
            if len(texts) < count:
                texts.extend(rng.sample(FOLLOW_UPS, count - len(texts)))
            short_turns = SHORT_TURNS.get(scenario["name"], []) if not args.scenarios else scenario.get("short_turns", [])
            turns = [factory.make(text, audio, f"user-{agent + 1}-conversation-{index + 1}-turn-{n + 1}",
                                  short_text=short_turns[n] if n < len(short_turns) else None)
                     for n, text in enumerate(texts[:count])]
            conversations.append({"conversation_id": conversation_id, "scenario": scenario["name"], "turns": turns})
        agents.append({"agent_id": identity, "conversations": conversations})
    return {"synthetic": True, "created_at": utc_now(), "base_url": args.base_url, "seed": args.seed, "agents": agents}


def pause(seconds, args):
    time.sleep(seconds * args.pace_scale)


def model_configuration_error(exc):
    text = str(exc).lower()
    return ("model_not_found" in text or
            ("model" in text and ("does not exist" in text or "do not have access" in text)))


def chunks(text, maximum=300):
    """Sentence-sized speech chunks, bounded even for unusually long sentences."""
    current = ""
    for sentence in re.findall(r"[^.!?]+[.!?]*", text):
        for word in sentence.split():
            for offset in range(0, len(word), maximum):
                piece = word[offset:offset + maximum]
                if len(current) + len(piece) + 1 > maximum:
                    if current:
                        yield current
                    current = piece
                else:
                    current = (current + " " + piece).strip()
        if current:
            yield current
            current = ""


def exercise(plan, args, folder, journal, rng, outcomes=None):
    client = Client(args.base_url, journal, plan["run_id"], args.timeout)
    if outcomes is None:
        outcomes = []
    conversation_log = folder / "conversations.jsonl"
    stop_run = False
    with conversation_log.open("w", encoding="utf-8") as transcript_log, (folder / "turns.jsonl").open("w", encoding="utf-8") as turn_log:
        for agent in plan["agents"]:
            identity = agent["agent_id"]
            client.call("/", agent_id=identity)
            frontend = client.call("/app.js", agent_id=identity)
            summary_supported = "/api/summary" in frontend.get("text", "")
            client.call("/health", agent_id=identity)
            client.call("/api/stats/visit", agent_id=identity, body={"id": identity}, content_type="text/plain")
            pause(rng.uniform(3, 7), args)
            for conversation in agent["conversations"]:
                cid = conversation["conversation_id"]
                messages = []  # Deliberately reset at every new conversation.
                outcome = {"agent_id": identity, "conversation_id": cid, "scenario": conversation["scenario"],
                           "planned_turns": len(conversation["turns"]), "completed_turns": 0, "error": None, "ended_by_model": False}
                outcomes.append(outcome)
                try:
                    status = client.call("/api/limit", agent_id=identity, conversation_id=cid)
                    if status.get("ok") is False:
                        raise APIError("Quota endpoint reported unavailable", 429)
                    pause(rng.uniform(4, 9), args)  # greeting / settling in
                    for number, turn in enumerate(conversation["turns"], 1):
                        print(f"User {identity[:8]} / {conversation['scenario']} / turn {number}", flush=True)
                        pause(rng.uniform(1.0, 5.0) + turn["audio_seconds"], args)
                        result = client.call("/api/transcribe?lang=en", agent_id=identity, conversation_id=cid, turn=number,
                                             body=Path(turn["wav"]).read_bytes(), content_type="audio/wav", audio_seconds=turn["audio_seconds"])
                        text = result.get("text")
                        if not isinstance(text, str) or not text.strip():
                            raise APIError("Transcription was empty")
                        messages.append({"role": "user", "content": text.strip()})
                        reply = client.call("/api/chat", agent_id=identity, conversation_id=cid, turn=number,
                                            body={"lang": "en", "context": "", "messages": messages[-20:]}, ndjson=True)
                        if reply["text"]:
                            messages.append({"role": "assistant", "content": reply["text"]})
                        outcome["completed_turns"] += 1
                        outcome["messages"] = list(messages)
                        # Persist completed turns immediately, before listening/pacing.
                        turn_log.write(json.dumps({"saved_at": utc_now(), "synthetic": True,
                            "agent_id": identity, "conversation_id": cid, "turn": number,
                            "expected_text": turn["text"], "transcribed_text": text.strip(),
                            "audio_seconds": turn["audio_seconds"], "reply": reply["text"],
                            "history_messages": len(messages)}, ensure_ascii=False) + "\n")
                        turn_log.flush()
                        if reply.get("lang", "en") in status.get("aiVoice", []):
                            for part in chunks(reply["text"]):
                                client.call("/api/speak", agent_id=identity, conversation_id=cid, turn=number,
                                            body={"lang": reply.get("lang", "en"), "text": part}, binary=True)
                        # Model listening time rather than altering measured HTTP latency.
                        pause(len(reply["text"].split()) / rng.uniform(2.1, 3.0) + rng.uniform(1.0, 4.0), args)
                        if reply.get("end"):
                            outcome["ended_by_model"] = True
                            break
                except APIError as exc:
                    outcome["error"] = safe_error(exc)
                    stop_run = exc.status == 429 or model_configuration_error(exc)
                except KeyboardInterrupt:
                    outcome.update(error="Interrupted", messages=messages, interrupted=True)
                    transcript_log.write(json.dumps(outcome, ensure_ascii=False) + "\n")
                    transcript_log.flush()
                    raise
                # Equivalent to pressing End conversation: summarize answered turns.
                # Never blindly retry POSTs: a timeout may still have consumed a request.
                if messages and messages[-1]["role"] == "user" and outcome["error"]:
                    messages.pop()
                if messages and not stop_run and summary_supported:
                    try:
                        summary = client.call("/api/summary", agent_id=identity, conversation_id=cid,
                                              body={"lang": "en", "context": "", "messages": messages[-40:]})
                        outcome["summary"] = summary.get("summary")
                        outcome["topic"] = summary.get("topic")
                    except APIError as exc:
                        outcome["summary_error"] = safe_error(exc)
                        outcome["error"] = outcome["error"] or outcome["summary_error"]
                        stop_run = exc.status == 429 or model_configuration_error(exc)
                outcome["messages"] = messages
                transcript_log.write(json.dumps(outcome, ensure_ascii=False) + "\n")
                transcript_log.flush()
                if stop_run:
                    print("Quota or model configuration error. Stopping all users; no identity rotation or retries.", flush=True)
                    return outcomes
                pause(rng.uniform(8, 25), args)
    return outcomes


def summarize(journal, outcomes, folder):
    rows = journal.rows
    durations = [r["audio_seconds"] for r in rows if r["audio_seconds"] is not None]
    latencies = sorted(r["latency_ms"] for r in rows)
    report = {"synthetic": True, "request_count": len(rows), "error_count": sum(bool(r["error"]) for r in rows),
              "conversations_attempted": len(outcomes),
              "conversations_completed": sum(o["completed_turns"] == o["planned_turns"] and not o["error"] for o in outcomes),
              "audio_seconds_min": min(durations, default=None), "audio_seconds_max": max(durations, default=None),
              "latency_p50_ms": latencies[round((len(latencies) - 1) * .5)] if latencies else None,
              "latency_p95_ms": latencies[math.ceil((len(latencies) - 1) * .95)] if latencies else None,
              "status_counts": {}, "by_endpoint": {}, "unknown_provider_metrics_are_null": True,
              "error_scope": "Client-visible HTTP and chat-stream errors only",
              "internal_provider_errors_verified": False}
    for row in rows:
        key = str(row["status_code"])
        report["status_counts"][key] = report["status_counts"].get(key, 0) + 1
    for path in sorted({r["endpoint"] for r in rows}):
        group = [r for r in rows if r["endpoint"] == path]
        values = sorted(r["latency_ms"] for r in group)
        report["by_endpoint"][path] = {"count": len(group), "errors": sum(bool(r["error"]) for r in group),
                                       "latency_p50_ms": values[round((len(values) - 1) * .5)],
                                       "latency_p95_ms": values[math.ceil((len(values) - 1) * .95)]}
    (folder / "summary.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return report


def parser():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    p.add_argument("--base-url", default=BASE)
    p.add_argument("--agents", type=int, default=1, help="simulated users, executed sequentially")
    p.add_argument("--conversations", type=int, default=1, help="separate visits/conversations per user")
    p.add_argument("--turns-min", type=int, default=3)
    p.add_argument("--turns-max", type=int, default=10)
    p.add_argument("--audio-min", type=float, default=5)
    p.add_argument("--audio-max", type=float, default=25)
    p.add_argument("--seed", type=int, default=None, help="optional reproducible seed; otherwise fresh randomness each run")
    p.add_argument("--out", type=Path, default=Path("results"))
    p.add_argument("--live", action="store_true", help="send real requests; otherwise prepare audio only")
    p.add_argument("--plan", type=Path, help="reuse a prepared plan.json without regenerating audio")
    p.add_argument("--voice", help="installed macOS voice; default is the system voice")
    p.add_argument("--tts-command", help="command accepting text on stdin and writing {wav}; optional {rate} placeholder; no shell")
    p.add_argument("--noise", type=float, default=0.0006, help="PCM room noise standard deviation; 0 disables")
    p.add_argument("--pace-scale", type=float, default=1, help="scale thinking, speaking and listening pauses; 0 for local checks")
    p.add_argument("--timeout", type=float, default=120)
    p.add_argument("--scenarios", type=Path, help="custom English scenarios JSON array: [{name, turns: [text, ...]}]")
    return p


def validate_plan(plan, args):
    if not isinstance(plan.get("agents"), list) or not plan["agents"]:
        raise ValueError("Plan has no users")
    for agent in plan["agents"]:
        if not agent.get("agent_id") or not agent.get("conversations"):
            raise ValueError("Plan user is missing its identity or conversations")
        for conversation in agent["conversations"]:
            if not conversation.get("conversation_id") or not conversation.get("turns"):
                raise ValueError("Plan conversation is missing its identity or turns")
            for turn in conversation["turns"]:
                actual = duration(Path(turn["wav"]))
                if not args.audio_min <= actual <= args.audio_max:
                    raise ValueError(f"Plan audio duration {actual:.3f}s is outside the requested range")
                turn["audio_seconds"] = round(actual, 4)


def main(argv=None):
    args = parser().parse_args(argv)
    if not (1 <= args.agents <= 100 and 1 <= args.conversations <= 20 and 1 <= args.turns_min <= args.turns_max <= 10):
        raise SystemExit("Use 1–100 users, 1–20 conversations and 1–10 turns, with min <= max")
    if not (5 <= args.audio_min <= args.audio_max <= 25 and args.audio_max - args.audio_min >= 1):
        raise SystemExit("Audio bounds must lie within 5–25 seconds with at least one second of room")
    if not (0 <= args.noise <= .02 and 0 <= args.pace_scale <= 10 and args.timeout > 0):
        raise SystemExit("Invalid noise, pacing or timeout setting")
    url = urllib.parse.urlsplit(args.base_url)
    if url.scheme not in ("http", "https") or not url.netloc or url.username or url.password or url.query or url.fragment or url.path not in ("", "/"):
        raise SystemExit("Base URL must be an HTTP(S) origin without credentials, query or fragment")
    args.out = args.out.resolve()
    args.out.mkdir(parents=True, exist_ok=True)
    seed_was_explicit = args.seed is not None
    args.seed, rng = random_stream(args.seed)
    run_id = str(uuid.uuid4())
    folder = args.out / run_id
    folder.mkdir()
    (folder / "randomization.json").write_text(json.dumps({"seed": args.seed, "seed_source": "explicit" if seed_was_explicit else "system_entropy",
        "audio_min": args.audio_min, "audio_max": args.audio_max}, indent=2) + "\n")
    journal = None
    outcomes = []
    failed = False
    try:
        plan = json.loads(args.plan.read_text(encoding="utf-8")) if args.plan else make_plan(args, rng, folder)
        validate_plan(plan, args)
        plan.update(run_id=run_id, base_url=args.base_url, execution_seed=args.seed)
        (folder / "plan.json").write_text(json.dumps(plan, indent=2) + "\n", encoding="utf-8")
        total = sum(len(c["turns"]) for a in plan["agents"] for c in a["conversations"])
        print(f"Prepared {len(plan['agents'])} user(s), {sum(len(a['conversations']) for a in plan['agents'])} conversations, {total} spoken turns.")
        if args.live:
            journal = Journal(folder)
            exercise(plan, args, folder, journal, rng, outcomes=outcomes)
            failed = any(o["error"] for o in outcomes) or any(r["error"] for r in journal.rows)
        else:
            print("Preparation only: no network requests sent. Use --live --plan <plan.json> to execute this audio.")
    except (Exception, KeyboardInterrupt) as exc:
        failed = True
        message = safe_error(exc) or "Interrupted"
        (folder / "failure.txt").write_text(message + "\n", encoding="utf-8")
        print("Stopped: " + message, file=sys.stderr)
    finally:
        if journal:
            summarize(journal, outcomes, folder)
            journal.close()
        print(f"Results: {folder}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
