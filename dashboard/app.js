// dashboard/app.js — My Zone Personal Dashboard & Hub
// Manages: Custom Projects & Drag-and-Drop, Monthly Gym Habits Calendar, AI Digest, Theme Engine

// ========================= CONSTANTS =========================
const API_ARTICLES = '/api/articles';
const API_REFRESH  = '/api/refresh';
const API_WIDGETS  = '/api/widgets';
const API_GYM_LOC  = '/api/gym/location-event';
const API_BOT_CHAT = '/api/bot/chat';
const API_BOT_DISPATCH = '/api/bot/dispatch-webhook';

const LS_SAVED_IDS = 'my_zone_saved_ids';
const LS_ARTICLES  = 'my_zone_articles';
const LS_LAST_FETCH= 'my_zone_last_fetched';
const LS_FILTER    = 'my_zone_filter';
const LS_THEME     = 'my_zone_theme';
const LS_WIDGETS   = 'my_zone_widgets';
const LS_PROJ_FLT  = 'my_zone_project_filter';
const LS_WEBHOOK_URL='my_zone_webhook_url';
const LS_AI_CHAT   = 'my_zone_ai_chat';
const LS_AI_SESSIONS = 'bhondu_ai_chat_sessions';
const LS_AI_ACTIVE_SESSION = 'bhondu_ai_active_session';

// ========================= STATE =========================
let state = {
  articles: [],
  filter: 'all',
  savedIds: new Set(),
  lastFetched: null,
  isRefreshing: false,
  theme: 'dark',
  projectFilter: 'all', // 'all' | 'in_progress' | 'in_queue' | 'finished'
  currentMonthDate: new Date(),
  widgets: {
    gym: {
      goal_per_month: 20,
      visits: [],
      sessions: [],
      streak_weeks: 3,
      geofence: {
        name: "Bestrong Gym",
        radius_meters: 150,
        latitude: 28.6139,
        longitude: 77.2090
      }
    },
    projects: [
      {
        id: "p1",
        name: "My Zone Custom Dashboard",
        category: "Full Stack",
        progress: 90,
        color: "#F5C518",
        status: "in_progress",
        tasks: "9/10 tasks",
        due: "Aug 22"
      },
      {
        id: "p2",
        name: "AI Newsletter Scrapers & Feed Engine",
        category: "Backend",
        progress: 100,
        color: "#22C55E",
        status: "finished",
        tasks: "8/8 tasks",
        due: "Aug 19"
      },
      {
        id: "p3",
        name: "Supabase Cloud Database & Auth Sync",
        category: "Database",
        progress: 15,
        color: "#6C63FF",
        status: "in_queue",
        tasks: "1/6 tasks",
        due: "Sep 02"
      }
    ]
  },
  aiBot: {
    isOpen: false,
    webhookUrl: '',
    activeSessionId: null,
    sessions: [],
    messages: []
  }
};

// ========================= DOM REFS =========================
const rootEl          = document.documentElement;
const themeToggleBtn  = document.getElementById('theme-toggle');
const themeLabel      = document.getElementById('theme-label');
const refreshBtn      = document.getElementById('refresh-btn');
const refreshLabel    = document.getElementById('refresh-label');
const statusDot       = document.getElementById('status-dot');
const statusTxt       = document.getElementById('status-text');

// Hero stats
const greetingTime    = document.getElementById('greeting-time');
const statTotal       = document.getElementById('stat-total');
const statGymGoal     = document.getElementById('stat-gym-goal');
const statProjActive  = document.getElementById('stat-projects-active');
const statSaved       = document.getElementById('stat-saved');
const tabSavedCount   = document.getElementById('tab-saved-count');

// Monthly Gym Widget
const gymMonthHeading = document.getElementById('gym-current-month-heading');
const gymMonthGrid    = document.getElementById('gym-month-grid');
const gymProgressBar  = document.getElementById('gym-progress-bar');
const gymSummaryText  = document.getElementById('gym-summary-text');
const gymStreakCount  = document.getElementById('gym-streak-count');
const sessionStatusTxt= document.getElementById('session-status-text');
const btnPrevMonth    = document.getElementById('btn-prev-month');
const btnNextMonth    = document.getElementById('btn-next-month');
const btnGeofenceCfg  = document.getElementById('btn-geofence-config');

// Projects Widget
const projectsListEl  = document.getElementById('projects-list');
const btnOpenNewProj  = document.getElementById('btn-open-new-project');
const btnProjectManage= document.getElementById('btn-project-manage');
const projStatusTabs  = document.querySelectorAll('.proj-tab');
const cntAll          = document.getElementById('cnt-all');
const cntInProgress   = document.getElementById('cnt-in_progress');
const cntInQueue      = document.getElementById('cnt-in_queue');
const cntFinished     = document.getElementById('cnt-finished');

// Project Modal
const projectModal    = document.getElementById('project-modal');
const projectModalClose=document.getElementById('project-modal-close');
const btnCancelProject= document.getElementById('btn-cancel-project');
const projectForm     = document.getElementById('project-form');
const projectModalTitle=document.getElementById('project-modal-title');
const projEditId      = document.getElementById('proj-edit-id');
const projInputName   = document.getElementById('proj-input-name');
const projInputStatus = document.getElementById('proj-input-status');
const projInputCategory=document.getElementById('proj-input-category');
const projInputProgress=document.getElementById('proj-input-progress');
const projValLabel    = document.getElementById('proj-val-label');
const projInputTasks  = document.getElementById('proj-input-tasks');
const projInputDue    = document.getElementById('proj-input-due');

// AI Chatbot (Bhondu) Assistant & Webhook Modal
const btnAiChatToggle = document.getElementById('btn-ai-chat-toggle');
const aiChatDrawer    = document.getElementById('ai-chat-drawer');
const btnAiHistory    = document.getElementById('btn-ai-history');
const btnAiNewChat    = document.getElementById('btn-ai-new-chat');
const btnOpenWebhookCfg=document.getElementById('btn-open-webhook-cfg');
const btnClearAiChat  = document.getElementById('btn-clear-ai-chat');
const btnCloseAiChat  = document.getElementById('btn-close-ai-chat');
const aiHistoryPanel  = document.getElementById('ai-history-panel');
const aiHistoryList   = document.getElementById('ai-history-list');
const btnCloseHistory = document.getElementById('btn-close-history');
const btnHistoryNewChat=document.getElementById('btn-history-new-chat');
const aiChatMessages  = document.getElementById('ai-chat-messages');
const aiChatForm      = document.getElementById('ai-chat-form');
const aiChatInput     = document.getElementById('ai-chat-input');
const btnAiVoice      = document.getElementById('btn-ai-voice');
const aiVoiceStatus   = document.getElementById('ai-voice-status');
const btnVoiceCancel  = document.getElementById('btn-voice-cancel');

// Secondary Chat Floater (Dual floater side-by-side)
const aiChatDrawer2     = document.getElementById('ai-chat-drawer-2');
const aiChatTitle2      = document.getElementById('ai-chat-title-2');
const aiChatSub2        = document.getElementById('ai-chat-sub-2');
const btnClearAiChat2   = document.getElementById('btn-clear-ai-chat-2');
const btnCloseAiChat2   = document.getElementById('btn-close-ai-chat-2');
const aiChatMessages2   = document.getElementById('ai-chat-messages-2');
const aiChatForm2       = document.getElementById('ai-chat-form-2');
const aiChatInput2      = document.getElementById('ai-chat-input-2');
const btnAiVoice2       = document.getElementById('btn-ai-voice-2');
const aiVoiceStatus2    = document.getElementById('ai-voice-status-2');
const btnVoiceCancel2   = document.getElementById('btn-voice-cancel-2');

const webhookModal    = document.getElementById('webhook-modal');
const webhookModalClose=document.getElementById('webhook-modal-close');
const btnCancelWebhook= document.getElementById('btn-cancel-webhook');
const btnSaveWebhook  = document.getElementById('btn-save-webhook');
const webhookUrlInput = document.getElementById('webhook-url-input');

// Geofence Modal
const geofenceModal   = document.getElementById('geofence-modal');
const geofenceCloseBtn= document.getElementById('geofence-modal-close');
const geofenceDoneBtn = document.getElementById('geofence-modal-done');
const btnSaveGeofence = document.getElementById('btn-save-geofence');
const geoInputName    = document.getElementById('geo-input-name');
const geoInputGoal    = document.getElementById('geo-input-goal');

// Articles Section
const articlesGrid    = document.getElementById('articles-grid');
const emptyState      = document.getElementById('empty-state');
const emptyTitle      = document.getElementById('empty-title');
const emptyDesc       = document.getElementById('empty-desc');
const errorBar        = document.getElementById('error-bar');
const errorText       = document.getElementById('error-text');
const errorClose      = document.getElementById('error-close');
const sourceErrors    = document.getElementById('source-errors');
const sectionTitle    = document.getElementById('section-title');
const newPill         = document.getElementById('new-pill');
const newPillLabel    = document.getElementById('new-pill-label');
const lastUpdated     = document.getElementById('last-updated');
const tabs            = document.querySelectorAll('.tab[data-filter]');

// Webhook Modal & Toast
const modalBackdrop   = document.getElementById('integration-modal');
const modalCloseBtn   = document.getElementById('modal-close');
const modalDoneBtn    = document.getElementById('modal-done-btn');
const toast           = document.getElementById('toast');


// ========================= THEME ENGINE =========================

function applyTheme(theme) {
  state.theme = theme;
  rootEl.setAttribute('data-theme', theme);
  themeLabel.textContent = theme === 'dark' ? 'Light' : 'Dark';
  try {
    localStorage.setItem(LS_THEME, theme);
  } catch (e) {}
}

function initTheme() {
  const saved = localStorage.getItem(LS_THEME);
  if (saved) {
    applyTheme(saved);
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    applyTheme('dark');
  } else {
    applyTheme('dark');
  }

  themeToggleBtn.addEventListener('click', () => {
    const next = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    showToast(`Switched to ${next} mode`);
  });
}

// ========================= UTILITIES =========================

