"""Offline regression checks; the server and provider metadata here are fixtures."""
import array
import contextlib
import io
import json
import math
import random
import tempfile
import threading
import time
import unittest
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import voice_tester as vt


def fixture_wav(path, seconds=5, silent=False):
    # An acoustic format fixture, not a speech sample or production test input.
    values = array.array("h", (0 if silent else round(8000 * math.sin(2 * math.pi * 220 * i / vt.RATE))
                               for i in range(round(seconds * vt.RATE))))
    with wave.open(str(path), "wb") as wav:
        wav.setparams((1, 2, vt.RATE, 0, "NONE", "not compressed"))
        wav.writeframes(values.tobytes())


class MockAPI:
    def __init__(self, mode="ok"):
        self.mode = mode
        self.calls = []
        fixture = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *_):
                pass

            def do_GET(self):
                self.respond()

            def do_POST(self):
                self.respond()

            def respond(self):
                raw = self.rfile.read(int(self.headers.get("Content-Length", 0)))
                payload = json.loads(raw) if raw and self.headers.get("Content-Type") != "audio/wav" else raw
                fixture.calls.append({"path": self.path, "method": self.command, "payload": payload,
                                      "identity": self.headers.get("X-Anon-Id"),
                                      "test_id": self.headers.get("X-Test-Request-Id"),
                                      "synthetic": self.headers.get("X-Synthetic-Test")})
                status, ctype = 200, "application/json"
                if self.path == "/api/limit":
                    if fixture.mode == "quota":
                        status, data = 429, {"error": "limit"}
                    else:
                        data = {"ok": True, "aiVoice": ["en"]}
                elif self.path == "/api/transcribe?lang=en":
                    with wave.open(io.BytesIO(raw)) as wav:
                        assert 5 <= wav.getnframes() / wav.getframerate() <= 25
                    data = {"text": "A synthetic fixture question about the previous reply.", "language": "en"}
                elif self.path == "/api/chat":
                    if fixture.mode == "failure":
                        status, data = 503, {"error": "unavailable"}
                    elif fixture.mode == "model-missing":
                        status, data = 400, {"error": {"code": "model_not_found", "message": "The model `groq/compound` does not exist or you do not have access to it."}}
                    elif fixture.mode == "stream-limit":
                        data, ctype = b'{"type":"error","error":"limit"}\n', "application/x-ndjson"
                    elif fixture.mode == "malformed":
                        data, ctype = b'{"type":', "application/x-ndjson"
                    elif fixture.mode == "ended":
                        data, ctype = b'{"type":"reply","end":true}\n', "application/x-ndjson"
                    else:
                        reply = {"type": "reply", "text": "A useful fixture reply with café and context.", "lang": "en", "end": False}
                        if fixture.mode == "metrics":
                            reply.update(model="fixture-model", usage={"prompt_tokens": 123, "completion_tokens": 45},
                                         telemetry={"provider_request_id": "fixture-provider-request", "time_to_first_token_ms": 2.5})
                        data = (json.dumps({"type": "searching"}) + "\n" + json.dumps(reply, ensure_ascii=False) + "\n").encode()
                        ctype = "application/x-ndjson"
                elif self.path == "/api/summary":
                    data = {"summary": "A local fixture summary.", "topic": "Fixture"}
                elif self.path == "/api/speak":
                    data, ctype = b"fixture audio bytes", "audio/mpeg"
                elif self.path == "/api/stats/visit":
                    status, data = 204, b""
                elif self.path in ("/", "/health"):
                    data, ctype = b"ok", "text/plain"
                elif self.path == "/app.js":
                    data, ctype = (b"fetch('/api/chat');" if fixture.mode == "no-summary" else b"fetch('/api/summary');"), "text/javascript"
                elif self.path == "/bad-schema":
                    data = []
                else:
                    status, data = 404, {"error": "not found"}
                if not isinstance(data, bytes):
                    data = json.dumps(data).encode()
                self.send_response(status)
                self.send_header("Content-Type", ctype)
                self.send_header("Content-Length", str(len(data)))
                self.send_header("X-Request-Id", "fixture-http-request")
                self.send_header("Rndr-Id", "fixture-render-request")
                self.end_headers()
                if ctype == "application/x-ndjson" and fixture.mode not in ("malformed", "stream-limit"):
                    # Split inside a UTF-8 character and between NDJSON events.
                    for byte in data:
                        self.wfile.write(bytes([byte]))
                        self.wfile.flush()
                else:
                    self.wfile.write(data)

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.base_url = f"http://127.0.0.1:{self.server.server_port}"

    def __enter__(self):
        self.thread.start()
        return self

    def __exit__(self, *_):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()


class TesterTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.folder = Path(self.temp.name)
        self.journal = vt.Journal(self.folder)

    def tearDown(self):
        self.journal.close()
        self.temp.cleanup()

    def test_context_resets_only_between_conversations_and_identity_stays(self):
        wav = self.folder / "fixture.wav"
        fixture_wav(wav)
        agents = []
        for user in range(2):
            conversations = [{"conversation_id": f"c-{user}-{index}", "scenario": "fixture",
                              "turns": [{"text": "fixture", "wav": str(wav), "audio_seconds": 5} for _ in range(count)]}
                             for index, count in enumerate((3, 4, 5))]
            agents.append({"agent_id": f"user-{user}", "conversations": conversations})
        plan = {"run_id": "fixture-run", "agents": agents}
        with MockAPI() as server, contextlib.redirect_stdout(io.StringIO()):
            args = SimpleNamespace(base_url=server.base_url, timeout=5, pace_scale=0)
            outcomes = vt.exercise(plan, args, self.folder, self.journal, random.Random(4))
        self.assertEqual(len(outcomes), 6)
        self.assertEqual([o["completed_turns"] for o in outcomes], [3, 4, 5, 3, 4, 5])
        chats = [c for c in server.calls if c["path"] == "/api/chat"]
        self.assertEqual([len(c["payload"]["messages"]) for c in chats],
                         [1, 3, 5, 1, 3, 5, 7, 1, 3, 5, 7, 9] * 2)
        self.assertEqual([c["identity"] for c in chats], ["user-0"] * 12 + ["user-1"] * 12)
        self.assertTrue(all(c["payload"]["context"] == "" for c in chats))
        self.assertTrue(all(c["synthetic"] == "true" for c in server.calls))
        self.assertEqual(len({c["test_id"] for c in server.calls}), len(server.calls))
        visits = [c for c in server.calls if c["path"] == "/api/stats/visit"]
        self.assertEqual([v["payload"]["id"] for v in visits], ["user-0", "user-1"])
        self.assertEqual(len([c for c in server.calls if c["path"] == "/api/summary"]), 6)
        self.assertEqual(len([c for c in server.calls if c["path"] == "/api/speak"]), 24)
        self.assertTrue(all(r["time_to_first_token_ms"] is None for r in self.journal.rows))
        self.assertTrue(all(r["model"] is None and r["input_tokens"] is None for r in self.journal.rows))

    def test_quota_stops_every_user_without_retries(self):
        plan = {"run_id": "fixture-run", "agents": [
            {"agent_id": f"user-{i}", "conversations": [{"conversation_id": str(i), "scenario": "fixture", "turns": [{}]}]}
            for i in range(2)]}
        with MockAPI("quota") as server, contextlib.redirect_stdout(io.StringIO()):
            args = SimpleNamespace(base_url=server.base_url, timeout=5, pace_scale=0)
            outcomes = vt.exercise(plan, args, self.folder, self.journal, random.Random(1))
        self.assertEqual(len(outcomes), 1)
        self.assertEqual(sum(c["path"] == "/api/limit" for c in server.calls), 1)
        self.assertEqual({c["identity"] for c in server.calls}, {"user-0"})
        self.assertEqual(self.journal.rows[-1]["status_code"], 429)

    def test_provider_metrics_are_read_only_when_returned(self):
        with MockAPI("metrics") as server:
            client = vt.Client(server.base_url, self.journal, "fixture-run")
            reply = client.call("/api/chat", agent_id="fixture", body={"messages": []}, ndjson=True)
        self.assertIn("café", reply["text"])
        row = self.journal.rows[-1]
        self.assertEqual(row["input_tokens"], 123)
        self.assertEqual(row["output_tokens"], 45)
        self.assertEqual(row["model"], "fixture-model")
        self.assertEqual(row["time_to_first_token_ms"], 2.5)
        self.assertEqual(row["provider_request_id"], "fixture-provider-request")
        self.assertEqual(row["render_request_id"], "fixture-render-request")
        self.assertEqual(row["event_types"], ["searching", "reply"])
        self.assertIsNone(row["api_key_label"])
        self.assertGreaterEqual(row["latency_ms"], row["time_to_first_reply_ms"])

    def test_http_and_stream_failures_are_logged_once(self):
        for mode, status in (("failure", 503), ("stream-limit", 200), ("malformed", 200)):
            with self.subTest(mode=mode), MockAPI(mode) as server:
                client = vt.Client(server.base_url, self.journal, "fixture-run")
                with self.assertRaises(vt.APIError) as captured:
                    client.call("/api/chat", agent_id="fixture", body={}, ndjson=True)
                self.assertEqual(len(server.calls), 1)
                self.assertEqual(self.journal.rows[-1]["status_code"], status)
                self.assertTrue(self.journal.rows[-1]["error"])
                if mode == "stream-limit":
                    self.assertEqual(captured.exception.status, 429)

    def test_bad_json_schema_is_logged_without_masking_error(self):
        with MockAPI() as server:
            client = vt.Client(server.base_url, self.journal, "fixture-run")
            with self.assertRaisesRegex(vt.APIError, "JSON object"):
                client.call("/bad-schema", agent_id="fixture")
        self.assertTrue(self.journal.rows[-1]["error"])

    def test_model_can_end_without_reply_text_as_frontend_allows(self):
        with MockAPI("ended") as server:
            client = vt.Client(server.base_url, self.journal, "fixture-run")
            result = client.call("/api/chat", agent_id="fixture", body={}, ndjson=True)
        self.assertTrue(result["end"])
        self.assertEqual(result["text"], "")
        self.assertIsNone(self.journal.rows[-1]["error"])

    def test_missing_model_is_preserved_and_stops_later_conversations(self):
        wav = self.folder / "fixture.wav"
        fixture_wav(wav)
        plan = {"run_id": "fixture-run", "agents": [{"agent_id": "one-user", "conversations": [
            {"conversation_id": str(i), "scenario": "fixture", "turns": [{"text": "fixture", "wav": str(wav), "audio_seconds": 5}]}
            for i in range(3)]}]}
        with MockAPI("model-missing") as server, contextlib.redirect_stdout(io.StringIO()):
            args = SimpleNamespace(base_url=server.base_url, timeout=5, pace_scale=0)
            outcomes = vt.exercise(plan, args, self.folder, self.journal, random.Random(1))
        self.assertEqual(len(outcomes), 1)
        self.assertIn("model_not_found", outcomes[0]["error"])
        self.assertEqual(sum(c["path"] == "/api/chat" for c in server.calls), 1)
        self.assertEqual(sum(c["path"] == "/api/summary" for c in server.calls), 0)

    def test_interrupted_run_preserves_completed_turn_and_counts(self):
        wav = self.folder / "fixture.wav"
        fixture_wav(wav)
        plan = {"run_id": "fixture-run", "agents": [{"agent_id": "one-user", "conversations": [
            {"conversation_id": "one-chat", "scenario": "fixture", "turns": [{"text": "fixture", "wav": str(wav), "audio_seconds": 5}]}]}]}
        outcomes = []
        def interrupted_after_reply(seconds, args):
            if any(row["endpoint"] == "/api/chat" for row in self.journal.rows):
                raise KeyboardInterrupt()
        with MockAPI() as server, patch.object(vt, "pause", interrupted_after_reply), contextlib.redirect_stdout(io.StringIO()):
            args = SimpleNamespace(base_url=server.base_url, timeout=5, pace_scale=0)
            with self.assertRaises(KeyboardInterrupt):
                vt.exercise(plan, args, self.folder, self.journal, random.Random(1), outcomes=outcomes)
        self.assertEqual(len(outcomes), 1)
        self.assertEqual(outcomes[0]["completed_turns"], 1)
        self.assertTrue(outcomes[0]["interrupted"])
        saved = json.loads((self.folder / "turns.jsonl").read_text())
        self.assertIn("café", saved["reply"])
        self.assertEqual(saved["history_messages"], 2)
        report = vt.summarize(self.journal, outcomes, self.folder)
        self.assertEqual(report["conversations_attempted"], 1)
        self.assertEqual(report["conversations_completed"], 0)
        self.assertFalse(report["internal_provider_errors_verified"])

    def test_summary_is_skipped_if_current_frontend_removed_it(self):
        wav = self.folder / "fixture.wav"
        fixture_wav(wav)
        plan = {"run_id": "fixture-run", "agents": [{"agent_id": "one-user", "conversations": [
            {"conversation_id": "one-chat", "scenario": "fixture", "turns": [{"text": "fixture", "wav": str(wav), "audio_seconds": 5}]}]}]}
        with MockAPI("no-summary") as server, contextlib.redirect_stdout(io.StringIO()):
            args = SimpleNamespace(base_url=server.base_url, timeout=5, pace_scale=0)
            outcomes = vt.exercise(plan, args, self.folder, self.journal, random.Random(1))
        self.assertEqual(outcomes[0]["completed_turns"], 1)
        self.assertFalse(any(c["path"] == "/api/summary" for c in server.calls))

    def test_audio_has_measured_duration_and_rejects_silence(self):
        source, dest = self.folder / "source.wav", self.folder / "dest.wav"
        fixture_wav(source, 5.1)
        seconds = vt.augment_wav(source, dest, random.Random(3), 5, 25, .0006)
        self.assertGreaterEqual(seconds, 5)
        self.assertLessEqual(seconds, 25)
        fixture_wav(source, 5, silent=True)
        with self.assertRaisesRegex(ValueError, "silent"):
            vt.augment_wav(source, dest, random.Random(3), 5, 25, 0)

    def test_random_audio_target_matches_actual_samples(self):
        source, dest = self.folder / "source.wav", self.folder / "target.wav"
        fixture_wav(source, 5.1)
        target = 5.7523125
        vt.augment_wav(source, dest, random.Random(3), 5, 25, 0,
                       target_seconds=target, leading=.2, trailing=.25)
        with wave.open(str(dest)) as wav:
            self.assertEqual(wav.getnframes(), round(target * vt.RATE))
        with self.assertRaisesRegex(ValueError, "closer to its target"):
            vt.augment_wav(source, dest, random.Random(3), 5, 25, 0,
                           target_seconds=20, leading=.2, trailing=.25)

    def test_default_seed_is_fresh_but_explicit_seed_replays(self):
        self.assertIsNone(vt.parser().parse_args([]).seed)
        with patch.object(vt.random, "SystemRandom") as entropy:
            entropy.return_value.getrandbits.side_effect = [123456, 987654]
            first_seed, first = vt.random_stream()
            second_seed, second = vt.random_stream()
        self.assertNotEqual(first_seed, second_seed)
        self.assertNotEqual(first.getrandbits(64), second.getrandbits(64))
        _, first = vt.random_stream(42)
        _, second = vt.random_stream(42)
        self.assertEqual([first.random() for _ in range(5)], [second.random() for _ in range(5)])

    def test_ten_question_visit_has_full_followups(self):
        args = vt.parser().parse_args(["--seed", "7", "--turns-min", "10", "--turns-max", "10"])
        with patch.object(vt, "AudioFactory") as factory, contextlib.redirect_stdout(io.StringIO()):
            factory.return_value.make.side_effect = lambda text, *a, **kw: {"text": text, "short_text": kw.get("short_text")}
            plan = vt.make_plan(args, random.Random(7), self.folder)
        self.assertEqual(len(plan["agents"]), 1)
        self.assertEqual(len(plan["agents"][0]["conversations"]), 1)
        turns = plan["agents"][0]["conversations"][0]["turns"]
        self.assertEqual(len(turns), 10)
        self.assertEqual(len({t["text"] for t in turns}), 10)

    def test_speech_chunks_stay_bounded_and_keep_words(self):
        text = "A sentence. " + "word " * 300
        parts = list(vt.chunks(text))
        self.assertTrue(all(0 < len(p) <= 300 for p in parts))
        self.assertEqual(" ".join(parts).split(), text.split())

    def test_redacts_common_credentials_from_errors(self):
        value = vt.safe_error("Authorization: Bearer abcdef12345 api_key=example-secret gsk_example123456")
        self.assertNotIn("abcdef12345", value)
        self.assertNotIn("example-secret", value)
        self.assertNotIn("gsk_example", value)


if __name__ == "__main__":
    unittest.main()
