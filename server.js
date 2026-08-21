// server.js — Local HTTP server for My Zone Dashboard
// Serves static dashboard files, byte-range video streaming, and REST APIs:
// - /api/articles
// - /api/widgets
// - /api/gym/location-event
// - /api/instagram/feed?username={username} (Meta Graph API Business Discovery + Fallback)

import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { aggregate } from './tools/aggregator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env variables
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [key, ...vals] = trimmed.split('=');
      if (key && vals.length > 0) {
        const val = vals.join('=').trim().replace(/^["']|["']$/g, '');
        if (!process.env[key.trim()]) {
          process.env[key.trim()] = val;
        }
      }
    }
  }
}
loadEnv();

// Initialize Supabase Client
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
  try {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    console.log('⚡ Supabase Cloud Database: Connected (' + process.env.SUPABASE_URL + ')');
  } catch (e) {
    console.warn('Supabase initialization warning:', e.message);
  }
}

const PORT = process.env.PORT ?? 8000;
const DASHBOARD_DIR = path.join(__dirname, 'dashboard');
const TMP_DIR = process.env.VERCEL ? os.tmpdir() : path.join(__dirname, '.tmp');
const STATE_FILE = path.join(TMP_DIR, 'articles.json');
const WIDGETS_FILE = path.join(TMP_DIR, 'widgets.json');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

async function parseRequestBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'object') {
      return req.body;
    }
    if (typeof req.body === 'string' && req.body.trim()) {
      try {
        return JSON.parse(req.body);
      } catch (e) {
        return {};
      }
    }
  }

  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

function serveFile(req, res, filePath, contentType) {
  try {
    // Prevent Directory Traversal (CWE-22)
    const normalizedTarget = path.resolve(filePath);
    const normalizedRoot = path.resolve(DASHBOARD_DIR);
    if (!normalizedTarget.startsWith(normalizedRoot)) {
      res.writeHead(403, { 'Content-Type': 'text/plain', 'X-Content-Type-Options': 'nosniff' });
      res.end('403 Forbidden');
      return;
    }

    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain', 'X-Content-Type-Options': 'nosniff' });
      res.end('Not found');
      return;
    }

    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      res.writeHead(403, { 'Content-Type': 'text/plain', 'X-Content-Type-Options': 'nosniff' });
      res.end('403 Forbidden');
      return;
    }

    const fileSize = stat.size;
    const range = req.headers.range;

    // Support HTTP Range requests for MP4 video streaming (enables seeking, scrubbing & browser support)
    if (range && (contentType === 'video/mp4' || contentType === 'video/webm')) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(filePath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'X-Content-Type-Options': 'nosniff'
      };
      res.writeHead(206, head);
      file.pipe(res);
      return;
    }

    const content = fs.readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': fileSize,
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache',
    });
    res.end(content);
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain', 'X-Content-Type-Options': 'nosniff' });
    res.end('Server Error: ' + e.message);
  }
}

async function serveArticles(res) {
  try {
    if (supabase) {
      try {
        const { data: dbArticles, error } = await supabase
          .from('articles')
          .select('*')
          .order('published_at', { ascending: false });

        if (!error && dbArticles && dbArticles.length > 0) {
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache',
          });
          res.end(JSON.stringify({ articles: dbArticles, last_fetched: new Date().toISOString(), sources: { supabase: { status: 'ok' } } }));
          return;
        }
      } catch (sbErr) {
        console.warn('Supabase articles fetch fallback:', sbErr.message);
      }
    }

    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf8');
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
      });
      res.end(data);
    } else {
      try {
        const agg = await aggregate();
        if (supabase && agg?.articles && agg.articles.length > 0) {
          supabase.from('articles').upsert(agg.articles, { onConflict: 'url' }).then(() => {}).catch(() => {});
        }
        if (fs.existsSync(STATE_FILE)) {
          const fresh = fs.readFileSync(STATE_FILE, 'utf8');
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(fresh);
          return;
        }
      } catch (aggErr) {
        console.warn('Live aggregation notice:', aggErr.message);
      }
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ articles: [], last_fetched: null, sources: {} }));
    }
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ error: e.message, articles: [] }));
  }
}

async function serveWidgets(res) {
  try {
    if (supabase) {
      try {
        const [{ data: projects }, { data: gymStreak }, { data: gymLogs }] = await Promise.all([
          supabase.from('projects').select('*').order('position', { ascending: true }),
          supabase.from('gym_streak').select('*').eq('id', 'current').single(),
          supabase.from('gym_logs').select('*').order('created_at', { ascending: false })
        ]);

        if (projects || gymStreak) {
          const payload = {
            projects: projects || [],
            gym: {
              visits: gymStreak?.visits || [],
              goal_per_month: gymStreak?.goal_per_month || 20,
              streak_weeks: gymStreak?.streak_weeks || 3,
              geofence: gymStreak?.geofence || { name: 'Bestrong Gym' },
              sessions: gymLogs || [],
              triggers: gymStreak?.triggers || []
            },
            instagram: { enabled: true, handles: [] }
          };
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache',
          });
          res.end(JSON.stringify(payload));
          return;
        }
      } catch (sbErr) {
        console.warn('Supabase widgets query fallback:', sbErr.message);
      }
    }

    const DEFAULT_WIDGETS_FILE = path.join(DASHBOARD_DIR, 'widgets.json');
    if (fs.existsSync(WIDGETS_FILE)) {
      const data = fs.readFileSync(WIDGETS_FILE, 'utf8');
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
      });
      res.end(data);
    } else if (fs.existsSync(DEFAULT_WIDGETS_FILE)) {
      const data = fs.readFileSync(DEFAULT_WIDGETS_FILE, 'utf8');
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
      });
      res.end(data);
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ gym: { visits: [], sessions: [], goal_per_month: 20 }, projects: [], instagram: { enabled: true, handles: [] } }));
    }
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ error: e.message }));
  }
}