function formatDate(isoStr) {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 3600)   return `${Math.round(diff / 60)}m ago`;
    if (diff < 86400)  return `${Math.round(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.round(diff / 86400)}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return ''; }
}

function formatTimestamp(isoStr) {
  if (!isoStr) return '';
  try {
    return 'Updated ' + new Date(isoStr).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return ''; }
}

function toLocalDateString(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function setStatus(type, label) {
  statusDot.className = `status-dot ${type}`;
  statusTxt.textContent = label;
}

let toastTimer;
function showToast(msg, type = '') {
  toast.textContent = msg;
  toast.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.className = 'toast'; }, 2800);
}

function hideSkeletons() {
  document.querySelectorAll('.skel-card').forEach(el => el.remove());
}

function setGreeting() {
  const h = new Date().getHours();
  greetingTime.textContent = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function bookmarkSVG(filled) {
  return filled
    ? `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M5 4a2 2 0 00-2 2v12l7-3 7 3V6a2 2 0 00-2-2H5z"/></svg>`
    : `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 4a2 2 0 00-2 2v12l7-3 7 3V6a2 2 0 00-2-2H5z" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function externalLinkSVG() {
  return `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8">
    <path d="M11 3h6v6M17 3l-8 8M8 5H4a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1v-4" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

function imgPlaceholderSVG() {
  return `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="16" width="48" height="36" rx="4" stroke="currentColor" stroke-width="2"/>
    <circle cx="22" cy="28" r="5" stroke="currentColor" stroke-width="2"/>
    <path d="M8 40 L22 28 L32 36 L42 26 L56 40" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
  </svg>`;
}

// ========================= STORAGE & SYNC =========================

function loadFromStorage() {
  try {
    const rawSaved = localStorage.getItem(LS_SAVED_IDS);
    state.savedIds = rawSaved ? new Set(JSON.parse(rawSaved)) : new Set();
    
    const rawArticles = localStorage.getItem(LS_ARTICLES);
    const cached = rawArticles ? JSON.parse(rawArticles) : [];
    
    state.lastFetched = localStorage.getItem(LS_LAST_FETCH) || null;
    state.filter = localStorage.getItem(LS_FILTER) || 'all';
    state.projectFilter = localStorage.getItem(LS_PROJ_FLT) || 'all';

    const rawWidgets = localStorage.getItem(LS_WIDGETS);
    if (rawWidgets) {
      state.widgets = { ...state.widgets, ...JSON.parse(rawWidgets) };
    }

    const rawWebhook = localStorage.getItem(LS_WEBHOOK_URL);
    if (rawWebhook) state.aiBot.webhookUrl = rawWebhook;

    // Load Chat Sessions
    const rawSessions = localStorage.getItem(LS_AI_SESSIONS);
    if (rawSessions) {
      try {
        state.aiBot.sessions = JSON.parse(rawSessions);
      } catch (e) { state.aiBot.sessions = []; }
    }

    // Auto-migrate and personalize any existing session titles
    if (state.aiBot.sessions && state.aiBot.sessions.length > 0) {
      state.aiBot.sessions.forEach(sess => {
        if (!sess.title || sess.title === 'New Conversation' || sess.title === 'New Chat' || sess.title === 'Side Chat' || sess.title === 'Conversation') {
          const smart = generateSmartSessionTitle(sess.messages);
          if (smart && smart !== 'New Conversation') {
            sess.title = smart;
          }
        }
      });
    }

    if (!state.aiBot.sessions || state.aiBot.sessions.length === 0) {
      const initSess = createNewSessionObject();
      state.aiBot.sessions = [initSess];
      state.aiBot.activeSessionId = initSess.id;
      state.aiBot.messages = initSess.messages;
    } else {
      const activeId = localStorage.getItem(LS_AI_ACTIVE_SESSION);
      const found = state.aiBot.sessions.find(s => s.id === activeId) || state.aiBot.sessions[0];
      state.aiBot.activeSessionId = found.id;
      state.aiBot.messages = found.messages || [];
    }

    return cached;
  } catch { return []; }
}

function saveToStorage() {
  try {
    localStorage.setItem(LS_SAVED_IDS, JSON.stringify([...state.savedIds]));
    localStorage.setItem(LS_ARTICLES, JSON.stringify(state.articles));
    if (state.lastFetched) localStorage.setItem(LS_LAST_FETCH, state.lastFetched);
    localStorage.setItem(LS_FILTER, state.filter);
    localStorage.setItem(LS_PROJ_FLT, state.projectFilter);
    localStorage.setItem(LS_WIDGETS, JSON.stringify(state.widgets));
    localStorage.setItem(LS_WEBHOOK_URL, state.aiBot.webhookUrl || '');

    // Sync active messages to active session in sessions array & personalize title
    if (state.aiBot.activeSessionId && state.aiBot.sessions) {
      const currentSession = state.aiBot.sessions.find(s => s.id === state.aiBot.activeSessionId);
      if (currentSession) {
        currentSession.messages = state.aiBot.messages;
        if (!currentSession.title || currentSession.title === 'New Conversation' || currentSession.title === 'New Chat' || currentSession.title === 'Side Chat') {
          const smart = generateSmartSessionTitle(currentSession.messages);
          if (smart && smart !== 'New Conversation') {
            currentSession.title = smart;
          }
        }
      }
    }

    if (state.aiBot.activeSessionId2 && state.aiBot.sessions) {
      const currentSession2 = state.aiBot.sessions.find(s => s.id === state.aiBot.activeSessionId2);
      if (currentSession2) {
        currentSession2.messages = state.aiBot.messages2;
        if (!currentSession2.title || currentSession2.title === 'New Conversation' || currentSession2.title === 'New Chat' || currentSession2.title === 'Side Chat') {
          const smart = generateSmartSessionTitle(currentSession2.messages);
          if (smart && smart !== 'New Conversation') {
            currentSession2.title = smart;
          }
        }
      }
    }

    localStorage.setItem(LS_AI_SESSIONS, JSON.stringify(state.aiBot.sessions || []));
    localStorage.setItem(LS_AI_ACTIVE_SESSION, state.aiBot.activeSessionId || '');
    localStorage.setItem(LS_AI_CHAT, JSON.stringify(state.aiBot.messages || []));
  } catch (e) { console.warn('localStorage write failed:', e); }
}


function mergeSaved(articles) {
  return articles.map(a => ({ ...a, is_saved: state.savedIds.has(a.id) }));
}

// ========================= CUSTOM PROJECTS & DRAG-AND-DROP =========================

function normalizeProjectStatus(status) {
  if (!status) return 'in_progress';
  const s = status.toLowerCase();
  if (s.includes('queue') || s.includes('to be') || s.includes('plan')) return 'in_queue';
  if (s.includes('finish') || s.includes('complete') || s.includes('done')) return 'finished';
  return 'in_progress';
}

function renderProjectsWidget() {
  const projects = state.widgets?.projects || [];
  projectsListEl.innerHTML = '';

  // Update counts
  const countAll = projects.length;
  const countInProgress = projects.filter(p => normalizeProjectStatus(p.status) === 'in_progress').length;
  const countInQueue    = projects.filter(p => normalizeProjectStatus(p.status) === 'in_queue').length;
  const countFinished   = projects.filter(p => normalizeProjectStatus(p.status) === 'finished').length;

  if (cntAll) cntAll.textContent = countAll;
  if (cntInProgress) cntInProgress.textContent = countInProgress;
  if (cntInQueue) cntInQueue.textContent = countInQueue;
  if (cntFinished) cntFinished.textContent = countFinished;
  if (statProjActive) statProjActive.textContent = countInProgress;

  // Filter tabs active state
  projStatusTabs.forEach(t => {
    t.classList.toggle('active', t.dataset.pstatus === state.projectFilter);
  });

  const filtered = projects.filter(p => {
    if (state.projectFilter === 'all') return true;
    return normalizeProjectStatus(p.status) === state.projectFilter;
  });

  if (filtered.length === 0) {
    projectsListEl.innerHTML = `<div style="text-align:center;padding:32px 10px;color:var(--clr-ink-3);font-size:0.82rem;">No projects under this filter.<br><span style="font-size:0.75rem;opacity:0.8;">Click <strong>+ New Project</strong> to add one!</span></div>`;
    return;
  }

  const statusLabels = {
    in_progress: '🔨 Work in Progress',
    in_queue:    '⏳ In Queue',
    finished:    '✅ Finished',
  };

  let draggedProjId = null;

  filtered.forEach((p, idx) => {
    const normStatus = normalizeProjectStatus(p.status);
    const card = document.createElement('div');
    card.className = `proj-card status-${normStatus}`;
    card.setAttribute('draggable', 'true');
    card.setAttribute('data-id', p.id);
    card.setAttribute('data-index', idx);

    const color = normStatus === 'finished' ? 'var(--clr-green)' : normStatus === 'in_queue' ? 'var(--clr-indigo)' : 'var(--clr-gold)';

    card.innerHTML = `
      <div class="proj-card-header">
        <div class="proj-title-group">
          <span class="proj-drag-handle" title="Hold & drag to rearrange project order">⋮⋮</span>
          <span class="proj-category-pill">${escHtml(p.category || 'General')}</span>
          <h4 class="proj-title">${escHtml(p.name)}</h4>
        </div>
        <button class="proj-status-btn ${normStatus}" data-id="${p.id}" data-current="${normStatus}" title="Click to cycle status: In Queue ➔ Work in Progress ➔ Finished">
          <span class="status-dot-pulse"></span>
          <span>${statusLabels[normStatus]}</span>
        </button>
      </div>

      <div class="proj-progress-row">
        <div class="proj-track-wrap">
          <div class="proj-fill-bar" style="width:${p.progress}%;background:${color};"></div>
        </div>
        <span class="proj-percent-num">${p.progress}%</span>
      </div>

      <div class="proj-footer-row">
        <div class="proj-meta-left">
          ${p.tasks ? `<span class="proj-meta-item">📌 ${escHtml(p.tasks)}</span>` : ''}
          ${p.due ? `<span class="proj-meta-item">⏱️ Due ${escHtml(p.due)}</span>` : ''}
        </div>
        <div class="proj-actions-group">
          <button class="btn-proj-action" data-action="minus" data-id="${p.id}" title="Decrease 10%">-10%</button>
          <button class="btn-proj-action" data-action="plus" data-id="${p.id}" title="Increase 10%">+10%</button>
          <button class="btn-proj-action" data-action="edit" data-id="${p.id}" title="Edit Project">✏️ Edit</button>
          <button class="btn-proj-action danger" data-action="delete" data-id="${p.id}" title="Delete Project">🗑️</button>
        </div>
      </div>
    `;

    // Drag and Drop
    card.addEventListener('dragstart', (e) => {
      draggedProjId = p.id;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', p.id);
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (!draggedProjId || draggedProjId === p.id) return;

      const rect = card.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (e.clientY < midY) {
        card.classList.add('drag-over-top');
        card.classList.remove('drag-over-bottom');
      } else {
        card.classList.add('drag-over-bottom');
        card.classList.remove('drag-over-top');
      }
    });

    card.addEventListener('dragleave', () => {
      card.classList.remove('drag-over-top', 'drag-over-bottom');
    });

    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('drag-over-top', 'drag-over-bottom');
      const sourceId = e.dataTransfer.getData('text/plain') || draggedProjId;
      if (!sourceId || sourceId === p.id) return;

      const rect = card.getBoundingClientRect();
      const insertBefore = e.clientY < (rect.top + rect.height / 2);
      reorderProjects(sourceId, p.id, insertBefore);
    });

    card.addEventListener('dragend', () => {
      draggedProjId = null;
      document.querySelectorAll('.proj-card').forEach(c => {
        c.classList.remove('dragging', 'drag-over-top', 'drag-over-bottom');
      });
    });

    // Click on status badge cycles status smoothly
    card.querySelector('.proj-status-btn').addEventListener('click', () => {
      const nextMap = {
        in_queue: 'in_progress',
        in_progress: 'finished',
        finished: 'in_queue'
      };
      const next = nextMap[normStatus] || 'in_progress';
      updateProjectStatus(p.id, next);
    });

    // Action buttons
    card.querySelectorAll('.btn-proj-action').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        if (action === 'plus') adjustProjectProgress(id, 10);
        if (action === 'minus') adjustProjectProgress(id, -10);
        if (action === 'edit') openEditProjectModal(id);
        if (action === 'delete') deleteProject(id);
      });
    });

    projectsListEl.appendChild(card);
  });
}

