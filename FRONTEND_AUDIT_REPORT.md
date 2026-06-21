# Frontend Audit Report — MarketPulse v2.1

**Date:** June 22, 2026  
**Build status:** ✅ `npx next build` passes (53 routes)

---

## Discovered Issues

### Critical — React Key Warnings (AI Assistant)
| Issue | Root Cause |
|-------|------------|
| `Each child in a list should have a unique "key" prop` in AIPage | Duplicate message IDs: static `"error"` key reused; SSE parser added messages multiple times; `Date.now()` collisions on rapid sends |

### High — Broken / Incomplete UI
| Issue | Location |
|-------|----------|
| Bookmark/share buttons non-functional | `news-card.tsx` |
| Search filters didn't re-run query on change | `search/page.tsx` |
| No connection status indicator | SSE provider |
| AI streaming parser incorrectly parsed SSE blocks | `ai/page.tsx` |
| Watchlist asset pills used array index as key | `dashboard/watchlists/page.tsx` |

### Medium — UX / Design
| Issue | Location |
|-------|----------|
| Monochrome terminal aesthetic, low visual hierarchy | Global CSS, homepage |
| No global search in header | Header |
| No typing indicator / stop generation in AI chat | AI page |
| No markdown rendering for AI responses | AI page |
| News detail lacked professional sections | `news/[id]/page.tsx` |

---

## Fixes Performed

### Phase 1 — Error Repair
- **AI messages:** All client messages now use `clientId()` (`crypto.randomUUID`) — never static strings or timestamps alone
- **SSE parser:** Rewrote as block-based parser in `parseAIStream()` — correctly handles `start`, `chunk`, `done`, `error` events
- **Deduplication:** Assistant messages deduplicated by database `id` before append
- **Source links:** Keys use `${message.id}-${url}` composite
- **Comments:** New comments use `json.data.id ?? clientId("comment")`
- **Watchlists:** Asset keys changed to `${watchlistId}-${symbol}`
- **News assets:** Keys use `${newsId}-${symbol}`

### Phase 2 — Premium UI Redesign
- **Design system:** Glassmorphism panels, gradient text, cyan/blue/gold accents, depth shadows (`globals.css`)
- **Header:** Glass blur bar, global search with instant suggestions + keyboard nav, connection badge, AI quick-ask link
- **Homepage:** Hero cards (Breaking Event, AI Summary, Macro Calendar, Sentiment), 3-column dashboard grid, animated market ticker strip
- **Market strip:** Infinite scroll animation, live SSE refresh
- **Connection status:** LIVE / CONNECTED / RECONNECTING / DISCONNECTED badge in header
- **AI chat:** Modern bubble UI, markdown via `react-markdown`, typing dots, stop button, retry button, gradient accents
- **Search:** URL-synced queries, instant filter updates, skeleton loaders, glass panel layout
- **News detail:** Multi-section layout — headline, affected assets, market impact, AI explanation CTA, timeline, related news, community discussion
- **News cards:** Glass hover states, working bookmark + share buttons

### Phase 3 — Real-Time Experience
- SSE provider exposes `useConnectionStatus()` context
- Market strip refreshes on `market` SSE events
- Live badge with pulse animation on news feed

---

## UI Architecture Overview

```
layout.tsx
├── ThemeProvider (default: dark, light mode supported)
├── AuthProvider
├── SSEProvider → ConnectionStatus context
│   ├── Header
│   │   ├── GlobalSearchBar (debounced suggestions)
│   │   ├── ConnectionStatus
│   │   └── NotificationBell
│   └── main
│       ├── / (Dashboard)
│       │   ├── MarketStrip (animated ticker)
│       │   ├── HeroCards (4 KPI cards)
│       │   └── 3-column grid (news / sidebar)
│       ├── /ai (ChatMessage + StreamingMessage + TypingIndicator)
│       ├── /search (URL-synced, filter tabs)
│       └── /news/[id] (multi-section detail)
```

**CSS layers:**
- `.glass-panel` — backdrop blur panels
- `.dash-panel` — elevated dashboard cards
- `.hero-card` — gradient-top accent cards
- `.gradient-text` — cyan → blue → gold headings
- `.ticker-track` — CSS infinite scroll animation

---

## Remaining Risks

| Risk | Severity | Notes |
|------|----------|-------|
| Macro calendar / economic events | Low | Displays honest "Feature not yet available" |
| Historical context on news detail | Low | Placeholder until data pipeline exists |
| Fuzzy search | Low | Uses PostgreSQL `ILIKE`; true FTS/indexing recommended at scale |
| AI page `/ai?q=` prefill | Low | Link exists on news detail; AI page doesn't auto-read query param yet |
| Bookmark state not persisted on load | Low | Bookmark button doesn't check existing bookmarks on mount |
| Light mode glass contrast | Low | May need tuning on very bright displays |

---

## Verification Checklist

- [x] TypeScript build passes
- [x] AI message keys are unique and stable
- [x] No static `"error"` message IDs
- [x] Search filters trigger new queries
- [x] Bookmark and share buttons functional
- [x] SSE connection status visible
- [x] AI streaming with stop/retry
- [x] Markdown rendering in AI responses
- [x] Responsive header with mobile menu + mobile search
- [x] Dark/light theme toggle

---

## Files Changed (Key)

| File | Change |
|------|--------|
| `src/app/ai/page.tsx` | Complete rewrite — keys, SSE, stop/retry |
| `src/components/ai/chat-message.tsx` | New — markdown bubbles, typing indicator |
| `src/components/realtime/sse-provider.tsx` | Connection context + SSE parser |
| `src/app/globals.css` | Premium design system |
| `src/components/layout/header.tsx` | Glass header + search + status |
| `src/app/page.tsx` | Multi-panel dashboard |
| `src/app/search/page.tsx` | URL-synced search with filters |
| `src/app/news/[id]/page.tsx` | Professional detail layout |
| `src/components/news/news-actions.tsx` | Working bookmark + share |
