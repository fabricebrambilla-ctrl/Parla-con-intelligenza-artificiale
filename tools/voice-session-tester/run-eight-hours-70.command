#!/bin/sh
cd "$(dirname "$0")" || exit 1
exec /usr/bin/caffeinate -i python3 daily_runner.py --live --hours 8 --timezone Europe/Zurich --questions-min 3 --questions-max 10 --budget-fraction 0.70 --model-calls-per-turn 4 "$@"
