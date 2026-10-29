#!/bin/sh
cd "$(dirname "$0")" || exit 1
exec /usr/bin/caffeinate -i /Library/Frameworks/Python.framework/Versions/3.14/bin/python3 daily_runner.py --live --batch --questions-min 1 --questions-max 2 --model-calls-per-turn 4 --hours 4 --timezone Europe/Zurich "$@"