async function reorderProjects(sourceId, targetId, insertBefore) {
  const projects = [...(state.widgets.projects || [])];
  const sourceIndex = projects.findIndex(p => p.id === sourceId);
  const targetIndex = projects.findIndex(p => p.id === targetId);

  if (sourceIndex === -1 || targetIndex === -1) return;

  const [movedProject] = projects.splice(sourceIndex, 1);
  let newTargetIndex = projects.findIndex(p => p.id === targetId);
  if (!insertBefore) newTargetIndex += 1;

  projects.splice(newTargetIndex, 0, movedProject);
  state.widgets.projects = projects;

  saveToStorage();
  renderProjectsWidget();
  showToast(`Moved "${movedProject.name}"! 📌`, 'saved-toast');

  try {
    await fetch(API_WIDGETS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projects: state.widgets.projects }),
    });
  } catch (e) {}
}

async function updateProjectStatus(id, newStatus) {
  const project = (state.widgets.projects || []).find(p => p.id === id);
  if (!project) return;
  project.status = newStatus;
  if (newStatus === 'finished') project.progress = 100;
  if (newStatus === 'in_queue' && project.progress === 100) project.progress = 0;

  saveToStorage();
  renderProjectsWidget();
  showToast(`Updated "${project.name}" to ${newStatus.replace('_', ' ')}!`, 'saved-toast');

  try {
    await fetch(API_WIDGETS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projects: state.widgets.projects }),
    });
  } catch (e) {}
}

async function adjustProjectProgress(id, delta) {
  const project = (state.widgets.projects || []).find(p => p.id === id);
  if (!project) return;
  project.progress = Math.max(0, Math.min(100, (project.progress || 0) + delta));
  if (project.progress === 100) project.status = 'finished';
  if (project.progress < 100 && project.status === 'finished') project.status = 'in_progress';

  saveToStorage();
  renderProjectsWidget();

  try {
    await fetch(API_WIDGETS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projects: state.widgets.projects }),
    });
  } catch (e) {}
}

function openNewProjectModal() {
  projectModalTitle.textContent = '🚀 Create New Project';
  projEditId.value = '';
  projInputName.value = '';
  projInputStatus.value = 'in_progress';
  projInputCategory.value = 'Development';
  projInputProgress.value = 50;
  projValLabel.textContent = '50%';
  projInputTasks.value = '';
  projInputDue.value = '';
  projectModal.style.display = 'flex';
}

function openEditProjectModal(id) {
  const project = (state.widgets.projects || []).find(p => p.id === id);
  if (!project) return;

  projectModalTitle.textContent = '✏️ Edit Project';
  projEditId.value = project.id;
  projInputName.value = project.name || '';
  projInputStatus.value = normalizeProjectStatus(project.status);
  projInputCategory.value = project.category || '';
  projInputProgress.value = project.progress || 0;
  projValLabel.textContent = `${project.progress || 0}%`;
  projInputTasks.value = project.tasks || '';
  projInputDue.value = project.due || '';
  projectModal.style.display = 'flex';
}

async function deleteProject(id) {
  state.widgets.projects = (state.widgets.projects || []).filter(p => p.id !== id);
  saveToStorage();
  renderProjectsWidget();
  showToast('Project deleted');

  try {
    await fetch(API_WIDGETS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projects: state.widgets.projects }),
    });
  } catch (e) {}
}

function initProjectEvents() {
  btnOpenNewProj.addEventListener('click', openNewProjectModal);
  projectModalClose.addEventListener('click', () => { projectModal.style.display = 'none'; });
  btnCancelProject.addEventListener('click', () => { projectModal.style.display = 'none'; });
  projectModal.addEventListener('click', (e) => {
    if (e.target === projectModal) projectModal.style.display = 'none';
  });

  projInputProgress.addEventListener('input', (e) => {
    projValLabel.textContent = `${e.target.value}%`;
  });

  // Filter tabs click
  projStatusTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      state.projectFilter = tab.dataset.pstatus;
      saveToStorage();
      renderProjectsWidget();
    });
  });

  // Form submit
  projectForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = projEditId.value || `p_${Date.now()}`;
    const name = projInputName.value.trim();
    const status = projInputStatus.value;
    const category = projInputCategory.value.trim() || 'General';
    const progress = parseInt(projInputProgress.value, 10) || 0;
    const tasks = projInputTasks.value.trim();
    const due = projInputDue.value.trim();

    const projData = {
      id,
      name,
      status,
      category,
      progress,
      tasks,
      due,
      color: status === 'finished' ? '#22C55E' : status === 'in_queue' ? '#6C63FF' : '#F5C518'
    };

    let projects = state.widgets.projects || [];
    const existingIdx = projects.findIndex(p => p.id === id);
    if (existingIdx >= 0) {
      projects[existingIdx] = projData;
      showToast(`Updated "${name}"!`, 'saved-toast');
    } else {
      projects.unshift(projData);
      showToast(`Created "${name}"! 🚀`, 'saved-toast');
    }

    state.widgets.projects = projects;
    projectModal.style.display = 'none';
    saveToStorage();
    renderProjectsWidget();

    try {
      await fetch(API_WIDGETS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projects: state.widgets.projects }),
      });
    } catch (e) {}
  });
}

// ========================= MONTHLY GYM CALENDAR TRACKER =========================

function renderMonthlyGymCalendar() {
  const current = state.currentMonthDate;
  const year = current.getFullYear();
  const month = current.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  gymMonthHeading.textContent = `${monthNames[month]} ${year}`;

  const firstDay = new Date(year, month, 1);
  const totalDays = new Date(year, month + 1, 0).getDate();
  let firstDayOfWeek = (firstDay.getDay() + 6) % 7;

  const visitsSet = new Set(state.widgets?.gym?.visits || []);
  const sessions = state.widgets?.gym?.sessions || [];
  const goal = state.widgets?.gym?.goal_per_month || 20;

  gymMonthGrid.innerHTML = '';
  let monthCompletedCount = 0;
  const todayStr = toLocalDateString(new Date());

  for (let i = 0; i < firstDayOfWeek; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.className = 'gym-month-cell empty';
    gymMonthGrid.appendChild(emptyCell);
  }

  for (let dayNum = 1; dayNum <= totalDays; dayNum++) {
    const dateObj = new Date(year, month, dayNum);
    const dateStr = toLocalDateString(dateObj);
    const isVisited = visitsSet.has(dateStr);
    const isToday = dateStr === todayStr;

    if (isVisited) monthCompletedCount++;

    const cell = document.createElement('div');
    cell.className = `gym-month-cell${isVisited ? ' visited' : ''}${isToday ? ' today' : ''}`;
    
    const sessionForDay = sessions.find(s => s.date === dateStr);
    const tooltip = sessionForDay
      ? `${sessionForDay.enter_time || ''} – ${sessionForDay.exit_time || 'Present'} (${sessionForDay.duration || ''})`
      : isVisited ? 'Gym Workout Logged ✓' : 'No workout logged';

    cell.setAttribute('title', `${monthNames[month]} ${dayNum}, ${year}: ${tooltip}`);

    cell.innerHTML = `
      <span class="gym-month-date-num">${dayNum}</span>
      <div class="gym-month-dot"></div>
    `;

    gymMonthGrid.appendChild(cell);
  }

  const gymName = state.widgets?.gym?.geofence?.name || "Bestrong Gym";
  if (btnGeofenceCfg) {
    btnGeofenceCfg.textContent = `📍 ${gymName}`;
  }

  const pct = Math.min(100, Math.round((monthCompletedCount / goal) * 100));
  gymProgressBar.style.width = `${pct}%`;
  gymSummaryText.textContent = `${monthCompletedCount} of ${goal} monthly days completed (${pct}%)`;
  statGymGoal.textContent = `${monthCompletedCount}/${goal}`;
  if (gymStreakCount) gymStreakCount.textContent = state.widgets?.gym?.streak_weeks || 3;

  const sessionSourceTag = document.querySelector('.session-source-tag');
  const sessionStatusDot = document.querySelector('.live-dot-green');
  const latestTrigger = (state.widgets?.gym?.triggers || [])[0];
  const latestSession = sessions[0];

  if (latestTrigger) {
    const isToday = latestTrigger.date === todayStr;
    const dayLabel = isToday ? 'Today' : (latestTrigger.date || 'Recent');
    const timeStr = latestTrigger.time || (latestTrigger.display_time?.includes('·') ? latestTrigger.display_time.split('·')[1].trim() : '') || 'Recently';

    if (latestTrigger.event === 'enter') {
      sessionStatusTxt.textContent = `Latest: Entered ${dayLabel} at ${timeStr} · In Progress`;
      if (sessionStatusDot) {
        sessionStatusDot.style.background = 'var(--clr-green)';
        sessionStatusDot.style.boxShadow = '0 0 8px var(--clr-green)';
      }
    } else {
      sessionStatusTxt.textContent = `Latest: Exited ${dayLabel} at ${timeStr} · Completed`;
      if (sessionStatusDot) {
        sessionStatusDot.style.background = 'var(--clr-gold)';
        sessionStatusDot.style.boxShadow = '0 0 8px var(--clr-gold)';
      }
    }
  } else if (latestSession) {
    const isToday = latestSession.date === todayStr;
    const dayLabel = isToday ? 'Today' : (latestSession.date || 'Recent');

    if (latestSession.status === 'in_progress' || !latestSession.exit_time || latestSession.exit_time === 'In progress...' || latestSession.exit_time === 'In Progress') {
      sessionStatusTxt.textContent = `Latest: Entered ${dayLabel} at ${latestSession.enter_time || ''} · In Progress`;
      if (sessionStatusDot) {
        sessionStatusDot.style.background = 'var(--clr-green)';
        sessionStatusDot.style.boxShadow = '0 0 8px var(--clr-green)';
      }
    } else {
      sessionStatusTxt.textContent = `Latest: Exited ${dayLabel} at ${latestSession.exit_time} (${latestSession.enter_time || ''} – ${latestSession.exit_time}${latestSession.duration ? ` · ${latestSession.duration}` : ''})`;
      if (sessionStatusDot) {
        sessionStatusDot.style.background = 'var(--clr-gold)';
        sessionStatusDot.style.boxShadow = '0 0 8px var(--clr-gold)';
      }
    }
  } else {
    sessionStatusTxt.textContent = 'Auto-tracking active · Waiting for phone geofence';
  }

  if (sessionSourceTag) {
    sessionSourceTag.textContent = `📍 ${state.widgets?.gym?.geofence?.name || 'Bestrong Geofence'}`;
  }
}

