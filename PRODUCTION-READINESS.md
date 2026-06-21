# Production Readiness Report — MarketPulse

**Review date:** June 22, 2026  
**Reviewers:** Senior Security Engineer & Senior Software Architect  
**Codebase version:** Post-audit refactor  
**Overall readiness score:** **68 / 100** — Strong foundation, not yet production-deployable without addressing P0/P1 items.

---

## Executive Summary

MarketPulse is a well-structured Next.js 16 application with thoughtful security primitives: Argon2id password hashing, server-side session validation, double-submit CSRF, role-based access control, audit logging, and production secret validation. The architecture is appropriate for an MVP targeting professional traders.

However, several **critical gaps** prevent a confident production launch today: no email delivery pipeline, in-memory rate limiting unsuitable for multi-instance deployment, incomplete feature surface (moderator role, watchlist API, admin UI mutations), and performance characteristics that will degrade under load.

This report documents findings by severity, refactors applied during this review, and a prioritized remediation roadmap.

---

## Readiness Scorecard

| Area | Score | Status |
|------|-------|--------|
| Authentication & Sessions | 82/100 | Good — minor middleware gap |
| Authorization (RBAC) | 70/100 | Moderator role unused |
| Input Validation | 85/100 | Zod on most routes |
| CSRF / XSS / Injection | 80/100 | Solid baseline |
| Secrets & Config | 78/100 | Fail-fast in production |
| Rate Limiting & Abuse | 45/100 | In-memory only |
| Email / Account Recovery | 25/100 | Tokens created, never sent |
| Scalability | 50/100 | Layout DB hit every request |
| Observability | 30/100 | Console.error only |
| Feature Completeness | 60/100 | Several linked pages/APIs missing |
| Deployment / Ops | 72/100 | Docker ready, no CI/CD |
| **Overall** | **68/100** | **Conditional go — fix P0/P1 first** |

---

## Security Findings

### P0 — Critical (Must fix before production)

| ID | Finding | Risk | Status |
|----|---------|------|--------|
| S-01 | **No email delivery** — verification and password-reset tokens are stored but never emailed. Users cannot self-serve account recovery. | Account lockout, support burden | Open |
| S-02 | **In-memory rate limiting** — ineffective across serverless instances, restarts, or horizontal scaling. | Brute-force, registration spam | Mitigated (adapter interface added) |
| S-03 | **Schema/provider mismatch was present** — SQLite URL with PostgreSQL schema caused deployment confusion. | Data loss, failed deploys | **Fixed** |

### P1 — High (Fix within first sprint)

| ID | Finding | Risk | Status |
|----|---------|------|--------|
| S-04 | **IP spoofing for rate limits** — `x-forwarded-for` trusted without proxy validation. | Rate limit bypass | **Fixed** (`TRUST_PROXY` env gate) |
| S-05 | **Tokens stored plaintext** — reset/verification tokens in DB were raw hex. | DB leak exposes active tokens | **Fixed** (SHA-256 hashed at rest) |
| S-06 | **Maintenance mode split-brain** — admin toggle wrote DB; middleware read env only. | Admin control ineffective | **Fixed** (DB + cookie + env unified) |
| S-07 | **Unverified users could publish content** — articles/discussions had no email gate. | Spam, fake accounts | **Fixed** (`requireVerifiedEmail`) |
| S-08 | **Middleware JWT-only for pages** — revoked sessions pass middleware until server component runs. | Brief unauthorized page access | Partial (acceptable with server guards) |
| S-09 | **No API-level auth middleware** — each route must remember guards individually. | Forgotten auth on new routes | Open |
| S-10 | **Seed script in production** — demo admin credentials if seed runs in prod. | Full admin compromise | **Fixed** (`ALLOW_SEED` gate) |

### P2 — Medium

| ID | Finding | Risk | Status |
|----|---------|------|--------|
| S-11 | User enumeration on register (409 vs generic login error) | Email discovery | Open (acceptable tradeoff) |
| S-12 | 2FA schema fields exist but unimplemented | False sense of security | Open |
| S-13 | OAuth configured but disabled — stale attack surface if enabled without review | Misconfiguration | Open |
| S-14 | CSP allows `unsafe-inline` / `unsafe-eval` | XSS impact amplification | Open |
| S-15 | User-generated content not sanitized for future rich-text rendering | Stored XSS when HTML added | Open |
| S-16 | `.history/` folder not gitignored — editor backups may contain secrets | Secret leakage | **Fixed** |

