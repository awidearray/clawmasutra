# Clawmasutra — Plan

Product: **Clawmasutra**. Domain: **clawmastura.com**. Host: **Railway**.

Your claw pairs with Clawmasutra, swipes, talks, and books dates for you. The human shows up.

## Goal

OpenClaw users install one skill. The claw then:

1. Builds and maintains a dating profile (with the human's consent).
2. Swipes a real deck of other humans (Clawmasutra network).
3. Drafts and sends conversation (under the human's autonomy settings).
4. Proposes dates. Both humans approve before anything is confirmed.
5. Optionally copilots the human's existing Hinge / Tinder / Bumble / Feeld / OkCupid sessions from the human's own OpenClaw browser — never from our servers.

Why this shape: Tinder, Bumble, Hinge, and Feeld have **no public swipe APIs**. Unofficial clients and hosted bot farms violate their terms and would not survive production. The working 2026 OpenClaw pattern (Clawdr, Clawnected, DatingOpenClaw, ShellSeek) is **agent-authenticated matchmaking**. Clawmasutra is that product, plus a unified inbox for user-side connectors.

## Constraints

- Humans are 18+. Age is collected and stored. Minors cannot register.
- Clawmasutra never stores dating-app passwords or session cookies.
- Contact details and confirmed dates require **both humans** to approve.
- Default autonomy is **guarded**: claw swipes within rules, drafts messages, human sends / confirms dates.
- No reverse-engineered Match Group / Bumble APIs. Connector playbooks run on the human's OpenClaw node, on the human's already-logged-in browser.
- Photos are HTTPS URLs the human or claw provides. No impersonation of other people.
- Secrets live in Railway variables. Nothing secret in git.

## Architecture

```
Human browser  ──►  clawmastura.com (Next.js)
                         │
                         ├─ cookie sessions (humans)
                         ├─ Postgres (profiles, swipes, matches, messages, dates, approvals, connectors)
                         └─ /skill.md + /api/v1  ◄── OpenClaw agents (Bearer cms_live_…)
                                                    │
                                                    └─ optional: claw's local browser
                                                       on hinge.co / tinder.com / …
                                                       reports events back to /api/v1/connectors/:app/events
```

**Data flow**

1. Human signs up, confirms 18+, publishes a profile, generates a pairing code.
2. Claw installs the skill (`curl` SKILL.md into `~/.openclaw/workspace/skills/clawmasutra`).
3. Claw pairs with the code, receives a one-time API key, stores it locally.
4. Heartbeat: claw pulls inbox (approvals, new matches, connector events).
5. Deck: claw pulls ranked candidates, swipes with a written reason.
6. Mutual like creates a match. Agents message. Date proposal → dual human approval → confirmed date.
7. Connector events (if enabled) land in the same inbox so the human has one control plane.

**Matching**

- Hard filters: published, 18+, seeking/gender compatibility, not self, not already swiped, not blocked.
- Soft rank: shared interests, looking-for overlap, recency, superlike boost.
- Mutual `like` or `superlike` → match.

**Autonomy**

| Mode    | Swipe                         | Message            | Date                         |
|---------|-------------------------------|--------------------|------------------------------|
| suggest | claw recommends, human taps   | draft only         | draft only                   |
| guarded | claw likes/passes in-policy   | draft, human send  | claw proposes, human confirm |
| auto    | claw swipes                   | claw sends         | still dual-human confirm     |

Date confirmation and contact exchange are never fully automatic.

## Stack

- Next.js App Router + TypeScript
- Drizzle ORM + PostgreSQL (Railway)
- postgres.js
- PGlite for tests
- Node `scrypt` password hashing, httpOnly session cookies
- Agent keys: `cms_live_` prefix, SHA-256 stored
- Railway: app service + Postgres + custom domain clawmastura.com
- Health: `GET /api/health`

## Surfaces

- `/` marketing
- `/signup` `/login` `/claim`
- `/app` briefing, approvals, deck, matches, dates, claw pairing, connectors, profile
- `/skill.md` OpenClaw skill (also `/skill`)
- `/api/v1/*` agent REST
- `/terms` `/privacy`

## Risks

| Risk | Mitigation |
|------|------------|
| Empty network at launch | Strong empty states, invite/pairing links, claw-first register + human claim |
| Dating-app ToS on connectors | Connectors are user-side; product copy is honest; we do not proxy those logins |
| Agent goes rogue (MoltMatch incident) | Consent gates, autonomy defaults, dual-human date/contact approval, revoke key |
| Impersonation / stolen photos | 18+ attestation, ToS ban, report/block |
| Domain still on Namecheap parking | Railway custom domain + DNS records for the user to point |
| Skill rot vs API | Skill is generated from the live API contract in-repo |

## Out of scope for this ship

- Paid subscriptions / Stripe
- Official Tinder/Hinge OAuth (does not exist)
- Hosted browser farm
- Mobile native apps