async function toggleGymDate(dateStr) {
  const visitsSet = new Set(state.widgets?.gym?.visits || []);
  if (visitsSet.has(dateStr)) {
    visitsSet.delete(dateStr);
    showToast(`Removed gym log for ${dateStr}`);
  } else {
    visitsSet.add(dateStr);
    showToast(`Logged gym workout for ${dateStr}! 💪`, 'saved-toast');
  }

  state.widgets.gym.visits = [...visitsSet];
  renderMonthlyGymCalendar();
  saveToStorage();

  try {
    await fetch(API_WIDGETS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gym: state.widgets.gym }),
    });
  } catch (e) {
    console.warn('Could not sync gym data to server:', e);
  }
}

function initMonthlyCalendarNav() {
  btnPrevMonth.addEventListener('click', () => {
    state.currentMonthDate = new Date(
      state.currentMonthDate.getFullYear(),
      state.currentMonthDate.getMonth() - 1,
      1
    );
    renderMonthlyGymCalendar();
  });

  btnNextMonth.addEventListener('click', () => {
    state.currentMonthDate = new Date(
      state.currentMonthDate.getFullYear(),
      state.currentMonthDate.getMonth() + 1,
      1
    );
    renderMonthlyGymCalendar();
  });
}

function renderGeofenceModal() {
  const gym = state.widgets?.gym || {};
  const gymName = gym.geofence?.name || "Bestrong Gym";
  const goal = gym.goal_per_month || 20;

  if (geoInputName) geoInputName.value = gymName;
  if (geoInputGoal) geoInputGoal.value = goal;

  const modalTitle = document.getElementById('geofence-modal-title');
  if (modalTitle) {
    modalTitle.textContent = `📍 ${gymName} Settings`;
  }

  if (btnGeofenceCfg) {
    btnGeofenceCfg.textContent = `📍 ${gymName}`;
  }

  const triggersListEl = document.getElementById('geo-triggers-list');
  const triggersCountEl = document.getElementById('geo-triggers-count');
  if (!triggersListEl) return;

  // 1. Gather all explicit triggers
  let allTriggers = Array.isArray(gym.triggers) ? [...gym.triggers] : [];

  // 2. Also extract exit and enter events from session logs
  if (Array.isArray(gym.sessions)) {
    gym.sessions.forEach((sess, sIdx) => {
      // Exit trigger if session has exit time
      if (sess.exit_time && sess.exit_time !== 'null' && sess.exit_time !== 'In progress...' && sess.exit_time !== 'In Progress') {
        const exitTimeStr = sess.exit_time;
        const exists = allTriggers.some(t => t.event === 'exit' && (t.time === exitTimeStr || t.display_time?.includes(exitTimeStr)));
        if (!exists) {
          allTriggers.push({
            id: `sess_exit_${sess.id || sIdx}`,
            event: 'exit',
            date: sess.date,
            time: exitTimeStr,
            display_time: `${sess.date} · ${exitTimeStr}`,
            detected_by: sess.detected_by || 'Bestrong Geofence (Automatic)'
          });
        }
      }
      // Enter trigger if session has enter time
      if (sess.enter_time && sess.enter_time !== 'Auto-detected') {
        const enterTimeStr = sess.enter_time;
        const exists = allTriggers.some(t => t.event === 'enter' && (t.time === enterTimeStr || t.display_time?.includes(enterTimeStr)));
        if (!exists) {
          allTriggers.push({
            id: `sess_enter_${sess.id || sIdx}`,
            event: 'enter',
            date: sess.date,
            time: enterTimeStr,
            display_time: `${sess.date} · ${enterTimeStr}`,
            detected_by: sess.detected_by || 'Bestrong Geofence (Automatic)'
          });
        }
      }
    });
  }

  // Helper to parse timestamp or date + time for sorting
  const parseTriggerTime = (t) => {
    if (t.timestamp) {
      const ts = new Date(t.timestamp).getTime();
      if (!isNaN(ts)) return ts;
    }
    if (t.date && t.time) {
      const d = new Date(`${t.date} ${t.time}`);
      if (!isNaN(d.getTime())) return d.getTime();
    }
    return 0;
  };

  // Sort newest first
  allTriggers.sort((a, b) => parseTriggerTime(b) - parseTriggerTime(a));

  // Take the most recent 5 triggers
  const last5 = allTriggers.slice(0, 5);

  if (triggersCountEl) {
    triggersCountEl.textContent = last5.length > 0 ? `${last5.length} Recent Logged` : 'Live Log';
  }

  if (last5.length === 0) {
    triggersListEl.innerHTML = `
      <div class="geo-triggers-empty">
        <span>📡 No mobile triggers logged yet.</span><br>
        <span style="font-size:0.72rem;opacity:0.75;">When MacroDroid triggers an entry or exit webhook, the last 5 trigger timings will appear here automatically.</span>
      </div>
    `;
    return;
  }

  triggersListEl.innerHTML = last5.map(trig => {
    const isEnter = trig.event === 'enter';
    const badgeCls = isEnter ? 'enter' : 'exit';
    const badgeText = isEnter ? '🟢 ENTER' : '🔴 EXIT';
    const timeDisplay = trig.display_time || (trig.time ? `${trig.date || 'Today'} · ${trig.time}` : (trig.timestamp ? new Date(trig.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Logged'));
    const sourceDisplay = trig.detected_by || 'Bestrong Geofence (Automatic)';

    return `
      <div class="geo-trigger-row">
        <div class="geo-trigger-left">
          <span class="geo-trigger-badge ${badgeCls}">${badgeText}</span>
          <span class="geo-trigger-time">${timeDisplay}</span>
        </div>
        <span class="geo-trigger-source" title="${sourceDisplay}">${sourceDisplay}</span>
      </div>
    `;
  }).join('');
}

// ========================= ARTICLES & NEWSLETTER SECTION =========================

function createArticleCard(article, idx) {
  const el = document.createElement('article');
  el.className = `article-card${article.is_new ? ' is-new' : ''}`;
  el.setAttribute('role', 'listitem');
  el.setAttribute('aria-label', article.title);
  el.style.animationDelay = `${Math.min(idx * 35, 350)}ms`;

  const color = article.source_color ?? '#6C63FF';
  const colorBg = `${color}18`;
  const authorsText = article.authors?.length
    ? `By ${article.authors.slice(0, 2).join(', ')}`
    : '';

  el.innerHTML = `
    <div class="card__img-wrap">
      ${article.image_url
        ? `<img class="card__img" src="${escHtml(article.image_url)}" alt="" loading="lazy" data-fallback="true" />`
        : `<div class="card__img-placeholder">${imgPlaceholderSVG()}</div>`
      }
      ${article.is_new ? `
        <div class="card__new-badge">
          <span class="new-dot" aria-hidden="true"></span>NEW
        </div>` : ''}
    </div>
    <div class="card__body">
      <div class="card__meta">
        <span class="card__badge" style="color:${color};background:${colorBg};border-color:${color}33;">
          ${escHtml(article.source_label)}
        </span>
        <span class="card__date">${formatDate(article.published_at)}</span>
      </div>
      <h2 class="card__title">${escHtml(article.title)}</h2>
      ${article.description ? `<p class="card__desc">${escHtml(article.description)}</p>` : ''}
      <div class="card__footer">
        <span class="card__author">${escHtml(authorsText)}</span>
        <div class="card__actions">
          <button class="card-btn card-btn--save${article.is_saved ? ' saved' : ''}"
                  data-id="${article.id}"
                  aria-label="${article.is_saved ? 'Unsave' : 'Save'}"
                  title="${article.is_saved ? 'Remove from saved' : 'Save article'}">
            ${bookmarkSVG(article.is_saved)}
          </button>
          <a class="card-btn card-btn--read"
             href="${escHtml(article.url)}"
             target="_blank"
             rel="noopener noreferrer"
             aria-label="Read full article"
             title="Read article">
            ${externalLinkSVG()}
          </a>
        </div>
      </div>
    </div>
  `;

  el.addEventListener('click', (e) => {
    if (e.target.closest('.card-btn--save') || e.target.closest('.card-btn--read')) return;
    window.open(article.url, '_blank', 'noopener,noreferrer');
  });

  el.querySelector('.card-btn--save').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleSave(article.id, el.querySelector('.card-btn--save'));
  });

  return el;
}

function getFilteredArticles() {
  const f = state.filter;
  return state.articles.filter(a => {
    if (f === 'all')    return true;
    if (f === 'saved')  return state.savedIds.has(a.id);
    return a.source === f;
  });
}

function renderArticles() {
  hideSkeletons();
  articlesGrid.innerHTML = '';

  const filtered = getFilteredArticles();

  if (filtered.length === 0) {
    emptyState.style.display = 'flex';
    articlesGrid.style.display = 'none';
    if (state.filter === 'saved') {
      emptyTitle.textContent = 'No saved articles';
      emptyDesc.textContent  = 'Tap the bookmark on any article to save it.';
    } else if (state.articles.length === 0) {
      emptyTitle.textContent = 'No articles yet';
      emptyDesc.textContent  = 'Run npm run scrape to fetch the latest AI news.';
    } else {
      emptyTitle.textContent = 'Nothing here';
      emptyDesc.textContent  = 'Try a different filter.';
    }
    return;
  }

  emptyState.style.display = 'none';
  articlesGrid.style.display = 'grid';

  filtered.forEach((article, idx) => {
    articlesGrid.appendChild(createArticleCard(
      { ...article, is_saved: state.savedIds.has(article.id) },
      idx
    ));
  });
}

function updateCountsAndBadges() {
  statTotal.textContent = state.articles.length;
  statSaved.textContent = state.savedIds.size;
  tabSavedCount.textContent = state.savedIds.size;

  lastUpdated.textContent = formatTimestamp(state.lastFetched);

  const filterLabels = {
    all:            'All Intelligence',
    the_rundown_ai: 'The AI Rundown',
    bens_bites:     "Ben's Bites",
    saved:          'Saved Articles',
  };
  sectionTitle.textContent = filterLabels[state.filter] ?? 'Articles';

  tabs.forEach(tab => {
    const active = tab.dataset.filter === state.filter;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-pressed', active);
  });
}

function showSourceErrors(sources) {
  if (!sources) return;
  const tags = Object.entries(sources)
    .filter(([, v]) => v.status === 'error')
    .map(([key, v]) => `<span class="source-error-tag" title="${escHtml(v.error_message ?? '')}">⚠ ${key === 'the_rundown_ai' ? 'The AI Rundown' : "Ben's Bites"} unavailable</span>`);
  if (tags.length) {
    sourceErrors.innerHTML = tags.join('');
    sourceErrors.style.display = 'flex';
  } else {
    sourceErrors.style.display = 'none';
  }
}

// ========================= ACTIONS =========================

function toggleSave(id, btn) {
  if (state.savedIds.has(id)) {
    state.savedIds.delete(id);
    btn.classList.remove('saved');
    btn.innerHTML = bookmarkSVG(false);
    btn.title = 'Save article';
    btn.setAttribute('aria-label', 'Save');
    showToast('Removed from saved');
  } else {
    state.savedIds.add(id);
    btn.classList.add('saved');
    btn.innerHTML = bookmarkSVG(true);
    btn.title = 'Remove from saved';
    btn.setAttribute('aria-label', 'Unsave');
    showToast('✓ Saved!', 'saved-toast');
  }
  statSaved.textContent = state.savedIds.size;
  tabSavedCount.textContent = state.savedIds.size;
  saveToStorage();
  if (state.filter === 'saved') setTimeout(renderArticles, 200);
}

function setFilter(filter) {
  state.filter = filter;
  updateCountsAndBadges();
  renderArticles();
  saveToStorage();
}

async function doRefresh() {
  if (state.isRefreshing) return;
  state.isRefreshing = true;
  refreshBtn.classList.add('loading');
  refreshLabel.textContent = 'Fetching…';
  setStatus('loading', 'Refreshing…');

  try {
    await fetch(API_REFRESH, { method: 'POST' });
    await loadAllData();
    showToast('✓ Everything updated!', 'saved-toast');
  } catch (e) {
    showToast('Refresh failed. Is server running?');
    setStatus('error', 'Error');
  } finally {
    state.isRefreshing = false;
    refreshBtn.classList.remove('loading');
    refreshLabel.textContent = 'Refresh';
  }
}

// ========================= DATA FETCH =========================

async function loadAllData() {
  setStatus('loading', 'Syncing…');

  // 1. Fetch Articles
  try {
    const r = await fetch(API_ARTICLES);
    if (r.ok) {
      const data = await r.json();
      state.articles = mergeSaved(data.articles ?? []);
      state.lastFetched = data.last_fetched ?? new Date().toISOString();
      showSourceErrors(data.sources);
      errorBar.style.display = 'none';
      setStatus('ok', 'Live');
    }
  } catch (e) {
    console.warn('Article fetch failed:', e);
    const cached = loadFromStorage();
    if (cached.length > 0) {
      state.articles = mergeSaved(cached);
      setStatus('error', 'Offline – cached');
    } else {
      errorBar.style.display = 'flex';
      setStatus('error', 'Offline');
    }
  }

  // 2. Fetch Widgets Data
  try {
    const rw = await fetch(API_WIDGETS);
    if (rw.ok) {
      const wData = await rw.json();
      state.widgets = { ...state.widgets, ...wData };
    }
  } catch (e) {
    console.warn('Widgets fetch failed:', e);
  }

  saveToStorage();
  updateCountsAndBadges();
  renderMonthlyGymCalendar();
  renderProjectsWidget();
  renderArticles();
}

// ========================= INIT =========================

function init() {
  setGreeting();
  initTheme();
  initMonthlyCalendarNav();
  initProjectEvents();

  const cached = loadFromStorage();
  if (cached.length > 0) {
    state.articles = mergeSaved(cached);
  }
  setFilter(state.filter);
  renderMonthlyGymCalendar();
  renderProjectsWidget();

  // Tab filter clicks
  tabs.forEach(tab => {
    tab.addEventListener('click', () => setFilter(tab.dataset.filter));
  });

  // Geofence Modal
  btnGeofenceCfg.addEventListener('click', () => {
    renderGeofenceModal();
    geofenceModal.style.display = 'flex';
  });
  geofenceCloseBtn.addEventListener('click', () => {
    geofenceModal.style.display = 'none';
  });
  geofenceDoneBtn.addEventListener('click', () => {
    geofenceModal.style.display = 'none';
  });
  btnSaveGeofence.addEventListener('click', async () => {
    state.widgets.gym = state.widgets.gym || {};
    state.widgets.gym.geofence = state.widgets.gym.geofence || {};
    state.widgets.gym.geofence.name = (geoInputName.value || "Bestrong Gym").trim();
    state.widgets.gym.goal_per_month = parseInt(geoInputGoal.value) || 20;
    saveToStorage();
    renderMonthlyGymCalendar();
    renderGeofenceModal();
    showToast('📍 Geofence settings saved!', 'saved-toast');
    try {
      await fetch(API_WIDGETS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gym: state.widgets.gym }),
      });
    } catch (e) {}
  });

  // Webhook Modal Open/Close
  btnProjectManage.addEventListener('click', () => {
    modalBackdrop.style.display = 'flex';
  });
  modalCloseBtn.addEventListener('click', () => {
    modalBackdrop.style.display = 'none';
  });
  modalDoneBtn.addEventListener('click', () => {
    modalBackdrop.style.display = 'none';
  });
  modalBackdrop.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) modalBackdrop.style.display = 'none';
  });

  // Refresh
  refreshBtn.addEventListener('click', doRefresh);

  // Error bar close
  errorClose.addEventListener('click', () => { errorBar.style.display = 'none'; });

  // Delegated image fallback
  document.addEventListener('error', (e) => {
    if (e.target.tagName === 'IMG' && e.target.dataset.fallback) {
      const wrap = e.target.closest('.card__img-wrap');
      if (wrap) {
        wrap.innerHTML = `<div class="card__img-placeholder">${imgPlaceholderSVG()}</div>`;
      }
    }
  }, true);

  // AI Chatbot & Webhook Modal
  initAiChatbot();
  initVoiceRecognition();
  initWebhookModal();

  loadAllData();
}

