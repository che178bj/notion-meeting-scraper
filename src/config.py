"""
設定檔讀取模組
"""
import os
import yaml
from pathlib import Path
from typing import Optional


class Config:
    """設定檔管理"""
    
    def __init__(self, config_path: Optional[str] = None):
        if config_path is None:
            # 預設找目前目錄的 config.yaml
            config_path = Path(__file__).parent.parent / "config.yaml"
        
        self.config_path = Path(config_path)
        self._config = self._load()
    
    def _load(self) -> dict:
        """載入 YAML 設定檔"""
        if not self.config_path.exists():
            raise FileNotFoundError(f"找不到設定檔: {self.config_path}")
        
        with open(self.config_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)
    
    @property
    def output_folder(self) -> str:
        return self._config.get('output', {}).get('folder', './output')
    
    @property
    def output_date_format(self) -> str:
        return self._config.get('output', {}).get('date_format', '%Y%m%d')
    
    @property
    def sanitize_config(self) -> dict:
        return self._config.get('output', {}).get('sanitize', {})
    
    @property
    def categories(self) -> list:
        return self._config.get('notion', {}).get('categories', [])
    
    @property
    def enabled_categories(self) -> list:
        return [c for c in self.categories if c.get('enabled', True)]
    
    @property
    def crawl_timeout(self) -> int:
        return self._config.get('crawl', {}).get('timeout', 60000)
    
    @property
    def crawl_wait_time(self) -> int:
        return self._config.get('crawl', {}).get('wait_time', 4000)
    
    @property
    def crawl_max_pages(self) -> int:
        return self._config.get('crawl', {}).get('max_pages_per_category', 10)
    
    @property
    def date_reference(self) -> str:
        return self._config.get('options', {}).get('date_reference', '2026-02-12')
    
    @property
    def verbose(self) -> bool:
        return self._config.get('options', {}).get('verbose', True)
    
    @property
    def extract_summary(self) -> bool:
        return self._config.get('options', {}).get('extract_summary', True)
    
    @property
    def extract_notes(self) -> bool:
        return self._config.get('options', {}).get('extract_notes', True)


def sanitize_filename(name: str, config: dict = None) -> str:
    """
    清理檔名：移除或替換特殊字元
    """
    if config is None:
        config = {}
    
    result = name
    
    # 替換 /
    replace_slash = config.get('replace_slash', '-')
    result = result.replace('/', replace_slash)
    
    # 替換 &
    replace_ampersand = config.get('replace_ampersand', 'and')
    result = result.replace('&', replace_ampersand)
    
    # 替換空格
    replace_space = config.get('replace_space', '_')
    result = result.replace(' ', replace_space)
    
    # 移除特殊字元
    special_chars = '\\:*?"<>|'
    for char in special_chars:
        result = result.replace(char, '')
    
    # 限制長度
    max_length = config.get('max_length', 50)
    if len(result) > max_length:
        result = result[:max_length]
    
    return result
