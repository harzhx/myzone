# tools/modal_scraper.py
# Modal Serverless Cron Scraper for My Zone AI Dashboard
# Automatically runs in Modal cloud every 24 hours and updates Supabase database.

import modal
import os
import re
import json
import hashlib
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

# Define Modal App
app = modal.App("myzone-newsletter-scraper")

# Define Container Image with requirements
image = modal.Image.debian_slim().pip_install(
    "supabase==2.13.0",
    "requests==2.32.3",
    "beautifulsoup4==4.12.3"
)

# Supabase Credentials (defaults or environment overrides)
DEFAULT_SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://kvoehtolnfbylfksowks.supabase.co")
DEFAULT_SUPABASE_KEY = os.environ.get("SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2b2VodG9sbmZieWxma3Nvd2tzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNjMwNzEsImV4cCI6MjEwMjYzOTA3MX0.LoePDkZ3RC_dAv7sT8fXyh7gZwrcR0Ky1MQgdW9pNbI")

def get_utc_now():
    return datetime.now(timezone.utc).isoformat()

def clean_html(raw_html: str) -> str:
    if not raw_html:
        return ""
    clean = re.sub(r'<[^>]+>', '', raw_html)
    clean = re.sub(r'\s+', ' ', clean).strip()
    return clean

def generate_id(url: str) -> str:
    return hashlib.sha256(url.encode('utf-8')).hexdigest()

def scrape_rundown():
    print("📡 [The AI Rundown] Fetching RSS feed...")
    url = "https://rss.beehiiv.com/feeds/2R3C6Bt5wj.xml"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) MyZone/1.0'})
    articles = []
    
    with urllib.request.urlopen(req, timeout=20) as resp:
        xml_data = resp.read()
        root = ET.fromstring(xml_data)
        
        for item in root.findall('./channel/item'):
            title = item.findtext('title', '').strip()
            link = item.findtext('link', '').strip()
            pub_date = item.findtext('pubDate', '')
            desc = clean_html(item.findtext('description', ''))
            
            # Find image
            enclosure = item.find('enclosure')
            image_url = enclosure.get('url') if enclosure is not None else None
            
            if not image_url:
                desc_raw = item.findtext('description', '')
                img_match = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', desc_raw)
                if img_match:
                    image_url = img_match.group(1)
            
            published_at = get_utc_now()
            if pub_date:
                try:
                    from email.utils import parsedate_to_datetime
                    published_at = parsedate_to_datetime(pub_date).isoformat()
                except Exception:
                    pass

            if title and link:
                articles.append({
                    "id": generate_id(link),
                    "source": "the_rundown_ai",
                    "source_label": "The AI Rundown",
                    "source_color": "#6C63FF",
                    "title": title,
                    "description": desc[:300] if desc else "Latest AI breakthroughs & workflows from The AI Rundown",
                    "url": link,
                    "image_url": image_url,
                    "authors": ["Rowan Cheung", "Zach Mink"],
                    "published_at": published_at,
                    "scraped_at": get_utc_now(),
                    "is_saved": False
                })
                
    print(f"✅ [The AI Rundown] Scraped {len(articles)} articles.")
    return articles

def scrape_bens_bites():
    print("📡 [Ben's Bites] Fetching Substack / RSS feed...")
    urls = ["https://www.bensbites.com/feed", "https://bensbites.beehiiv.com/archive"]
    articles = []
    
    # Try Substack RSS feed
    try:
        req = urllib.request.Request(urls[0], headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) MyZone/1.0'})
        with urllib.request.urlopen(req, timeout=20) as resp:
            xml_data = resp.read()
            root = ET.fromstring(xml_data)
            
            for item in root.findall('./channel/item'):
                title = item.findtext('title', '').strip()
                link = item.findtext('link', '').strip()
                pub_date = item.findtext('pubDate', '')
                desc = clean_html(item.findtext('description', ''))
                
                enclosure = item.find('enclosure')
                image_url = enclosure.get('url') if enclosure is not None else None
                
                if not image_url:
                    desc_raw = item.findtext('description', '')
                    img_match = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', desc_raw)
                    if img_match:
                        image_url = img_match.group(1)
                
                published_at = get_utc_now()
                if pub_date:
                    try:
                        from email.utils import parsedate_to_datetime
                        published_at = parsedate_to_datetime(pub_date).isoformat()
                    except Exception:
                        pass

                if title and link:
                    articles.append({
                        "id": generate_id(link),
                        "source": "bens_bites",
                        "source_label": "Ben's Bites",
                        "source_color": "#FF6B35",
                        "title": title,
                        "description": desc[:300] if desc else "Daily product drops, tools, and AI insights from Ben's Bites",
                        "url": link,
                        "image_url": image_url,
                        "authors": ["Ben Tossell"],
                        "published_at": published_at,
                        "scraped_at": get_utc_now(),
                        "is_saved": False
                    })
    except Exception as e:
        print(f"⚠️ [Ben's Bites] RSS feed fallback: {e}")
        
    print(f"✅ [Ben's Bites] Scraped {len(articles)} articles.")
    return articles

@app.function(
    image=image,
    schedule=modal.Cron("0 0 * * *"),  # Runs every 24 hours at 00:00 UTC
    timeout=300
)
def scrape_and_sync():
    """Scheduled 24-hour scraper function running in Modal Cloud."""
    from supabase import create_client
    
    print("\n🚀 [Modal Cron Scraper] Starting 24h cycle...")
    supabase_url = os.environ.get("SUPABASE_URL", DEFAULT_SUPABASE_URL)
    supabase_key = os.environ.get("SUPABASE_ANON_KEY", DEFAULT_SUPABASE_KEY)
    
    sb = create_client(supabase_url, supabase_key)
    
    all_articles = []
    
    # 1. Scrape Rundown
    try:
        rundown_articles = scrape_rundown()
        all_articles.extend(rundown_articles)
    except Exception as e:
        print(f"❌ Error scraping The AI Rundown: {e}")
        
    # 2. Scrape Ben's Bites
    try:
        bens_articles = scrape_bens_bites()
        all_articles.extend(bens_articles)
    except Exception as e:
        print(f"❌ Error scraping Ben's Bites: {e}")
        
    print(f"\n📦 Total articles gathered: {len(all_articles)}")
    
    # 3. Upsert into Supabase
    if all_articles:
        try:
            print("⚡ Syncing articles into Supabase table 'public.articles'...")
            result = sb.table("articles").upsert(all_articles, on_conflict="url").execute()
            print(f"🎉 Successfully synced {len(all_articles)} articles to Supabase!")
        except Exception as e:
            print(f"❌ Supabase upsert error: {e}")
            raise e
            
    return {
        "status": "success",
        "synced_count": len(all_articles),
        "timestamp": get_utc_now()
    }

@app.local_entrypoint()
def main():
    """Manual local trigger: modal run tools/modal_scraper.py"""
    print("▶️ Triggering Modal Scraper job...")
    result = scrape_and_sync.remote()
    print(f"✅ Job Finished: {json.dumps(result, indent=2)}")
