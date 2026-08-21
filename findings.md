# 🔬 findings.md — Research & Discoveries

> **Append-only log.** Add discoveries, constraints, and insights here. Never delete entries.

---

## 📅 2026-08-18 — Project Kickoff

### Workspace
- Location: `E:\2026\learn antigravity-2`
- State at init: Empty directory

---

## 📅 2026-08-19 — Link Research (Feed Discovery)

### Source 1: The AI Rundown
- **Platform:** Beehiiv
- **RSS Feed:** `https://rss.beehiiv.com/feeds/2R3C6Bt5wj.xml` ✅ VERIFIED LIVE
- **Feed Format:** Standard RSS 2.0 with `<content:encoded>` CDATA blocks (full HTML content)
- **Item fields available:** `<title>`, `<description>`, `<link>`, `<guid>`, `<pubDate>`, `<dc:creator>`, `<enclosure url>` (thumbnail image), `<content:encoded>` (full HTML)
- **Sample article:** "Pacing comes to the AI frontier" — 2026-08-19
- **No API key required** ✅
- **Rate limit:** Unknown — will cap at 1 fetch/24hr to be safe
- **Constraint:** `<content:encoded>` contains full HTML with inline styles — must strip for display, use `<description>` as teaser

### Source 2: Ben's Bites
- **Platform:** Beehiiv (bensbites.beehiiv.com)
- **RSS Feed:** ❌ NOT AVAILABLE (404 at `/feed.xml`)
- **Alternative:** Web scrape the `/archive` page at `bensbites.beehiiv.com/archive`
- **Scraping approach:** Requests + BeautifulSoup, target article cards in the archive listing
- **Status:** 🟡 Pending test — archive page loads confirmed but scrape structure TBD
- **Constraint:** No standard feed ID; must parse HTML DOM. Subject to layout changes.
- **Fallback:** If archive scrape fails, use RSSHub or email-to-RSS service

### Design Research Findings
- **Trending layout for 2026:** Bento grid (modular cards)
- **Color palette:** Dark mode base with vibrant accent (electric blue or purple AI-themed)
- **Key UX patterns:** Source-colored badges, hover-to-reveal actions, skeleton loading, quick-action buttons (Save, Read, Share)
- **Typography:** Inter or Outfit from Google Fonts
- **Interaction:** CSS micro-animations, smooth card transitions

### Deduplication Strategy
- Article ID = SHA-256 hash of the permalink URL
- This is deterministic and stable across runs
- Store seen IDs in `.tmp/articles.json` → compare on next run → only surface NEW items

### Persistence Strategy (Phase 1)
- Browser localStorage keys:
  - `ai_pulse_articles` — full Article array (JSON)
  - `ai_pulse_saved_ids` — array of saved article IDs
  - `ai_pulse_last_fetched` — ISO timestamp
- Future: migrate to Supabase tables (articles, saved_articles)

---

## ⚠️ Constraints & Gotchas

1. **Ben's Bites has no RSS** — must scrape HTML archive, fragile vs. layout changes
2. **AI Rundown RSS content is full HTML** — strip for summaries, don't render raw CDATA
3. **Beehiiv rate limits unknown** — enforce 1 fetch/24hr regardless
4. **`{{live_url}}` template tags** in AI Rundown RSS content must be stripped (Beehiiv template variables leaked into feed)
5. **Thumbnail images** are served via Beehiiv CDN (beehiiv.com CDN) — no CORS issues for `<img>` tags

---

## 📚 Useful Resources

- AI Rundown RSS: `https://rss.beehiiv.com/feeds/2R3C6Bt5wj.xml`
- Ben's Bites Archive: `https://bensbites.beehiiv.com/archive`
- Python `feedparser` library: robust RSS parsing with namespace support
- Python `beautifulsoup4` + `requests`: HTML scraping
- Python `schedule` or Windows Task Scheduler: 24h trigger
- Google Fonts: Inter (`https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap`)