### P3 — Low / Informational

| ID | Finding | Status |
|----|---------|--------|
| S-17 | Session `token` column in DB unused for validation | By design (JWT carries sessionId) |
| S-18 | Logout CSRF required but was unwired in UI | **Fixed** (logout button added) |
| S-19 | `requireModerator()` defined but never used | Open |
| S-20 | AI responses are placeholders — no input/output filtering for LLM | Open (when LLM connected) |

---

## Architecture Findings

### Strengths

1. **Clean separation** — `lib/auth`, `lib/security`, `lib/validations`, `lib/api` are well-scoped.
2. **Role from DB, not JWT** — prevents stale privilege escalation after role change.
3. **Server Components for reads** — admin and dashboard pages query DB directly (appropriate for this scale).
4. **Audit trail** — admin actions logged with IP and metadata.
5. **Safe user projection** — `toSafeUser()` and `safeUserSelect` prevent password hash leakage.

### Weaknesses

| ID | Issue | Impact | Status |
|----|-------|--------|--------|
| A-01 | **Monolithic admin API** — single POST with action switch | Hard to test, extend | Open |
| A-02 | **No service layer** — business logic in route handlers | Duplication, testing pain | Open |
| A-03 | **Dual auth paths** — middleware + page guards + API guards | Redundant, confusing | Partial |
| A-04 | **Feature flags in DB, read inconsistently** | Dead configuration | Open |
| A-05 | **Missing route groups** — `(public)` / `(authenticated)` / `(admin)` | Layout concerns mixed | Open |
| A-06 | **Admin UI is read-only** — no client mutations wired | Admin panel incomplete | Open |
| A-07 | **Moderator role has no distinct capabilities** | RBAC incomplete | Open |

---

## Performance & Scalability Findings

| ID | Issue | Impact | Status |
|----|-------|--------|--------|
| P-01 | **`getCurrentUser()` in root layout** — DB session lookup on every page | +20–50ms per request | Open |
| P-02 | **Personalized news ignored user interests** | Wasted query, wrong UX | **Fixed** |
| P-03 | **N+1 tag writes on article create** | Slow under load | **Fixed** (transaction) |
| P-04 | **Search uses `contains` without full-text index** | O(n) table scans | Open |
| P-05 | **Nested comment loading up to 50 threads** | Large payloads | Open |
| P-06 | **In-memory rate limit Map** — unbounded growth mitigated | Memory pressure | **Mitigated** (10k cap) |
| P-07 | **Missing composite indexes on Article** | Slow filtered lists | **Fixed** |
| P-08 | **No connection pooling config** — Prisma defaults | Connection exhaustion at scale | Open (use PgBouncer) |
| P-09 | **No caching layer** — Redis/CDN for news feed | Repeated DB hits | Open |

---

## Code Smells Addressed

| Smell | Location | Fix |
|-------|----------|-----|
| Duplicate CSRF fetch logic | AI page, settings page | Centralized `secureFetch()` |
| Unsafe enum casts `as never` | articles/discussions GET | Zod `nativeEnum` validation |
| Broken constants file | `lib/constants.ts` | Restored `AIInterpretation` interface |
| Missing dashboard pages (404 links) | Header navigation | Added bookmarks, notifications, watchlists, activity |
| Orphaned validation schemas | comment, report, watchlist | Added `/api/comments`, `/api/reports` |
| Dynamic imports in route handlers | articles POST | Consolidated static imports |

---

## Refactors Applied (This Review)

### Security
- SHA-256 hash for password-reset and email-verification tokens at rest
- `TRUST_PROXY` environment gate for IP extraction
- Rate limit store capped at 10,000 entries
- `requireVerifiedEmail()` guard on content creation
- Production seed blocked unless `ALLOW_SEED=true`
- Unified maintenance mode: env + DB + HttpOnly cookie
- Double-submit CSRF validation (header must match cookie)
- Logout wired with CSRF via `secureFetch()`
- `.history/` added to `.gitignore`

### Architecture
- `lib/settings.ts` — cached site settings reader
- `lib/api/client.ts` — client-side CSRF helper
- `lib/security/tokens.ts` — token hashing utilities
- `lib/maintenance.ts` — server-side maintenance enforcement
- `RateLimitAdapter` interface for Redis migration
- PostgreSQL restored as canonical database provider

