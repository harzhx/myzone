# 📋 Dashboard SOP — Architecture Layer 1

**Version:** 1.0 | **Last Updated:** 2026-08-19

## Purpose
Define how the dashboard loads, displays, and manages article data. The dashboard is a pure HTML/CSS/JS single-page application served by a local Node.js server.

---

## Data Flow

```
tools/aggregator.js
        ↓ writes
.tmp/articles.json
        ↓ served by
server.js (Node HTTP server on port 8000)
        ↓ fetched by
dashboard/app.js (via fetch('/api/articles'))
        ↓ merged with
localStorage (saved IDs + cached articles)
        ↓ rendered in
dashboard/index.html
```

---

## Loading Sequence

1. `app.js` runs on `DOMContentLoaded`
2. Load saved article IDs from `localStorage.getItem('ai_pulse_saved_ids')` → parse JSON
3. Load cached articles from `localStorage.getItem('ai_pulse_articles')` → parse JSON
4. `fetch('/api/articles')` → get fresh data from server
5. On success: merge with localStorage, mark `is_saved` flags, re-render, update `localStorage`
6. On failure: use cached articles from localStorage with a warning banner
7. Render article cards in the main grid
8. Apply current filter (All / source / Saved)

---

## localStorage Schema

| Key | Type | Description |
|---|---|---|
| `ai_pulse_saved_ids` | `string` (JSON array of IDs) | Which articles the user has saved |
| `ai_pulse_articles` | `string` (JSON array) | Full article cache for offline use |
| `ai_pulse_last_fetched` | `string` (ISO-8601) | Timestamp of last successful fetch |
| `ai_pulse_filter` | `string` | Active filter: `"all"`, `"the_rundown_ai"`, `"bens_bites"`, `"saved"` |

---

## UI States

| State | Trigger | Behavior |
|---|---|---|
| Loading | Initial fetch | Show skeleton cards (6 placeholder cards) |
| Loaded | fetch() resolves | Replace skeletons with real cards, animate in |
| Error | fetch() fails | Show error banner, display cached articles |
| Empty | No articles match filter | Show empty state illustration + message |
| No new | All articles seen before | Show "No new articles since last check" notice |

---

## Card Render Rules

1. NEW articles (first scrape or ID not seen before) show a pulsing green "NEW" badge
2. Saved articles show a filled bookmark icon (gold)
3. Unsaved articles show an outline bookmark icon
4. Source badge uses `source_color` from the Article object
5. Clicking a card opens the article URL in a new tab
6. Clicking the bookmark button toggles `is_saved` in localStorage

---

## Filter Logic

- `"all"` → show all articles sorted by `published_at` DESC
- `"the_rundown_ai"` → only articles with `source === "the_rundown_ai"`
- `"bens_bites"` → only articles with `source === "bens_bites"`
- `"saved"` → only articles with `is_saved === true`

---

## Repair Log

| Date | Issue | Fix |
|---|---|---|
| 2026-08-19 | Initial SOP creation | — |
