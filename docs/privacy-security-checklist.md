# Privacy and security review

Updated 27 October 2026. Operator confirmed by the owner: Fabrice Brambilla, 17, Switzerland, brambillafabrice@gmail.com. The public About page also includes the owner-approved phone number, +41 78 335 15 72. The confirmed age of 17 supersedes the earlier statement of 18 and does not establish provider/account contractual eligibility. This is an implementation record and an open review checklist, not legal certification.

## Implemented

- Daily aggregate page openings and valid voice questions submitted, kept for seven Zurich calendar days. The question total excludes flagged synthetic/QA traffic and the separate text API; it counts a valid submission even if its answer fails. No persistent visitor IDs, per-user records, individual request timestamps, question text or audio are stored in these aggregates. Repeats and unflagged automation can count, so totals do not identify unique or verified human users. Initialization removes the former identifier tables; question totals start with this update and earlier questions are not reconstructed.
- Privacy information and a single AI identity statement before microphone access. Short controls follow language selection. Six-language privacy information distinguishes the voice page, text API, providers, browser preferences and aggregate counts.
- No saved voice history. Ending a conversation clears its text in browser memory. Text API chats expire on access and periodic cleanup after about 24 idle hours, and can disappear earlier on deletion, restart or capacity eviction.
- Groq Inference APIs zero data retention enabled with explicit owner approval. Usage metadata remains. Recheck the setting when the provider/project changes.
- No raw upstream error text in application logs. API responses use no-store, invalid empty voice prompts do not dispatch to a model, external Postgres verifies TLS certificates, and the private counter reset requires a CSRF token.
- Dependency/license and asset inventory in THIRD_PARTY_NOTICES.md. The About page includes the original owner-supplied 130 by 130 PNG portrait, with public use explicitly requested; it is unchanged and has no EXIF chunk. No external fonts, remote image assets or UICI logo are used. Preserve dependency license and NOTICE files when distributing.
- The outbound Groq prompt describes spoken/screen-reader interface requirements rather than assigning a disability to every caller, and instructs the model not to infer personal attributes from use. This does not establish a lawful basis for sensitive questions or guarantee the model cannot infer them.
- AI-generated fields/headers on text and cloud-speech output. These are truthful labels, not proof of compliance with every marking requirement.

## Decisions that code cannot settle

| Item | What must be established | Status |
|---|---|---|
| Provider eligibility | Fabrice confirmed he is 17 on 27 October 2026, replacing the earlier statement of 18. The previous adult/account-eligibility conclusion is superseded. Verify that each actual account and agreement permits this operator and use; do not invent guardian approval, accept new terms or transfer accounts without a decision. | Open |
| Sensitive information | A voice question may reveal health or disability information even though the app does not ask for it. A warning is not an Article 9 basis. Assess lawful handling and any necessary explicit consent or restriction before inviting sensitive use. | Open |
| Ordinary lawful bases | Review whether Article 6(1)(b) is appropriate to the actual free service relationship, and document a legitimate-interests assessment for security and professional outreach where used. | Open |
| Provider processing and transfers | Groq publishes a DPA incorporated into its Services Agreement and Swiss SCC adaptations. Confirm it covers this account, review Render/Tavily agreements, record actual subprocessors, destination countries, retention and transfer safeguards. Frankfurt hosting is not proof all processing stays in Germany. | Open |
| Children using the service | The operator is 17. Separately assess the rules for end users who are children; operator age does not settle end-user consent or provider requirements. Do not invent parental consent. | End-user policy review open |
| EU/UK scope | Assess GDPR territorial scope, any representative requirement, applicable accessibility law and local direct-email rules. Language availability alone does not establish lawful deployment or outreach in every country. | Open |
| AI Act | Review the app's provider/deployer role, applicable transparency and machine-readable marking duties. JSON flags and HTTP headers alone have not been certified as satisfying all duties. | Open |
| Human accessibility testing | Complete actual JAWS/NVDA/VoiceOver and speaker testing. Automated regressions do not prove every assistive-technology configuration works. | Open |
| Availability | The owner deliberately keeps ordinary API access public and site quotas off. A bot can exhaust provider quota. No per-user restrictions were silently reinstated. | Accepted owner tradeoff; revisit if needed |

## Verification record

The integrated staged release passed the full local regression suite twice: 97 tests, 96 passed, one optional Redis integration skipped, zero failures per run. Local evidence is `/tmp/fabrice-app-20261027-full-1-authorized.log` and `/tmp/fabrice-app-20261027-full-2.log`. Prior CUA-only Chrome checks covered 36 six-language home/About layout cases and native keyboard/return-language behavior. Documentation corrections followed the full runs without changing the tested application code. These checks do not resolve the legal/provider decisions above or replace real JAWS/NVDA/VoiceOver and speaker tests.

## Operating procedure

Keep questions, recordings, credentials and provider error bodies out of application logs. Use synthetic fixtures for debugging. Review dependencies after security notices and preserve reproducible lockfiles.

For a rights request, verify the minimum context needed to identify any retained record. Do not ask for an ID document by default. Explain when no identifiable app record exists; coordinate any provider-held record through its documented process. Keep a minimal request/action record. A deletion request is not permission to destroy unrelated mail or required delivery/opt-out evidence.

For a suspected incident, restrict affected access, preserve minimum factual evidence, assess the data/risk and contact the owner promptly. Evaluate Swiss/EU notification duties with qualified help, including any applicable 72-hour GDPR deadline; do not treat every ordinary model error as a breach.

Maintain a short processing register and a documented risk/DPIA screening before wider or sensitive deployment. Do not certify a DPIA unnecessary merely because the service is free. Do not begin new bulk outreach until the recipient list, regional rules and current notice are reviewed. University sending remains on hold until Fabrice chooses contacts. Never repeat initial outreach to an address or organization already contacted.

## Official references

- [Swiss FDPIC: AI and data protection](https://www.edoeb.admin.ch/en/ai-and-data-protection)
- [Swiss FDPIC: duty to provide information](https://www.edoeb.admin.ch/en/duty-to-provide-information)
- [Swiss FDPIC: outsourcing](https://www.edoeb.admin.ch/en/outsourcing-of-data-processing)
- [Swiss Federal Act on Data Protection](https://www.fedlex.admin.ch/eli/cc/2022/491/en)
- [EU GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj)
- [EDPB consent guidelines](https://www.edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_202005_consent_en.pdf)
- [European Commission: AI transparency obligations](https://digital-strategy.ec.europa.eu/en/policies/guidelines-ai-transparency-obligations)
- [Groq data controls](https://console.groq.com/docs/your-data)
- [Groq Services Agreement](https://console.groq.com/docs/legal/services-agreement)
- [Groq DPA](https://console.groq.com/docs/legal/customer-data-processing-addendum)
- [Tavily platform terms](https://www.tavily.com/terms)
- [Tavily privacy](https://www.tavily.com/privacy)
- [Render DPA](https://render.com/dpa)
- [Render logging](https://render.com/docs/logging)
- [Fish Audio privacy](https://fish.audio/privacy/)
- [Express security practices](https://expressjs.com/en/advanced/best-practice-security/)
- [OWASP Node.js security](https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html)
- [CNIL professional email prospecting](https://www.cnil.fr/la-prospection-commerciale-par-courrier-electronique)
- [Canadian regulator: CASL questions](https://crtc.gc.ca/eng/com500/faq500.htm/)

No general requirement to advertise that code was AI-assisted was identified in this reviewed scope. Keep the app's AI interaction disclosure and all relevant licenses; do not turn this observation into a universal legal guarantee.