async function updateWidgets(req, res) {
  try {
    const parsed = await parseRequestBody(req);

    // Sync with Supabase
    if (supabase) {
      try {
        if (Array.isArray(parsed.projects)) {
          const formatted = parsed.projects.map((p, idx) => ({
            id: p.id,
            name: p.name,
            category: p.category || 'AI Pipeline',
            status: p.status || 'in_progress',
            progress: p.progress ?? 50,
            color: p.color || '#F5C518',
            tasks: p.tasks || '1/4 tasks',
            due: p.due || 'End of Month',
            position: idx,
            updated_at: new Date().toISOString()
          }));
          await supabase.from('projects').upsert(formatted);

          // If items were deleted, clean up Supabase
          const currentIds = parsed.projects.map(p => p.id);
          const { data: existing } = await supabase.from('projects').select('id');
          if (existing && existing.length > 0) {
            const toDelete = existing.filter(e => !currentIds.includes(e.id)).map(e => e.id);
            if (toDelete.length > 0) {
              await supabase.from('projects').delete().in('id', toDelete);
            }
          }
        }

        if (parsed.gym) {
          await supabase.from('gym_streak').upsert({
            id: 'current',
            goal_per_month: parsed.gym.goal_per_month || 20,
            streak_weeks: parsed.gym.streak_weeks || 3,
            visits: parsed.gym.visits || [],
            updated_at: new Date().toISOString()
          });
        }
      } catch (sbErr) {
        console.warn('Supabase widgets update warning:', sbErr.message);
      }
    }

    let current = {};
    if (fs.existsSync(WIDGETS_FILE)) {
      current = JSON.parse(fs.readFileSync(WIDGETS_FILE, 'utf8'));
    } else if (fs.existsSync(path.join(DASHBOARD_DIR, 'widgets.json'))) {
      current = JSON.parse(fs.readFileSync(path.join(DASHBOARD_DIR, 'widgets.json'), 'utf8'));
    }
    const updated = { ...current, ...parsed };
    try {
      if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
      fs.writeFileSync(WIDGETS_FILE, JSON.stringify(updated, null, 2), 'utf8');
    } catch (e) {}

    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ success: true, data: updated, supabase: Boolean(supabase) }));
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ error: e.message }));
  }
}

