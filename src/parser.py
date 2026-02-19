"""
日期解析模組
將相對日期轉換為實際日期
"""
import re
from datetime import datetime, timedelta
from typing import Optional


class DateParser:
    """日期解析器"""
    
    def __init__(self, reference_date: str = None):
        """
        初始化
        reference_date: 參照日期 (YYYY-MM-DD)
        """
        if reference_date:
            self.reference_date = datetime.strptime(reference_date, '%Y-%m-%d')
        else:
            self.reference_date = datetime.now()
    
    def parse(self, date_str: str) -> str:
        """
        解析日期字串
        支援格式：
        - Last Tuesday
        - Last Monday
        - February 4, 2026
        - Feb 4, 2026
        - 2026年2月4日
        """
        if not date_str:
            return ""
        
        date_str = date_str.strip()
        
        # 嘗試相對日期
        result = self._parse_relative(date_str)
        if result:
            return result
        
        # 嘗試英文日期
        result = self._parse_english(date_str)
        if result:
            return result
        
        # 嘗試中文日期
        result = self._parse_chinese(date_str)
        if result:
            return result
        
        # 回傳原始字串
        return date_str
    
    def _parse_relative(self, date_str: str) -> Optional[str]:
        """解析相對日期（如 Last Tuesday）"""
        weekday_map = {
            "Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3,
            "Friday": 4, "Saturday": 5, "Sunday": 6
        }
        
        match = re.search(r'Last\s+(\w+)', date_str, re.IGNORECASE)
        if match:
            target_weekday_name = match.group(1)
            target_weekday = weekday_map.get(target_weekday_name.capitalize())
            
            if target_weekday is not None:
                days_ago = (self.reference_date.weekday() - target_weekday) % 7
                if days_ago == 0:
                    days_ago = 7
                
                actual_date = self.reference_date - timedelta(days=days_ago)
                return actual_date.strftime('%Y年%m月%d日')
        
        return None
    
    def _parse_english(self, date_str: str) -> Optional[str]:
        """解析英文日期（如 February 4, 2026）"""
        month_map = {
            "January": 1, "February": 2, "March": 3, "April": 4,
            "May": 5, "June": 6, "July": 7, "August": 8,
            "September": 9, "October": 10, "November": 11, "December": 12,
            "Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4,
            "Jul": 7, "Aug": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12
        }
        
        # February 4, 2026 或 Feb 4, 2026
        match = re.search(r'(\w+)\s+(\d+),?\s*(\d{4})', date_str)
        if match:
            month_str = match.group(1)
            day = match.group(2)
            year = match.group(3)
            
            month = month_map.get(month_str)
            if month:
                try:
                    date_obj = datetime(int(year), month, int(day))
                    return date_obj.strftime('%Y年%m月%d日')
                except ValueError:
                    pass
        
        return None
    
    def _parse_chinese(self, date_str: str) -> Optional[str]:
        """解析中文日期（如 2026年2月4日）"""
        match = re.search(r'(\d{4})年(\d{1,2})月(\d{1,2})日', date_str)
        if match:
            year = int(match.group(1))
            month = int(match.group(2))
            day = int(match.group(3))
            
            try:
                date_obj = datetime(year, month, day)
                return date_obj.strftime('%Y年%m月%d日')
            except ValueError:
                pass
        
        return None
    
    def get_date_only(self, date_str: str) -> Optional[str]:
        """
        取得純日期部分（用於比對）
        例如：2026年2月12日 -> 2026-02-12
        """
        parsed = self.parse(date_str)
        if not parsed:
            return None
        
        # 轉換為 YYYY-MM-DD 格式
        try:
            # 嘗試從中文日期轉換
            match = re.search(r'(\d{4})年(\d{1,2})月(\d{1,2})日', parsed)
            if match:
                year = match.group(1)
                month = match.group(2).zfill(2)
                day = match.group(3).zfill(2)
                return f"{year}-{month}-{day}"
        except:
            pass
        
        return None
