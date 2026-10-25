"""Preview-only timing helpers for the planned daily runner. Sends no requests."""
from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo


def daily_window(launched_at, *, hours=8, zone="Europe/Sofia", opening=8, closing=20):
    if launched_at.tzinfo is None:
        raise ValueError("Launch time must include a time zone")
    if not 0 <= opening < closing <= 23 or hours <= 0:
        raise ValueError("Invalid daytime window")
    local = launched_at.astimezone(ZoneInfo(zone))
    opens = datetime.combine(local.date(), time(opening), tzinfo=local.tzinfo)
    closes = datetime.combine(local.date(), time(closing), tzinfo=local.tzinfo)
    start = max(local, opens)
    if start >= closes:
        raise ValueError("Today's daytime window has ended; launch tomorrow morning")
    requested_end = (start.astimezone(timezone.utc) + timedelta(hours=hours)).astimezone(local.tzinfo)
    return start, min(requested_end, closes)


def visit_starts(start, end, count, rng, *, reserve_minutes=15):
    """Stratified random arrivals, leaving space for the final conversation.

    These are future schedule slots, not substituted API request timestamps.
    Fresh entropy comes from voice_tester.random_stream(), unless a seed is set.
    """
    if start.tzinfo is None or end.tzinfo is None or count < 1 or reserve_minutes < 0:
        raise ValueError("Invalid schedule settings")
    seconds = (end.astimezone(timezone.utc) - start.astimezone(timezone.utc)).total_seconds() - reserve_minutes * 60
    if seconds <= 0:
        raise ValueError("Not enough time remains for a visit")
    span = seconds / count
    beginning = start.astimezone(timezone.utc)
    return [(beginning + timedelta(seconds=rng.uniform(i * span, (i + 1) * span))).astimezone(start.tzinfo)
            for i in range(count)]


if __name__ == "__main__":
    import json
    from voice_tester import random_stream
    seed, rng = random_stream()
    start, end = daily_window(datetime.now(timezone.utc))
    print(json.dumps({"preview_only": True, "seed": seed, "start": start.isoformat(), "end": end.isoformat(),
                      "example_visits": [d.isoformat() for d in visit_starts(start, end, 10, rng)]}, indent=2))
