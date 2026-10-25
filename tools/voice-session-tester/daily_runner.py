#!/usr/bin/env python3
"""Eight elapsed hours of explicitly labelled synthetic voice QA; standard library only."""
from __future__ import annotations
import argparse
import csv
import fcntl
import json
import math
import os
import random
import subprocess
import sys
import time
import urllib.parse
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo
import voice_tester as vt

DAILY = dict(primary_requests=1000, primary_tokens=200000, fallback_requests=1000,
             fallback_tokens=200000, speech_requests=2000, audio_seconds=28800, searches=33)
FRACTION = .75
CAPS = {k: math.floor(v * FRACTION) for k, v in DAILY.items()}
MONTH_SEARCH_CAP = 750
QUESTION_MIN, QUESTION_MAX = 1, 5
EXPECTED_QUESTIONS_PER_VISIT = (QUESTION_MIN + QUESTION_MAX) / 2
EXPECTED_TOKENS_PER_VISIT = 3500  # Planning estimate, not measured token telemetry.
MODELS = ("openai/gpt-oss-120b", "openai/gpt-oss-20b", "whisper-large-v3-turbo")

class StopRun(Exception):
    pass

class Clock:
    def __init__(self):
        self.resumed = False
    def now(self):
        return datetime.now(timezone.utc)
    def sleep(self, seconds):
        before = time.time()
        time.sleep(seconds)
        if time.time() - before > seconds + 120:
            self.resumed = True

