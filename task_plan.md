# 📋 task_plan.md — B.L.A.S.T. Task Plan

> **Living document.** Updated at every phase transition.

---

## 🗺️ Project Phases

| Phase | Name | Status |
|---|---|---|
| 0 | Initialization | ✅ COMPLETE |
| 1 | Blueprint | 🟡 IN REVIEW — Awaiting user approval |
| 2 | Link | ⬜ BLOCKED |
| 3 | Architect | ⬜ BLOCKED |
| 4 | Stylize | ⬜ BLOCKED |
| 5 | Trigger | ⬜ BLOCKED |

---

## ✅ Phase 0 — Initialization Checklist

- [x] Create `gemini.md` (Project Constitution)
- [x] Create `task_plan.md` (this file)
- [x] Create `findings.md`
- [x] Create `progress.md`
- [x] Ask & receive answers to all 5 Discovery Questions
- [x] Define Data Schema in `gemini.md`
- [ ] Get user approval on Blueprint → **EXECUTION GATE**

---

## 📌 Phase 1 — Blueprint Goals *(Pending Approval)*

- [ ] Confirm data schema (Article object + Feed State)
- [ ] Confirm source strategy: AI Rundown (RSS) + Ben's Bites (HTML scrape)
- [ ] Confirm file structure
- [ ] Confirm dashboard layout approach (Bento grid, dark mode, card-based)

---

## 📌 Phase 2 — Link Goals

- [ ] `tools/scraper_rundown.py` — parse AI Rundown RSS feed
- [ ] `tools/scraper_bens_bites.py` — scrape Ben's Bites archive HTML
- [ ] `tools/aggregator.py` — merge both feeds, deduplicate, write to `.tmp/articles.json`
- [ ] Verify both scrapers return valid Article objects
- [ ] Update `findings.md` with any discovered constraints

---

## 📌 Phase 3 — Architect Goals

- [ ] `architecture/scraper_sop.md` — SOP for all scrapers
- [ ] `architecture/dashboard_sop.md` — Dashboard data loading spec
- [ ] `architecture/scheduler_sop.md` — 24h run logic + new-article detection
- [ ] `tools/scheduler.py` — 24h polling loop with new-item detection
- [ ] `dashboard/index.html` — Main shell
- [ ] `dashboard/style.css` — Design system (dark mode, cards, animations)
- [ ] `dashboard/app.js` — Data loading, save logic, localStorage, refresh UI

---

## 📌 Phase 4 — Stylize Goals

- [ ] Implement Bento grid layout with source-colored cards
- [ ] Add save/bookmark interaction with persistence
- [ ] Add new article badge / "Last Updated" indicator
- [ ] Add source filter tabs (All / AI Rundown / Ben's Bites)
- [ ] Add loading skeleton animations
- [ ] Final design review with user

---

## 📌 Phase 5 — Trigger Goals

- [ ] Windows Task Scheduler entry for 24h scraper run
- [ ] OR: `scheduler.py` daemon mode
- [ ] Final documentation pass in `gemini.md`
- [ ] Supabase migration plan (deferred to Phase 5+)
