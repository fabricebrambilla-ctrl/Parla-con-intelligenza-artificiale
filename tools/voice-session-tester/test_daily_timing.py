import random
import unittest
from datetime import datetime, timedelta, timezone
from daily_timing import daily_window, visit_starts


class TimingTests(unittest.TestCase):
    def test_end_moves_with_actual_launch_time(self):
        for clock, expected in [("08:13", "16:13"), ("09:47", "17:47"), ("11:02", "19:02")]:
            begin, end = daily_window(datetime.fromisoformat(f"2026-10-26T{clock}:00+02:00"))
            self.assertEqual(end.strftime("%H:%M"), expected)
            self.assertEqual(end - begin, timedelta(hours=8))

    def test_late_launch_is_cut_off_at_daytime_boundary(self):
        begin, end = daily_window(datetime.fromisoformat("2026-10-26T15:30:00+02:00"))
        self.assertEqual(end.strftime("%H:%M"), "20:00")
        self.assertEqual(end - begin, timedelta(hours=4, minutes=30))
        with self.assertRaisesRegex(ValueError, "ended"):
            daily_window(datetime.fromisoformat("2026-10-26T20:30:00+02:00"))

    def test_timezone_follows_daylight_saving_change(self):
        before, _ = daily_window(datetime.fromisoformat("2026-10-24T06:00:00+00:00"))
        after, _ = daily_window(datetime.fromisoformat("2026-10-25T06:00:00+00:00"))
        self.assertEqual(before.utcoffset(), timedelta(hours=3))
        self.assertEqual(after.utcoffset(), timedelta(hours=2))

    def test_arrivals_are_scattered_inside_window_and_change_by_seed(self):
        start, end = daily_window(datetime.fromisoformat("2026-10-26T09:00:00+02:00"))
        a = visit_starts(start, end, 12, random.Random(11))
        b = visit_starts(start, end, 12, random.Random(99))
        self.assertNotEqual(a, b)
        self.assertEqual(a, sorted(a))
        self.assertTrue(all(start <= t <= end - timedelta(minutes=15) for t in a))
        self.assertGreater(len({(a[i + 1] - a[i]).total_seconds() for i in range(11)}), 1)


if __name__ == "__main__":
    unittest.main()
