# Provider routing

Ordinary chat/transcription reads GROQ_API_KEY, GROQ_API_KEY_2, GROQ_API_KEY_3. Search reads TAVILY_API_KEY and TAVILY_API_KEY_3. All values stay in Render; never paste them into the frontend, repository, telemetry or logs. Extra Fish voice remains unchanged and primary-only.

The first available key is used until a definite HTTP 429 rejection, then the next distinct key is tried. Tavily also advances after a documented HTTP 432 plan-usage rejection, with a 24-hour cooldown; its 433 pay-as-you-go spending block is not bypassed. Each key is attempted at most once per operation. Retry-After is respected separately for each model/service; missing headers default to a 60-second cooldown. Timeouts, cancellation, malformed success responses, billing/access blocks and other HTTP errors are not retried. An expired cooldown makes the first key eligible again. Same-organization keys still share the provider quota; counting keys is not counting organizations.

Local diagnostics count actual responses and measured chat tokens per alias since process start. They reset on deployment and are not a durable billing limit. Provider limits and billing remain authoritative. No plan purchase, payment or automatic reload change is included.

QA with an explicit budget envelope stays on GROQ_API_KEY and TAVILY_API_KEY, never on another account. The previous run was stopped before paid routing, with journals/budget retained. Do not multiply the QA allowance by the configured key count or restart old partial visits.

Startup checks GET /models for every Groq key, and GET /usage for every Tavily key. These validate authentication, without running inference or search. A startup HTTP error needs investigation; a configured key is not automatically a working key. Logs show aliases/status only.

Capacity illustration using the owner's original allowances: 3 independent organizations × 200,000 primary tokens/day × 70% = 420,000 tokens/day. The local sample has 94 measured answered questions using 130,495 primary tokens, mean 1,388 tokens/question. This suggests about 302 answered questions or 46 sessions at 6.5 questions/session. Longer histories (sample covers turns 1–5), research and other traffic can lower the result. Paid-plan daily quotas are not verified; these numbers are conditional, not the account's confirmed entitlement or real-user counts.

Check data-retention controls independently in every provider organization. The privacy notice discloses that zero retention is not verified for all accounts.

Sources: https://console.groq.com/docs/rate-limits ; https://console.groq.com/docs/errors ; https://docs.tavily.com/documentation/api-reference/endpoint/usage .
