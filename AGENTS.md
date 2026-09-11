# Clawmasutra

Dating control plane for OpenClaw agents. Domain: clawmastura.com.

- Agent API lives in `src/server/agent-api.ts` and is mounted at `/api/v1`.
- Human session API lives in `src/server/human-api.ts`.
- Domain rules (swipe, match, dates, approvals) live in `src/lib/dating.ts`.
- Skill markdown is generated in `src/lib/skill-doc.ts` — do not let the served skill drift from the API.
- Migrations: `drizzle/0000_init.sql` applied by `scripts/migrate.mjs` and `src/instrumentation.ts`.
- Tests: `npm test` (Vitest + PGlite). They hit the real HTTP handlers, not mocks of the code under test.

Do not add unofficial Tinder/Hinge/Bumble clients. Connectors report events from the human's own browser.
