# Eight-hour synthetic QA runner

Run this once each morning in Terminal on this Mac:

```sh
"/Users/fabrice/Documents/Codex/2026-10-24/referenced-chatgpt-conversation-this-is-an/outputs/voice-session-tester/run-eight-hours.command"
```

Or, after downloading the folder elsewhere, open Terminal in that folder and run:

```sh
sh run-eight-hours.command
```

Requires Python 3.11+, macOS `say`, and `afconvert`. No Python packages or API keys are needed. Keep the Mac powered, its **lid open**, and Terminal running. The launcher prevents idle sleep; the display can turn off. Closing the lid can still suspend execution. Ctrl+C stops the runner. Nothing is scheduled automatically, and this command does not install a background service.

## Daily and weekly volume

The default plan is **40 synthetic identities per day**. Each visit independently samples **1–5 question-and-answer exchanges**, uniformly: each possible count has a 20% probability, and repeats are allowed. Context is retained within the visit. The assistant can end a visit earlier. Each new visit starts with empty conversation history, even when an identity returns.

| Day | New UUIDs | Returning UUIDs | Planned visits | Maximum questions |
| --- | ---: | ---: | ---: | ---: |
| First run, no identity history | 40 | 2 of those 40 return later that day | 42 | 210 |
| Each subsequent day | 38 | 2 from the saved identity pool | 40 | 200 |
| Seven consecutive days, starting fresh | **268 distinct UUIDs** | 5% of each day's 40 identities return | **282 visits** | **1,410** |

The expected question counts are 126 on the first day, 120 on each later day, and 846 across the week; the actual sampled totals vary. These are planning numbers, not guaranteed completions. The model's actual usage, early endings, provider errors, sleep and remaining shared budget can reduce them. The same returning person may be selected on more than one day. The client keeps UUIDs in `daily-state/identities.json`; it never rotates an identity to bypass a provider limit.

The estimate uses 3,500 answer-model tokens per visit at an expected three questions (the mean of 1–5), plus allowance for return visits. Longer sampled visits can use more tokens; the hard usage guards remain authoritative. Tokens are the expected constraint. Actual usage depends on response length, prior context and tool calls, so an exact maximum user count cannot be known in advance. The backend checks a conservative allowance **before** each provider call and refunds only usage confirmed by the provider.

## Timing and variation

The eight-hour deadline is the actual launch time plus eight elapsed hours. A launch at 08:17 ends at 16:17; a launch at 09:43 ends at 17:43. There is no fixed finish clock time. Timestamps include UTC and `Europe/Zurich` local time with the correct daylight-saving offset. Use `--timezone Europe/Sofia` if that is the desired display zone instead.

Each launch draws a fresh random seed. Arrivals are randomly distributed through the window, leaving time for final visits. Visits execute one at a time; a long visit may delay the next. Question topics, spoken elaborations, speech rate and pauses vary. Each recording independently samples an actual duration between **5 and 25 seconds** at audio-sample precision. Legitimate repeats are allowed, including repeated whole-second values in Groq's dashboard.

The tester waits for each real response, then simulates listening based on its word count at a varied listening speed, plus thinking time. It also enforces at least 60 seconds between answer requests to reduce burst risk. Provider per-minute limits can still stop a run; no retries or extra identities bypass them.

Missed arrivals after sleep are skipped rather than replayed in a burst. The deadline is not extended. If the computer is asleep at the deadline, the process cannot exit until it wakes, but it will make no new API requests after waking past that deadline. A restart requires manually launching a new run; the saved budget remains in force.

## Approved budgets

These use the owner's supplied limits, not a claim about every Groq account's current plan.

| Resource | Supplied daily limit | This runner's 75% ceiling |
| --- | ---: | ---: |
| gpt-oss-120b requests | 1,000 | 750 |
| gpt-oss-120b total tokens | 200,000 | 150,000 |
| gpt-oss-20b requests | 1,000 | 750 |
| gpt-oss-20b total tokens | 200,000 | 150,000 |
| Whisper requests | 2,000 | 1,500 |
| Whisper audio | 8 hours | 6 hours |
| Tavily searches | approximately 33 | 24 |

The runner does not need fallback-model calls during its normal flow, and gives those a zero allowance. It stops on a provider 429 instead of switching models. Tavily has an additional ceiling of 750 searches per calendar month, based on the supplied 1,000/month limit. After its search allowance is exhausted, the backend returns search unavailable to the model and can continue answering without live search.

