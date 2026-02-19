#!/usr/bin/env python3
"""
命令列介面
"""
import sys
import click
from pathlib import Path
from datetime import datetime, timedelta
from typing import List

from .config import Config
from .scraper import MeetingScraper


def get_date_range(from_date: str, to_date: str) -> List[str]:
    """
    產生日期區間內的所有日期
    """
    start = datetime.strptime(from_date, '%Y-%m-%d')
    end = datetime.strptime(to_date, '%Y-%m-%d')
    
    dates = []
    current = start
    while current <= end:
        dates.append(current.strftime('%Y-%m-%d'))
        current += timedelta(days=1)
    
    return dates


@click.command()
@click.option('--config', '-c', default=None, help='設定檔路徑')
@click.option('--date', '-d', default=None, help='參照日期 (YYYY-MM-DD)')
@click.option('--from', 'from_date', default=None, help='回溯起始日期 (YYYY-MM-DD)')
@click.option('--to', 'to_date', default=None, help='回溯結束日期 (YYYY-MM-DD)')
@click.option('--category', default=None, help='只爬取特定分類')
@click.option('--output', '-o', default=None, help='輸出資料夾')
@click.option('--verbose', '-v', is_flag=True, default=True, help='顯示詳細日誌')
@click.option('--quiet', '-q', is_flag=True, default=False, help='安靜模式')
def main(config, date, from_date, to_date, category, output, verbose, quiet):
    """
    Notion 會議爬蟲
    
    範例：
        python -m notion_scraper                      # 執行爬蟲（今天）
        python -m notion_scraper --date 2026-02-12   # 指定日期
        python -m notion_scraper --from 2026-02-02 --to 2026-02-13  # 回溯日期範圍
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
        
        # 決定執行日期
        execute_dates = []
        
        if from_date and to_date:
            # 回溯模式
            execute_dates = get_date_range(from_date, to_date)
            print(f"🔄 回溯模式：{from_date} ~ {to_date}，共 {len(execute_dates)} 天")
        elif date:
            # 單一日期
            execute_dates = [date]
        else:
            # 預設今天
            today = datetime.now().strftime('%Y-%m-%d')
            execute_dates = [today]
        
        # 建立爬蟲
        scraper = MeetingScraper(cfg, verbose=verbose)
        
        # 依序執行每個日期
        total_saved = 0
        
        for exec_date in execute_dates:
            print(f"\n{'='*50}")
            print(f"📅 執行日期: {exec_date}")
            print(f"{'='*50}")
            
            scraper.output_folder = Path(cfg.output_folder) / exec_date
            scraper.output_folder.mkdir(parents=True, exist_ok=True)
            
            saved = scraper.run(reference_date=exec_date)
            total_saved += saved
            
            print(f"✅ {exec_date} 完成：儲存 {saved} 筆")
        
        print(f"\n🎉 全部完成！總共儲存 {total_saved} 筆")
        
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
