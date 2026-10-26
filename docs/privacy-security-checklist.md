# Privacy and security review

Updated 26 October 2026. Operator confirmed by the owner: Fabrice Brambilla, Switzerland, brambillafabrice@gmail.com. This is an implementation record and an open review checklist, not legal certification.

## Implemented

- Aggregate page openings only, with date and count kept for seven Zurich calendar days. No persistent visitor IDs, per-user records or conversation analytics. Initialization removes the former identifier tables. Old counts are intentionally not migrated.
- Privacy information and a single AI identity statement before microphone access. Short controls follow language selection. Six-language privacy information distinguishes the voice page, text API, providers, browser preferences and aggregate counts.
- No saved voice history. Ending a conversation clears its text in browser memory. Text API chats expire on access and periodic cleanup after about 24 idle hours, and can disappear earlier on deletion, restart or capacity eviction.
- Groq Inference APIs zero data retention enabled with explicit owner approval. Usage metadata remains. Recheck the setting when the provider/project changes.
- No raw upstream error text in application logs. API responses use no-store, invalid empty voice prompts do not dispatch to a model, external Postgres verifies TLS certificates, and the private counter reset requires a CSRF token.
- Dependency/license inventory in THIRD_PARTY_NOTICES.md. No bundled image or font assets found. Keep dependency license and NOTICE files when distributing.
- AI-generated fields/headers on text and cloud-speech output. These are truthful labels, not proof of compliance with every marking requirement.

## Decisions that code cannot settle

| Item | What must be established | Status |
|---|---|---|
| Provider eligibility | The owner confirmed the account age requirement is met on 26 October 2026. No age-based blocker is identified. Confirm the account and its existing agreement cover the actual operator; do not accept new terms or transfer accounts without a decision. | Age checked; ordinary contract review remains |
| Sensitive information | A voice question may reveal health or disability information even though the app does not ask for it. A warning is not an Article 9 basis. Assess lawful handling and any necessary explicit consent or restriction before inviting sensitive use. | Open |
| Ordinary lawful bases | Review whether Article 6(1)(b) is appropriate to the actual free service relationship, and document a legitimate-interests assessment for security and professional outreach where used. | Open |
| Provider processing and transfers | Groq publishes a DPA incorporated into its Services Agreement and Swiss SCC adaptations. Confirm it covers this account, review Render/Tavily agreements, record actual subprocessors, destination countries, retention and transfer safeguards. Frankfurt hosting is not proof all processing stays in Germany. | Open |
| Children using the service | The operator is an adult. Separately assess any rules for children using the service; the operator's age does not settle end-user requirements. Do not invent parental consent. | End-user policy review open |
| EU/UK scope | Assess GDPR territorial scope, any representative requirement, applicable accessibility law and local direct-email rules. Language availability alone does not establish lawful deployment or outreach in every country. | Open |
| AI Act | Review the app's provider/deployer role, applicable transparency and machine-readable marking duties. JSON flags and HTTP headers alone have not been certified as satisfying all duties. | Open |
| Human accessibility testing | Complete actual JAWS/NVDA/VoiceOver and speaker testing. Automated regressions do not prove every assistive-technology configuration works. | Open |
| Availability | The owner deliberately keeps ordinary API access public and site quotas off. A bot can exhaust provider quota. No per-user restrictions were silently reinstated. | Accepted owner tradeoff; revisit if needed |

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