// ============================================================
// BHONDU AI COMPANION & AUTOMATION ENGINE
// ============================================================

function generateSmartSessionTitle(messages) {
  if (!messages || !Array.isArray(messages) || messages.length === 0) return 'New Conversation';
  
  const userMsg = messages.find(m => m.sender === 'user');
  if (!userMsg || !userMsg.text) return 'New Conversation';

  const text = userMsg.text.trim();
  const lower = text.toLowerCase();

  // Keyword-based personalized smart naming
  if (lower.includes('news') || lower.includes('article') || lower.includes('digest') || lower.includes('summarize')) {
    return '📰 AI News & Summary';
  }
  if (lower.includes('gym') || lower.includes('workout') || lower.includes('streak') || lower.includes('fitness') || lower.includes('exercise')) {
    return '🏋️ Gym Streak & Fitness';
  }
  if (lower.includes('tweet') || lower.includes('twitter') || lower.includes('buffer') || lower.includes('post') || lower.includes('social')) {
    return '🐦 Tweet & Social Dispatch';
  }
  if (lower.includes('focus') || lower.includes('priorit') || lower.includes('next') || lower.includes('todo') || lower.includes('work on') || lower.includes('recommend')) {
    return '💡 Focus & Task Priorities';
  }
  if (lower.includes('project') || lower.includes('pipeline') || lower.includes('app') || lower.includes('build')) {
    const match = text.match(/(?:named|called|project)\s+["']?([^"',.]+?)["']?(?:\s+(?:in|into|to)|$)/i);
    if (match && match[1]) {
      const projName = match[1].trim();
      return `💼 ${projName.length > 20 ? projName.slice(0, 18) + '…' : projName}`;
    }
    return '💼 Project Planning';
  }

  // Clean prompt-based title
  let cleaned = text
    .replace(/^(hey|hi|hello|please|can you|bhondu|assist me with|tell me)\s+/i, '')
    .replace(/[?.!,;:]+$/, '')
    .trim();

  if (!cleaned) cleaned = text;

  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return cleaned.length > 26 ? cleaned.slice(0, 24) + '…' : cleaned;
}

function createWelcomeMessage() {
  return {
    id: 'welcome_' + Date.now(),
    sender: 'bot',
    text: "👋 Hey there! I'm **Bhondu**, your personal AI assistant.\n\nI can help you manage your projects pipeline, log your workouts, summarize live AI news, or dispatch tweets to your Make.com / Buffer webhook. What would you like to do?",
    options: [
      { label: "📰 Summarize AI News", prompt: "Summarize the latest AI news for me" },
      { label: "💡 Focus Next", prompt: "What should I work on next?" },
      { label: "🏋️ Gym Streak", prompt: "How is my gym streak and progress this month?" },
      { label: "➕ Add Project", prompt: "Add a new project named Mobile App into Work in Progress" },
      { label: "🐦 Tweet via Buffer", prompt: "Tweet: My personal AI dashboard & intelligence hub is live! 🚀" }
    ],
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };
}

