# Voice session tester

For the approved **eight-hour runner**, use [EIGHT-HOUR-RUNNER.md](EIGHT-HOUR-RUNNER.md). It samples **1–5 questions per visit uniformly and independently**, plans **40 identities/day**, and enforces the supplied **75% budgets**. The `voice_tester.py` commands below remain the separate short-session tool.

A standalone client for your Talk with Artificial Intelligence website. No repository access or Groq API key is needed: it calls the same public voice endpoints as your frontend, which uses its own backend configuration.

By default, each simulated user makes **one visit with 3–10 question-and-answer turns**. Use `--conversations` explicitly if you want several visits per identity. Follow-ups use the previous replies. Each new conversation starts with empty context. Spoken input lasts **5–25 seconds**, measured from the WAV file rather than assigned in a log.

Sessions are synthetic QA, not real human user research. The client identifies itself as `VoiceSessionTester/1.0 (synthetic QA)` and sends `X-Synthetic-Test: true`. It uses actual speech and varied pacing to exercise transcription, context, reply streaming, speech output and summarization. It does not spoof a browser or conceal automated traffic.

## Run on this Mac

Requires Python 3.11 or newer, macOS `say`, and `afconvert`. No Python packages need installing. Audio is generated into files; the tester does not access your microphone or play sound.

Open a terminal in the extracted `voice-session-tester` folder.

Prepare one user's visit without contacting the site:

```sh
python3 voice_tester.py --out results
```

Run one user, with one visit and 3–10 questions, against your live website:

```sh
python3 voice_tester.py --live --agents 1 --out results
```

Run five distinct users, with one visit each:

```sh
python3 voice_tester.py --live --agents 5 --out results
```

Users run sequentially. Pauses include time to speak, listen and think, so the full test can take many minutes. The input recordings vary; reply length, server latency, token usage and model choice are real results of your app. If a quota returns HTTP 429, or the chat stream reports a limit, **the entire run stops**. It never creates another identity to bypass that limit and never automatically retries a POST.

