# MarketPulse — Financial Market Intelligence Platform

A production-oriented full-stack platform for reliable, real-time financial market intelligence. Built for professional traders who value accuracy, transparency, and trust over speed and hype.

## Philosophy

- **Reliability over speed** — Verified sources and reliability scoring on every headline
- **Accuracy over quantity** — Curated feed, not noise
- **Transparency over marketing** — Clear importance and verification status
- **Security first** — Argon2 hashing, CSRF protection, rate limiting, RBAC, audit logging

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS 4 |
| Backend | Next.js API Routes (REST) |
| Database | PostgreSQL + Prisma ORM |
| Auth | Custom JWT sessions, Argon2, OAuth-ready |
| Validation | Zod |
| Deployment | Docker, docker-compose |

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 16+ (or Docker)

### 1. Clone and install

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your database URL and generate secure secrets:

```bash
# Generate session secrets (Linux/macOS)
openssl rand -base64 32
```

### 3. Start PostgreSQL (Docker)

```bash
docker compose up postgres -d
```

### 4. Push schema and seed

```bash
npm run db:push
npm run db:seed
```

### 5. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@marketpulse.com | Admin123! |
| Moderator | mod@marketpulse.com | User1234! |
| Trader | trader@marketpulse.com | User1234! |

## Docker (Full Stack)

```bash
# Set secrets in .env first
docker compose up --build
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages & API
│   ├── api/               # REST API endpoints
│   │   ├── auth/          # Authentication (login, register, etc.)
│   │   ├── admin/         # Admin-only operations
│   │   ├── news/          # News feed
│   │   ├── articles/      # Knowledge plaza
│   │   ├── discussions/   # Community
│   │   ├── ai/            # AI assistant
│   │   ├── search/        # Global search
│   │   └── user/          # User dashboard data
│   ├── admin/             # Admin panel (protected)
│   ├── dashboard/         # User dashboard (protected)
│   ├── ai/                # AI assistant page
│   ├── knowledge/         # Knowledge plaza
│   ├── community/         # Community discussions
│   └── search/            # Search page
├── components/
│   ├── ui/                # Reusable UI components
│   ├── layout/            # Header, footer
│   ├── auth/              # Auth forms
│   ├── news/              # News components
│   └── providers/         # Theme & auth providers
├── lib/
│   ├── auth/              # Session, permissions, guards
│   ├── security/          # Password, CSRF, rate limiting
│   ├── validations/       # Zod schemas
│   ├── api/               # API response helpers
│   ├── db.ts              # Prisma client
│   ├── config.ts          # App configuration
│   ├── audit.ts           # Audit & activity logging
│   └── constants.ts       # Shared constants
├── types/                 # TypeScript types
└── middleware.ts          # Route protection & security headers
prisma/
├── schema.prisma          # Database schema
└── seed.ts                # Seed data
```

## Security Architecture

| Feature | Implementation |
|---------|---------------|
| Password hashing | Argon2id |
| Sessions | JWT in HttpOnly, Secure, SameSite cookies |
| CSRF | Signed double-submit cookie pattern |
| Rate limiting | In-memory (Redis-ready architecture) |
| Login throttling | Account lockout after 5 failed attempts |
| Input validation | Zod on all API endpoints |
| SQL injection | Prisma ORM parameterized queries |
| XSS | Output sanitization, CSP headers |
| Authorization | RBAC with server-side guards |
| Audit logging | All admin actions logged |
| Headers | HSTS, X-Frame-Options, CSP, etc. |

## User Roles

| Role | Access |
|------|--------|
| Guest | Public pages, news feed |
| Registered User | Dashboard, bookmarks, AI, publishing |
| Moderator | Content moderation tools |
| Administrator | Full admin panel |

## API Endpoints

### Authentication
- `POST /api/auth/register` — Create account
- `POST /api/auth/login` — Sign in
- `POST /api/auth/logout` — Sign out
- `GET /api/auth/me` — Current user + CSRF token
- `POST /api/auth/password` — Forgot password
- `PUT /api/auth/password` — Reset password
- `PATCH /api/auth/password` — Change password
- `GET /api/auth/verify-email` — Verify email

### Content
- `GET /api/news` — News feed with pagination
- `GET /api/news/[id]` — Single news item
- `GET/POST /api/articles` — Knowledge plaza
- `GET/POST /api/discussions` — Community
- `GET /api/search` — Global search
- `GET/POST /api/ai` — AI assistant

### User
- `GET/PATCH/PUT/DELETE /api/user` — Profile, interests, account deletion

### Admin (ADMIN role required)
- `GET/POST /api/admin` — Stats, user management, news creation

## Database Models

Users, Sessions, OAuthAccounts, News, NewsSources, NewsCategories, Articles, Discussions, Comments, Bookmarks, Watchlists, Notifications, Reports, AuditLogs, Tags, Badges, UserInterests, UserActivity, AIConversations, AIMessages, SiteSettings, FeatureFlags

## Production Checklist

- [ ] Set strong `SESSION_SECRET` and `CSRF_SECRET`
- [ ] Configure PostgreSQL with SSL
- [ ] Set up SMTP for email verification
- [ ] Configure OAuth credentials (Google, GitHub)
- [ ] Replace in-memory rate limiter with Redis
- [ ] Connect LLM provider for AI assistant
- [ ] Set up monitoring and logging
- [ ] Enable HTTPS via reverse proxy

## Scripts

```bash
npm run dev          # Development server
npm run build        # Production build
npm run start        # Production server
npm run db:push      # Push schema to database
npm run db:migrate   # Run migrations
npm run db:seed      # Seed sample data
npm run db:studio    # Prisma Studio GUI
npm run lint         # ESLint
```

## License

Private — All rights reserved.