function createNewSessionObject() {
  const newId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  return {
    id: newId,
    title: 'New Conversation',
    createdAt: new Date().toISOString(),
    messages: [createWelcomeMessage()]
  };
}

function createNewSession(forcePrimary = false) {
  const primaryHasUserInput = (state.aiBot.messages || []).some(m => m.sender === 'user');

  // If the primary chat has NO user input yet, don't spawn a new one! Keep the current one.
  if (!primaryHasUserInput && !forcePrimary) {
    toggleHistoryPanel(false);
    if (aiChatInput) aiChatInput.focus();
    showToast('Already in a fresh chat session!');
    return (state.aiBot.sessions && state.aiBot.sessions[0]) || null;
  }

  // If primary HAS user input, open second floater side-by-side!
  if (primaryHasUserInput && !state.aiBot.isOpen2 && !forcePrimary) {
    return openSecondaryChatFloater();
  }

  // Otherwise create/replace primary session
  const session = createNewSessionObject();
  if (!state.aiBot.sessions) state.aiBot.sessions = [];
  state.aiBot.sessions.unshift(session);
  state.aiBot.activeSessionId = session.id;
  state.aiBot.messages = session.messages;
  saveToStorage();
  renderAiChatMessages();
  renderHistoryPanel();
  toggleHistoryPanel(false);
  showToast('Started new chat with Bhondu ✨', 'saved-toast');
  return session;
}

function openSecondaryChatFloater(sessionId = null) {
  if (!aiChatDrawer2) return;
  let session = null;

  if (sessionId) {
    session = (state.aiBot.sessions || []).find(s => s.id === sessionId);
  }

  if (!session) {
    session = createNewSessionObject();
    session.title = 'Side Chat';
    if (!state.aiBot.sessions) state.aiBot.sessions = [];
    state.aiBot.sessions.push(session);
  }

  state.aiBot.activeSessionId2 = session.id;
  state.aiBot.messages2 = session.messages || [createWelcomeMessage()];
  state.aiBot.isOpen2 = true;
  aiChatDrawer2.style.display = 'flex';
  if (aiChatTitle2) aiChatTitle2.textContent = `Bhondu · ${session.title.slice(0, 18)}`;

  saveToStorage();
  renderAiChatMessages2();
  toggleHistoryPanel(false);
  setTimeout(() => { if (aiChatInput2) aiChatInput2.focus(); }, 150);
  showToast('Opened second floater chat side-by-side! 💬💬', 'saved-toast');
  return session;
}

function closeSecondaryChatFloater() {
  if (!aiChatDrawer2) return;
  state.aiBot.isOpen2 = false;
  aiChatDrawer2.style.display = 'none';
}

function renderAiChatMessages2() {
  if (!aiChatMessages2) return;
  aiChatMessages2.innerHTML = '';

  (state.aiBot.messages2 || []).forEach(msg => {
    const msgEl = document.createElement('div');
    msgEl.className = `ai-msg ${msg.sender}`;

    let actionCardHtml = '';
    if (msg.actionCard) {
      const isWh = msg.actionCard.type === 'webhook';
      actionCardHtml = `
        <div class="ai-action-card${isWh ? ' webhook' : ''}">
          <span class="ai-action-badge">${msg.actionCard.badge || '✓ Action Completed'}</span>
          <span style="font-weight:700;">${escHtml(msg.actionCard.title || '')}</span>
          <span style="font-size:0.72rem;color:var(--clr-ink-3);">${escHtml(msg.actionCard.desc || '')}</span>
        </div>
      `;
    }

    let optionsHtml = '';
    if (msg.options && Array.isArray(msg.options) && msg.options.length > 0) {
      optionsHtml = `
        <div class="ai-welcome-options">
          ${msg.options.map(opt => `<button type="button" class="ai-option-btn secondary" data-prompt="${escHtml(opt.prompt)}">${escHtml(opt.label)}</button>`).join('')}
        </div>
      `;
    }

    msgEl.innerHTML = `
      <div class="ai-bubble">
        ${formatAiMessageText(msg.text)}
        ${optionsHtml}
        ${actionCardHtml}
      </div>
      <span class="ai-msg-time">${msg.time || ''}</span>
    `;

    aiChatMessages2.appendChild(msgEl);
  });

  aiChatMessages2.scrollTop = aiChatMessages2.scrollHeight;
}

function addAiMessage2(sender, text, actionCard = null) {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const newMsg = {
    id: `msg2_${Date.now()}_${Math.random()}`,
    sender,
    text,
    time,
    actionCard
  };
  if (!state.aiBot.messages2) state.aiBot.messages2 = [];
  state.aiBot.messages2.push(newMsg);

  if (state.aiBot.activeSessionId2) {
    const sess = (state.aiBot.sessions || []).find(s => s.id === state.aiBot.activeSessionId2);
    if (sess) {
      sess.messages = state.aiBot.messages2;
      const smart = generateSmartSessionTitle(sess.messages);
      if (smart && smart !== 'New Conversation') {
        sess.title = smart;
        if (aiChatTitle2) aiChatTitle2.textContent = `Bhondu · ${sess.title}`;
      }
    }
  }

  saveToStorage();
  renderAiChatMessages2();
}