def atomic(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(tmp, path)

def append(path, value):
    with path.open("a", encoding="utf-8") as stream:
        stream.write(json.dumps(value, ensure_ascii=False) + "\n")
        stream.flush()

class Ledger:
    """One shared rolling-24-hour account ledger, reserved BEFORE each POST.

    A crashed/unknown POST keeps its whole reservation. It is not replayed.
    The lock spans the live run, so concurrent launches cannot double-spend.
    """
    def __init__(self, folder, clock):
        self.folder, self.clock = Path(folder), clock
        self.path = self.folder / "budget.json"
        self.lock = None
        self.data = None

    def __enter__(self):
        self.folder.mkdir(parents=True, exist_ok=True)
        self.lock = (self.folder / "runner.lock").open("a")
        try:
            fcntl.flock(self.lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            self.lock.close()
            raise StopRun("Another daily runner is active. Keep one shared daily-state folder.")
        self.data = json.loads(self.path.read_text()) if self.path.exists() else {"version": 1, "events": []}
        if self.data.get("version") != 1 or not isinstance(self.data.get("events"), list):
            raise StopRun("Invalid budget state; refusing to reset it.")
        return self

    def __exit__(self, *_):
        if self.lock:
            fcntl.flock(self.lock, fcntl.LOCK_UN)
            self.lock.close()

    def remaining(self):
        now = self.clock.now()
        remaining = dict(CAPS)
        monthly_searches = 0
        for event in self.data["events"]:
            at = datetime.fromisoformat(event["at"])
            spent = event["spent"]
            if at > now:
                raise StopRun("Clock moved backwards; budget state cannot be safely interpreted.")
            if at >= now - timedelta(hours=24):
                for k in CAPS:
                    remaining[k] -= spent[k]
            if at.strftime("%Y-%m") == now.strftime("%Y-%m"):
                monthly_searches += spent["searches"]
        remaining["searches"] = min(remaining["searches"], MONTH_SEARCH_CAP - monthly_searches)
        return {k: max(0, n) for k, n in remaining.items()}

    def reserve(self, path, audio_seconds=None):
        left = self.remaining()
        allowed = dict.fromkeys(CAPS, 0)
        if path.startswith("/api/transcribe"):
            seconds = max(10, math.ceil(audio_seconds))
            if left["speech_requests"] < 1 or left["audio_seconds"] < seconds:
                raise StopRun("Synthetic transcription/audio budget reached.")
            allowed.update(speech_requests=1, audio_seconds=seconds)
        elif path == "/api/chat":
            if left["primary_requests"] < 1 or left["primary_tokens"] < 1:
                raise StopRun("Synthetic answer-model budget reached.")
            # The backend bounds every hidden model call against this envelope.
            # A network failure conservatively keeps the full allowance.
            allowed.update(primary_requests=min(2, left["primary_requests"]),
                           primary_tokens=left["primary_tokens"], searches=min(1, left["searches"]))
        else:
            raise StopRun("Unbudgeted paid endpoint.")
        event = {"id": str(uuid.uuid4()), "at": self.clock.now().isoformat(), "endpoint": path,
                 "allowed": allowed, "spent": dict(allowed), "state": "reserved_unknown"}
        self.data["events"].append(event)
        atomic(self.path, self.data)
        return event

    def settle(self, event, report):
        if not isinstance(report, dict) or report.get("version") != 1:
            raise StopRun("Missing QA accounting; the reservation is retained and all users stop.")
        spent = report.get("spent")
        if not isinstance(spent, dict) or set(spent) != set(CAPS):
            raise StopRun("Incomplete QA accounting; reservation retained.")
        if any(type(spent[k]) is not int or not 0 <= spent[k] <= event["allowed"][k] for k in CAPS):
            raise StopRun("Invalid/out-of-envelope accounting; reservation retained.")
        event.update(spent=spent, state="settled", provider_calls=report.get("provider_calls", []))
        atomic(self.path, self.data)

    def snapshot(self):
        left = self.remaining()
        return {"daily_limits_supplied_by_owner": DAILY, "fraction": FRACTION, "caps": CAPS,
                "remaining": left, "accounting_scope": "This runner/shared state only; not other website users.",
                "window": "rolling 24 hours; monthly searches additionally calendar-month limited",
                "monthly_search_cap": MONTH_SEARCH_CAP}

def planned_user_count(remaining):
    # Primary tokens are the expected bottleneck, even though failed fallback
    # calls and tool rounds are separately charged at execution.
    return max(0, min(100, math.floor(min(
        remaining["primary_tokens"] / (EXPECTED_TOKENS_PER_VISIT * 1.05),
        remaining["primary_requests"] / (2 * EXPECTED_QUESTIONS_PER_VISIT * 1.05),
        remaining["speech_requests"] / (EXPECTED_QUESTIONS_PER_VISIT * 1.05),
        remaining["audio_seconds"] / (15 * EXPECTED_QUESTIONS_PER_VISIT * 1.05)))))

def visit_questions(scenario, rng):
    # randint uses an unbiased integer draw; each count has probability 1/5.
    # Do not balance buckets, reject repeats, or cycle through the five counts.
    count = rng.randint(QUESTION_MIN, QUESTION_MAX)
    texts = list(scenario["turns"])
    if len(texts) < count:
        texts += rng.sample(vt.FOLLOW_UPS, count - len(texts))
    short = vt.SHORT_TURNS.get(scenario["name"], [])
    return [{"text": t, "short_text": short[n] if n < len(short) else None}
            for n, t in enumerate(texts[:count])]

def make_daily_plan(start, hours, count, pool, rng, seed, zone):
    if start.tzinfo is None or hours <= 0 or count < 1:
        raise ValueError("Invalid schedule")
    end = start + timedelta(hours=hours)
    window = hours * 3600
    reserve = min(45 * 60, window * .12)
    span = (window - reserve) / count
    old = list(pool.get("users", {}))
    returning_count = int(math.floor(count * .05 + .5))
    # Exactly two returning identities for the default forty; small overridden
    # runs use the nearest whole identity, and report the actual ratio.
    returning_count = min(returning_count, count)
    reused = rng.sample(old, min(len(old), returning_count))
    identities = reused + [str(uuid.uuid4()) for _ in range(count - len(reused))]
    rng.shuffle(identities)
    visits = []
    for i, identity in enumerate(identities):
        scenario = rng.choice(vt.SCENARIOS)
        visits.append(dict(agent_id=identity, conversation_id=str(uuid.uuid4()),
            arrival=(start + timedelta(seconds=rng.uniform(i * span, (i + 1) * span))).isoformat(),
            scenario=scenario["name"], returning=identity in reused,
            questions=visit_questions(scenario, rng)))
    # First-ever launch bootstraps returning behaviour within the same day;
    # the returned visit has fresh context and different questions.
    missing = returning_count - len(reused)
    candidates = visits[:max(missing, count // 2)]
    for original in rng.sample(candidates, missing):
        first = datetime.fromisoformat(original["arrival"])
        lower = max(first + timedelta(seconds=min(3600, window * .15)), start + timedelta(seconds=window * .5))
        upper = end - timedelta(seconds=reserve)
        when = lower + (upper - lower) * rng.random()
        scenario = rng.choice(vt.SCENARIOS)
        visits.append(dict(agent_id=original["agent_id"], conversation_id=str(uuid.uuid4()),
            arrival=when.isoformat(), scenario=scenario["name"], returning=True,
            questions=visit_questions(scenario, rng)))
    visits.sort(key=lambda x: x["arrival"])
    return {"synthetic": True, "seed": seed, "timezone": zone,
            "start": start.isoformat(), "end": end.isoformat(),
            "local_start": start.astimezone(ZoneInfo(zone)).isoformat(),
            "local_end": end.astimezone(ZoneInfo(zone)).isoformat(),
            "hours": hours, "unique_identities": count, "new_identities": count - len(reused),
            "returning_identities": returning_count, "retention_fraction_planned": returning_count / count,
            "visits": visits, "expected_tokens_per_visit": EXPECTED_TOKENS_PER_VISIT,
            "question_count_distribution": {"minimum": QUESTION_MIN, "maximum": QUESTION_MAX,
                "probability_each": 1 / (QUESTION_MAX - QUESTION_MIN + 1), "repeats_allowed": True},
            "user_count_is_a_budget_planning_estimate": True}

def started_visits(folder):
    path = folder / "requests.jsonl"
    rows = [json.loads(line) for line in path.read_text().splitlines() if line.strip()] if path.exists() else []
    return {row["conversation_id"] for row in rows if row.get("conversation_id")}

def update_remaining_plan(plan, folder, rng, seed):
    """Change only unstarted visits; keep UUIDs, arrivals and original deadline."""
    started = started_visits(folder)
    scenarios = {s["name"]: s for s in vt.SCENARIOS}
    changes = []
    for visit in plan["visits"]:
        if visit["conversation_id"] in started:
            continue
        old_count = len(visit["questions"])
        visit["questions"] = visit_questions(scenarios[visit["scenario"]], rng)
        changes.append({"conversation_id": visit["conversation_id"], "before": old_count,
                        "after": len(visit["questions"])})
    plan["seed"] = seed
    plan["question_count_distribution"] = {"minimum": QUESTION_MIN, "maximum": QUESTION_MAX,
        "probability_each": 1 / (QUESTION_MAX - QUESTION_MIN + 1), "repeats_allowed": True}
    return changes

class DailyJournal(vt.Journal):
    def __init__(self, folder, zone, resume=False):
        previous = []
        if resume and (folder / "requests.jsonl").exists():
            previous = [json.loads(line) for line in (folder / "requests.jsonl").read_text().splitlines() if line.strip()]
        super().__init__(folder)
        self.zone, self.folder = ZoneInfo(zone), folder
        self.csvfile.seek(0)
        self.csvfile.truncate()
        self.writer = csv.DictWriter(self.csvfile, fieldnames=vt.FIELDS + ["request_time_local"], extrasaction="ignore")
        self.writer.writeheader()
        self.rows = previous
        for row in previous:
            self.writer.writerow(row)
        self.csvfile.flush()

    def write(self, row):
        row["request_time_local"] = datetime.fromisoformat(row["request_time"]).astimezone(self.zone).isoformat()
        super().write(row)
        for provider in (row.get("qa_usage") or {}).get("provider_calls", []):
            append(self.folder / "provider-requests.jsonl", dict(provider, synthetic=True,
                request_time=row["request_time"], request_time_local=row["request_time_local"],
                test_request_id=row["test_request_id"], agent_id=row["agent_id"], conversation_id=row["conversation_id"]))

class DailyClient(vt.Client):
    def __init__(self, args, journal, run_id, ledger, clock, deadline):
        super().__init__(args.base_url, journal, run_id, args.timeout)
        self.ledger, self.clock, self.deadline = ledger, clock, deadline

    def call(self, path, **kwargs):
        left = (self.deadline - self.clock.now()).total_seconds()
        if left <= 2:
            raise StopRun("Eight-hour deadline reached.")
        self.timeout = min(self.timeout, max(1, left - 1))
        event = None
        self.extra_headers = {}
        if path.startswith("/api/transcribe") or path == "/api/chat":
            event = self.ledger.reserve(path, kwargs.get("audio_seconds"))
            self.extra_headers = {"X-QA-Budget": json.dumps(event["allowed"], separators=(",", ":"))}
        try:
            return super().call(path, **kwargs)
        finally:
            if event:
                row = self.journal.rows[-1] if self.journal.rows else {}
                self.ledger.settle(event, row.get("qa_usage"))

def wait_until(target, deadline, clock):
    while clock.now() < min(target, deadline):
        clock.sleep(min(30, (min(target, deadline) - clock.now()).total_seconds()))

def do_visit(visit, args, client, folder, rng, clock, deadline, pool, pool_path, last_chat):
    identity, cid = visit["agent_id"], visit["conversation_id"]
    outcome = dict(agent_id=identity, conversation_id=cid, scenario=visit["scenario"],
                   returning=visit["returning"], planned_turns=len(visit["questions"]), completed_turns=0,
                   actual_start=clock.now().isoformat(), error=None)
    history = []  # Returning identity does NOT inherit a previous conversation.
    audio_folder = folder / "audio"
    audio_folder.mkdir(exist_ok=True)
    factory = vt.AudioFactory(args, rng)
    try:
        for path in ("/", "/health"):
            client.call(path, agent_id=identity)
        client.call("/api/stats/visit", agent_id=identity, body={"id": identity}, content_type="text/plain")
        status = client.call("/api/limit", agent_id=identity, conversation_id=cid)
        if status.get("ok") is False:
            raise StopRun("Website unavailable or at its own limit.")
        wait_until(clock.now() + timedelta(seconds=rng.uniform(4, 10)), deadline, clock)
        for index, question in enumerate(visit["questions"], 1):
            if (deadline - clock.now()).total_seconds() < args.timeout + 30:
                raise StopRun("Insufficient time remains for another complete turn.")
            turn = factory.make(question["text"], audio_folder, f"{cid}-{index}", short_text=question["short_text"])
            wait_until(clock.now() + timedelta(seconds=turn["audio_seconds"] + rng.uniform(1, 5)), deadline, clock)
            if (deadline - clock.now()).total_seconds() < args.timeout + 5:
                raise StopRun("Deadline reached before upload.")
            text = client.call("/api/transcribe?lang=en", agent_id=identity, conversation_id=cid, turn=index,
                body=Path(turn["wav"]).read_bytes(), content_type="audio/wav", audio_seconds=vt.duration(Path(turn["wav"]))).get("text")
            if not isinstance(text, str) or not text.strip():
                raise StopRun("Empty transcription; no automatic POST retry.")
            history.append({"role": "user", "content": text.strip()})
            # Rate safety is a real pause, never a substituted HTTP latency.
            wait_until(max(clock.now(), last_chat[0] + timedelta(seconds=60)), deadline, clock)
            if (deadline - clock.now()).total_seconds() < args.timeout + 1:
                raise StopRun("Deadline reached before chat.")
            last_chat[0] = clock.now()
            reply = client.call("/api/chat", agent_id=identity, conversation_id=cid, turn=index,
                body={"lang": "en", "context": "", "messages": history[-20:]}, ndjson=True)
            answer = reply.get("text", "")
            if answer:
                history.append({"role": "assistant", "content": answer})
            outcome["completed_turns"] += 1
            append(folder / "turns.jsonl", dict(saved_at=clock.now().isoformat(), synthetic=True,
                agent_id=identity, conversation_id=cid, turn=index, expected_text=turn["text"],
                transcribed_text=text, reply=answer, audio_seconds=turn["audio_seconds"],
                audio_target_seconds=turn["audio_target_seconds"], history_messages=len(history),
                qa_usage=reply.get("telemetry", {}).get("qa")))
            pool.setdefault("users", {})[identity] = {"last_seen": clock.now().isoformat()}
            atomic(pool_path, pool)
            # Use response length and a randomized listening/reading speed.
            listen = len(answer.split()) / rng.uniform(2.1, 3.0)
            wait_until(clock.now() + timedelta(seconds=listen + rng.uniform(2, 12)), deadline, clock)
            if reply.get("end"):
                outcome["ended_by_model"] = True
                break
    except (Exception, KeyboardInterrupt) as exc:
        outcome["error"] = vt.safe_error(exc) or "Interrupted"
        raise
    finally:
        outcome["ended_at"] = clock.now().isoformat()
        append(folder / "conversations.jsonl", outcome)

def execute(plan, args, folder, ledger, pool, pool_path, clock, journal):
    deadline = datetime.fromisoformat(plan["end"])
    started = {row["conversation_id"] for row in journal.rows if row.get("conversation_id")}
    old_outcomes = folder / "conversations.jsonl"
    outcomes = [json.loads(line) for line in old_outcomes.read_text().splitlines() if line.strip()] if old_outcomes.exists() else []
    finished = {row["conversation_id"] for row in outcomes if row.get("ended_by_model") or
                row.get("completed_turns", 0) >= row.get("planned_turns", 1)}
    client = DailyClient(args, journal, plan["run_id"], ledger, clock, deadline)
    capability = client.call("/api/qa", agent_id="synthetic-preflight")
    if capability.get("version") != 1 or tuple(capability.get(k) for k in ("primary_model", "fallback_model", "speech_model")) != MODELS:
        raise StopRun("Backend QA guard is missing or models changed. No paid requests sent.")
    completed, skipped, reason = len(finished), [], None
    last_chat = [clock.now() - timedelta(minutes=1)]
    try:
        for visit in plan["visits"]:
            if visit["conversation_id"] in started:
                if visit["conversation_id"] not in finished:
                    skipped.append(dict(conversation_id=visit["conversation_id"], reason="previously started; no request replay on resume"))
                continue
            scheduled = datetime.fromisoformat(visit["arrival"])
            wait_until(scheduled, deadline, clock)
            now = clock.now()
            if now >= deadline:
                break
            if (now - scheduled).total_seconds() > 180 and clock.resumed:
                skipped.append(dict(conversation_id=visit["conversation_id"], reason="missed arrival (sleep or busy); no catch-up burst"))
                continue
            clock.resumed = False
            print(f"{now.astimezone(ZoneInfo(args.timezone)):%H:%M:%S} synthetic visit "
                  f"{visit['agent_id'][:8]}: {len(visit['questions'])} questions", flush=True)
            do_visit(visit, args, client, folder, random.Random(plan["seed"] ^ uuid.UUID(visit["conversation_id"]).int),
                     clock, deadline, pool, pool_path, last_chat)
            completed += 1
    except (StopRun, vt.APIError, ValueError, OSError) as exc:
        reason = vt.safe_error(exc)
        print("No more API requests: " + reason, flush=True)
        budget_stop = "qa_budget" in reason or (isinstance(exc, StopRun) and any(word in reason.lower() for word in ("budget reached", "deadline", "insufficient time")))
        if not budget_stop:
            raise
    finally:
        atomic(folder / "daily-summary.json", dict(synthetic=True, visits_completed=completed, skipped=skipped,
            stop_reason=reason, budget=ledger.snapshot(), planned_end=plan["end"], no_post_retries=True,
            output_voice="Listening time simulated; no unbudgeted Fish/Orpheus requests."))
    # Honour eight elapsed hours even after the planned traffic/budget is used.
    wait_until(deadline, deadline, clock)
    return completed

def parser():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--live", action="store_true", help="send actual requests; otherwise preview only")
    p.add_argument("--resume", type=Path, help="resume a saved plan after stopping the old process; keep its deadline and skip started visits")
    p.add_argument("--hours", type=float, default=8)
    p.add_argument("--users", type=int, help="optional smaller override of the automatic budget plan")
    p.add_argument("--timezone", default="Europe/Zurich")
    p.add_argument("--base-url", default="https://talk-with-ai-8xjh.onrender.com")
    p.add_argument("--out", type=Path, default=Path(__file__).parent / "daily-results")
    p.add_argument("--state", type=Path, default=Path(__file__).parent / "daily-state")
    p.add_argument("--seed", type=int, default=None)
    p.add_argument("--timeout", type=float, default=120)
    p.add_argument("--voice")
    p.add_argument("--tts-command")
    p.add_argument("--noise", type=float, default=.0006)
    return p

def main(argv=None):
    args = parser().parse_args(argv)
    saved_plan = None
    if args.resume:
        saved_plan = json.loads(args.resume.resolve().read_text())
        args.base_url, args.timezone = saved_plan["base_url"], saved_plan["timezone"]
        if args.users is not None:
            raise SystemExit("--users cannot replace identities in a resumed plan.")
    if not 0 < args.hours <= 8 or args.timeout <= 0 or not 0 <= args.noise <= .02:
        raise SystemExit("Hours must be >0 and <=8; timeout/noise must be valid.")
    ZoneInfo(args.timezone)
    url = urllib.parse.urlsplit(args.base_url)
    if url.scheme not in ("http", "https") or not url.netloc or url.username or url.password or url.query or url.fragment or url.path not in ("", "/"):
        raise SystemExit("Use an HTTP(S) origin without credentials, query, fragment or path.")
    args.audio_min, args.audio_max = 5, 25
    clock = Clock()
    start = clock.now()
    seed, rng = vt.random_stream(args.seed)
    run_id = str(uuid.uuid4())
    folder = args.resume.resolve().parent if saved_plan else args.out.resolve() / run_id
    folder.mkdir(parents=True, exist_ok=bool(saved_plan))
    pool_path = args.state.resolve() / "identities.json"
    pool = json.loads(pool_path.read_text()) if pool_path.exists() else {"users": {}}
    journal = None
    with Ledger(args.state.resolve(), clock) as ledger:
        if saved_plan:
            if datetime.fromisoformat(saved_plan["end"]) <= start:
                print("The original deadline has passed. No requests sent.")
                return 0
            plan = saved_plan
            changes = update_remaining_plan(plan, folder, rng, seed)
            count = plan["unique_identities"]
            # Prevent a wake/restart from replaying missed arrivals in a burst.
            clock.resumed = True
            if args.live:
                backup_id = start.strftime("%Y%m%dT%H%M%S") + "-" + uuid.uuid4().hex[:8]
                for name in ("plan.json", "daily-summary.json", "failure.txt"):
                    original = folder / name
                    if original.exists():
                        (folder / (name + ".before-resume-" + backup_id)).write_bytes(original.read_bytes())
                (folder / "failure.txt").unlink(missing_ok=True)
                append(folder / "schedule-updates.jsonl", dict(at=start.isoformat(), seed=seed,
                    reason="Owner requested independent uniform 1–5 questions", changes=changes,
                    original_deadline=plan["end"], no_started_visits_replayed=True))
        else:
            count = planned_user_count(ledger.remaining())
            if args.users is not None:
                if not 1 <= args.users <= count:
                    raise SystemExit(f"--users must be between 1 and the current estimate ({count}).")
                count = args.users
            if count < 1:
                print("No budget remains for another planned visit. Shared state was preserved.")
                return 0
            plan = make_daily_plan(start, args.hours, count, pool, rng, seed, args.timezone)
            plan.update(run_id=run_id, base_url=args.base_url, budget=ledger.snapshot())
        if not saved_plan or args.live:
            atomic(folder / "plan.json", plan)
        print(f"Plan: {count} identities, {len(plan['visits'])} visits, "
              f"{sum(len(v['questions']) for v in plan['visits'])} questions; "
              f"{plan['local_start']} to {plan['local_end']}", flush=True)
        print(f"Budget ceiling: {CAPS}; token usage may end traffic before every visit completes.", flush=True)
        print(f"Results: {folder}", flush=True)
        if not args.live:
            print("Preview only: no audio synthesized and no network requests made.")
            return 0
        try:
            journal = DailyJournal(folder, args.timezone, resume=bool(saved_plan))
            execute(plan, args, folder, ledger, pool, pool_path, clock, journal)
        except (Exception, KeyboardInterrupt) as exc:
            (folder / "failure.txt").write_text((vt.safe_error(exc) or "Interrupted") + "\n")
            print("Stopped: " + (vt.safe_error(exc) or "Interrupted"), file=sys.stderr)
            return 1
        finally:
            if journal:
                journal.close()
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
