# 📋 Scraper SOP — Architecture Layer 1

**Version:** 1.0 | **Last Updated:** 2026-08-19

## Purpose
Define how all scrapers collect data, what fields they extract, and how edge cases are handled. Any code changes in `tools/` must be preceded by an update to this document.

---

## Scraper Invariants

1. **Output format:** Every scraper returns an array of Article objects conforming to the schema in `gemini.md`
2. **ID generation:** `id = SHA-256(article_url)` — deterministic, dedup-safe
3. **Encoding:** All output is UTF-8 JSON
4. **Error handling:** On failure, log error and return `{ articles: [], error: "message" }` — never crash
5. **Rate limit:** Maximum 1 fetch per 24 hours per source (enforced by scheduler)
6. **Timeout:** HTTP requests timeout at 15 seconds

---

## Source 1: The AI Rundown (RSS)

**Tool:** `tools/scraper_rundown.js`
**Feed URL:** `https://rss.beehiiv.com/feeds/2R3C6Bt5wj.xml`
**Method:** HTTP GET → XML parse → map to Article schema

### Field Mapping
| Article Field | RSS Source | Notes |
|---|---|---|
| `id` | SHA-256 of `<link>` | Deterministic |
| `source` | hardcoded: `"the_rundown_ai"` | |
| `source_label` | hardcoded: `"The AI Rundown"` | |
| `source_color` | hardcoded: `"#6C63FF"` | Electric violet |
| `title` | `<title>` | Strip HTML entities |
| `description` | `<description>` | Teaser text — strip HTML |
| `url` | `<link>` | Permalink |
| `image_url` | `<enclosure url>` | CDN image, may be absent |
| `authors` | `<dc:creator>` (multiple) | Array of strings |
| `published_at` | `<pubDate>` → ISO-8601 | Convert to UTC |
| `scraped_at` | Now | ISO-8601 UTC |
| `is_saved` | `false` | Default |

### Known Gotchas
- `<content:encoded>` contains full HTML with inline styles — **DO NOT parse this for display**
- Beehiiv template variables like `{{live_url}}` appear in content — strip them
- Multiple `<dc:creator>` elements may appear per item — collect all into array

---

## Source 2: Ben's Bites (HTML Scrape)

**Tool:** `tools/scraper_bens_bites.js`
**Archive URL:** `https://bensbites.beehiiv.com/archive`
**Method:** HTTP GET → HTML parse → map to Article schema

### DOM Targets (inspect `/archive` page)
- Article cards: likely `article`, `[data-post-id]`, or `.post-card` elements
- Title: `h2` or `h3` within each card
- Link: `<a>` href on the card or title
- Date: `time` element with `datetime` attribute
- Description/teaser: `p` within card

### Field Mapping
| Article Field | HTML Source | Notes |
|---|---|---|
| `id` | SHA-256 of full URL | |
| `source` | hardcoded: `"bens_bites"` | |
| `source_label` | hardcoded: `"Ben's Bites"` | |
| `source_color` | hardcoded: `"#FF6B35"` | Warm orange |
| `title` | `h2`/`h3` text | |
| `description` | `p` teaser text | May be empty |
| `url` | card `<a>` href | Ensure absolute URL |
| `image_url` | `img` src in card | May be absent |
| `authors` | `["Ben Tossell"]` | Hardcoded, single author |
| `published_at` | `<time datetime>` → ISO-8601 | |
| `scraped_at` | Now | ISO-8601 UTC |
| `is_saved` | `false` | Default |

### Known Gotchas
- Ben's Bites has NO RSS feed — this is HTML scraping, fragile vs. layout changes
- If scrape fails, return empty array + error message — do not block the aggregator
- Archive page may paginate — only scrape page 1 (most recent 20-30 articles) for now

---

## Repair Log

| Date | Issue | Fix |
|---|---|---|
| 2026-08-19 | Initial SOP creation | — |
| 2026-08-19 | Ben's Bites Beehiiv archive → 301 → redirects to bensbites.com → Substack | Updated `scraper_bens_bites.js` to use `https://www.bensbites.com/feed` (Substack RSS). Update feed URL in `gemini.md`. |
| 2026-08-19 | Card image `onerror` with escaped HTML caused `"/>` rendering artifacts | Replaced with `data-fallback="true"` attribute + delegated `error` event listener |
