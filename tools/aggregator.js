// tools/aggregator.js
// Layer 3 Tool: Merges all scrapers, deduplicates, writes .tmp/articles.json
// Per Architecture SOP: architecture/scraper_sop.md + scheduler_sop.md

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { scrapeRundown } from './scraper_rundown.js';
import { scrapeBensBites } from './scraper_bens_bites.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TMP_DIR = process.env.VERCEL ? os.tmpdir() : path.join(ROOT, '.tmp');
const STATE_FILE = path.join(TMP_DIR, 'articles.json');

// Ensure .tmp exists
try {
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
} catch (e) {}

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (e) {
    console.warn('Could not read state file, starting fresh:', e.message);
  }
  return { last_fetched: null, articles: [] };
}

function saveState(state) {
  try {
    if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (e) {
    console.warn('Could not save articles state cache:', e.message);
  }
}

export async function aggregate() {
  console.log('\n🔄 Aggregator starting...');
  const now = new Date().toISOString();

  // Load existing state
  const prevState = loadState();
  const prevIds = new Set((prevState.articles ?? []).map(a => a.id));
  const prevSavedIds = new Set(
    (prevState.articles ?? []).filter(a => a.is_saved).map(a => a.id)
  );

  // Run both scrapers concurrently
  console.log('  → Fetching The AI Rundown (RSS)...');
  console.log("  → Fetching Ben's Bites (HTML)...");
  const [rundownResult, bensBitesResult] = await Promise.allSettled([
    scrapeRundown(),
    scrapeBensBites(),
  ]);

  const errors = [];
  let allNew = [];

  if (rundownResult.status === 'fulfilled') {
    const { articles, error } = rundownResult.value;
    if (error) errors.push(error);
    else {
      console.log(`  ✅ The AI Rundown: ${articles.length} articles`);
      allNew.push(...articles);
    }
  } else {
    errors.push(`Rundown scraper rejected: ${rundownResult.reason}`);
  }

  if (bensBitesResult.status === 'fulfilled') {
    const { articles, error } = bensBitesResult.value;
    if (error) errors.push(error);
    else {
      console.log(`  ✅ Ben's Bites: ${articles.length} articles`);
      allNew.push(...articles);
    }
  } else {
    errors.push(`Ben's Bites scraper rejected: ${bensBitesResult.reason}`);
  }

  // If both failed, don't overwrite state
  if (allNew.length === 0 && errors.length >= 2) {
    console.error('🚨 CRITICAL: Both scrapers failed. State not updated.');
    errors.forEach(e => console.error('  ERROR:', e));
    return { new_count: 0, total: prevState.articles?.length ?? 0, errors };
  }

  // Deduplicate — new scrape wins on conflict
  const merged = new Map();
  for (const article of allNew) {
    // Preserve is_saved flag from previous state
    if (prevSavedIds.has(article.id)) article.is_saved = true;
    // Mark as new if not seen before
    article.is_new = !prevIds.has(article.id);
    merged.set(article.id, article);
  }

  // Carry forward saved articles that didn't appear in this scrape
  for (const old of (prevState.articles ?? [])) {
    if (!merged.has(old.id)) {
      old.is_new = false; // Not new anymore
      merged.set(old.id, old);
    }
  }

  const articles = [...merged.values()].sort(
    (a, b) => new Date(b.published_at) - new Date(a.published_at)
  );

  const newCount = articles.filter(a => a.is_new).length;

  // Build new state
  const newState = {
    last_fetched: now,
    sources: {
      the_rundown_ai: {
        feed_url: 'https://rss.beehiiv.com/feeds/2R3C6Bt5wj.xml',
        status: errors.some(e => e.includes('Rundown')) ? 'error' : 'ok',
        error_message: errors.find(e => e.includes('Rundown')) ?? null,
      },
      bens_bites: {
        feed_url: 'https://bensbites.beehiiv.com/archive',
        status: errors.some(e => e.includes("Ben's Bites")) ? 'error' : 'ok',
        error_message: errors.find(e => e.includes("Ben's Bites")) ?? null,
      },
    },
    articles,
  };

  saveState(newState);

  console.log(`\n📦 Aggregation complete:`);
  console.log(`   Total articles: ${articles.length}`);
  console.log(`   New this cycle: ${newCount}`);
  if (errors.length) console.error(`   Errors: ${errors.join('; ')}`);

  return { new_count: newCount, total: articles.length, errors };
}

// --- CLI entrypoint ---
if (process.argv[1].includes('aggregator')) {
  const result = await aggregate();
  process.exit(result.errors.length >= 2 ? 1 : 0);
}