function showAiTypingIndicator2() {
  if (!aiChatMessages2) return;
  const existing = document.getElementById('ai-typing-indicator-2');
  if (existing) existing.remove();

  const typingEl = document.createElement('div');
  typingEl.className = 'ai-msg bot typing';
  typingEl.id = 'ai-typing-indicator-2';
  typingEl.innerHTML = `
    <div class="ai-bubble">
      <div class="typing-indicator-dots">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
  aiChatMessages2.appendChild(typingEl);
  aiChatMessages2.scrollTop = aiChatMessages2.scrollHeight;
}

function removeAiTypingIndicator2() {
  const el = document.getElementById('ai-typing-indicator-2');
  if (el) el.remove();
}

async function processAiUserCommand2(rawInput) {
  const input = rawInput.trim();
  if (!input) return;

  addAiMessage2('user', input);
  showAiTypingIndicator2();

  const context = {
    projects: state.widgets.projects,
    gym: state.widgets.gym,
    articles: (state.articles || []).slice(0, 6).map(a => ({
      title: a.title,
      source: a.source,
      summary: a.summary
    })),
    time: new Date().toISOString()
  };

  try {
    const res = await fetch(API_BOT_CHAT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: input,
        history: (state.aiBot.messages2 || []).slice(-6),
        context: context
      })
    });

    const data = await res.json();
    removeAiTypingIndicator2();

    if (!res.ok || !data.reply) {
      throw new Error(data.error || 'Chat engine did not return a valid response.');
    }

    let actionCard = null;
    if (data.action) {
      const act = data.action;
      if (act.type === 'add_project' && act.data) {
        const newProj = {
          id: `p_${Date.now()}`,
          name: act.data.name,
          category: act.data.category || 'AI Pipeline',
          progress: act.data.progress ?? (act.data.status === 'finished' ? 100 : (act.data.status === 'in_queue' ? 0 : 50)),
          color: act.data.color || (act.data.status === 'finished' ? '#22C55E' : (act.data.status === 'in_queue' ? '#6C63FF' : '#F5C518')),
          status: act.data.status || 'in_progress',
          tasks: '1/4 tasks',
          due: 'End of Month'
        };
        state.widgets.projects.unshift(newProj);
        saveToStorage();
        renderProjectsWidget();
        showToast(`AI added project "${newProj.name}"! 🚀`, 'saved-toast');
        actionCard = { type: 'project', badge: '✓ Project Added', title: newProj.name, desc: `Status: ${newProj.status.replace('_', ' ')}` };
      } else if (act.type === 'log_gym') {
        const today = toLocalDateString(new Date());
        if (!state.widgets.gym.visits.includes(today)) {
          state.widgets.gym.visits.push(today);
          saveToStorage();
          renderMonthlyGymCalendar();
          showToast('🏋️ Logged workout session!', 'saved-toast');
          actionCard = { type: 'gym', badge: '✓ Workout Recorded', title: 'Gym Session Logged', desc: `Total: ${state.widgets.gym.visits.length} days` };
        }
      } else if (act.type === 'tweet' && act.data?.text) {
        try {
          const whRes = await fetch(API_BOT_DISPATCH, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'tweet', text: act.data.text, webhook_url: state.aiBot.webhookUrl || undefined })
          });
          const whData = await whRes.json();
          if (whData.success) {
            actionCard = { type: 'webhook', badge: '✓ Dispatched', title: 'Tweet Broadcast Published', desc: 'Dispatched to Make.com / Buffer' };
            showToast('🐦 Tweet dispatched via Webhook!', 'saved-toast');
          }
        } catch (e) {}
      }
    }

    addAiMessage2('bot', data.reply, actionCard);
  } catch (err) {
    removeAiTypingIndicator2();
    console.error('[Bhondu Chatbot 2 Error]:', err);
    addAiMessage2('bot', `I encountered an issue connecting to the chat engine: ${err.message}. Please try again.`);
  }
}

function switchSession(sessionId) {
  const session = (state.aiBot.sessions || []).find(s => s.id === sessionId);
  if (session) {
    state.aiBot.activeSessionId = session.id;
    state.aiBot.messages = session.messages || [];
    saveToStorage();
    renderAiChatMessages();
    toggleHistoryPanel(false);
  }
}

function deleteSession(sessionId, e) {
  if (e) e.stopPropagation();
  state.aiBot.sessions = (state.aiBot.sessions || []).filter(s => s.id !== sessionId);

  if (state.aiBot.sessions.length === 0) {
    // If all deleted, start fresh session and redirect to new chat area
    createNewSession(true);
    toggleHistoryPanel(false);
    showToast('All conversations deleted. Started a fresh chat ✨', 'saved-toast');
  } else {
    // Stay on history panel!
    if (state.aiBot.activeSessionId === sessionId) {
      state.aiBot.activeSessionId = state.aiBot.sessions[0].id;
      state.aiBot.messages = state.aiBot.sessions[0].messages || [];
      renderAiChatMessages();
    }
    saveToStorage();
    renderHistoryPanel();
    toggleHistoryPanel(true); // Stay on history overlay
    showToast('Conversation deleted');
  }
}

function renderHistoryPanel() {
  if (!aiHistoryList) return;
  aiHistoryList.innerHTML = '';

  const sessions = state.aiBot.sessions || [];
  if (sessions.length === 0) {
    aiHistoryList.innerHTML = `<div class="ai-history-empty">No previous conversations yet.</div>`;
    return;
  }

  sessions.forEach(sess => {
    // Ensure personalized title
    if (!sess.title || sess.title === 'New Conversation' || sess.title === 'New Chat' || sess.title === 'Side Chat') {
      const smart = generateSmartSessionTitle(sess.messages);
      if (smart && smart !== 'New Conversation') {
        sess.title = smart;
      }
    }

    const isActive = sess.id === state.aiBot.activeSessionId;
    const itemEl = document.createElement('div');
    itemEl.className = `ai-history-item${isActive ? ' active' : ''}`;
    
    const dateFormatted = formatDate(sess.createdAt) || 'Recent';
    const msgCount = (sess.messages || []).length;

    itemEl.innerHTML = `
      <div class="ai-history-item-info">
        <span class="ai-history-item-title">${escHtml(sess.title || 'Conversation')}</span>
        <span class="ai-history-item-meta">${dateFormatted} · ${msgCount} messages</span>
      </div>
      <button type="button" class="ai-history-delete-btn" title="Delete chat" data-id="${sess.id}">🗑️</button>
    `;

    itemEl.addEventListener('click', (e) => {
      if (e.target.closest('.ai-history-delete-btn')) return;
      const primaryHasUserInput = (state.aiBot.messages || []).some(m => m.sender === 'user');
      if (state.aiBot.activeSessionId === sess.id) {
        toggleHistoryPanel(false);
        return;
      }
      if (primaryHasUserInput && !state.aiBot.isOpen2) {
        openSecondaryChatFloater(sess.id);
      } else {
        switchSession(sess.id);
      }
    });

    const delBtn = itemEl.querySelector('.ai-history-delete-btn');
    if (delBtn) {
      delBtn.addEventListener('click', (e) => deleteSession(sess.id, e));
    }

    aiHistoryList.appendChild(itemEl);
  });
}

function toggleHistoryPanel(show) {
  if (!aiHistoryPanel) return;
  const isOpen = (show !== undefined) ? show : (aiHistoryPanel.style.display === 'none');
  aiHistoryPanel.style.display = isOpen ? 'flex' : 'none';
  if (isOpen) {
    renderHistoryPanel();
  }
}

function renderAiChatMessages() {
  if (!aiChatMessages) return;
  aiChatMessages.innerHTML = '';

  (state.aiBot.messages || []).forEach(msg => {
    const msgEl = document.createElement('div');
    msgEl.className = `ai-msg ${msg.sender}`;

    let actionCardHtml = '';
    if (msg.actionCard) {
      const isWh = msg.actionCard.type === 'webhook';
      actionCardHtml = `
        <div class="ai-action-card${isWh ? ' webhook' : ''}">
          <span class="ai-action-badge">${msg.actionCard.badge || '✓ Action Completed'}</span>
          <span style="font-weight:700;">${escHtml(msg.actionCard.title || '')}</span>
          <span style="font-size:0.72rem;color:var(--clr-ink-3);">${escHtml(msg.actionCard.desc || '')}</span>
        </div>
      `;
    }

    let optionsHtml = '';
    if (msg.options && Array.isArray(msg.options) && msg.options.length > 0) {
      optionsHtml = `
        <div class="ai-welcome-options">
          ${msg.options.map(opt => `<button type="button" class="ai-option-btn" data-prompt="${escHtml(opt.prompt)}">${escHtml(opt.label)}</button>`).join('')}
        </div>
      `;
    }

    msgEl.innerHTML = `
      <div class="ai-bubble">
        ${formatAiMessageText(msg.text)}
        ${optionsHtml}
        ${actionCardHtml}
      </div>
      <span class="ai-msg-time">${msg.time || ''}</span>
    `;

    aiChatMessages.appendChild(msgEl);
  });

  aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
}

function formatAiMessageText(text) {
  if (!text) return '';
  let formatted = escHtml(text);

  // Bold & Italic
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
  formatted = formatted.replace(/_([^_]+)_/g, '<em>$1</em>');

  // Inline code
  formatted = formatted.replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.12);padding:2px 6px;border-radius:4px;font-size:0.85em;">$1</code>');

  // Blockquotes (e.g. > Quote)
  formatted = formatted.replace(/^>\s*(.+)$/gm, '<blockquote style="border-left:3px solid var(--clr-gold);padding-left:10px;margin:6px 0;color:var(--clr-ink-2);font-style:italic;">$1</blockquote>');

  // Bullet items (e.g. • or - )
  formatted = formatted.replace(/^([•\-\*])\s+(.+)$/gm, '<div style="display:flex;gap:6px;margin:2px 0;"><span style="color:var(--clr-gold);">•</span><span>$2</span></div>');

  // Line breaks
  formatted = formatted.replace(/\n/g, '<br/>');

  return formatted;
}

function addAiMessage(sender, text, actionCard = null) {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const newMsg = {
    id: `msg_${Date.now()}_${Math.random()}`,
    sender,
    text,
    time,
    actionCard
  };
  state.aiBot.messages.push(newMsg);

  if (state.aiBot.activeSessionId) {
    const sess = (state.aiBot.sessions || []).find(s => s.id === state.aiBot.activeSessionId);
    if (sess) {
      sess.messages = state.aiBot.messages;
      const smart = generateSmartSessionTitle(sess.messages);
      if (smart && smart !== 'New Conversation') {
        sess.title = smart;
      }
    }
  }

  saveToStorage();
  renderAiChatMessages();
}

function showAiTypingIndicator() {
  if (!aiChatMessages) return;
  const existing = document.getElementById('ai-typing-indicator');
  if (existing) existing.remove();

  const typingEl = document.createElement('div');
  typingEl.className = 'ai-msg bot typing';
  typingEl.id = 'ai-typing-indicator';
  typingEl.innerHTML = `
    <div class="ai-bubble">
      <div class="typing-indicator-dots">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
  aiChatMessages.appendChild(typingEl);
  aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
}

function removeAiTypingIndicator() {
  const el = document.getElementById('ai-typing-indicator');
  if (el) el.remove();
}

async function processAiUserCommand(rawInput) {
  const input = rawInput.trim();
  if (!input) return;

  // 1. Add user message to UI
  addAiMessage('user', input);

  // 2. Show smooth typing indicator
  showAiTypingIndicator();

  // 3. Build rich context snapshot
  const context = {
    projects: state.widgets.projects,
    gym: state.widgets.gym,
    articles: (state.articles || []).slice(0, 6).map(a => ({
      title: a.title,
      source: a.source,
      summary: a.summary
    })),
    time: new Date().toISOString()
  };

  try {
    const res = await fetch(API_BOT_CHAT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: input,
        history: state.aiBot.messages.slice(-6),
        context: context
      })
    });

    const data = await res.json();
    removeAiTypingIndicator();

    if (!res.ok || !data.reply) {
      throw new Error(data.error || 'Chat engine did not return a valid response.');
    }

    let actionCard = null;

    // 4. Handle any automated workflow actions requested by user
    if (data.action) {
      const act = data.action;

      // ADD PROJECT
      if (act.type === 'add_project' && act.data) {
        const newProj = {
          id: `p_${Date.now()}`,
          name: act.data.name,
          category: act.data.category || 'AI Pipeline',
          progress: act.data.progress ?? (act.data.status === 'finished' ? 100 : (act.data.status === 'in_queue' ? 0 : 50)),
          color: act.data.color || (act.data.status === 'finished' ? '#22C55E' : (act.data.status === 'in_queue' ? '#6C63FF' : '#F5C518')),
          status: act.data.status || 'in_progress',
          tasks: '1/4 tasks',
          due: 'End of Month'
        };
        state.widgets.projects.unshift(newProj);
        saveToStorage();
        renderProjectsWidget();
        showToast(`AI added project "${newProj.name}"! 🚀`, 'saved-toast');

        try {
          await fetch(API_WIDGETS, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projects: state.widgets.projects })
          });
        } catch (e) {}

        actionCard = {
          type: 'project',
          badge: '✓ Project Added',
          title: newProj.name,
          desc: `Status: ${newProj.status.replace('_', ' ')} · Progress: ${newProj.progress}%`
        };
      }

      // MOVE PROJECT STATUS
      else if (act.type === 'move_project' && act.data) {
        const project = state.widgets.projects.find(p => p.id === act.data.id || p.name.toLowerCase() === act.data.name?.toLowerCase());
        if (project) {
          project.status = act.data.status;
          if (act.data.status === 'finished') project.progress = 100;
          if (act.data.status === 'in_queue' && project.progress === 100) project.progress = 0;
          if (act.data.status === 'in_progress' && project.progress === 0) project.progress = 50;

          saveToStorage();
          renderProjectsWidget();
          showToast(`AI moved "${project.name}" to ${project.status.replace('_', ' ')}!`, 'saved-toast');

          try {
            await fetch(API_WIDGETS, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ projects: state.widgets.projects })
            });
          } catch (e) {}

          actionCard = {
            type: 'project',
            badge: '✓ Status Updated',
            title: project.name,
            desc: `Status: ${project.status.replace('_', ' ')} · Progress: ${project.progress}%`
          };
        }
      }

      // DELETE PROJECT
      else if (act.type === 'delete_project' && act.data) {
        state.widgets.projects = state.widgets.projects.filter(p => p.id !== act.data.id && p.name.toLowerCase() !== act.data.name?.toLowerCase());
        saveToStorage();
        renderProjectsWidget();
        showToast(`Deleted "${act.data.name}"`);

        try {
          await fetch(API_WIDGETS, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projects: state.widgets.projects })
          });
        } catch (e) {}
      }

      // LOG GYM
      else if (act.type === 'log_gym') {
        const today = toLocalDateString(new Date());
        if (!state.widgets.gym.visits.includes(today)) {
          state.widgets.gym.visits.push(today);
          saveToStorage();
          renderMonthlyGymCalendar();
          showToast('🏋️ Logged workout session!', 'saved-toast');

          try {
            await fetch(API_WIDGETS, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ gym: state.widgets.gym })
            });
          } catch (e) {}

          actionCard = {
            type: 'gym',
            badge: '✓ Workout Recorded',
            title: 'Gym Session Logged',
            desc: `Total: ${state.widgets.gym.visits.length}/${state.widgets.gym.goal_per_month || 20} days this month`
          };
        }
      }

      // TWEET / BUFFER
      else if (act.type === 'tweet' && act.data?.text) {
        try {
          const whRes = await fetch(API_BOT_DISPATCH, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'tweet',
              text: act.data.text,
              webhook_url: state.aiBot.webhookUrl || undefined
            })
          });
          const whData = await whRes.json();
          if (whData.success) {
            actionCard = {
              type: 'webhook',
              badge: whData.mode === 'simulated' ? '⚡ Webhook Verified' : '✓ Dispatched to Scenario',
              title: 'Tweet Broadcast Published',
              desc: `Dispatched to Make.com / Buffer scenario`
            };
            showToast('🐦 Tweet dispatched via Webhook!', 'saved-toast');
          }
        } catch (e) {}
      }
    }

    addAiMessage('bot', data.reply, actionCard);

  } catch (err) {
    removeAiTypingIndicator();
    console.error('[Bhondu Chatbot Process Error]:', err);
    addAiMessage('bot', `I encountered an issue connecting to the chat engine: ${err.message}. Please try again.`);
  }
}