### Performance
- Composite indexes on `Article(status, publishedAt)` and `(status, featured, publishedAt)`
- Personalized news filtered by interest → category slug mapping
- Article creation wrapped in `$transaction`

### Features
- Dashboard sub-pages: bookmarks, notifications, watchlists, activity
- `/api/comments` and `/api/reports` endpoints
- `/maintenance` public page

---

## Production Deployment Checklist

### Before first deploy

- [ ] Set `SESSION_SECRET` and `CSRF_SECRET` (≥32 chars, cryptographically random)
- [ ] Set `DATABASE_URL` to PostgreSQL with SSL (`?sslmode=require`)
- [ ] Set `TRUST_PROXY=true` behind nginx/Cloudflare/load balancer
- [ ] Configure SMTP and implement email sending in auth routes
- [ ] Replace in-memory rate limiter with Redis (Upstash, ElastiCache)
- [ ] Run `prisma migrate deploy` (not `db push`) in production
- [ ] **Never** run `db:seed` in production without reviewing credentials
- [ ] Enable PostgreSQL connection pooling (PgBouncer or Prisma Accelerate)
- [ ] Set up error tracking (Sentry) and structured logging
- [ ] Configure backup strategy for PostgreSQL
- [ ] Review CSP — remove `unsafe-eval` if possible
- [ ] Wire admin UI to `/api/admin` POST actions
- [ ] Add health check endpoint (`/api/health`)
- [ ] Set up CI/CD with `npm run build`, lint, and migration checks

### Recommended within 30 days

- [ ] Implement 2FA or remove schema fields
- [ ] Add full-text search (PostgreSQL `tsvector` or Elasticsearch)
- [ ] Session cache (Redis) to reduce layout DB hits
- [ ] Wire moderator role to content moderation APIs
- [ ] Add watchlist CRUD API
- [ ] Content sanitization library (DOMPurify) before rich-text editor
- [ ] Penetration test focused on auth flows
- [ ] Load test news feed and search at 1000 concurrent users

---

## Risk Matrix

```
Impact ▲
  High  │ S-01 Email    S-02 Rate limit
        │ S-06 Maint.✓  P-04 Search
  Med   │ S-14 CSP      A-06 Admin UI
        │ P-01 Layout   S-12 2FA
  Low   │ S-19 Mod role S-17 Session token
        └──────────────────────────────► Likelihood
           Low        Med        High
```

---

## Verdict

**MarketPulse is architecturally sound for a v1 platform** with above-average security awareness for a greenfield project. The authentication stack (Argon2 + server sessions + CSRF + lockout) meets professional standards.

**Do not deploy to production** until:
1. Email delivery is implemented (S-01)
2. Distributed rate limiting is in place (S-02)
3. PostgreSQL is provisioned with migrations and pooling (S-03)
4. Admin panel mutations are wired and tested (A-06)

With P0/P1 remediation (estimated 1–2 sprints), the platform can reach **85+/100** production readiness.

---

## Appendix: API Security Matrix (Post-Refactor)

| Route | Auth | CSRF | Rate Limit | Validation |
|-------|------|------|------------|------------|
| POST /api/auth/login | — | — | IP | Zod |
| POST /api/auth/register | — | — | IP | Zod |
| POST /api/auth/logout | Session | Yes | — | — |
| GET /api/auth/me | Optional | — | — | — |
| POST/PUT /api/auth/password | Mixed | PATCH only | IP | Zod |
| GET /api/auth/verify-email | Token | — | IP | Manual |
| GET/POST /api/admin | Admin | POST | IP | Zod |
| GET/PATCH/PUT/DELETE /api/user | User | Mutations | — | Zod |
| GET /api/news | Optional | — | — | Zod |
| POST /api/articles | Verified | Yes | — | Zod |
| POST /api/discussions | Verified | Yes | — | Zod |
| POST /api/comments | Verified | Yes | — | Zod |
| POST /api/reports | User | Yes | — | Zod |
| GET/POST /api/ai | User | POST | IP | Zod |
| GET /api/search | — | — | IP | Zod |

---

*Report generated as part of senior security/architecture review. Refactors marked ✓ are included in the current codebase.*