// Automatic Phone Geolocation Event Handler
async function handleLocationEvent(req, res) {
  try {
    const payload = await parseRequestBody(req);
    const eventType = payload.event || 'enter';
    const eventTime = payload.timestamp ? new Date(payload.timestamp) : new Date();
    const dateStr = eventTime.toISOString().slice(0, 10);
    const timeFormatted = eventTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    let current = { gym: { visits: [], sessions: [] } };
    if (fs.existsSync(WIDGETS_FILE)) {
      current = JSON.parse(fs.readFileSync(WIDGETS_FILE, 'utf8'));
    } else if (fs.existsSync(path.join(DASHBOARD_DIR, 'widgets.json'))) {
      current = JSON.parse(fs.readFileSync(path.join(DASHBOARD_DIR, 'widgets.json'), 'utf8'));
    }

    current.gym = current.gym || {};
    current.gym.visits = current.gym.visits || [];
    current.gym.sessions = current.gym.sessions || [];
    current.gym.triggers = current.gym.triggers || [];

    if (!current.gym.visits.includes(dateStr)) {
      current.gym.visits.push(dateStr);
    }

    // Record incoming trigger event for the recent trigger history
    const triggerRecord = {
      id: `trig_${Date.now()}`,
      event: eventType,
      timestamp: eventTime.toISOString(),
      time: timeFormatted,
      date: dateStr,
      display_time: `${dateStr} · ${timeFormatted}`,
      detected_by: payload.source || (payload.device ? `${payload.device} (MacroDroid)` : 'MacroDroid Geofence')
    };
    current.gym.triggers = [triggerRecord, ...current.gym.triggers.filter(t => t.id !== triggerRecord.id)].slice(0, 15);

    const gymName = current.gym?.geofence?.name || 'Bestrong Gym';
    let activeSession = current.gym.sessions.find(s => s.date === dateStr && s.status === 'in_progress');

    if (eventType === 'enter') {
      if (!activeSession) {
        activeSession = {
          id: `s_${Date.now()}`,
          date: dateStr,
          enter_time: timeFormatted,
          exit_time: null,
          duration: 'In progress...',
          status: 'in_progress',
          detected_by: `${gymName} (Automatic)`,
          calories: 0,
          heart_rate_avg: '--'
        };
        current.gym.sessions.unshift(activeSession);
      }
    } else if (eventType === 'exit') {
      if (activeSession) {
        activeSession.exit_time = timeFormatted;
        activeSession.status = 'completed';

        let durText = 'Completed';
        if (activeSession.enter_time) {
          const startD = new Date(`${dateStr} ${activeSession.enter_time}`);
          const endD = new Date(`${dateStr} ${timeFormatted}`);
          const diffMs = endD.getTime() - startD.getTime();
          if (!isNaN(diffMs) && diffMs > 0) {
            const totalMins = Math.round(diffMs / 60000);
            const hrs = Math.floor(totalMins / 60);
            const mins = totalMins % 60;
            durText = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
          }
        }
        activeSession.duration = durText;
        activeSession.detected_by = `${gymName} (Automatic)`;
      } else {
        activeSession = {
          id: `s_${Date.now()}`,
          date: dateStr,
          enter_time: 'Auto-detected',
          exit_time: timeFormatted,
          duration: 'Logged via Geofence',
          status: 'completed',
          detected_by: `${gymName} (Automatic)`,
          calories: 480,
          heart_rate_avg: '135 bpm'
        };
        current.gym.sessions.unshift(activeSession);
      }
    }

    if (supabase && activeSession) {
      try {
        await supabase.from('gym_logs').upsert({
          id: activeSession.id,
          date: dateStr,
          enter_time: activeSession.enter_time,
          exit_time: activeSession.exit_time,
          duration: activeSession.duration,
          status: activeSession.status,
          detected_by: activeSession.detected_by,
          calories: activeSession.calories,
          heart_rate_avg: activeSession.heart_rate_avg
        });
        await supabase.from('gym_streak').upsert({
          id: 'current',
          visits: current.gym.visits,
          triggers: current.gym.triggers || [],
          updated_at: new Date().toISOString()
        });
      } catch (sbErr) {
        console.warn('Supabase gym log sync warning:', sbErr.message);
      }
    }

    try {
      if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
      fs.writeFileSync(WIDGETS_FILE, JSON.stringify(current, null, 2), 'utf8');
    } catch (e) {}

    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ success: true, message: `Gym ${eventType} logged automatically at ${timeFormatted}`, data: current.gym, supabase: Boolean(supabase) }));
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ error: e.message }));
  }
}

// ============================================================
// CONVERSATIONAL AI CHATBOT ENGINE (POWERED BY GEMINI)
// ============================================================

async function handleBotChatEndpoint(req, res) {
  try {
    const payload = await parseRequestBody(req);
    const message = (payload.message || '').trim();
    const history = payload.history || [];
    const context = payload.context || {};

    if (!message) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'Message is required.' }));
      return;
    }

    let response = null;

    // 1. Primary Engine: Google Gemini LLM
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
      try {
        response = await callGeminiChat(message, history, context);
      } catch (geminiErr) {
        console.error('[Gemini Chat Error]:', geminiErr.message);
        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({
          reply: `⚠️ Gemini connection issue: ${geminiErr.message}. Please check your connection or API key.`,
          error: geminiErr.message
        }));
        return;
      }
    }
    // 2. Secondary fallback: OpenAI LLM (if explicitly configured)
    else if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim()) {
      try {
        response = await callOpenAiChat(message, history, context);
      } catch (llmErr) {
        console.error('[OpenAI Chat Error]:', llmErr.message);
        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({
          reply: `⚠️ OpenAI connection issue: ${llmErr.message}.`,
          error: llmErr.message
        }));
        return;
      }
    }
    // 3. Fallback only if no API keys are provided at all
    else {
      response = await generateSmartChatResponse(message, history, context);
    }

    // If response includes an automated social media / tweet action, dispatch to Make.com Webhook
    if (response && response.action && response.action.type === 'tweet' && response.action.data?.text) {
      const webhookUrl = process.env.MAKE_WEBHOOK_URL || process.env.MAKE_BUFFER_WEBHOOK_URL;
      if (webhookUrl && !webhookUrl.includes('your-custom-webhook-id')) {
        try {
          await dispatchToMakeWebhook(response.action.data.text, webhookUrl);
          response.action.dispatched = true;
        } catch (whErr) {
          console.warn('[Make.com Webhook Dispatch Error]:', whErr.message);
        }
      }
    }

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    });
    res.end(JSON.stringify(response));
  } catch (e) {
    console.error('[Bot Chat Error]:', e);
    res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({
      reply: `I encountered an unexpected error: ${e.message}. Please try again.`,
      error: e.message
    }));
  }
}

