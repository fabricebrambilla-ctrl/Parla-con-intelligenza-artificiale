"""Offline tests: virtual clock, labelled acoustic fixtures and local HTTP only."""
import io
import json
import random
import tempfile
import threading
import unittest
import wave
from contextlib import redirect_stdout
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch
import daily_runner as dr
import voice_tester as vt

class FakeClock:
    def __init__(self):
        self.at = datetime(2026, 10, 26, 8, tzinfo=timezone.utc)
        self.resumed = False
        self.oversleep_once = False
    def now(self):
        return self.at
    def sleep(self, seconds):
        self.at += timedelta(seconds=seconds)
        if self.oversleep_once:
            self.at += timedelta(hours=3)
            self.resumed = True
            self.oversleep_once = False

class FixtureAudio:
    def __init__(self, args, rng):
        self.rng = rng
    def make(self, text, folder, stem, short_text=None):
        seconds = self.rng.randrange(5 * vt.RATE, 25 * vt.RATE + 1) / vt.RATE
        path = folder / (stem + ".wav")
        with wave.open(str(path), "wb") as w:
            w.setparams((1, 2, vt.RATE, 0, "NONE", "fixture"))
            w.writeframes(b"\x00\x10" * round(seconds * vt.RATE))
        return dict(text=text, wav=str(path), audio_seconds=seconds, audio_target_seconds=seconds)