The entire run also stops on an exposed `model_not_found`/model-access error, rather than submitting more conversations to a broken model configuration. The public request bodies do not select a model. Groq retired `groq/compound` and `groq/compound-mini` on 21 September 2026; any backend still using those IDs needs a server-side change. See the [official deprecation notice](https://console.groq.com/docs/deprecations). The tester cannot detect an internal provider error if your backend catches it and only returns a successful fallback reply.

To reuse the exact audio and user IDs from a prepared plan, use its printed absolute path:

```sh
python3 voice_tester.py --live --plan /absolute/path/to/results/RUN_ID/plan.json --out results
```

`--plan` reuses the users, conversations and turn counts stored in that file; planning flags such as `--agents` do not change it. Keep its original audio folder in place. A new run gets a new run ID and new test request IDs. Independent live invocations without `--plan` create new users.

For another deployment, add `--base-url https://your-deployment.onrender.com`. For fast local checks only, `--pace-scale 0` removes simulated pauses. It does not change measured request latency.

## Identity and context

- A random UUID identifies each simulated user. The same UUID goes into `X-Anon-Id` on every request and `{ "id": "…" }` on `/api/stats/visit`.
- If multiple visits are requested for a user, they share the UUID. Every conversation has its own local `conversation_id`, and `messages` starts empty.
- On turn two, the chat request contains the first user message, first assistant answer, and second user message. The same pattern continues for 3–10 turns.
- `context` is an empty string for every new conversation. Summaries are saved in the local results, but are not fed into a separate conversation.
- The voice endpoints do not return a persistent chat ID. The tester's conversation ID is for local correlation; it is not an `/api/agent` chat ID.
- `X-Test-Run-Id` and `X-Test-Request-Id` help correlate backend logs if your server chooses to record them. They do not automatically propagate through Render into Groq logs.

This uses the website's **voice workflow**, not `/api/agent/chats`. The agent API does not exercise audio transcription.

## Requests made

For each user: `GET /`, `GET /health`, `POST /api/stats/visit`.

For each conversation: `GET /api/limit`, followed by 3–10 pairs of `POST /api/transcribe?lang=en` and `POST /api/chat`. The chat payload is `{ "lang": "en", "context": "", "messages": [...] }`.

If `/api/limit` advertises an AI voice for the reply language, the tester also sends sentence-sized `POST /api/speak` requests. Otherwise it simulates time spent listening to the browser's local speech fallback. It does not claim that speech generation occurred when that endpoint was skipped.

At the start of each user session the tester reads `/app.js`. It sends `POST /api/summary` only if that deployed frontend still references the route. Your newer frontend has removed summaries, so the tester skips them there. There is no extra goodbye transcription by default, so 3–10 turns means 3–10 actual question-and-answer exchanges. If the assistant ends early, the tester records that instead of forcing further turns.

HTTP errors, invalid JSON, empty transcriptions and broken chat streams are surfaced. A failed or timed-out POST is not replayed automatically because the server may already have processed it.

## Results and measurements

Every invocation creates its own folder:

- `plan.json`: synthetic user IDs, conversation topics, planned utterances, sampled duration targets and audio paths.
- `randomization.json`: the generated or explicitly selected seed, saved before preparation so a failed preparation can be reproduced.
- `audio/*.wav`: real spoken, mono 16 kHz, 16-bit PCM inputs.
- `requests.csv` and `requests.jsonl`: one record per HTTP request, including failures.
- `conversations.jsonl`: transcribed questions, actual assistant replies, summary and completion/error state.
- `turns.jsonl`: each completed turn is saved immediately, before listening pauses, so stopping a run does not lose its completed exchanges.
- `summary.json`: request/error counts, status counts and latency percentiles, both overall and per endpoint.
- `failure.txt`: present if preparation or execution was interrupted or failed.

Preparation-only runs create the plan and audio, not a live request report. Unknown fields are empty in CSV and `null` in JSON.

The error counts cover client-visible failures. A successful HTTP 200 does not establish that every internal provider call succeeded: the server can catch a provider error and produce a fallback reply. `summary.json` explicitly records that hidden provider errors are not verified.

| Requested parameter | How it is handled |
| --- | --- |
| Request time | Actual UTC timestamp at the start of each HTTP request. |
| Model | Only recorded if your server returns `model` or `telemetry.model`. The backend selects it. |
| API key | No keys are requested, read or saved. `api_key_label` stays blank. Your provider dashboard can show which backend credential was used. |
| Status code | Actual HTTP status. A chat stream can contain a logical error after HTTP 200; `error` records that too. |
| Time to first token | Blank unless the backend returns a measured `telemetry.time_to_first_token_ms`. The current site sends completed reply events, which do not reveal the first generated token. |
| Time to first byte | Client elapsed time until the first response body bytes are received. Includes network and server work. |
| Time to first reply | Client elapsed time until a complete `type: "reply"` event is received. This is not first-token latency. |
| Latency | Actual client elapsed time until the HTTP body completes or the request fails. Human pauses are outside this timer. |
| Input/output tokens | Only from returned `usage.prompt_tokens`/`usage.completion_tokens`, `usage.input_tokens`/`usage.output_tokens`, or explicit telemetry. Never estimated from character counts. |
| Audio seconds | Actual input WAV duration on transcription calls. Blank on text/summary/health calls because they do not upload audio. |
| Request ID | Separate `request_id` (`X-Request-Id`), `render_request_id` (`Rndr-Id`) and provider ID, if returned. `test_request_id` is generated locally for each individual request. |
| Error | HTTP/network/parser failures, with common credential formats redacted. Conversation-level errors are also in `conversations.jsonl`. |

Request IDs should **not** all be the same. One user spans many conversations, and one conversation spans many HTTP requests. A backend chat request can also trigger several different provider calls, each with its own provider ID. Render IDs and Groq IDs are separate. The public client cannot reconstruct hidden provider calls or their individual token usage.

If you later want complete Groq metrics in the CSV, instrument the backend to expose a safe telemetry object, for example:

```json
{
  "telemetry": {
    "model": "actual model from the provider response",
    "input_tokens": 123,
    "output_tokens": 45,
    "time_to_first_token_ms": 150.2,
    "provider_request_id": "actual-provider-request-id"
  }
}
```

Those numbers are an example of the schema, not test results. If one request makes multiple provider calls, log those individually on the server; do not represent a combined value as one model call. Never include an API key in this object. That instrumentation is the part for which repository access would help; running this client does not require it.

## Variation and limits

Five built-in English conversation topics include AI research, reading printed text, phone accessibility, cooking, and language learning. Every topic has context-dependent follow-ups. A **fresh seed from operating-system entropy is generated on every new run**. It controls topic order, turn count, text elaborations, speech rate, short leading/trailing pauses, gain, low background noise, and thinking/listening intervals. UUIDs remain randomly unique. Supply `--seed 42` only when you deliberately want repeatable choices. `--plan` deliberately reuses its saved audio, so omit it when you want new recordings.

Each audio duration is drawn uniformly between the selected bounds at 16 kHz sample precision. The synthesizer adjusts spoken content and speech rate, then makes a small final timing adjustment (at most 10%) to match that sampled duration. Actual measured WAV duration and the sampled target are both saved. The provider dashboard may show whole seconds, so different recordings can still display the same integer. Repeats are allowed; values are not rejected merely because an earlier value matched.

Token counts, TTFT, measured latency, status codes, model choices, API-key labels and provider request IDs are never randomized. These are measured or server-selected results, not simulation knobs.

Speech audio is checked to contain a nontrivial signal, and speech generation is rejected if it returns silence. The code does not fill a short word with twenty seconds of silence or cut speech mid-sentence. Small room-noise variation is for testing transcription robustness. Add `--noise 0` to disable it. Speech synthesis is not equivalent to real microphone recordings, accents, hesitations or accessibility testing with people.

You can set `--voice` to an installed macOS English voice. To inspect installed voices, use `say -v '?'`. For other operating systems, `--tts-command` accepts an executable command that reads the utterance from stdin and writes an **uncompressed mono 16 kHz, 16-bit PCM WAV** to `{wav}`. An optional `{rate}` placeholder receives the speech rate. The command runs without a shell. Example adapter interface:

```sh
python3 voice_tester.py --tts-command 'python3 /path/to/your_tts_adapter.py --output "{wav}" --rate {rate}'
```

The adapter must perform any required resampling. Longer custom text may require the adapter to honor `{rate}`. Custom scenarios can be supplied with `--scenarios file.json`, using an array of objects with `name` and one or more English `turns` strings; turn 2 onward should reference earlier replies. Random context-dependent follow-ups fill visits longer than the supplied scenario. Optional `short_turns` supplies concise equivalents for short recordings.

This tester checks the backend voice flow. It does not operate the actual browser, exercise microphone permission dialogs, verify on-device voice playback, or reproduce mobile/screen-reader UI issues.

## Eight-hour runner

The completed daily runner is `daily_runner.py`; on this Mac run `./run-eight-hours.command`. See [the complete instructions and budgets](EIGHT-HOUR-RUNNER.md). It uses eight elapsed hours from launch, with no fixed 20:00 cutoff. Run it in the morning for daytime traffic. The older `daily_timing.py` is a preview-only helper with a daytime cutoff; it is not used by the daily runner.

The daily runner adds safe backend accounting for every hidden answer-model call, search and transcription. `provider-requests.jsonl` contains individually returned model usage and provider IDs. Unknown metrics remain unknown; conservative budget reservations are explicitly separate from measured usage. It does not send unbudgeted remote TTS or summary calls.

## Offline verification

```sh
python3 -m unittest -v test_voice_tester.py test_daily_timing.py test_daily_runner.py test_catchup.py
```

The tests use a local mock server and explicitly labeled audio/metadata fixtures. They cover three conversations per identity, context continuity and reset, distinct identities, measured WAV duration, chunked Unicode reply parsing, conditional speech output, surfaced failures, rate-limit stopping without retries, and missing versus returned provider metrics. They do not consume production API quota.

The live attempt on 24 October 2026 began at 19:23:02 Europe/Sofia. One simulated user completed three transcription/chat exchanges before the run was stopped after your provider screenshot exposed a caught Compound error. After the fix was verified live, the same user finished the remaining two conversations (three and four exchanges), for ten answered turns across three conversations in total. The final runtime-log check found no new Compound errors after deployment. See `live-test-review.md` for the screenshot interpretation and the distinction between provider metrics and human behavior.

Protocol references inspected on 24 October 2026: [frontend](https://parla-con-intelligenza-artificiale.onrender.com/app.js), [visit beacon](https://parla-con-intelligenza-artificiale.onrender.com/stats.js), and [agent API documentation](https://parla-con-intelligenza-artificiale.onrender.com/api/agent).