Speech allowance conservatively charges at least 10 seconds per transcription, rounding longer clips upward; the saved actual recording duration stays unchanged. See [Groq's speech documentation](https://console.groq.com/docs/speech-to-text).

The local ledger uses a rolling 24-hour window, so relaunching or crossing midnight does not reset it. Only one live run can use the same state folder at a time. Keep `daily-state` in place across days and use the same folder for this account. A timeout, interrupted upload or missing accounting keeps the full reservation and stops the run; an uncertain POST is never blindly replayed.

**These ceilings cover traffic from this runner's shared ledger.** Other visitors, other scripts, other computers and earlier unrecorded usage also consume your organization-wide provider quota and are not visible to this client. The runner therefore cannot guarantee total account usage stays below 75%. Groq's [rate-limit documentation](https://console.groq.com/docs/rate-limits) describes the organization-wide limits and per-minute restrictions. A normal budget stop leaves the runner idle until the eight-hour deadline; a provider or accounting error exits immediately.

## Honest measurements

Every request identifies itself as synthetic QA. The test exercises real transcription and answer endpoints, using real generated speech. It does not manufacture human research data or establish that a screen reader works.

Model choice, measured latency, token usage, status codes, provider request IDs and errors are actual results, never randomized. TTFT stays unknown unless explicitly measured; time to first byte or a complete reply is recorded separately. Whisper's small input-token counter is not a count of spoken words; audio duration and transcript output are the relevant separate fields. A zero TTFT on that nonstreaming transcription row does not prove an error or automation.

The daily runner skips remote speech-output and summary calls because their additional budgets were not provided. Listening time is simulated. It does not operate a browser, microphone permission dialogs or actual screen readers.

## Results and options

Each run prints its results folder under `daily-results`. It saves:

- `plan.json`: arrivals, UUIDs, topics, independently sampled 1–5-question visits and deadline.
- `turns.jsonl` and `conversations.jsonl`: completed exchanges and visit outcomes.
- `requests.csv` / `requests.jsonl`: actual client timestamps, latency, IDs and errors.
- `provider-requests.jsonl`: safe per-model usage returned by the backend; no API keys.
- `daily-summary.json`: completions, skipped visits, stop reason and remaining budget.
- `audio/*.wav`: the actual generated recordings sent to transcription.
- `failure.txt`: only when execution fails or is interrupted.

Preview without any network requests or speech generation:

```sh
python3 daily_runner.py
```

Use fewer identities if desired, still with uniformly sampled 1–5 questions per visit:

```sh
sh run-eight-hours.command --users 10
```

Small identity counts round the 5% return rate to a whole person and report the actual planned ratio. Without `--seed`, each launch uses fresh randomness. `--seed 42` intentionally makes schedule choices reproducible; it does not make provider replies or metrics deterministic.

The backend must expose `/api/qa` version 1 and safe QA accounting. The runner verifies this before paid requests and refuses to run if the guard is missing or model configuration differs.

## Verification scope

Automated tests use real local HTTP with a virtual clock to exercise the complete eight-hour schedule, variable-length context, independent uniform count sampling, safe continuation without replay, returning identities, quota reservations, missing telemetry and sleep skips. They use explicitly labelled acoustic fixtures, not production requests. Native macOS speech is checked separately. This is not a claim that an eight-hour production run has already completed.

## Continue an interrupted run without extending it

After stopping the old process, the updated runner can continue the same saved plan with `--resume /absolute/path/to/plan.json`. It preserves the original deadline, identity UUIDs, arrivals, request history and shared budget. It skips all previously started visits (including partial visits) instead of replaying any uncertain requests, and samples new counts only for unstarted visits. Missed arrivals are skipped. Before updating the plan, it saves backup copies and records the changes in `schedule-updates.jsonl`. It refuses to run beside another process using the same state folder.

The 25 October run used this continuation path, then stopped after an unaccounted network failure. It is not still running. The normal morning command is unchanged.

## Carry never-started visits into a new eight-hour run

After an old plan has expired, `--carry-unstarted /absolute/path/to/old/plan.json` adds only its never-started visits to a fresh daily plan. It preserves the old UUIDs and questions, leaves the old files intact, and samples new arrivals across the next eight hours. Completed, partial and uncertain visits are excluded by checking all result journals. Original planned times are provenance only; every actual request uses its current timestamp.

Use the same `daily-state` and `daily-results` folders. The new visits and carry-over share the same rolling budget. The 5% return rule applies to each original daily cohort; combining cohorts can change the combined ratio. The larger queue may not finish before the budget or deadline stops it. This mode cannot be combined with `--resume`, cannot use an unexpired plan or a different site, and cannot run beside another copy using the same state.

On 26 October, the authorized catch-up combined 26 never-started visits with 40 visits planned for today. It scheduled 66 visits and 65 distinct UUIDs from 13:27 to 21:27 Europe/Zurich, subject to the remaining budget. Do not launch a second copy while that process is active.