class LocalAPI:
    def __init__(self, mode="ok"):
        self.mode, self.calls = mode, []
        outer = self
        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *_): pass
            def do_GET(self): self.answer()
            def do_POST(self): self.answer()
            def answer(self):
                raw = self.rfile.read(int(self.headers.get("Content-Length", 0)))
                audio = self.headers.get("Content-Type") == "audio/wav"
                payload = raw if audio else json.loads(raw) if raw else None
                envelope = json.loads(self.headers.get("X-QA-Budget", "{}"))
                outer.calls.append(dict(path=self.path, payload=payload, envelope=envelope,
                    identity=self.headers.get("X-Anon-Id"), synthetic=self.headers.get("X-Synthetic-Test"),
                    request_id=self.headers.get("X-Test-Request-Id")))
                used = dict.fromkeys(dr.CAPS, 0)
                provider = []
                status, ctype = 200, "application/json"
                if self.path == "/api/qa":
                    data = dict(version=1, primary_model=dr.MODELS[0], fallback_model=dr.MODELS[1], speech_model=dr.MODELS[2],
                                synthetic_only=outer.mode != "unsafe-guard", budgets=list(dr.CAPS))
                elif self.path == "/api/limit":
                    data = {"ok": True}
                elif self.path.startswith("/api/transcribe"):
                    with wave.open(io.BytesIO(raw)) as wav:
                        seconds = wav.getnframes() / wav.getframerate()
                    used.update(speech_requests=1, audio_seconds=max(10, __import__("math").ceil(seconds)))
                    data = {"text": "Fixture question referring to prior discussion."}
                elif self.path == "/api/chat":
                    if outer.mode == "quota":
                        status, data = 429, {"error": "limit"}
                    elif envelope.get("primary_tokens", 0) < 500:
                        data = {"type": "error", "error": "qa_budget"}
                    else:
                        model_calls = 3 if outer.mode == "multi-round" else 1
                        if envelope.get("primary_requests",0) < model_calls:
                            data = {"type":"error","error":"qa_budget"}
                        else:
                            used.update(primary_requests=model_calls, primary_tokens=500*model_calls, searches=envelope.get("searches",0))
                            provider = [dict(model=dr.MODELS[0], accounted_tokens=500, input_tokens=450,
                                output_tokens=50, usage_measured=True, status=200) for _ in range(model_calls)]
                            data = {"type":"reply","text":"A useful fixture response that keeps context.", "lang":"en","end":False}
                    ctype = "application/x-ndjson"
                elif self.path == "/api/stats/visit":
                    data = {"ok":True}
                else:
                    data = {"ok":True}
                if envelope and outer.mode != "missing-telemetry":
                    data["telemetry"] = {"qa":{"version":1,"spent":used,"provider_calls":provider}}
                response = (json.dumps(data) + ("\n" if "ndjson" in ctype else "")).encode()
                self.send_response(status)
                self.send_header("Content-Type",ctype)
                self.send_header("Content-Length",str(len(response)))
                self.end_headers()
                self.wfile.write(response)
        self.server = ThreadingHTTPServer(("127.0.0.1",0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.base = f"http://127.0.0.1:{self.server.server_port}"
    def __enter__(self):
        self.thread.start()
        return self
    def __exit__(self,*_):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()

class DailyTests(unittest.TestCase):
    def test_original_limits_seventy_five_percent_and_default_users(self):
        self.assertEqual(dr.CAPS, dict(primary_requests=750,primary_tokens=150000,
            fallback_requests=750,fallback_tokens=150000,speech_requests=1500,audio_seconds=21600,searches=24))
        self.assertEqual(dr.planned_user_count(dr.CAPS),40)

    def test_retention_first_day_and_following_day_context_is_not_in_pool(self):
        start=FakeClock().now()
        first=dr.make_daily_plan(start,8,20,{"users":{}},random.Random(12),12,"Europe/Zurich")
        self.assertEqual(first["unique_identities"],20)
        self.assertEqual(len(first["visits"]),21)
        returned=[x for x in first["visits"] if x["returning"]]
        self.assertEqual(len(returned),1)
        same=[x for x in first["visits"] if x["agent_id"]==returned[0]["agent_id"]]
        self.assertLess(same[0]["arrival"],same[1]["arrival"])
        pool={"users":{x["agent_id"]:{} for x in first["visits"]}}
        second=dr.make_daily_plan(start+timedelta(days=1),8,20,pool,random.Random(45),45,"Europe/Zurich")
        self.assertEqual(second["new_identities"],19)
        self.assertEqual(len(second["visits"]),20)
        self.assertEqual(sum(v["returning"] for v in second["visits"]),1)

    def test_eight_elapsed_hours_and_new_random_arrivals(self):
        a=dr.make_daily_plan(FakeClock().now(),8,20,{"users":{}},random.Random(1),1,"Europe/Zurich")
        b=dr.make_daily_plan(FakeClock().now()+timedelta(minutes=23),8,20,{"users":{}},random.Random(2),2,"Europe/Zurich")
        self.assertEqual(datetime.fromisoformat(a["end"])-datetime.fromisoformat(a["start"]),timedelta(hours=8))
        self.assertNotEqual([x["arrival"] for x in a["visits"]],[x["arrival"] for x in b["visits"]])
        self.assertTrue(all(1 <= len(x["questions"]) <= 5 for x in a["visits"]))

    def test_variable_questions_and_weekly_unique_identity_total(self):
        pool={"users":{}}
        new_total=0
        for day in range(7):
            plan=dr.make_daily_plan(FakeClock().now()+timedelta(days=day),8,40,pool,random.Random(day),day,"Europe/Zurich")
            self.assertEqual(plan["returning_identities"],2)
            self.assertTrue(all(1 <= len(v["questions"]) <= 5 for v in plan["visits"]))
            self.assertEqual(len(plan["visits"]),42 if day == 0 else 40)
            new_total += plan["new_identities"]
            for visit in plan["visits"]:
                pool["users"][visit["agent_id"]]={}
        self.assertEqual(new_total,268)
        self.assertEqual(len(pool["users"]),268)

    def test_uniform_independent_count_draws_include_repeats_and_both_bounds(self):
        rng=random.Random(765)
        counts=[len(dr.visit_questions(vt.SCENARIOS[0],rng)) for _ in range(10000)]
        self.assertEqual(set(counts),{1,2,3,4,5})
        self.assertTrue(any(a==b for a,b in zip(counts,counts[1:])))
        self.assertTrue(all(1800 < counts.count(n) < 2200 for n in range(1,6)))
        for n in range(1,6):
            with patch.object(rng,'randint',return_value=n) as draw:
                self.assertEqual(len(dr.visit_questions(vt.SCENARIOS[0],rng)),n)
                self.assertEqual(len(dr.visit_questions(vt.SCENARIOS[0],rng)),n)
                self.assertEqual(draw.call_args_list,[((1,5),),((1,5),)])

    def test_resume_changes_only_unstarted_question_counts_and_keeps_deadline(self):
        plan=dr.make_daily_plan(FakeClock().now(),8,20,{"users":{}},random.Random(7),7,'Europe/Zurich')
        original=json.loads(json.dumps(plan))
        with tempfile.TemporaryDirectory() as tmp:
            folder=Path(tmp)
            (folder/'requests.jsonl').write_text(json.dumps({'conversation_id':plan['visits'][0]['conversation_id']})+'\n')
            rng=random.Random(8)
            with patch.object(rng,'randint',return_value=1):
                changed=dr.update_remaining_plan(plan,folder,rng,8)
            self.assertEqual(plan['visits'][0],original['visits'][0])
            self.assertEqual(len(changed),len(plan['visits'])-1)
            self.assertTrue(all(len(v['questions'])==1 for v in plan['visits'][1:]))
            self.assertEqual(plan['end'],original['end'])
            self.assertEqual([(v['agent_id'],v['conversation_id'],v['arrival']) for v in plan['visits']],
                             [(v['agent_id'],v['conversation_id'],v['arrival']) for v in original['visits']])

    def test_resume_preserves_request_history_and_never_replays_started_visits(self):
        with tempfile.TemporaryDirectory() as tmp, LocalAPI() as api:
            folder=Path(tmp)/'run';folder.mkdir()
            clock=FakeClock()
            plan=dr.make_daily_plan(clock.now(),8,3,{'users':{}},random.Random(9),9,'Europe/Zurich')
            plan['run_id']='resume-fixture'
            plan['base_url']=api.base
            dr.atomic(folder/'plan.json',plan)
            old=dr.DailyJournal(folder,'Europe/Zurich')
            for visit in plan['visits'][:2]:
                row=dict.fromkeys(vt.FIELDS)
                row.update(request_time=clock.now().isoformat(),conversation_id=visit['conversation_id'],
                           agent_id=visit['agent_id'],endpoint='/api/limit',test_request_id=visit['conversation_id'])
                old.write(row)
            old.close()
            previous=(folder/'requests.jsonl').read_bytes()
            first=plan['visits'][0]
            (folder/'conversations.jsonl').write_text(json.dumps(dict(conversation_id=first['conversation_id'],
                planned_turns=len(first['questions']),completed_turns=len(first['questions'])))+'\n')
            with patch.object(dr,'Clock',return_value=clock),patch.object(vt,'AudioFactory',FixtureAudio),redirect_stdout(io.StringIO()):
                code=dr.main(['--live','--resume',str(folder/'plan.json'),'--state',str(Path(tmp)/'state'),'--seed','987'])
            self.assertEqual(code,0)
            self.assertTrue((folder/'requests.jsonl').read_bytes().startswith(previous))
            touched={x['identity'] for x in api.calls}
            self.assertTrue(all(v['agent_id'] not in touched for v in plan['visits'][:2]))
            self.assertIn(plan['visits'][2]['agent_id'],touched)
            self.assertEqual(clock.now(),datetime.fromisoformat(plan['end']))
            summary=json.loads((folder/'daily-summary.json').read_text())
            self.assertEqual(summary['visits_completed'],2)
            self.assertEqual(len(summary['skipped']),1)
            updated=json.loads((folder/'plan.json').read_text())
            self.assertEqual(updated['end'],plan['end'])
            self.assertEqual(updated['visits'][:2],plan['visits'][:2])
            self.assertEqual(updated['question_count_distribution']['probability_each'],.2)
            self.assertTrue(list(folder.glob('plan.json.before-resume-*')))
            self.assertTrue((folder/'schedule-updates.jsonl').exists())

    def test_ledger_reserves_before_post_and_survives_crash_and_reset_boundary(self):
        with tempfile.TemporaryDirectory() as tmp:
            clock=FakeClock()
            with dr.Ledger(tmp,clock) as ledger:
                e=ledger.reserve("/api/chat")
                self.assertEqual(ledger.remaining()["primary_tokens"],0)
                with self.assertRaises(dr.StopRun):ledger.reserve("/api/chat")
            with dr.Ledger(tmp,clock) as ledger:
                self.assertEqual(ledger.remaining()["primary_tokens"],0)
                clock.at += timedelta(hours=25)
                self.assertEqual(ledger.remaining()["primary_tokens"],150000)
                # Same-month search reservations remain bounded even after 24h.
                self.assertEqual(ledger.remaining()["searches"],24)

    def test_invalid_telemetry_does_not_refund_reservation(self):
        with tempfile.TemporaryDirectory() as tmp, dr.Ledger(tmp,FakeClock()) as ledger:
            e=ledger.reserve("/api/chat")
            with self.assertRaises(dr.StopRun):ledger.settle(e,None)
            self.assertEqual(ledger.remaining()["primary_tokens"],0)
            spent=dict.fromkeys(dr.CAPS,0);spent["primary_tokens"]=150001
            with self.assertRaises(dr.StopRun):ledger.settle(e,{"version":1,"spent":spent})

    def run_local(self,mode="ok",users=40,oversleep=False,batch=False,model_calls_per_turn=2):
        tmp=tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        folder=Path(tmp.name)/"run";folder.mkdir()
        clock=FakeClock();clock.oversleep_once=oversleep
        with LocalAPI(mode) as api, dr.Ledger(Path(tmp.name)/"state",clock,model_calls_per_turn) as ledger:
            args=dr.parser().parse_args(["--base-url",api.base]);args.audio_min,args.audio_max=5,25
            plan=dr.make_daily_plan(clock.now(),8,users,{"users":{}},random.Random(17),17,args.timezone,
                                    question_max=2 if batch else 5, batch=batch)
            plan["run_id"]="fixture-run"
            journal=dr.DailyJournal(folder,args.timezone)
            try:
                with patch.object(vt,"AudioFactory",FixtureAudio),redirect_stdout(io.StringIO()):
                    dr.execute(plan,args,folder,ledger,{"users":{}},Path(tmp.name)/"identities.json",clock,journal)
            finally:
                journal.close()
            return api.calls,plan,clock,journal.rows,json.loads((folder/"daily-summary.json").read_text())

    def test_full_eight_hours_accelerated_real_http_context_identity_audio_and_budgets(self):
        calls,plan,clock,rows,summary=self.run_local()
        self.assertEqual(clock.now(),datetime.fromisoformat(plan["end"]))
        self.assertEqual(summary["visits_completed"],42)
        chat=[x for x in calls if x["path"]=="/api/chat"]
        self.assertTrue(chat)
        self.assertTrue(all(x["synthetic"]=="true" for x in calls))
        first=[x for x in chat if len(x["payload"]["messages"])==1]
        self.assertEqual(len(first),42)
        self.assertTrue(any(len(x["payload"]["messages"])>1 for x in chat))
        self.assertEqual(len({x["request_id"] for x in calls}),len(calls))
        self.assertEqual(len({x["identity"] for x in first}),40)
        self.assertLessEqual(sum(x["envelope"].get("searches",0) for x in chat),24)
        self.assertTrue(all(5<=x["audio_seconds"]<=25 for x in rows if x["audio_seconds"]))
        self.assertFalse(any(x["path"]=="/api/speak" for x in calls))
        self.assertTrue(all("request_time_local" in x for x in rows))

    def test_sleep_skips_missed_arrivals_without_catchup(self):
        calls,plan,clock,rows,summary=self.run_local(users=5,oversleep=True)
        self.assertTrue(summary["skipped"])
        self.assertEqual(clock.now(),datetime.fromisoformat(plan["end"]))

    def test_missing_telemetry_and_quota_stop_before_another_user(self):
        for mode in ("missing-telemetry","quota"):
            with self.subTest(mode=mode), self.assertRaises((dr.StopRun,vt.APIError)):
                self.run_local(mode,users=2)

    def test_batch_more_identities_without_more_budget_or_fixed_three_questions(self):
        self.assertEqual(dr.planned_user_count(dr.CAPS,1,2),81)
        pool={"users":{f"known-{i}":{} for i in range(10)}}
        start=FakeClock().now()
        plan=dr.make_daily_plan(start,4,81,pool,random.Random(21),21,"Europe/Zurich",1,2,True)
        self.assertEqual(plan["unique_identities"],81)
        self.assertEqual(plan["new_identities"],77)
        self.assertEqual(plan["returning_identities"],4)
        self.assertEqual(set(len(v["questions"]) for v in plan["visits"]),{1,2})
        self.assertTrue(all(v["arrival"]==start.isoformat() for v in plan["visits"]))
        self.assertEqual(plan["question_count_distribution"]["probability_each"],.5)

    def test_batch_real_local_http_exits_when_done_and_keeps_qa_identity_and_budget(self):
        calls,plan,clock,rows,summary=self.run_local(users=4,batch=True)
        self.assertLess(clock.now(),datetime.fromisoformat(plan["end"]))
        self.assertEqual(summary["visits_completed"],4)
        chat=[x for x in calls if x["path"]=="/api/chat"]
        self.assertEqual(len({x["identity"] for x in chat}),4)
        self.assertTrue(all(x["synthetic"]=="true" for x in calls))
        self.assertTrue(all(x["envelope"]["fallback_requests"]==0 for x in chat))
        self.assertTrue(all(5<=x["audio_seconds"]<=25 for x in rows if x["audio_seconds"]))
        self.assertFalse(any(x["path"]=="/api/speak" for x in calls))

    def test_batch_refuses_unsafe_guard_before_any_provider_request(self):
        with self.assertRaises(dr.StopRun):
            self.run_local(mode="unsafe-guard",users=2,batch=True)

    def test_multi_round_response_is_reserved_once_without_replaying_the_post(self):
        calls,plan,clock,rows,summary=self.run_local(mode="multi-round",users=2,batch=True,model_calls_per_turn=4)
        self.assertEqual(summary["visits_completed"],2)
        chat=[x for x in calls if x["path"]=="/api/chat"]
        self.assertEqual(len(chat),sum(len(x["questions"]) for x in plan["visits"]))
        self.assertTrue(all(x["envelope"]["primary_requests"]==4 for x in chat))
        self.assertTrue(all(x["envelope"]["fallback_requests"]==0 for x in chat))
        self.assertEqual(summary["budget"]["remaining"]["primary_requests"],750-3*len(chat))
        self.assertEqual(summary["budget"]["remaining"]["primary_tokens"],150000-1500*len(chat))
        self.assertTrue(all(x["synthetic"]=="true" for x in calls))

    def test_four_call_reservation_preserves_global_ceiling_and_refunds_only_confirmed_usage(self):
        with tempfile.TemporaryDirectory() as tmp, dr.Ledger(tmp,FakeClock(),4) as ledger:
            event=ledger.reserve('/api/chat')
            self.assertEqual(event['allowed']['primary_requests'],4)
            self.assertEqual(ledger.remaining()['primary_requests'],746)
            self.assertEqual(ledger.remaining()['primary_tokens'],0)
            spent=dict.fromkeys(dr.CAPS,0);spent.update(primary_requests=3,primary_tokens=1500)
            ledger.settle(event,{'version':1,'spent':spent})
            self.assertEqual(ledger.remaining()['primary_requests'],747)
            self.assertEqual(ledger.remaining()['primary_tokens'],148500)
            ledger.data['events'][0]['spent']['primary_requests']=749
            self.assertEqual(ledger.reserve('/api/chat')['allowed']['primary_requests'],1)

    def test_per_turn_call_allowance_cannot_exceed_four(self):
        for count in (0,5,100):
            with self.assertRaises(ValueError):dr.Ledger('/unused',FakeClock(),count)

    def test_seventy_percent_uses_existing_rolling_usage_without_reset(self):
        with tempfile.TemporaryDirectory() as tmp:
            clock=FakeClock()
            with dr.Ledger(tmp,clock) as old:
                event=old.reserve('/api/chat')
                spent=dict.fromkeys(dr.CAPS,0);spent.update(primary_requests=1,primary_tokens=141000)
                old.settle(event,{'version':1,'spent':spent})
            with dr.Ledger(tmp,clock,fraction=.70) as reduced:
                self.assertEqual(reduced.caps['primary_requests'],700)
                self.assertEqual(reduced.caps['primary_tokens'],140000)
                self.assertEqual(reduced.caps['speech_requests'],1400)
                self.assertEqual(reduced.caps['audio_seconds'],20160)
                self.assertEqual(reduced.caps['searches'],23)
                self.assertEqual(reduced.month_search_cap,700)
                self.assertEqual(reduced.remaining()['primary_tokens'],0)
                self.assertEqual(len(reduced.data['events']),1)
                with self.assertRaises(dr.StopRun):reduced.reserve('/api/chat')

    def test_three_to_ten_questions_are_independent_uniform_draws_with_context(self):
        rng=random.Random(115)
        counts=[len(dr.visit_questions(vt.SCENARIOS[0],rng,3,10)) for _ in range(10000)]
        self.assertEqual(set(counts),set(range(3,11)))
        self.assertTrue(all(1100 < counts.count(n) < 1400 for n in range(3,11)))
        self.assertTrue(any(a==b for a,b in zip(counts,counts[1:])))
        plan=dr.make_daily_plan(FakeClock().now(),8,10,{'users':{}},random.Random(44),44,'Europe/Zurich',3,10)
        self.assertEqual(plan['question_count_distribution']['probability_each'],.125)
        self.assertTrue(all(3<=len(v['questions'])<=10 for v in plan['visits']))
        self.assertGreater(plan['expected_tokens_per_visit'],dr.expected_visit_tokens())

    def test_resuming_long_question_profile_keeps_saved_range(self):
        plan=dr.make_daily_plan(FakeClock().now(),8,5,{'users':{}},random.Random(3),3,'Europe/Zurich',3,10)
        with tempfile.TemporaryDirectory() as tmp:
            dr.update_remaining_plan(plan,Path(tmp),random.Random(4),4)
        self.assertEqual(plan['question_count_distribution']['minimum'],3)
        self.assertEqual(plan['question_count_distribution']['maximum'],10)
        self.assertTrue(all(3<=len(v['questions'])<=10 for v in plan['visits']))


    def test_wait_target_crossed_between_clock_reads_never_sleeps_negative(self):
        base=FakeClock().now()
        class AdvancingClock:
            def __init__(self):self.reads=0;self.sleeps=[]
            def now(self):
                value=base+timedelta(seconds=self.reads*2)
                self.reads+=1
                return value
            def sleep(self,seconds):
                if seconds < 0:raise ValueError('sleep length must be non-negative')
                self.sleeps.append(seconds)
        clock=AdvancingClock()
        dr.wait_until(base+timedelta(seconds=1),base+timedelta(hours=1),clock)
        self.assertEqual(clock.sleeps,[1])
        expired=AdvancingClock()
        dr.wait_until(base-timedelta(seconds=1),base+timedelta(hours=1),expired)
        self.assertEqual(expired.sleeps,[])

if __name__=="__main__":
    unittest.main()
