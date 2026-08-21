// tools/scheduler.js
// Layer 3 Tool: 24-hour automation loop
// Per Architecture SOP: architecture/scheduler_sop.md

import { aggregate } from './aggregator.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PROGRESS_FILE = path.join(ROOT, 'progress.md');

// Read interval from env or default to 24h
const INTERVAL_HOURS = parseFloat(process.env.SCRAPE_INTERVAL_HOURS ?? '24');
const INTERVAL_MS = INTERVAL_HOURS * 60 * 60 * 1000;

function logToProgress(entry) {
  const line = `\n${entry}\n`;
  try {
    fs.appendFileSync(PROGRESS_FILE, line, 'utf8');
  } catch (e) {
    console.error('Could not write to progress.md:', e.message);
  }
  console.log(entry);
}

async function runCycle() {
  const now = new Date();
  const timestamp = now.toISOString().replace('T', ' ').slice(0, 16);
  logToProgress(`\n## ${timestamp} — Scheduler Cycle`);

  try {
    const result = await aggregate();
    const errorList = result.errors.length > 0 ? result.errors.join('; ') : 'None';
    logToProgress(`- Sources attempted: [the_rundown_ai, bens_bites]`);
    logToProgress(`- Total articles in store: ${result.total}`);
    logToProgress(`- New articles this cycle: ${result.new_count}`);
    logToProgress(`- Errors: ${errorList}`);

    if (result.new_count > 0) {
      logToProgress(`✅ ${result.new_count} new article(s) found and added.`);
    } else {
      logToProgress(`— No new articles this cycle.`);
    }
  } catch (err) {
    logToProgress(`🚨 Scheduler cycle error: ${err.message}`);
    console.error(err);
  }
}

// --- Main ---
console.log('🛰️  AI Pulse Scheduler starting...');
console.log(`   Interval: every ${INTERVAL_HOURS} hours`);
console.log(`   Press Ctrl+C to stop\n`);

// Run immediately on startup
await runCycle();

// Then run every N hours
const intervalHandle = setInterval(runCycle, INTERVAL_MS);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⛔ Scheduler stopped.');
  clearInterval(intervalHandle);
  process.exit(0);
});

process.on('SIGTERM', () => {
  clearInterval(intervalHandle);
  process.exit(0);
});
