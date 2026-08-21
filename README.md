# My Zone — Personal AI Hub & Intelligence Command Center 🚀

A modern, high-performance personal command center featuring **Bhondu AI Companion**, automated fitness tracking, custom project pipeline management, and real-time AI intelligence aggregation from top newsletters.

---

## ✨ Features

- **🤖 Bhondu Personal AI Companion**:
  - Floating AI assistant powered by Google Gemini / OpenAI with built-in zero-dependency natural language intent engine.
  - Multi-action dispatching: auto-add projects, update pipeline statuses, log gym workouts, and summarize live news.
  - **Dual Side-by-Side Floating Chat Windows**: Chat on multiple topics simultaneously.
  - **Speech-to-Text (Voice Input)**: Dictate prompts using the Web Speech API.
  - **Session History & Smart Auto-Naming**: Contextual chat naming and persistent session management.
- **🏋️ Monthly Gym Discipline Tracker**:
  - Automated geofence entry/exit logging via mobile webhook (`/api/gym/location-event`).
  - Interactive monthly calendar with streak badges, completion metrics, and session summaries.
- **💼 Projects & Pipeline Management**:
  - Categorized Kanban/pipeline cards (Work in Progress, In Queue, Finished).
  - Drag-and-drop reordering, progress tracking, and instant filtering.
- **📰 Live AI Intelligence Digest**:
  - Automated scrapers for *The AI Rundown* (RSS) and *Ben's Bites* (Substack).
  - Bookmarking/saving articles, instant search, source filtering, and fast keyword discovery.
- **🐦 Social Media / Make.com Webhook Dispatch**:
  - Post directly to Make.com / Buffer scenarios from the AI chatbot.

---

## 🛠️ Architecture & Tech Stack

- **Backend**: Node.js HTTP Server (`server.js`) with zero heavy framework bloat.
- **Frontend**: Vanilla JavaScript (ES6+), semantic HTML5, and bespoke Glassmorphism CSS design system.
- **Data Persistence**: Local storage and structured JSON files (`.tmp/articles.json`, `dashboard/widgets.json`).
- **AI / LLMs**: Google Gemini 1.5 Flash, OpenAI GPT-4o-mini, and offline rule-based regex fallback engine.

---

## 🚀 Quick Start & Installation

### 1. Clone the Repository
```bash
git clone https://github.com/harzhx/myzone.git
cd myzone
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy the example environment file:
```bash
cp .env.example .env
```
Edit `.env` with your preferred settings and API keys (optional):
```env
PORT=8000
SCRAPE_INTERVAL_HOURS=24

# Make.com / Buffer Webhook URL for Twitter/Social dispatch
MAKE_WEBHOOK_URL=https://hook.eu1.make.com/your-custom-webhook-id

# Optional AI LLM API Keys
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
```

### 4. Run the Dashboard
```bash
npm start
```
Open **`http://localhost:8000`** in your browser.

---

## 📡 API Endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/articles` | `GET` | Retrieve latest aggregated newsletter intelligence |
| `/api/widgets` | `GET` / `POST` | Get or update dashboard widgets (projects, gym data) |
| `/api/gym/location-event` | `POST` | Geofence webhook for auto-logging gym entry/exit |
| `/api/bot/chat` | `POST` | Conversational endpoint for Bhondu AI assistant |
| `/api/bot/dispatch-webhook` | `POST` | Dispatch social/tweet payload to Make.com / Buffer |
| `/api/refresh` | `POST` | Trigger instant scraper aggregation cycle |

---

## 🔒 Security & Privacy

- **Zero Secret Commits**: `.env` and sensitive API keys are strictly excluded via `.gitignore`.
- **Path Traversal Protection**: Static file server validates paths against `DASHBOARD_DIR` (CWE-22).
- **SSRF Hardening**: Outbound webhook requests validate protocol and block private/loopback CIDR ranges (CWE-918).
- **HTML Sanitization**: All user-provided text in the UI is escaped to prevent XSS injection.

---

## 📄 License
MIT License. Created by [harzhx](https://github.com/harzhx).
