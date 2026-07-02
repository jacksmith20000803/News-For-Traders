# TRADX Platform Upgrade Report — v3.0.0

**Date:** June 22, 2026  
**Brand:** TRADX — *Trade. Invest. Grow.*  
**Build:** ✅ `npx next build` — **72 routes**

---

## Executive Summary

MarketPulse has been rebranded to **TRADX** with emerald-green premium styling and your logo (`/public/tradx-logo.webp`). This upgrade adds real-time market streaming, TradingView Lightweight Charts, user onboarding/personalization, extended profile management, registration analytics, support chat, feedback inbox, and an enhanced admin dashboard — while preserving all existing trader features from v2.1.

---

## 1. TRADX Rebrand

| Item | Status |
|---|---|
| Logo in header/footer/landing | ✅ `/public/tradx-logo.webp` |
| Site title & metadata | ✅ `TRADX — Trade. Invest. Grow.` |
| Emerald green color theme | ✅ CSS variables updated in `globals.css` |
| Tagline on landing | ✅ "Trade. Invest. Grow." |
| Auth copy updated | ✅ Login/register forms |

---

## 2. Real-Time Market Data

| Feature | Implementation |
|---|---|
| SSE streaming | Extended `/api/events` with `market` + `chat` channels |
| Reconnect logic | `SSEProvider` — 5s exponential retry |
| Fallback polling | Charts poll `/api/market` every 15s |
| Market service layer | `src/lib/market/stream.ts` |
| Background sync | Cron ingest calls `syncAndBroadcastMarket()` |

**Supported asset types:** crypto, forex, stocks, commodities, indices (via existing `MarketQuote` + providers).

---

## 3. Real-Time Charts

**Page:** `/charts`

| Feature | Status |
|---|---|
| TradingView Lightweight Charts | ✅ |
| Asset selector (BTC, ETH, EURUSD, Gold, AAPL, NVDA) | ✅ |
| Intervals: 1m, 5m, 15m, 1H, 4H, 1D, 1W | ✅ |
| Candlestick charts | ✅ |
| SMA, EMA, RSI, MACD indicators | ✅ |
| Favorites (star toggle) | ✅ `/api/favorites` |
| Real-time price overlay | ✅ SSE + polling |

**API:** `GET /api/market/candles?symbol=&assetType=&interval=`

---

## 4. User Personalization & Onboarding

**Page:** `/onboarding` (3-step wizard)

New users are redirected after registration to configure:
- Preferred market (Crypto / Forex / Stocks / Commodities)
- Interest categories
- Notification preferences

**New models:**
- `UserPreferences` — preferred market, default symbol, chart interval
- `NotificationSettings` — email, push, in-app toggles per event type
- `FavoriteAsset` — starred chart assets

**API:** `POST /api/onboarding`, `GET/PATCH /api/preferences`

---

## 5. User Profile Management

Extended fields on `User` model:
- `username`, `dateOfBirth`, `country`, `timezone`, `preferredLanguage`

**API:** `PATCH /api/preferences` — profile + notification settings

Profile changes trigger:
- Admin notifications (`PROFILE_CHANGE`)
- Audit log entry (`USER_PROFILE_UPDATE`)

Avatar upload: URL-based field (ready for S3/Vercel Blob integration).

---

## 6. Admin Dashboard Enhancements

**Updated:** `/admin`

New dashboard cards:
- Total users
- New users today
- Unviewed registrations (badge count)
- Feedback inbox (new submissions)
- Pending reports

**New pages:**
- `/admin/registrations` — IP, country, device, browser, OS, user agent
- `/admin/feedback` — contact, bug reports, suggestions inbox

---

## 7. Registration Analytics

**Model:** `RegistrationAudit`

Captured on signup:
- Registration IP, country, city (from Vercel/CF headers)
- Browser, device type, OS, user agent
- Timestamp

New registrations notify all admins (`NEW_REGISTRATION` notification type). Badge clears when admin views registration list.

---

## 8. Real-Time Support Chat

**Page:** `/support`  
**API:** `GET/POST /api/support`

| Feature | Status |
|---|---|
| User support chat | ✅ |
| Admin welcome message | ✅ `ChatSettings` model |
| Real-time delivery | ✅ SSE `chat` channel |
| Admin notifications | ✅ On new message |
| Admin presence | ✅ `AdminPresence` model (Online/Offline/DND) |

**Note:** Uses SSE (Vercel-compatible) instead of Socket.IO. For dedicated server deployments, Socket.IO can be added as an adapter.

---

## 9. Feedback System

Landing page (`/#contact`) includes unified form supporting:
- Contact, Feedback, Bug reports, Suggestions

**Model:** `FeedbackSubmission` with status tracking (NEW → IN_PROGRESS → REPLIED → CLOSED)

**Admin:** `/admin/feedback`

**API:** `POST /api/feedback` (public, no auth required)

---

## 10. Real-Time Notifications

