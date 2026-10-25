#!/bin/sh
cd "$(dirname "$0")" || exit 1
exec /usr/bin/caffeinate -i python3 daily_runner.py --live "$@"
