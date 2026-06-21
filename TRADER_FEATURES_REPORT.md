# Trader Features Report — MarketPulse v2.1.0

**Date:** June 22, 2026  
**Platform:** MarketPulse (Next.js 16, React 19, PostgreSQL, Prisma)  
**Build status:** ✅ `npx next build` passes — **62 routes**

---

## Executive Summary

This release adds institutional-grade trader tooling: multi-watchlist management with drag-and-drop, economic calendar, market heatmap, asset detail pages, portfolio tracking, and a unified alert engine with in-app and email delivery. Performance optimizations include batch quote lookups, `unstable_cache` on heatmap/calendar endpoints, and parallel Prisma queries on asset detail pages.

---

## 1. Advanced Watchlists

### Features Delivered

| Capability | Status | Implementation |
|---|---|---|
| Multiple watchlists | ✅ | `Watchlist` model with `sortOrder`, per-user CRUD |
| Drag-and-drop ordering | ✅ | HTML5 DnD in `WatchlistManager`; API reorder via `PATCH /api/watchlists` and `POST /api/watchlists/[id]` |
| Price alerts | ✅ | One-click alert creation from watchlist items |
| Email + in-app alerts | ✅ | `AlertChannel` enum (`IN_APP`, `EMAIL`, `BOTH`); delivery via `lib/alerts/engine.ts` |
| Asset categories | ✅ | `AssetCategory` on watchlists and items (`STOCKS`, `FOREX`, `CRYPTO`, `COMMODITIES`, `INDICES`) |

### Routes & UI

- **Page:** `/dashboard/watchlists`
- **Component:** `src/components/watchlists/watchlist-manager.tsx`
- **API:**
  - `GET/POST/PATCH /api/watchlists` — list, create, reorder watchlists
  - `GET/PATCH/DELETE/POST /api/watchlists/[id]` — CRUD, add/reorder items
  - `DELETE/PATCH /api/watchlists/[id]/items/[itemId]` — item management

### Performance Notes

- Watchlist GET fetches all quotes once and maps in memory — **no N+1** per item.
- Item reorder uses a single `$transaction` batch update.

---

## 2. Economic Calendar

### Features Delivered

| Capability | Status |
|---|---|
| CPI, NFP, FOMC, GDP, Unemployment | ✅ |
| Event filtering (type, impact) | ✅ |
| Impact levels (HIGH / MEDIUM / LOW) | ✅ |
| Timezone conversion | ✅ |

### Routes & UI

- **Page:** `/calendar`
- **Component:** `src/components/calendar/calendar-view.tsx`
- **API:** `GET /api/calendar?type=&impact=&timezone=`
- **Library:** `src/lib/calendar/events.ts` — `getCachedCalendar` with 300s revalidation

### Seed Data

10 upcoming US macro events seeded in `prisma/seed.ts` spanning CPI, NFP, FOMC, GDP, and unemployment releases.

---

## 3. Market Heatmap

### Features Delivered

| Capability | Status |
|---|---|
| Stocks, Forex, Crypto tabs | ✅ |
| Color intensity by % change | ✅ |
| Click-through to asset pages | ✅ |

### Routes & UI

- **Page:** `/heatmap`
- **Component:** `src/components/market/heatmap-grid.tsx`
- **API:** `GET /api/heatmap?category=` — cached 60s via `getCachedHeatmap`
- **Library:** `src/lib/market/heatmap.ts` — normalizes intensity to [-1, 1], maps to RGB

### Color Scale

- **Green gradient:** positive change (`intensityToColor`)
- **Red gradient:** negative change
- Intensity normalized against max absolute change in the current dataset

---

## 4. Asset Detail Pages

### Features Delivered

| Section | Status |
|---|---|
| Price chart (90-day history) | ✅ |
| Related news | ✅ |
| Sentiment (discussion proxy) | ✅ |
| AI summary link | ✅ |
| Historical performance | ✅ |
| Related discussions | ✅ |

### Example URLs

- `/assets/BTC` — Bitcoin
- `/assets/XAUUSD` — Gold
- `/assets/EURUSD` — Euro/USD
- `/assets/AAPL`, `/assets/NVDA`, etc.

