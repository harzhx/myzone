// tools/scraper_bens_bites.js
// Layer 3 Tool: Scrapes Ben's Bites via Substack RSS feed
// UPDATED 2026-08-19: Ben's Bites moved from Beehiiv to Substack (www.bensbites.com)
// Per Architecture SOP: architecture/scraper_sop.md

import https from 'https';
import http from 'http';
import crypto from 'crypto';
import { parseStringPromise } from 'xml2js';

const FEED_URL = 'https://www.bensbites.com/feed';
const SOURCE = 'bens_bites';
const SOURCE_LABEL = "Ben's Bites";
const SOURCE_COLOR = '#FF6B35';
const TIMEOUT_MS = 15000;

// --- Helpers ---

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/{{[^}]+}}/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toISO(dateStr) {
  try {
    return new Date(dateStr).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function fetchUrl(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) { reject(new Error('Too many redirects')); return; }
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      timeout: TIMEOUT_MS,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AI-Pulse/1.0)' }
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        const next = res.headers.location.startsWith('http')
          ? res.headers.location
          : `https://www.bensbites.com${res.headers.location}`;
        fetchUrl(next, redirectCount + 1).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
  });
}

// --- Main scraper ---

export async function scrapeBensBites() {
  const scrapedAt = new Date().toISOString();
  try {
    const xml = await fetchUrl(FEED_URL);
    const parsed = await parseStringPromise(xml, { explicitArray: true, explicitCharkey: true });
    const items = parsed?.rss?.channel?.[0]?.item ?? [];

    const articles = items.map((item) => {
      // Substack RSS: title/description may be CDATA wrapped
      const getRaw = (field) => {
        const val = item[field]?.[0];
        if (!val) return '';
        if (typeof val === 'string') return val;
        if (typeof val === 'object' && val._) return val._;
        return String(val);
      };

      const url = getRaw('link') || getRaw('guid');
      const enclosure = item.enclosure?.[0]?.['$'];
      const imageUrl = enclosure?.url ?? null;

      return {
        id: sha256(url),
        source: SOURCE,
        source_label: SOURCE_LABEL,
        source_color: SOURCE_COLOR,
        title: stripHtml(getRaw('title')),
        description: stripHtml(getRaw('description')).slice(0, 300),
        url,
        image_url: imageUrl,
        authors: ['Ben Tossell'],
        published_at: toISO(getRaw('pubDate')),
        scraped_at: scrapedAt,
        is_saved: false,
        is_new: false,
      };
    }).filter(a => a.url && a.title && a.title.length > 3);

    return { articles, error: null };
  } catch (err) {
    return { articles: [], error: `Ben's Bites scraper failed: ${err.message}` };
  }
}

// --- CLI entrypoint ---
if (process.argv[1].includes('scraper_bens_bites')) {
  const result = await scrapeBensBites();
  if (result.error) console.error('ERROR:', result.error);
  console.log(JSON.stringify(result.articles, null, 2));
  console.error(`\n✅ Scraped ${result.articles.length} articles from Ben's Bites`);
}
