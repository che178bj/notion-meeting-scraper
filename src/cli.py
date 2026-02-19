#!/usr/bin/env python3
"""
命令列介面
"""
import sys
import click
from pathlib import Path

from .config import Config
from .scraper import MeetingScraper


@click.command()
@click.option('--config', '-c', default=None, help='設定檔路徑')
@click.option('--date', '-d', default=None, help='參照日期 (YYYY-MM-DD)')
@click.option('--category', default=None, help='只爬取特定分類')
@click.option('--output', '-o', default=None, help='輸出資料夾')
@click.option('--verbose', '-v', is_flag=True, default=True, help='顯示詳細日誌')
@click.option('--quiet', '-q', is_flag=True, default=False, help='安靜模式')
def main(config, date, category, output, verbose, quiet):
    """
    Notion 會議爬蟲
    
    範例：
        python -m notion_scraper                      # 執行爬蟲
        python -m notion_scraper --date 2026-02-12   # 指定日期
        python -m notion_scraper --category 數據週會議  # 只爬特定分類
    """
    try:
        # 載入設定
        if config:
            cfg = Config(config)
        else:
            cfg = Config()
        
        # 覆寫設定
        if output:
            cfg._config['output']['folder'] = output
        
        if quiet:
            verbose = False
        
        # 建立爬蟲
        scraper = MeetingScraper(cfg, verbose=verbose)
        
        # 執行
        scraper.run(reference_date=date)
        
    except FileNotFoundError as e:
        print(f"錯誤: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"執行錯誤: {e}")
        if verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