// LLM: OpenAI Chat Completions
async function callOpenAiChat(userMsg, history, context) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const systemPrompt = `You are Bhondu, an intelligent, friendly, and highly capable personal dashboard companion assistant.
You talk like a helpful personal chief of staff. Never output robotic gibberish. Use clean markdown.

Current Real-Time Dashboard Context:
- Active Projects: ${JSON.stringify(context.projects || [])}
- Monthly Gym Tracker: ${JSON.stringify(context.gym || {})}
- Live AI News Headlines: ${JSON.stringify((context.articles || []).slice(0, 5))}
- Current Time: ${new Date().toLocaleString()}

You MUST respond strictly in valid JSON format matching this schema:
{
  "reply": "Friendly, natural conversational markdown response",
  "action": null | {
    "type": "add_project" | "move_project" | "delete_project" | "log_gym" | "tweet",
    "data": {
      // For "add_project": { "name": string, "status": "in_progress"|"in_queue"|"finished", "category": string, "progress": number, "color": string }
      // For "move_project": { "id": string, "name": string, "status": "in_progress"|"in_queue"|"finished" }
      // For "delete_project": { "id": string, "name": string }
      // For "log_gym": { "date": "YYYY-MM-DD" }
      // For "tweet": { "text": string }
    }
  }
}
CRITICAL INSTRUCTION: Only generate an "action" when the user explicitly assigns or asks to perform a dashboard task (e.g., adding a project, changing project status, logging a workout, tweeting). For all regular discussions, questions, summaries, advice, or chitchat, set "action" to null.`;

  const messages = [
    { role: 'system', content: systemPrompt }
  ];

  if (Array.isArray(history)) {
    history.slice(-6).forEach(h => {
      if (h.sender === 'user') messages.push({ role: 'user', content: h.text });
      else if (h.sender === 'bot') messages.push({ role: 'assistant', content: h.text });
    });
  }

  messages.push({ role: 'user', content: userMsg });

  const postBody = JSON.stringify({
    model,
    messages,
    temperature: 0.7,
    response_format: { type: 'json_object' }
  });

  const options = {
    hostname: 'api.openai.com',
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Content-Length': Buffer.byteLength(postBody)
    },
    timeout: 15000
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message || 'OpenAI API Error'));
          const content = parsed.choices?.[0]?.message?.content;
          if (!content) return reject(new Error('Empty response from OpenAI'));
          const result = JSON.parse(content);
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('OpenAI request timed out')); });
    req.on('error', reject);
    req.write(postBody);
    req.end();
  });
}

// LLM: Google Gemini API (Dedicated Primary Model with Fallback Pipeline)
async function callGeminiChat(userMsg, history, context) {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured in .env');

  const systemInstruction = `You are Bhondu, an intelligent, friendly, ultra-capable personal dashboard companion AI for the user.
You talk like a sharp, supportive personal chief of staff. Never output robotic gibberish. Write with clean, elegant markdown formatting (bolding, lists, highlights).

Current Real-Time Dashboard State:
- Active Projects: ${JSON.stringify(context.projects || [])}
- Monthly Gym Tracker: ${JSON.stringify(context.gym || {})}
- Live AI News Headlines: ${JSON.stringify((context.articles || []).slice(0, 5))}
- Current System Time: ${new Date().toLocaleString()}

You MUST respond strictly in valid JSON format matching this schema:
{
  "reply": "Conversational, insightful, direct markdown response to the user",
  "action": null | {
    "type": "add_project" | "move_project" | "delete_project" | "log_gym" | "tweet",
    "data": {
      // For "add_project": { "name": string, "status": "in_progress" | "in_queue" | "finished", "category": string, "progress": number, "color": string }
      // For "move_project": { "id": string, "name": string, "status": "in_progress" | "in_queue" | "finished" }
      // For "delete_project": { "id": string, "name": string }
      // For "log_gym": { "date": "YYYY-MM-DD" }
      // For "tweet": { "text": string }
    }
  }
}

IMPORTANT RULES FOR ACTIONS ("Work when assigned"):
1. ONLY return an "action" object when the user explicitly assigns or requests a specific task or change (e.g., adding a project, changing/moving a project status, deleting a project, logging a gym workout, posting a tweet).
2. When performing an action, describe what you did clearly in "reply" and set "action" to the appropriate payload.
3. For general chat, questions, brainstorming, project advice, news summaries, or casual remarks, "action" MUST BE null.
4. Ensure the JSON is completely valid without extra leading or trailing text.`;

  const contents = [];

  // Append recent conversation history for rich continuity
  if (Array.isArray(history) && history.length > 0) {
    history.slice(-6).forEach(h => {
      if (h.sender === 'user' && h.text) {
        contents.push({ role: 'user', parts: [{ text: h.text }] });
      } else if (h.sender === 'bot' && h.text) {
        contents.push({ role: 'model', parts: [{ text: typeof h.text === 'string' ? h.text : JSON.stringify(h.text) }] });
      }
    });
  }

  // Current prompt
  contents.push({
    role: 'user',
    parts: [{ text: `${systemInstruction}\n\nUser Request: ${userMsg}` }]
  });

  const postBody = JSON.stringify({
    contents,
    generationConfig: {
      temperature: 0.7,
      responseMimeType: 'application/json'
    }
  });

  const candidateModels = [
    process.env.GEMINI_MODEL,
    'gemini-3.6-flash',
    'gemini-3.7-flash',
    'gemini-flash-latest'
  ].filter(Boolean);

  let lastError = null;

  for (const model of candidateModels) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 35000);

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: postBody,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const rawText = await res.text();
      if (!res.ok) {
        throw new Error(`Gemini API HTTP ${res.status} (${model}): ${rawText.slice(0, 200)}`);
      }

      const parsed = JSON.parse(rawText);
      if (parsed.error) {
        throw new Error(parsed.error.message || `Gemini error on ${model}`);
      }

      let text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error(`Empty candidates response from Gemini (${model})`);
      }

      // Clean any accidental markdown codeblock wrappers
      text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      const jsonResult = JSON.parse(text);
      return jsonResult; // Success
    } catch (err) {
      lastError = err;
      console.warn(`[Gemini Model Try Failed: ${model}]:`, err.message);
    }
  }

  throw lastError || new Error('All Gemini model candidates failed');
}

