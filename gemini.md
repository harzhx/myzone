# 📜 gemini.md — Project Constitution
> **This file is LAW.** Do not modify unless a schema changes, a rule is added, or architecture is modified.

---

## 🗂️ Project Identity

| Field | Value |
|---|---|
| **Project Name** | My Zone — Personal Hub & AI Digest |
| **System Pilot** | Antigravity (AGY) |
| **Protocol** | B.L.A.S.T. v1.0 |
| **Architecture** | A.N.T. 3-Layer |
| **Initialized** | 2026-08-18 |
| **Last Updated** | 2026-08-19 |
| **Status** | 🟢 PHASES 0–4 COMPLETE — Server running on port 8000 |

---

## 🎯 North Star

> **Build a beautiful, interactive personal dashboard ('My Zone') that aggregates AI newsletter intelligence (The AI Rundown, Ben's Bites), automatically tracks monthly gym habits via phone geolocation/geofencing with a 31-day illuminated dot calendar, provides a fully customizable Projects & Milestones Taskbar with 3 status states ('🔨 Work in Progress', '⏳ In Queue', '✅ Finished'), Drag-and-Drop project reordering, and features a dynamic Instagram Radar & in-app native video Reels player with Meta Graph API integration and dev fallback, supports instant Dark/Light mode switching, and persists data across sessions.**

---

## 📐 Data Schema

> **STATUS: DEFINED ✅ — Coding may begin after Blueprint approval.**

### Article Object
```json
{
  "id": "string (SHA-256 of URL — deterministic, dedup-safe)",
  "source": "string (e.g., 'the_rundown_ai', 'bens_bites')",
  "source_label": "string (e.g., 'The AI Rundown', 'Ben's Bites')",
  "source_color": "string (hex color for source badge)",
  "title": "string",
  "description": "string (subtitle/teaser from RSS <description>)",
  "url": "string (permalink)",
  "image_url": "string | null (enclosure image from RSS)",
  "authors": ["string"],
  "published_at": "string (ISO-8601 UTC)",
  "scraped_at": "string (ISO-8601 UTC)",
  "tags": ["string"],
  "is_saved": "boolean (false by default)"
}
```

### Feed State Object (stored in `.tmp/articles.json`)
```json
{
  "last_fetched": "string (ISO-8601 UTC)",
  "sources": {
    "the_rundown_ai": {
      "feed_url": "https://rss.beehiiv.com/feeds/2R3C6Bt5wj.xml",
      "last_item_id": "string (ID of most recent article seen)",
      "status": "ok | error",
      "error_message": "string | null"
    },
    "bens_bites": {
      "feed_url": "https://bensbites.beehiiv.com/archive (scrape)",
      "last_item_id": "string | null",
      "status": "ok | error",
      "error_message": "string | null"
    }
  },
  "articles": [Article]
}
```

### localStorage Schema (browser-side persistence)
```json
{
  "ai_pulse_saved_ids": ["string"],
  "ai_pulse_articles": [Article],
  "ai_pulse_last_fetched": "string (ISO-8601)"
}
```

---

## 🔗 Integrations & Services

| Service | Method | Status | Notes |
|---|---|---|---|
| The AI Rundown | RSS Feed | ✅ VERIFIED | `https://rss.beehiiv.com/feeds/2R3C6Bt5wj.xml` |
| Ben's Bites | Substack RSS | ✅ VERIFIED | `https://www.bensbites.com/feed` — moved from Beehiiv to Substack |
| Supabase | DB (future) | ⬜ NOT STARTED | Phase 2 integration — deferred |

---

## 📏 Behavioral Rules

1. **New articles only:** Only surface articles that did not exist in the previous fetch — compare by `id` (hash of URL)
2. **Deduplication:** Never show the same article twice. IDs are SHA-256 hashes of the permalink URL
3. **Persist saved articles:** `is_saved = true` articles survive refreshes via `localStorage`
4. **24-hour refresh cycle:** The Python scheduler checks for new articles every 24 hours and writes to `.tmp/articles.json`
5. **Graceful degradation:** If one feed fails, show the error badge on that source but continue displaying others
6. **No API keys required** for Phase 1 (scraping only)

---

## 🚫 Do-Not Rules

1. **Do NOT** hardcode any secrets or API keys — use `.env`
2. **Do NOT** delete `.tmp/articles.json` between runs — it is the state file
3. **Do NOT** display ads or sponsored content from newsletters as primary articles
4. **Do NOT** connect to Supabase until explicitly instructed in Phase 2
5. **Do NOT** scrape more than once per 24 hours to respect source rate limits

---

## 🏛️ Architectural Invariants

1. All intermediate/temp files go in `.tmp/` — never in root or `tools/`
2. All secrets/keys live in `.env` — never hardcoded
3. Business logic lives in `tools/` Python scripts — never in the navigation layer
4. SOPs in `architecture/` must be updated **before** code changes in `tools/`
5. The dashboard reads from `.tmp/articles.json` — the scraper writes to it
6. A project is only **"Complete"** when the payload is in its final cloud destination
7. `localStorage` is the interim persistence layer until Supabase is connected

---

## 🔧 Maintenance Log

| Date | Change | Reason |
|---|---|---|
| 2026-08-18 | Constitution initialized | Protocol 0 kickoff |
| 2026-08-19 | Data schemas defined, sources researched | Discovery answers received |
| 2026-08-19 | AI Rundown RSS verified live | Link research phase |
| 2026-08-19 | Ben's Bites Beehiiv → redirects to Substack | Scraper updated to `www.bensbites.com/feed` |
| 2026-08-19 | Both scrapers verified: 20+20=40 articles | Phase 2 Link complete |
| 2026-08-19 | Dashboard built: HTML/CSS/JS dark-mode Bento grid | Phase 3+4 Architect+Stylize complete |
| 2026-08-19 | Image onerror rendering bug fixed | Self-annealing repair loop |
| 2026-08-20 | RapidAPI Instagram Looter live search & native MP4 stream integrated | Live autocomplete search & in-site video playback |