function initAiChatbot() {
  if (!btnAiChatToggle || !aiChatDrawer) return;

  // Toggle open/close primary
  btnAiChatToggle.addEventListener('click', () => {
    state.aiBot.isOpen = !state.aiBot.isOpen;
    aiChatDrawer.style.display = state.aiBot.isOpen ? 'flex' : 'none';
    if (state.aiBot.isOpen) {
      renderAiChatMessages();
      setTimeout(() => { if (aiChatInput) aiChatInput.focus(); }, 150);
    }
  });

  if (btnCloseAiChat) {
    btnCloseAiChat.addEventListener('click', () => {
      state.aiBot.isOpen = false;
      aiChatDrawer.style.display = 'none';
      toggleHistoryPanel(false);
    });
  }

  // History button toggle
  if (btnAiHistory) {
    btnAiHistory.addEventListener('click', () => {
      toggleHistoryPanel();
    });
  }

  if (btnCloseHistory) {
    btnCloseHistory.addEventListener('click', () => {
      toggleHistoryPanel(false);
    });
  }

  // New Chat buttons
  if (btnAiNewChat) {
    btnAiNewChat.addEventListener('click', () => {
      createNewSession();
    });
  }

  if (btnHistoryNewChat) {
    btnHistoryNewChat.addEventListener('click', () => {
      createNewSession();
    });
  }

  if (btnClearAiChat) {
    btnClearAiChat.addEventListener('click', () => {
      if (state.aiBot.activeSessionId) {
        deleteSession(state.aiBot.activeSessionId);
      } else {
        createNewSession(true);
      }
    });
  }

  // Secondary Floater Controls
  if (btnCloseAiChat2) {
    btnCloseAiChat2.addEventListener('click', () => {
      closeSecondaryChatFloater();
    });
  }

  if (btnClearAiChat2) {
    btnClearAiChat2.addEventListener('click', () => {
      state.aiBot.messages2 = [createWelcomeMessage()];
      if (state.aiBot.activeSessionId2) {
        const s = (state.aiBot.sessions || []).find(sess => sess.id === state.aiBot.activeSessionId2);
        if (s) s.messages = state.aiBot.messages2;
      }
      saveToStorage();
      renderAiChatMessages2();
      showToast('Secondary chat cleared');
    });
  }

  if (aiChatForm2) {
    aiChatForm2.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = aiChatInput2.value.trim();
      if (!text) return;
      aiChatInput2.value = '';
      processAiUserCommand2(text);
    });
  }

  // Message Options buttons click delegation
  if (aiChatMessages) {
    aiChatMessages.addEventListener('click', (e) => {
      const optBtn = e.target.closest('.ai-option-btn');
      if (optBtn) {
        const prompt = optBtn.dataset.prompt;
        if (prompt) {
          processAiUserCommand(prompt);
        }
      }
    });
  }

  if (aiChatMessages2) {
    aiChatMessages2.addEventListener('click', (e) => {
      const optBtn = e.target.closest('.ai-option-btn');
      if (optBtn) {
        const prompt = optBtn.dataset.prompt;
        if (prompt) {
          processAiUserCommand2(prompt);
        }
      }
    });
  }

  // Form submit primary
  if (aiChatForm) {
    aiChatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = aiChatInput.value.trim();
      if (!text) return;
      aiChatInput.value = '';
      processAiUserCommand(text);
    });
  }
}

// ============================================================
// SPEECH-TO-TEXT (WEB SPEECH API VOICE INPUT)
// ============================================================

let speechRecognition = null;
let isVoiceListening = false;
let activeVoiceTarget = 1; // 1 or 2

function initVoiceRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.info('[Speech Recognition]: Web Speech API is not supported in this browser environment.');
    [btnAiVoice, btnAiVoice2].forEach(btn => {
      if (btn) {
        btn.title = 'Voice recognition not supported in this browser';
        btn.style.opacity = '0.5';
        btn.addEventListener('click', () => {
          showToast('Voice input is not supported in this browser environment.');
        });
      }
    });
    return;
  }

  try {
    speechRecognition = new SpeechRecognition();
    speechRecognition.continuous = false;
    speechRecognition.interimResults = true;
    speechRecognition.lang = 'en-US';

    speechRecognition.onstart = () => {
      isVoiceListening = true;
      if (activeVoiceTarget === 1) {
        if (btnAiVoice) btnAiVoice.classList.add('is-listening');
        if (aiVoiceStatus) aiVoiceStatus.style.display = 'flex';
        if (aiChatInput) aiChatInput.placeholder = 'Listening... (Speak your request)';
      } else {
        if (btnAiVoice2) btnAiVoice2.classList.add('is-listening');
        if (aiVoiceStatus2) aiVoiceStatus2.style.display = 'flex';
        if (aiChatInput2) aiChatInput2.placeholder = 'Listening... (Speak your request)';
      }
    };

    speechRecognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const txt = finalTranscript || interimTranscript;
      if (activeVoiceTarget === 1 && aiChatInput) {
        aiChatInput.value = txt;
      } else if (activeVoiceTarget === 2 && aiChatInput2) {
        aiChatInput2.value = txt;
      }
    };

    speechRecognition.onerror = (event) => {
      console.warn('[Speech Recognition Error]:', event.error);
      stopVoiceRecognition();
      if (event.error === 'not-allowed') {
        showToast('Microphone permission denied.');
      } else if (event.error !== 'no-speech') {
        showToast(`Voice notice: ${event.error}`);
      }
    };

    speechRecognition.onend = () => {
      const target = activeVoiceTarget;
      stopVoiceRecognition();
      if (target === 1) {
        const spokenText = aiChatInput ? aiChatInput.value.trim() : '';
        if (spokenText) {
          aiChatInput.value = '';
          processAiUserCommand(spokenText);
        }
      } else {
        const spokenText = aiChatInput2 ? aiChatInput2.value.trim() : '';
        if (spokenText) {
          aiChatInput2.value = '';
          processAiUserCommand2(spokenText);
        }
      }
    };

    if (btnAiVoice) {
      btnAiVoice.addEventListener('click', () => {
        if (isVoiceListening) {
          speechRecognition.stop();
        } else {
          try {
            activeVoiceTarget = 1;
            if (aiChatInput) aiChatInput.value = '';
            speechRecognition.start();
          } catch (e) { console.warn(e); }
        }
      });
    }

    if (btnAiVoice2) {
      btnAiVoice2.addEventListener('click', () => {
        if (isVoiceListening) {
          speechRecognition.stop();
        } else {
          try {
            activeVoiceTarget = 2;
            if (aiChatInput2) aiChatInput2.value = '';
            speechRecognition.start();
          } catch (e) { console.warn(e); }
        }
      });
    }

    if (btnVoiceCancel) {
      btnVoiceCancel.addEventListener('click', () => {
        if (speechRecognition && isVoiceListening) speechRecognition.abort();
        stopVoiceRecognition();
        if (aiChatInput) aiChatInput.value = '';
      });
    }

    if (btnVoiceCancel2) {
      btnVoiceCancel2.addEventListener('click', () => {
        if (speechRecognition && isVoiceListening) speechRecognition.abort();
        stopVoiceRecognition();
        if (aiChatInput2) aiChatInput2.value = '';
      });
    }
  } catch (err) {
    console.warn('[Speech Recognition Init Error]:', err);
  }
}

function stopVoiceRecognition() {
  isVoiceListening = false;
  if (btnAiVoice) btnAiVoice.classList.remove('is-listening');
  if (btnAiVoice2) btnAiVoice2.classList.remove('is-listening');
  if (aiVoiceStatus) aiVoiceStatus.style.display = 'none';
  if (aiVoiceStatus2) aiVoiceStatus2.style.display = 'none';
  if (aiChatInput) {
    aiChatInput.placeholder = "Ask AI or say 'Add project...', 'Tweet...', 'Log gym'...";
  }
  if (aiChatInput2) {
    aiChatInput2.placeholder = "Ask Bhondu in this side window...";
  }
}

function initWebhookModal() {
  if (btnOpenWebhookCfg && webhookModal) {
    btnOpenWebhookCfg.addEventListener('click', () => {
      if (webhookUrlInput) {
        webhookUrlInput.value = state.aiBot.webhookUrl || '';
      }
      webhookModal.style.display = 'flex';
    });
  }

  if (webhookModalClose) {
    webhookModalClose.addEventListener('click', () => { webhookModal.style.display = 'none'; });
  }
  if (btnCancelWebhook) {
    btnCancelWebhook.addEventListener('click', () => { webhookModal.style.display = 'none'; });
  }
  if (webhookModal) {
    webhookModal.addEventListener('click', (e) => {
      if (e.target === webhookModal) webhookModal.style.display = 'none';
    });
  }

  if (btnSaveWebhook) {
    btnSaveWebhook.addEventListener('click', () => {
      const url = webhookUrlInput.value.trim();
      state.aiBot.webhookUrl = url;
      saveToStorage();
      webhookModal.style.display = 'none';
      showToast('⚡ Webhook URL saved!', 'saved-toast');
      addAiMessage('bot', `Make.com / Buffer webhook configured to: \`${url || 'Default'}\``);
    });
  }
}

document.addEventListener('DOMContentLoaded', init);