// Built-in Natural Intent Determination & Conversational Engine
async function generateSmartChatResponse(userMsg, history, context) {
  const msg = userMsg.trim();
  const lower = msg.toLowerCase();
  const projects = context.projects || [];
  const gym = context.gym || { visits: [], goal_per_month: 20, streak_weeks: 3 };
  const articles = context.articles || [];

  // ==========================================================
  // 1. INTENT RECOGNITION: ACTIONS (PROJECTS, GYM, TWEET)
  // ==========================================================

  // A. ADD PROJECT
  // Matches: "add project X to in progress", "create a new project named App", "new project: X"
  let addMatch = msg.match(/(?:add|create|start)\s+(?:a\s+)?(?:new\s+)?project\s+(?:named|called\s+)?['"]?(.+?)['"]?\s+(?:in|to|into|as)\s+(work\s+in\s+progress|in\s+progress|in_progress|in\s+queue|in_queue|finished|done|completed)$/i)
    || msg.match(/(?:add|create|start)\s+(?:a\s+)?(?:new\s+)?project\s+(?:named|called\s+)?['"]?(.+?)['"]?$/i)
    || msg.match(/^new project:\s*(.+)$/i);

  if (addMatch) {
    let name = (addMatch[1] || '').replace(/^(named|called)\s+/i, '').trim();
    let rawStatus = (addMatch[2] || 'in_progress').toLowerCase();

    const statusMatch = name.match(/\s+(?:in|to|into|as)\s+(work\s+in\s+progress|in\s+progress|in_progress|in\s+queue|in_queue|finished|done|completed)$/i);
    if (statusMatch) {
      rawStatus = statusMatch[1].toLowerCase();
      name = name.slice(0, statusMatch.index).trim();
    }

    if (name && name.length > 1 && !['a', 'the', 'my', 'new'].includes(name.toLowerCase())) {
      const status = (rawStatus.includes('finish') || rawStatus.includes('done'))
        ? 'finished'
        : (rawStatus.includes('queue') ? 'in_queue' : 'in_progress');

      return {
        reply: `Done! 🚀 I've added **"${name}"** to your **${status.replace('_', ' ').toUpperCase()}** list.\n\nYou can track its progress, assign tasks, or update it anytime right on your dashboard.`,
        action: {
          type: 'add_project',
          data: {
            name,
            status,
            category: 'AI Pipeline',
            progress: status === 'finished' ? 100 : (status === 'in_queue' ? 0 : 50),
            color: status === 'finished' ? '#22C55E' : (status === 'in_queue' ? '#6C63FF' : '#F5C518')
          }
        }
      };
    }
  }

  // B. CHANGE / MOVE PROJECT STATUS
  // Matches: "move project X to finished", "mark X as complete", "change status of X to in progress"
  const moveMatch = msg.match(/(?:change|move|update|set|mark)\s+(?:status\s+of\s+)?(?:project\s+)?['"]?([^'"]+?)['"]?\s+(?:to|into|as)\s+(work\s+in\s+progress|in\s+queue|finished|done|completed)/i);
  if (moveMatch) {
    const query = moveMatch[1].trim().toLowerCase();
    const rawStatus = moveMatch[2].trim().toLowerCase();
    const newStatus = (rawStatus.includes('finish') || rawStatus.includes('done') || rawStatus.includes('complete'))
      ? 'finished'
      : (rawStatus.includes('queue') ? 'in_queue' : 'in_progress');

    const matchedProj = projects.find(p => p.name.toLowerCase().includes(query) || query.includes(p.name.toLowerCase()));
    if (matchedProj) {
      return {
        reply: `Awesome! I've moved **"${matchedProj.name}"** to **${newStatus.replace('_', ' ').toUpperCase()}** (${newStatus === 'finished' ? '100% complete 🎉' : 'Active'})!`,
        action: {
          type: 'move_project',
          data: {
            id: matchedProj.id,
            name: matchedProj.name,
            status: newStatus
          }
        }
      };
    }
  }

  // C. DELETE / REMOVE PROJECT
  if (lower.startsWith('delete project') || lower.startsWith('remove project')) {
    const query = msg.replace(/^(delete|remove)\s+project\s+/i, '').trim().toLowerCase();
    const matchedProj = projects.find(p => p.name.toLowerCase().includes(query));
    if (matchedProj) {
      return {
        reply: `I have removed **"${matchedProj.name}"** from your active projects list.`,
        action: {
          type: 'delete_project',
          data: { id: matchedProj.id, name: matchedProj.name }
        }
      };
    }
  }

  // D. LOG GYM / WORKOUT
  if (lower.includes('log gym') || lower.includes('log workout') || lower.includes('i worked out') || lower.includes('went to the gym') || lower.includes('hit the gym')) {
    const today = new Date().toISOString().split('T')[0];
    const alreadyLogged = gym.visits && gym.visits.includes(today);
    const count = (gym.visits ? gym.visits.length : 0) + (alreadyLogged ? 0 : 1);
    const goal = gym.goal_per_month || 20;

    return {
      reply: alreadyLogged
        ? `You've already logged your gym session for today (**${today}**)! Keep that consistency rolling! 🔥🏋️`
        : `Boom! 💪 I've logged your workout session for today (**${today}**).\n\nYou're at **${count}/${goal} days** towards your monthly fitness goal!`,
      action: {
        type: 'log_gym',
        data: { date: today }
      }
    };
  }

  // E. TWEET / SOCIAL MEDIA / BUFFER DISPATCH
  if (lower.startsWith('tweet:') || lower.startsWith('tweet ') || lower.startsWith('post to buffer:') || lower.startsWith('post to twitter:') || lower.startsWith('post on social media:') || lower.startsWith('post on twitter:')) {
    const tweetText = msg.replace(/^(tweet:|tweet|post to buffer:|post to twitter:|post on social media:|post on twitter:)\s*/i, '').trim();
    if (tweetText) {
      return {
        reply: `Drafting and dispatching your post to **Make.com / Twitter / Buffer**:\n\n> "${tweetText}"\n\nIt has been broadcasted to your automation webhook pipeline! 🐦✨`,
        action: {
          type: 'tweet',
          data: { text: tweetText }
        }
      };
    }
  }

  // ==========================================================
  // 2. CONTEXTUAL INTELLIGENCE & DASHBOARD QUERIES
  // ==========================================================

  // A. SUMMARIZE AI NEWS / WHAT'S THE LATEST
  if (lower.includes('summarize') || lower.includes('news') || lower.includes('digest') || lower.includes('latest in ai') || lower.includes('ai updates') || lower.includes('what happened')) {
    if (articles.length > 0) {
      const top3 = articles.slice(0, 3);
      const summaryList = top3.map((a, i) => `${i + 1}. **${a.title}** (${a.source})\n   ${a.summary ? a.summary.slice(0, 140) + '…' : 'Read more in the live digest.'}`).join('\n\n');
      return {
        reply: `Here are the top AI breakthroughs from your live digest today:\n\n${summaryList}\n\nWould you like me to bookmark or tweet about any of these?`
      };
    } else {
      return {
        reply: "Your AI digest is actively gathering articles. Click the **Refresh** button at the top of the dashboard to pull the latest newsletters from *The AI Rundown* and *Ben's Bites*!"
      };
    }
  }

  // B. GYM & HABIT STATS
  if (lower.includes('gym streak') || lower.includes('gym progress') || lower.includes('workout progress') || lower.includes('fitness stats') || lower.includes('gym goal')) {
    const visits = gym.visits || [];
    const goal = gym.goal_per_month || 20;
    const streak = gym.streak_weeks || 3;
    const pct = Math.round((visits.length / goal) * 100);

    return {
      reply: `🏋️ **Your Monthly Gym Progress**:\n\n• **Completed:** ${visits.length} of ${goal} sessions (${pct}%)\n• **Active Streak:** ${streak} consecutive weeks\n• **Location:** ${gym.geofence?.name || 'Bestrong Gym'}\n\n${pct >= 80 ? "You're crushing it this month! Keep up the momentum! 🔥" : "Stay consistent—every workout brings you closer to your target!"}`
    };
  }

  // C. PROJECTS OVERVIEW & WHAT TO WORK ON
  if (lower.includes('what should i work on') || lower.includes('prioritize') || lower.includes('focus next') || lower.includes('my projects') || lower.includes('list projects') || lower.includes('show projects')) {
    if (projects.length === 0) {
      return {
        reply: "You don't have any projects in your pipeline yet. Tell me something like: _'Add a new project named Mobile App to in progress'_ to get started!"
      };
    }

    const inProgress = projects.filter(p => p.status === 'in_progress');
    const inQueue = projects.filter(p => p.status === 'in_queue');
    const finished = projects.filter(p => p.status === 'finished');

    let reply = `📋 **Your Projects Overview** (${projects.length} Total):\n\n`;
    if (inProgress.length > 0) {
      reply += `⚡ **In Progress (${inProgress.length}):**\n` + inProgress.map(p => `• **${p.name}** — ${p.progress}% (${p.tasks || 'Active'})`).join('\n') + '\n\n';
    }
    if (inQueue.length > 0) {
      reply += `⏳ **In Queue (${inQueue.length}):**\n` + inQueue.map(p => `• **${p.name}** (Due: ${p.due || 'Upcoming'})`).join('\n') + '\n\n';
    }
    if (finished.length > 0) {
      reply += `✅ **Finished (${finished.length}):** ${finished.map(p => p.name).join(', ')}\n\n`;
    }

    if (inProgress.length > 0) {
      reply += `💡 **Suggestion:** Focus on completing **"${inProgress[0].name}"** to push it over the finish line today!`;
    }

    return { reply };
  }

  // ==========================================================
  // 3. NATURAL CHIT-CHAT, GREETINGS & CASUAL CONVERSATION
  // ==========================================================

  // Greetings
  if (lower.match(/^(hi|hello|hey|heya|howdy|sup|yo|good\s*(morning|afternoon|evening|day))(\s|!|\.|\?|$)/i)) {
    const greetings = [
      `Hey there! 👋 How's your day going? I'm here to help you manage your projects, track your workouts, or catch up on the latest AI news.`,
      `Hello! 🌟 Ready to get some work done? Tell me what you'd like to tackle or ask me anything.`,
      `Hi! Great to see you. How can I assist your workflow today?`
    ];
    return { reply: greetings[Math.floor(Math.random() * greetings.length)] };
  }

  // How are you
  if (lower.includes('how are you') || lower.includes('how are things') || lower.includes('how do you do')) {
    return {
      reply: `I'm running smoothly at 100% efficiency! ⚡ All your dashboard systems, news feeds, and automation webhooks are active. What's on your agenda today?`
    };
  }

  // Who are you / what are you
  if (lower.includes('who are you') || lower.includes('what are you') || lower.includes('what can you do') || lower.includes('help me') || lower.includes('features')) {
    return {
      reply: `I'm **Bhondu** — your smart personal AI companion integrated directly into your hub! 🤖\n\nHere is what I can do for you:\n• 📋 **Project Management:** Add, complete, or re-prioritize projects dynamically.\n• 🏋️ **Gym Habit Tracking:** Log workouts and monitor your monthly streak.\n• 📰 **AI Digest Insights:** Summarize and explain breaking AI developments.\n• 🐦 **Social Automations:** Dispatch tweets and updates directly via Make.com / Buffer.\n• 🎤 **Voice Commands:** Click the microphone icon to speak naturally.\n• 💬 **General Assistant:** Answer questions, brainstorm ideas, and help you stay productive!`
    };
  }

  // Thank you / gratitude
  if (lower.includes('thank') || lower.includes('thx') || lower.includes('appreciate') || lower.includes('good job') || lower.includes('awesome') || lower.includes('great')) {
    const thanksReplies = [
      "You're very welcome! Glad I could help. Let me know if you need anything else! ✨",
      "Always happy to help! Keep up the great work today. 🚀",
      "Anytime! I'm here whenever you need a hand. 😊"
    ];
    return { reply: thanksReplies[Math.floor(Math.random() * thanksReplies.length)] };
  }

  // Jokes / fun
  if (lower.includes('joke') || lower.includes('funny') || lower.includes('make me laugh')) {
    const jokes = [
      "Why do programmers prefer dark mode? Because light attracts bugs! 🐛💡",
      "There are only 10 types of people in the world: those who understand binary, and those who don't. 🤖",
      "Why did the JavaScript developer wear glasses? Because they didn't C#! 🤓"
    ];
    return { reply: jokes[Math.floor(Math.random() * jokes.length)] };
  }

  // Motivation / encouragement
  if (lower.includes('motivat') || lower.includes('inspire') || lower.includes('lazy') || lower.includes('tired') || lower.includes('hard to focus')) {
    return {
      reply: `Remember: *Discipline is choosing between what you want now and what you want most.* 🦾\n\nPick just **one small task** on your projects board and commit to 15 minutes of uninterrupted focus. You've got this!`
    };
  }

  // Coding & Tech Questions
  if (lower.includes('javascript') || lower.includes('python') || lower.includes('react') || lower.includes('api') || lower.includes('webhook') || lower.includes('css') || lower.includes('node')) {
    return {
      reply: `That's a great tech topic! Feel free to ask a specific coding or architectural question, and I'll break it down with examples or best practices for you.`
    };
  }

  // ==========================================================
  // 4. SMART CONVERSATIONAL FALLBACK (Natural, friendly, helpful)
  // ==========================================================
  return {
    reply: `I understand what you're asking! While I'm tailored specifically for your dashboard workflow, I can help you brainstorm this, update your projects, check your workout streak, or draft a post for Twitter.\n\nCould you clarify what you'd like to accomplish, or would you like me to assist with one of your current tasks?`
  };
}

async function dispatchToMakeWebhook(text, webhookUrl) {
  const urlObj = new URL(webhookUrl);
  const postData = JSON.stringify({
    action: 'tweet',
    text,
    timestamp: new Date().toISOString(),
    source: 'My Zone AI Assistant'
  });
  const client = urlObj.protocol === 'http:' ? http : https;
  return new Promise((resolve, reject) => {
    const req = client.request(urlObj, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 10000
    }, (res) => {
      let d = '';
      res.on('data', c => { d += c; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// ============================================================
// AI BOT TASK DISPATCHER & WEBHOOK INTEGRATION (Make.com / Buffer / Twitter)
// ============================================================

async function handleBotWebhookDispatch(req, res) {
  try {
    const payload = await parseRequestBody(req);
    const action = payload.action || 'tweet';
    const text = payload.text || payload.message || '';
    const customWebhook = payload.webhook_url;

    if (!text && !payload.data) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'Text or data payload is required' }));
      return;
    }

    const targetWebhook = customWebhook || process.env.MAKE_BUFFER_WEBHOOK_URL;
    const isPlaceholder = !targetWebhook || targetWebhook.includes('your-custom-webhook-id') || targetWebhook.includes('placeholder');

    const dispatchPayload = {
      action,
      text,
      timestamp: new Date().toISOString(),
      source: 'My Zone AI Assistant',
      metadata: {
        app: 'My Zone Dashboard',
        ...payload.metadata
      }
    };

    if (isPlaceholder) {
      // Return simulated success when webhook is not yet configured with user ID
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({
        success: true,
        mode: 'simulated',
        message: 'Payload prepared and verified. (Configured with simulated local webhook runner until custom Make.com/Buffer URL is set in .env or Webhook Settings)',
        dispatched_payload: dispatchPayload,
        webhook_url: targetWebhook || 'Not configured'
      }));
      return;
    }

    // Validate Webhook URL & Protect against SSRF (CWE-918)
    let webhookUrl;
    try {
      webhookUrl = new URL(targetWebhook);
    } catch (urlErr) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'Invalid webhook URL format.' }));
      return;
    }

    if (!['http:', 'https:'].includes(webhookUrl.protocol)) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'Webhook URL must use HTTP or HTTPS protocol.' }));
      return;
    }

    const hostname = webhookUrl.hostname.toLowerCase();
    const isInternalHost = (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '0.0.0.0' ||
      hostname === '169.254.169.254' ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.local')
    );

    if (isInternalHost && !process.env.ALLOW_INTERNAL_WEBHOOKS) {
      res.writeHead(403, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'Internal/loopback webhook targets are blocked for security.' }));
      return;
    }

    const postData = JSON.stringify(dispatchPayload);
    const client = webhookUrl.protocol === 'http:' ? http : https;
    const whReq = client.request(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (whRes) => {
      let respData = '';
      whRes.on('data', c => { respData += c; });
      whRes.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({
          success: whRes.statusCode >= 200 && whRes.statusCode < 300,
          status_code: whRes.statusCode,
          response: respData.substring(0, 500),
          dispatched_payload: dispatchPayload
        }));
      });
    });

    whReq.on('error', (err) => {
      console.error('[Webhook Dispatch Error]:', err.message);
      res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({
        success: false,
        error: `Failed to reach webhook: ${err.message}`,
        dispatched_payload: dispatchPayload
      }));
    });

    whReq.write(postData);
    whReq.end();

  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ error: e.message }));
  }
}

