#!/usr/bin/env python3
"""
Notion 會議爬蟲核心模組
"""
import re
from datetime import datetime
from typing import List, Dict, Optional
from pathlib import Path

from playwright.sync_api import sync_playwright, Page, Browser

from .parser import DateParser
from .formatter import MarkdownFormatter, sanitize_filename


class MeetingScraper:
    """Notion 會議爬蟲"""
    
    def __init__(
        self,
        config,
        verbose: bool = True
    ):
        self.config = config
        self.verbose = verbose
        self.parser = DateParser(config.date_reference)
        self.formatter = MarkdownFormatter(config.output_date_format)
        
        self.browser: Optional[Browser] = None
        self.page: Optional[Page] = None
        
        # 建立輸出資料夾
        self.output_folder = Path(config.output_folder)
        self.output_folder.mkdir(parents=True, exist_ok=True)
    
    def log(self, message: str):
        """輸出日誌"""
        if self.verbose:
            print(message)
    
    def start(self):
        """啟動瀏覽器"""
        self.browser = sync_playwright().chromium.launch(headless=True)
        self.page = self.browser.new_page()
    
    def stop(self):
        """關閉瀏覽器"""
        if self.browser:
            self.browser.close()
    
    def crawl_category(self, category: dict, reference_date: str) -> List[dict]:
        """
        爬取單一分類
        """
        category_name = category['name']
        category_url = category['url']
        
        self.log(f"\n【{category_name}】")
        
        # 取得所有會議頁面（含子分類）
        all_meetings = self._get_all_meetings(category_url, category_name)
        
        # 過濾只保留今天的會議
        today_meetings = []
        
        for meeting in all_meetings:
            meeting_date = meeting.get('date', '')
            
            # 解析日期
            if meeting_date:
                parsed_date = self.parser.parse(meeting_date)
                meeting['parsed_date'] = parsed_date
                
                # 取得 YYYY-MM-DD 格式
                date_only = self.parser.get_date_only(meeting_date)
                meeting['date_only'] = date_only
                
                # 比對今天
                if date_only == reference_date:
                    today_meetings.append(meeting)
                    self.log(f"  ✓ 符合今天日期: {meeting.get('title', '無標題')[:30]}")
            else:
                # 沒有日期，嘗試從標題抓
                title = meeting.get('title', '')
                date_from_title = self._extract_date_from_title(title)
                if date_from_title:
                    meeting['parsed_date'] = date_from_title
                    meeting['date_only'] = date_from_title
                    
                    if date_from_title == reference_date:
                        today_meetings.append(meeting)
                        self.log(f"  ✓ 從標題找到今天日期: {title[:30]}")
        
        self.log(f"  → 總共 {len(all_meetings)} 筆，符合今天 {len(today_meetings)} 筆")
        
        return today_meetings
    
    def _get_all_meetings(self, url: str, category_name: str) -> List[dict]:
        """取得所有會議"""
        meetings = []
        
        try:
            self.page.goto(url, wait_until="domcontentloaded", timeout=self.config.crawl_timeout)
            self.page.wait_for_timeout(self.config.crawl_wait_time)
            
            # 取得子頁面連結
            subpages = self._get_subpages()
            
            # 爬取每個子頁面
            for subpage in subpages[:self.config.crawl_max_pages]:
                try:
                    self.page.goto(subpage['url'], wait_until="domcontentloaded", timeout=self.config.crawl_timeout)
                    self.page.wait_for_timeout(self.config.crawl_wait_time)
                    
                    # 取得會議資訊
                    info = self._extract_meeting_info(subpage['url'])
                    
                    if info.get('title') or info.get('summary'):
                        info['category'] = category_name
                        info['subcategory'] = subpage.get('title', '')
                        meetings.append(info)
                        self.log(f"    ✓ {info.get('title', '無標題')[:30]}")
                        
                except Exception as e:
                    self.log(f"    ✗ Error: {e}")
                    
        except Exception as e:
            self.log(f"  ✗ Error loading category: {e}")
        
        return meetings
    
    def _get_subpages(self) -> List[dict]:
        """取得頁面中所有子頁面連結"""
        subpages = []
        
        try:
            links = self.page.evaluate('''() => {
                const result = [];
                const anchors = document.querySelectorAll('a[href*="/so/"]');
                
                anchors.forEach(anchor => {
                    const href = anchor.href;
                    const text = anchor.innerText.trim();
                    
                    if (text && text.length > 2 && text.length < 80 && href) {
                        if (!text.includes('Skip to') && !text.includes('Sign up')) {
                            result.push({ title: text, url: href });
                        }
                    }
                });
                
                return result;
            }''')
            
            # 去重
            seen = set()
            for link in links:
                if link['title'] not in seen:
                    seen.add(link['title'])
                    subpages.append(link)
                    
        except Exception as e:
            self.log(f"Error getting subpages: {e}")
        
        return subpages
    
    def _extract_meeting_info(self, url: str) -> dict:
        """從頁面提取會議資訊"""
        result = {
            'title': '',
            'date': '',
            'summary': '',
            'notes': '',
            'url': url
        }
        
        try:
            # 取得標題
            title = self.page.evaluate('''() => {
                const heading = document.querySelector('h1');
                return heading ? heading.innerText : '';
            }''')
            result['title'] = title.strip()
            
            # 取得日期
            date_text = self.page.evaluate('''() => {
                const spans = document.querySelectorAll('span');
                for (const span of spans) {
                    if (span.innerText.includes('@') && 
                        (span.innerText.includes('Last') || span.innerText.includes(', 202'))) {
                        return span.innerText.replace('@', '').trim();
                    }
                }
                return '';
            }''')
            
            if date_text:
                result['date'] = date_text.replace('@', '').strip()
            
            # 取得 Summary
            if self.config.extract_summary:
                summary = self.page.evaluate('''() => {
                    const allText = document.body.innerText;
                    const match = allText.match(/Summary\\s*([\\s\\S]*?)(?=Notes|$)/);
                    if (match) {
                        return match[1].trim();
                    }
                    return '';
                }''')
                result['summary'] = summary.strip()
            
            # 取得 Notes
            if self.config.extract_notes:
                notes = self.page.evaluate('''() => {
                    const allText = document.body.innerText;
                    const match = allText.match(/Notes\\s*([\\s\\S]*?)(?=Transcript|$)/);
                    if (match) {
                        return match[1].trim();
                    }
                    return '';
                }''')
                result['notes'] = notes.strip()
                
        except Exception as e:
            self.log(f"Error extracting info: {e}")
        
        return result
    
    def _extract_date_from_title(self, title: str) -> Optional[str]:
        """從標題提取日期"""
        # 嘗試找日期格式
        patterns = [
            r'(\d{4})/(\d{1,2})/(\d{1,2})',
            r'(\d{4})-(\d{1,2})-(\d{1,2})',
            r'(\d{1,2})/(\d{1,2})',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, title)
            if match:
                try:
                    if len(match.groups()) == 3:
                        if len(match.group(1)) == 4:
                            year, month, day = match.groups()
                        else:
                            year = "2026"
                            month, day = match.group(1), match.group(2)
                        
                        date_obj = datetime(int(year), int(month), int(day))
                        return date_obj.strftime('%Y-%m-%d')
                except:
                    pass
        
        return None
    
    def save_meeting(self, meeting: dict, category: str, reference_date: str):
        """
        儲存單一會議到檔案
        """
        subcategory = meeting.get('subcategory', '')
        
        # 產生檔名
        filename = self.formatter.generate_filename(
            category=category,
            subcategory=subcategory,
            date_str=reference_date.replace('-', ''),
            sanitize_func=sanitize_filename
        )
        
        filepath = self.output_folder / filename
        
        # 格式化內容
        content = self.formatter.format_meeting(
            category=category,
            subcategory=subcategory,
            date=meeting.get('parsed_date', meeting.get('date', '未知')),
            title=meeting.get('title', ''),
            summary=meeting.get('summary', ''),
            notes=meeting.get('notes', ''),
            notion_url=meeting.get('url', ''),
            crawled_at=datetime.now(),
            reference_date=reference_date
        )
        
        # 寫入檔案
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        
        self.log(f"  💾 已儲存: {filename}")
        
        return filepath
    
    def run(self, reference_date: str = None):
        """
        執行爬蟲
        """
        if reference_date is None:
            reference_date = self.config.date_reference
        
        self.log(f"=" * 50)
        self.log(f"Notion 會議爬蟲 - 開始執行")
        self.log(f"參照日期: {reference_date}")
        self.log(f"=" * 50)
        
        self.start()
        
        saved_count = 0
        
        try:
            # 遍歷每個分類
            for category in self.config.enabled_categories:
                today_meetings = self.crawl_category(category, reference_date)
                
                # 儲存今天的會議
                for meeting in today_meetings:
                    self.save_meeting(meeting, category['name'], reference_date)
                    saved_count += 1
                    
        finally:
            self.stop()
        
        self.log(f"\n總共儲存 {saved_count} 筆會議記錄")
        
        return saved_count