### Routes & Data

- **Page:** `src/app/assets/[symbol]/page.tsx`
- **API:** `GET /api/assets/[symbol]`
- **Library:** `src/lib/trader/queries.ts` — `getAssetDetail()` runs **5 parallel queries** (quote, history, news, discussions, profile)

### Slug Mapping

`src/lib/assets/symbols.ts` provides canonical slug → symbol/assetType/category mappings with fallback for unknown symbols.

---

## 5. Portfolio Tracker

### Features Delivered

| Capability | Status |
|---|---|
| Manual position entry | ✅ |
| Real-time P&L (via market quotes) | ✅ |
| Performance % | ✅ |
| Allocation pie chart | ✅ |

### Routes & UI

- **Page:** `/dashboard/portfolio`
- **Component:** `src/components/portfolio/portfolio-dashboard.tsx`
- **Chart:** `src/components/charts/allocation-chart.tsx` (CSS conic-gradient)
- **API:** `GET/POST/DELETE /api/portfolio`

### P&L Calculation

```
marketValue = currentPrice × quantity
pnl = marketValue - (entryPrice × quantity)
pnlPercent = pnl / costBasis × 100
```

Quotes fetched in a single batch query keyed by symbol+assetType — **no N+1**.

---

## 6. Alert Engine

### Alert Types

| Type | Trigger |
|---|---|
| `PRICE_CROSS_ABOVE` | Price ≥ threshold |
| `PRICE_CROSS_BELOW` | Price ≤ threshold |
| `PERCENT_CHANGE` | \|changePercent\| ≥ threshold |
| `VOLATILITY_SPIKE` | \|changePercent\| ≥ threshold (default 3%) |
| `NEWS_MENTION` | Headline/asset match on keyword within 1 hour |

### Delivery Channels

