// tools/scraper_rundown.js
// Layer 3 Tool: Scrapes The AI Rundown RSS feed
// Per Architecture SOP: architecture/scraper_sop.md
// Returns: Array of Article objects

import https from 'https';
import http from 'http';
import crypto from 'crypto';
import { parseStringPromise } from 'xml2js';

const FEED_URL = 'https://rss.beehiiv.com/feeds/2R3C6Bt5wj.xml';
const SOURCE = 'the_rundown_ai';
const SOURCE_LABEL = 'The AI Rundown';
const SOURCE_COLOR = '#6C63FF';
const TIMEOUT_MS = 15000;

// --- Helpers ---

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/{{[^}]+}}/g, '') // Remove Beehiiv template vars
    .replace(/<[^>]*>/g, '')   // Remove HTML tags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
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

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout: TIMEOUT_MS }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchUrl(res.headers.location).then(resolve).catch(reject);
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

export async function scrapeRundown() {
  const scrapedAt = new Date().toISOString();
  try {
    const xml = await fetchUrl(FEED_URL);
    const parsed = await parseStringPromise(xml, { explicitArray: true });
    const items = parsed?.rss?.channel?.[0]?.item ?? [];

    const articles = items.map((item) => {
      const url = item.link?.[0] ?? item.guid?.[0]?._ ?? item.guid?.[0] ?? '';
      const imageUrl = item.enclosure?.[0]?.['$']?.url ?? null;
      const creators = item['dc:creator'] ?? [];
      const authors = creators.map(c => (typeof c === 'string' ? c : c._)).filter(Boolean);

      return {
        id: sha256(url),
        source: SOURCE,
        source_label: SOURCE_LABEL,
        source_color: SOURCE_COLOR,
        title: stripHtml(item.title?.[0] ?? ''),
        description: stripHtml(item.description?.[0] ?? ''),
        url,
        image_url: imageUrl,
        authors,
        published_at: toISO(item.pubDate?.[0] ?? item['atom:published']?.[0] ?? ''),
        scraped_at: scrapedAt,
        is_saved: false,
        is_new: false,
      };
    }).filter(a => a.url && a.title);

    return { articles, error: null };
  } catch (err) {
    return { articles: [], error: `Rundown scraper failed: ${err.message}` };
  }
}

// --- CLI entrypoint ---
if (process.argv[1]?.includes('scraper_rundown')) {
  const result = await scrapeRundown();
  if (result.error) console.error('ERROR:', result.error);
  console.log(JSON.stringify(result.articles, null, 2));
  console.error(`\n✅ Scraped ${result.articles.length} articles from The AI Rundown`);
}
