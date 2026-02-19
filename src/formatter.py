"""
Markdown 格式化模組
"""
from datetime import datetime
from typing import Optional


class MarkdownFormatter:
    """Markdown 格式化器"""
    
    def __init__(self, date_format: str = '%Y%m%d'):
        self.date_format = date_format
    
    def format_meeting(
        self,
        category: str,
        subcategory: str,
        date: str,
        title: str,
        summary: str,
        notes: str,
        notion_url: str,
        crawled_at: datetime,
        reference_date: str
    ) -> str:
        """
        格式化單一會議為 Markdown
        """
        # YAML front matter
        yaml_lines = [
            "---",
            f"category: {category}",
        ]
        
        if subcategory:
            yaml_lines.append(f"subcategory: {subcategory}")
        else:
            yaml_lines.append("subcategory: ")
        
        yaml_lines.append(f"date: {reference_date}")
        yaml_lines.append(f"crawled_at: {crawled_at.isoformat()}")
        yaml_lines.append("---")
        yaml_lines.append("")
        
        # 會議內容
        content = [
            f"## 📋 會議資訊",
            "",
            "| 項目 | 內容 |",
            "|------|------|",
            f"| 分類 | {category} |",
        ]
        
        if subcategory:
            content.append(f"| 子分類 | {subcategory} |")
        
        content.append(f"| 日期 | {date} |")
        content.append("")
        content.append("---")
        content.append("")
        
        # 標題（如果有的話）
        if title:
            content.append(f"## 📋 {title}")
            content.append("")
        
        # 摘要
        if summary:
            content.append("## 📝 摘要")
            content.append("")
            content.append(summary)
            content.append("")
        
        # 筆記
        if notes:
            content.append("## 📓 筆記")
            content.append("")
            # 將筆記分段
            for line in notes.split('\n'):
                line = line.strip()
                if line:
                    content.append(f"- {line}")
            content.append("")
        
        # 原始連結
        if notion_url:
            content.append("## 🔗 原始連結")
            content.append("")
            content.append(f"[查看 Notion]({notion_url})")
            content.append("")
        
        content.append("---")
        
        # 組合
        yaml_text = '\n'.join(yaml_lines)
        content_text = '\n'.join(content)
        
        return yaml_text + content_text
    
    def generate_filename(
        self,
        category: str,
        subcategory: str,
        date_str: str,
        sanitize_func
    ) -> str:
        """
        產生檔名
        meetings-{分類}-{子分類}-{YYYYMMDD}.md
        """
        # 清理分類名稱
        clean_category = sanitize_filename(category)
        
        # 組成檔名
        if subcategory:
            clean_subcategory = sanitize_filename(subcategory)
            filename = f"meetings-{clean_category}-{clean_subcategory}-{date_str}.md"
        else:
            filename = f"meetings-{clean_category}-{date_str}.md"
        
        return filename


def sanitize_filename(name: str) -> str:
    """清理檔名"""
    if not name:
        return ""
    
    result = name
    
    # 替換 /
    result = result.replace('/', '-')
    
    # 替換 &
    result = result.replace('&', 'and')
    
    # 替換空格
    result = result.replace(' ', '_')
    
    # 移除特殊字元
    special_chars = '\\:*?"<>|'
    for char in special_chars:
        result = result.replace(char, '')
    
    # 限制長度
    max_length = 50
    if len(result) > max_length:
        result = result[:max_length]
    
    return result