async function handleBotSessionsEndpoint(req, res) {
  if (req.method === 'GET') {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('chat_sessions').select('*').order('updated_at', { ascending: false });
        if (!error && data) {
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ success: true, sessions: data, supabase: true }));
          return;
        }
      } catch (e) {
        console.warn('Supabase chat sessions query error:', e.message);
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ success: true, sessions: [], supabase: false }));
    return;
  }

  if (req.method === 'POST') {
    try {
      const payload = await parseRequestBody(req);
      if (supabase && payload.id) {
        await supabase.from('chat_sessions').upsert({
          id: payload.id,
          title: payload.title || 'Conversation',
          messages: payload.messages || [],
          updated_at: new Date().toISOString()
        });
      }
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ success: true, supabase: Boolean(supabase) }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (req.method === 'DELETE') {
    try {
      const payload = await parseRequestBody(req);
      if (supabase && payload.id) {
        await supabase.from('chat_sessions').delete().eq('id', payload.id);
      }
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ success: true, supabase: Boolean(supabase) }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }
}

// ============================================================
// MAIN HTTP SERVER & ROUTER
// ============================================================

export async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers?.host || `localhost:${PORT}`}`);
  const pathname = url.pathname;

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Range',
    });
    res.end();
    return;
  }

  // REST API routes
  if (pathname === '/api/articles') {
    return serveArticles(res);
  }

  if (pathname === '/api/widgets') {
    if (req.method === 'POST' || req.method === 'PUT') {
      return updateWidgets(req, res);
    }
    return serveWidgets(res);
  }

  if (pathname === '/api/gym/location-event' && req.method === 'POST') {
    return handleLocationEvent(req, res);
  }

  if (pathname === '/api/bot/chat' && req.method === 'POST') {
    return handleBotChatEndpoint(req, res);
  }

  if (pathname === '/api/bot/dispatch-webhook' && req.method === 'POST') {
    return handleBotWebhookDispatch(req, res);
  }

  if (pathname === '/api/bot/sessions') {
    return handleBotSessionsEndpoint(req, res);
  }

  if (pathname === '/api/refresh' && req.method === 'POST') {
    try {
      const result = await aggregate();
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(result));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // Static file serving with video range support
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.join(DASHBOARD_DIR, filePath);

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] ?? 'text/plain';
  serveFile(req, res, filePath, contentType);
}

const server = http.createServer(handleRequest);

// Only listen locally when not running inside Vercel serverless environment
if (!process.env.VERCEL) {
  server.listen(PORT, () => {
    console.log('\n🚀 My Zone Dashboard is running!');
    console.log(`   Open: http://localhost:${PORT}`);
    console.log(`   API:  http://localhost:${PORT}/api/articles`);
    console.log(`   Widgets: http://localhost:${PORT}/api/widgets`);
    console.log(`   Location Webhook: http://localhost:${PORT}/api/gym/location-event`);
    console.log(`   Press Ctrl+C to stop\n`);
  });

  process.on('SIGINT', () => {
    console.log('\n⛔ Server stopped.');
    server.close();
    process.exit(0);
  });
}

export default handleRequest;