Existing SSE notification system extended with new types:
- `ADMIN_MESSAGE`, `PROFILE_CHANGE`, `NEW_REGISTRATION`, `SUPPORT_MESSAGE`

Notification center at `/dashboard/notifications` (existing) supports read/unread/delete.

Browser push: `NotificationSettings.pushEnabled` flag ready — enable via `Notification.requestPermission()` in client (hook point in onboarding step 3).

---

## 11. UI/UX Redesign

| Element | Change |
|---|---|
| Color palette | Cyan → Emerald green (`#10b981`, `#34d399`) |
| Landing page | Framer Motion animated hero for guests |
| Glass panels | Preserved with emerald glow accents |
| Header | TRADX logo image, Charts nav link |
| Buttons/CTAs | Emerald gradient |

**Dependencies added:** `framer-motion`, `lightweight-charts`

---

## 12. Security (Preserved + Extended)

| Control | Status |
|---|---|
| CSRF protection | ✅ All mutating routes |
| Rate limiting | ✅ Auth endpoints |
| RBAC | ✅ Admin routes guarded |
| Audit logging | ✅ Profile changes, admin actions |
| Input validation | ✅ Zod on all new APIs |
| Secure headers | ✅ Existing middleware |

---

## 13. Database Schema Changes

### New Enums
`PreferredMarket`, `AdminPresenceStatus`, `FeedbackType`, `FeedbackStatus`, `SupportMessageStatus`

### Extended Enums
`NotificationType` (+4 types), `AuditAction` (+USER_PROFILE_UPDATE)

### New Models
`UserPreferences`, `NotificationSettings`, `FavoriteAsset`, `RegistrationAudit`, `FeedbackSubmission`, `SupportConversation`, `SupportMessage`, `AdminPresence`, `ChatSettings`

### Extended User Model
`username`, `dateOfBirth`, `country`, `timezone`, `preferredLanguage`, `onboardingCompleted`

---

## Migration Instructions

```powershell
cd "F:\News For Trader"
npx prisma db push
npx prisma generate
npm run db:seed
npm run ingest:news
npx next build
```

---

## Environment Variables

```env
# Existing
DATABASE_URL=
SESSION_SECRET=
CSRF_SECRET=
CRON_SECRET=
FINNHUB_API_KEY=
OPENAI_API_KEY=

# Branding
APP_NAME=TRADX
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Email (alerts)
SMTP_HOST=
SMTP_USER=
SMTP_PASSWORD=
EMAIL_FROM=alerts@tradx.com
```

---

## Deployment (Vercel)

1. Push schema: `npx prisma db push` against production DB
2. Set all env vars in Vercel dashboard
3. Deploy — `postinstall` runs `prisma generate`
4. Configure cron: `POST /api/cron/ingest` every 5 minutes with `x-cron-secret` header
5. Place logo at `/public/tradx-logo.webp` (already included)

---

## Testing Report

| Area | Status | Notes |
|---|---|---|
| Build / TypeScript | ✅ Pass | 72 routes |
| Authentication | ✅ Preserved | Register → onboarding redirect |
| Charts | ✅ Implemented | Requires price history seed or ingest |
| Notifications | ✅ Extended | SSE channels verified |
| Admin panel | ✅ Enhanced | Registrations + feedback pages |
| Market streaming | ✅ Implemented | SSE broadcast on cron |
| Support chat | ✅ Implemented | SSE-based |
| Unit tests | ⚠️ Pending | Recommend Vitest for `lib/market/stream.ts` indicators |
| E2E tests | ⚠️ Pending | Recommend Playwright for onboarding + charts flows |

---

## Security Review

| Risk | Mitigation |
|---|---|
| Public feedback spam | Rate limit recommended on `/api/feedback` |
| Profile change audit | Admin notified on every profile PATCH |
| Chat abuse | Auth required; admin moderation via notifications |
| XSS in chat/feedback | Zod max lengths; React auto-escaping |

---

## Performance Recommendations

1. Add Redis for market quote cache in high-traffic deployments
2. Lazy-load `lightweight-charts` with `dynamic(() => import(...), { ssr: false })`
3. Batch registration audit "viewed" updates on admin page load
4. Add `@next/bundle-analyzer` to monitor chart library impact (~45KB gzipped)

---

## Future Improvements

1. Socket.IO adapter for dedicated Node server (typing indicators, read receipts)
2. S3/Vercel Blob avatar upload with image optimization
3. Browser push notification service worker
4. Three.js hero background on landing (optional, performance trade-off)
5. Full E2E test suite with Playwright
6. GeoIP service (MaxMind) for accurate city on registration
7. Admin chat reply UI with file attachments

---

## Demo Accounts

| Email | Password |
|---|---|
| `trader@marketpulse.com` | `User1234!` |
| `admin@marketpulse.com` | `Admin123!` |

*(Demo emails unchanged; update to `@tradx.com` in seed when ready)*

---

**Platform version:** 3.0.0 — TRADX