- **In-app:** Creates `Notification` with type `PRICE_ALERT`
- **Email:** `src/lib/email.ts` — SMTP via env vars (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`); logs when unconfigured

### Routes & UI

- **Page:** `/dashboard/alerts`
- **Component:** `src/components/alerts/alerts-manager.tsx`
- **API:** `GET/POST/PATCH/DELETE /api/alerts`
- **Cron:** `POST /api/cron/evaluate-alerts` (also wired into `/api/cron/ingest`)

### Cooldown

Alerts re-trigger at most once per hour (`triggeredAt` / `lastTriggeredAt` check).

---

## 7. Performance Optimization Audit

### Core Web Vitals

| Area | Assessment | Action Taken |
|---|---|---|
| LCP | Good | Server-rendered pages; minimal client JS on calendar/heatmap |
| INP | Good | Drag-drop uses native HTML5 APIs (no heavy DnD library) |
| CLS | Good | Skeleton loaders on async client components |

### Bundle Size

| Decision | Rationale |
|---|---|
| No charting library | SVG sparkline in `price-chart.tsx` (~2KB vs 200KB+ for Recharts/Chart.js) |
| No DnD library | Native drag events in watchlist manager |
| CSS conic-gradient pie | No D3/Nivo for allocation chart |
| `react-markdown` only on `/ai` | Isolated to AI page |

**Estimated client bundle impact:** < 15KB gzipped for all new trader components.

### Database Query Optimization

| Query | Pattern | N+1 Risk |
|---|---|---|
| `getAssetDetail` | `Promise.all` — 5 parallel queries | ✅ None |
| `getPortfolioSummary` | Single quote batch + in-memory join | ✅ None |
| `GET /api/watchlists` | Single quote fetch + Map lookup | ✅ None |
| `getHeatmapData` | Single `marketQuote.findMany` | ✅ None |
| `getCachedCalendar` | Single filtered query, 300s cache | ✅ None |
| `evaluatePriceAlerts` | Single alert fetch + single quote fetch | ✅ None |
| `evaluateAlertRules` (NEWS_MENTION) | Per-rule news query in loop | ⚠️ **Known N+1** — acceptable at low rule counts; batch if rules > 50 |

### Caching Strategy

| Endpoint | Cache TTL |
|---|---|
| `/api/heatmap` | 60 seconds (`unstable_cache`) |
| `/api/calendar` | 300 seconds (`unstable_cache`) |
| Market quotes | Updated via cron ingest |

### Recommended Future Optimizations

1. Batch `NEWS_MENTION` rule evaluation into a single news query per cron run
2. Add Redis cache layer for market quotes in high-traffic deployments
3. Add database indexes on `news.headline` for news alert keyword searches (GIN/trigram)
4. Lazy-load heatmap cells below the fold with virtual scrolling if quote count exceeds 100

---

## Database Schema Additions

### New Enums

- `AssetCategory`, `AlertType`, `AlertChannel`, `EconomicEventType`, `EventImpact`
- Extended `NotificationType`: `PRICE_ALERT`, `ECONOMIC_EVENT`, `PORTFOLIO_ALERT`

### New Models

- `WatchlistItem`, `PriceAlert`, `AlertRule`, `EconomicEvent`
- `Portfolio`, `PortfolioPosition`, `PriceHistory`, `AssetProfile`

---

## Navigation Updates

Header now includes **Heatmap** and **Calendar** links. Dashboard adds **Portfolio** and **Alerts** cards.

---

## Deployment Checklist

```bash
# 1. Apply schema (review before --accept-data-loss in production)
npx prisma db push
npx prisma generate

# 2. Seed trader demo data
npm run db:seed

# 3. Ingest live market data
npm run ingest:news

# 4. Verify build
npx next build
```

### Environment Variables (New)

```env
SMTP_HOST=
SMTP_USER=
SMTP_PASSWORD=
EMAIL_FROM=alerts@marketpulse.com
CRON_SECRET=          # Required for alert evaluation cron
```

### Cron Schedule (Recommended)

| Job | Endpoint | Frequency |
|---|---|---|
| Ingest + Alerts | `POST /api/cron/ingest` | Every 5 minutes |
| Alert evaluation only | `POST /api/cron/evaluate-alerts` | Every 1 minute (optional) |

---

## Demo Accounts

| Email | Password | Role |
|---|---|---|
| `trader@marketpulse.com` | `User1234!` | Pre-seeded watchlist + portfolio |
| `admin@marketpulse.com` | `Admin123!` | Admin access |

---

## File Index (New/Modified)

### Pages
- `src/app/calendar/page.tsx`
- `src/app/heatmap/page.tsx`
- `src/app/assets/[symbol]/page.tsx`
- `src/app/dashboard/portfolio/page.tsx`
- `src/app/dashboard/alerts/page.tsx`
- `src/app/dashboard/watchlists/page.tsx`

### Components
- `src/components/watchlists/watchlist-manager.tsx`
- `src/components/portfolio/portfolio-dashboard.tsx`
- `src/components/alerts/alerts-manager.tsx`
- `src/components/calendar/calendar-view.tsx`
- `src/components/market/heatmap-grid.tsx`
- `src/components/charts/price-chart.tsx`
- `src/components/charts/allocation-chart.tsx`

### Libraries
- `src/lib/assets/symbols.ts`
- `src/lib/alerts/engine.ts`
- `src/lib/email.ts`
- `src/lib/calendar/events.ts`
- `src/lib/market/heatmap.ts`
- `src/lib/trader/queries.ts`
- `src/lib/validations/trader.ts`

### API Routes
- `src/app/api/watchlists/**`
- `src/app/api/alerts/route.ts`
- `src/app/api/calendar/route.ts`
- `src/app/api/heatmap/route.ts`
- `src/app/api/assets/[symbol]/route.ts`
- `src/app/api/portfolio/route.ts`
- `src/app/api/cron/evaluate-alerts/route.ts`

---

## Conclusion

All seven trader feature areas are implemented and production-build verified. The platform now supports institutional workflows from watchlist management through macro calendar monitoring, visual market scanning, deep asset analysis, portfolio tracking, and automated alerting — with performance-conscious design choices throughout.

**Platform version:** 2.1.0
