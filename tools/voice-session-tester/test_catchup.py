import io
import json
import random
import tempfile
import unittest
from contextlib import redirect_stdout
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import patch
import daily_runner as dr
import voice_tester as vt
from test_daily_runner import FakeClock, FixtureAudio, LocalAPI

class CatchupTests(unittest.TestCase):
    def source(self, root, base='http://fixture.test'):
        folder=root/'old';folder.mkdir()
        old=dr.make_daily_plan(FakeClock().now()-timedelta(days=1),8,6,{'users':{}},random.Random(2),2,'Europe/Zurich')
        old.update(run_id='yesterday-fixture',base_url=base)
        dr.atomic(folder/'plan.json',old)
        (folder/'requests.jsonl').write_text(json.dumps({'conversation_id':old['visits'][0]['conversation_id']})+'\n')
        # Even a failure before the first CID-bearing request is not replayed.
        (folder/'conversations.jsonl').write_text(json.dumps({'conversation_id':old['visits'][1]['conversation_id'],'completed_turns':0})+'\n')
        return folder/'plan.json',old

    def today(self, base='http://fixture.test'):
        plan=dr.make_daily_plan(FakeClock().now(),8,3,{'users':{}},random.Random(8),8,'Europe/Zurich')
        plan.update(base_url=base,run_id='today-fixture')
        return plan

    def test_only_never_started_visits_move_and_old_files_are_unchanged(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);source,old=self.source(root);before=source.read_bytes()
            today=self.today();end=today['end']
            dr.carry_unstarted_into_plan(today,[source],root,random.Random(9))
            self.assertEqual(today['carried_visits'],4)
            self.assertEqual(today['today_visits'],3)
            self.assertEqual(today['end'],end)
            self.assertEqual(source.read_bytes(),before)
            carried=[v for v in today['visits'] if 'carryover_source' in v]
            self.assertEqual([v['conversation_id'] for v in carried],[v['conversation_id'] for v in old['visits'][2:]])
            self.assertEqual([v['questions'] for v in carried],[v['questions'] for v in old['visits'][2:]])
            self.assertTrue(all(datetime.fromisoformat(today['start'])<=datetime.fromisoformat(v['arrival'])<datetime.fromisoformat(end) for v in today['visits']))
            self.assertEqual(today['visits'],sorted(today['visits'],key=lambda v:v['arrival']))

    def test_global_started_journal_and_duplicate_sources_cannot_replay(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);source,old=self.source(root)
            other=root/'later';other.mkdir();(other/'requests.jsonl').write_text(json.dumps({'conversation_id':old['visits'][2]['conversation_id']})+'\n')
            today=self.today();dr.carry_unstarted_into_plan(today,[source,source],root,random.Random(3))
            self.assertEqual(today['carried_visits'],3)
            self.assertEqual(len({v['conversation_id'] for v in today['visits']}),len(today['visits']))

    def test_wrong_site_or_unexpired_source_refused(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);source,old=self.source(root)
            with self.assertRaisesRegex(ValueError,'same website'):
                dr.carry_unstarted_into_plan(self.today('http://other.test'),[source],root,random.Random(2))
            old['end']=(FakeClock().now()+timedelta(hours=1)).isoformat();dr.atomic(source,old)
            with self.assertRaisesRegex(ValueError,'has not ended'):
                dr.carry_unstarted_into_plan(self.today(),[source],root,random.Random(2))

    def test_catchup_uses_same_ledger_real_current_times_and_no_old_visit_replay(self):
        with tempfile.TemporaryDirectory() as tmp, LocalAPI() as api:
            root=Path(tmp);source,old=self.source(root,api.base);clock=FakeClock()
            state=root/'state'
            with dr.Ledger(state,clock) as ledger:
                old_event=ledger.reserve('/api/chat')
                spent=dict.fromkeys(dr.CAPS,0);spent.update(primary_requests=1,primary_tokens=1000)
                ledger.settle(old_event,{'version':1,'spent':spent})
            with patch.object(dr,'Clock',return_value=clock),patch.object(vt,'AudioFactory',FixtureAudio),redirect_stdout(io.StringIO()):
                code=dr.main(['--live','--carry-unstarted',str(source),'--users','3','--base-url',api.base,'--out',str(root),'--state',str(state)])
            self.assertEqual(code,0)
            plan_files=[p for p in root.glob('*/plan.json') if p!=source]
            self.assertEqual(len(plan_files),1)
            plan=json.loads(plan_files[0].read_text());self.assertEqual(plan['carried_visits'],4)
            rows=[json.loads(line) for line in (plan_files[0].parent/'requests.jsonl').read_text().splitlines()]
            touched={r.get('conversation_id') for r in rows}
            self.assertTrue(all(v['conversation_id'] not in touched for v in old['visits'][:2]))
            self.assertTrue(all(datetime.fromisoformat(e['at'])>=FakeClock().now() for e in json.loads((state/'budget.json').read_text())['events']))
            self.assertEqual(json.loads((state/'budget.json').read_text())['events'][0]['spent']['primary_tokens'],1000)
            summary=json.loads((plan_files[0].parent/'daily-summary.json').read_text());self.assertEqual(summary['visits_completed'],7)
            self.assertEqual(clock.now(),datetime.fromisoformat(plan['end']))

if __name__=='__main__':unittest.main()
