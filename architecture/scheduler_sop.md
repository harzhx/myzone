# 📋 Scheduler SOP — Architecture Layer 1

**Version:** 1.0 | **Last Updated:** 2026-08-19

## Purpose
Define how the 24-hour automation loop works: when scrapers run, how new articles are detected, and what happens on each cycle.

---

## Scheduler Logic

```
On startup:
  1. Run aggregator immediately (first fetch)
  2. Set interval: every 24 hours

Each cycle:
  1. Record last_item_ids from .tmp/articles.json (before scrape)
  2. Run scraper_rundown.js → get articles_rundown
  3. Run scraper_bens_bites.js → get articles_bens
  4. Merge all → deduplicate by ID
  5. Compare IDs against previous state → identify NEW articles
  6. Write updated .tmp/articles.json
  7. Log result to progress.md: timestamp, new count, errors
  8. If new_count > 0: log "✅ X new articles found"
  9. If new_count === 0: log "— No new articles this cycle"
```

---

## New Article Detection

- Compare current article IDs against `last_item_ids` from previous state
- Any ID in `current` but not in `previous` is marked as `is_new: true`
- `is_new` flag is written to `.tmp/articles.json`
- Dashboard reads `is_new` to show the glowing NEW badge

---

## File State Continuity

- `.tmp/articles.json` is NEVER deleted between runs
- Each run READS the existing state, then WRITES the merged updated state
- This ensures saved article data and history are preserved

---

## Error Handling

| Scenario | Action |
|---|---|
| Rundown scraper fails | Log error, continue with Ben's Bites |
| Ben's Bites scraper fails | Log error, continue with Rundown data |
| Both scrapers fail | Log critical error, do not overwrite `.tmp/articles.json` |
| Network timeout | Retry once after 30 seconds, then log failure |

---

## Schedule Configuration

- Default interval: 24 hours (86400000 ms)
- Can be overridden by setting `SCRAPE_INTERVAL_HOURS` in `.env`
- Run immediately on startup (no waiting for first interval)

---

## Logging

All scheduler events are appended to `progress.md` in the format:
```
## YYYY-MM-DD HH:MM — Scheduler Cycle
- Sources attempted: [rundown, bens_bites]
- New articles: N
- Errors: [list or "None"]
```

---

## Repair Log

| Date | Issue | Fix |
|---|---|---|
| 2026-08-19 | Initial SOP creation | — |
