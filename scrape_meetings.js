#!/usr/bin/env node
/**
 * Notion 會議記錄爬蟲 v5 - 每日精簡版
 * 只抓每個分類最近 3 篇會議
 */

const { chromium } = require('playwright');
const fs = require('fs');

// ==================== 配置 ====================
const NOTION_PAGES = {
    "APP月會": "https://www.notion.so/APP-2b6d1d3a5f4e80c39836ff678f90050a",
    "數據週會議": "https://www.notion.so/2b6d1d3a5f4e8051b86fd9afa4e1f049",
    "Shopper自動化&發票快查": "https://www.notion.so/Shopper-2b6d1d3a5f4e808eb026ed8642c9487a",
    "HAPPY GENIE專案": "https://www.notion.so/HAPPY-GENIE-2b6d1d3a5f4e8067a6a7dcfe18411dc0",
    "自動化/醫療": "https://www.notion.so/2cbd1d3a5f4e80b28a2cd3e276b4f00e",
    "市調報價AI": "https://www.notion.so/AI-2a9d1d3a5f4e80638623e9d5b4ac1685",
    "GM雙週會": "https://www.notion.so/GM-2b6d1d3a5f4e8052a54bcba1dba32c43",
    "顧客洞察專案": "https://www.notion.so/2b6d1d3a5f4e804bb503c9fae827ebf8",
    "虛擬受訪者": "https://www.notion.so/2e5d1d3a5f4e8022940fdec4b55bbb2a",
};

// 輸出檔案：meetings_YYYY-MM-DD.md
const today = new Date();
const dateStr = today.toISOString().split('T')[0];
const OUTPUT_FILE = `/home/ubuntu/.openclaw/workspace/meetings_${dateStr}.md`;

// ==================== 輔助函式 ====================

function parseRelativeDate(dateStr) {
    if (!dateStr) return "";
    
    const today = new Date(); // 使用当前实际日期
    
    // Last Tuesday
    const lastMatch = dateStr.match(/Last\s+(\w+)/i);
    if (lastMatch) {
        const weekdayMap = {
            'Monday': 0, 'Tuesday': 1, 'Wednesday': 2, 'Thursday': 3,
            'Friday': 4, 'Saturday': 5, 'Sunday': 6
        };
        const targetWeekday = weekdayMap[lastMatch[1]];
        if (targetWeekday !== undefined) {
            let daysAgo = (today.getDay() - targetWeekday + 7) % 7;
            if (daysAgo === 0) daysAgo = 7;
            const actualDate = new Date(today);
            actualDate.setDate(today.getDate() - daysAgo);
            return `${actualDate.getFullYear()}年${actualDate.getMonth() + 1}月${actualDate.getDate()}日`;
        }
    }
    
    // February 4, 2026
    const dateMatch = dateStr.match(/(\w+)\s+(\d+),?\s*(\d{4})/);
    if (dateMatch) {
        const monthStr = dateMatch[1];
        const day = dateMatch[2];
        const year = dateMatch[3];
        
        const monthMap = {
            'January': 1, 'February': 2, 'March': 3, 'April': 4,
            'May': 5, 'June': 6, 'July': 7, 'August': 8,
            'September': 9, 'October': 10, 'November': 11, 'December': 12,
            'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4,
            'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
        };
        
        const month = monthMap[monthStr] || 1;
        return `${year}年${month}月${day}日`;
    }
    
    return dateStr;
}

async function extractMeetingInfo(page, categoryName) {
    const result = { title: "", date: "", summary: "", notes: "" };
    
    try {
        // 获取页面所有文本并解析所有会议
        const allMeetings = await page.evaluate(() => {
            const bodyText = document.body.innerText;
            
            // 找到所有会议（包含 @ 的行）
            const meetingMatches = bodyText.matchAll(/(.+?)\s*@\s*(Last\s+\w+|\w+\s+\d+,?\s*\d{4})/g);
            const meetings = [];
            
            for (const match of meetingMatches) {
                meetings.push({
                    title: match[1].trim(),
                    dateText: match[2].trim()
                });
            }
            
            // 找到所有 Summary 到 Notes/Transcript 之间的内容
            const summaryMatches = bodyText.matchAll(/Summary\s*([\s\S]*?)(?=Notes|Transcript|Was this)/gi);
            const summaries = [];
            for (const match of summaryMatches) {
                const text = match[1].trim();
                // 清理内容
                const cleaned = text.replace(/^\n/, ''); // 移除长度限制
                if (cleaned.length > 10) {
                    summaries.push(cleaned);
                }
            }
            
            return { meetings, summaries };
        });
        
        // 如果只有一个会议，直接返回
        if (allMeetings.meetings.length === 1) {
            result.title = allMeetings.meetings[0].title;
            result.date = parseRelativeDate(allMeetings.meetings[0].dateText);
            result.summary = allMeetings.summaries[0] || '';
            result.notes = '';
            return result;
        }
        
        // 如果有多个会议，返回第一个（调用方会处理所有会议）
        if (allMeetings.meetings.length > 0) {
            result.title = allMeetings.meetings[0].title;
            result.date = parseRelativeDate(allMeetings.meetings[0].dateText);
            result.summary = allMeetings.summaries[0] || '';
            result.notes = '';
        }
        
    } catch (e) {
        console.error("Error:", e.message);
    }
    
    return result;
}

// 新函数：从页面提取所有会议（带各自摘要）
async function extractAllMeetingsFromPage(page, categoryName, subcategory = '') {
    try {
        const data = await page.evaluate(() => {
            const bodyText = document.body.innerText;
            
            // 找到所有会议（包含 @ 的行）
            const meetingMatches = bodyText.matchAll(/(.+?)\s*@\s*(Last\s+\w+|\w+\s+\d+,?\s*\d{4})/g);
            const meetings = [];
            
            for (const match of meetingMatches) {
                meetings.push({
                    title: match[1].trim(),
                    dateText: match[2].trim()
                });
            }
            
            // 找到所有 "Share summary" 后面的内容（这是真正的摘要）
            // 格式：Summary -> Notes -> Transcript -> Share summary -> 摘要内容
            // 匹配到下一个 "Summary" 或 "Notes" 或 "citations" 之前
            const summaryMatches = bodyText.matchAll(/Share summary\s*([\s\S]*?)(?=\n\n|Summary\s|Notes\s|citations\s*\\d|$)/gi);
            const summaries = [];
            for (const match of summaryMatches) {
                let text = match[1].trim();
                // 清理内容：移除多余的空白和标记
                text = text.replace(/^\n+/, '').replace(/\n+$/, '');
                // 限制长度
                if (text.length > 10) {
                    summaries.push(text);
                }
            }
            
            return { meetings, summaries };
        });
        
        // 组合会议和摘要
        const results = [];
        for (let i = 0; i < data.meetings.length; i++) {
            results.push({
                category: categoryName,
                subcategory: subcategory,
                title: data.meetings[i].title,
                date: parseRelativeDate(data.meetings[i].dateText),
                summary: data.summaries[i] || '',
                notes: ''
            });
        }
        
        return results;
        
    } catch (e) {
        console.error("Error extracting all meetings:", e.message);
        return [];
    }
}

async function getAllPageLinks(page) {
    const subpages = [];
    
    try {
        // 从页面文本中提取所有会议标题（包含 @ 和日期的行）
        const meetings = await page.evaluate(() => {
            const bodyText = document.body.innerText;
            const lines = bodyText.split('\n');
            
            const meetingLines = [];
            lines.forEach(line => {
                // 匹配会议标题格式：xxx @ 日期
                if (line.includes('@') && (line.includes('Last') || line.match(/[A-Z][a-z]+ \d+,? \d{4}/))) {
                    const match = line.match(/(.+?)\s*@\s*(.+)/);
                    if (match) {
                        meetingLines.push({
                            title: match[1].trim(),
                            dateText: match[2].trim()
                        });
                    }
                }
            });
            
            return meetingLines;
        });
        
        // 去重
        const seen = new Set();
        for (const m of meetings) {
            if (!seen.has(m.title)) {
                seen.add(m.title);
                subpages.push({
                    title: m.title,
                    dateText: m.dateText,
                    url: '' // 不需要 URL，直接从当前页面提取
                });
            }
        }
        
    } catch (e) {
        console.error("Error getting meetings:", e.message);
    }
    
    return subpages;
}

async function main() {
    console.log("=".repeat(50));
    console.log(`Notion 會議記錄爬蟲 v5 - 每日精簡版`);
    console.log(`日期：${dateStr}`);
    console.log("=".repeat(50));
    
    const allMeetings = [];
    const MAX_MEETINGS_PER_CATEGORY = 999;  // 每個分類全部抓取
    
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    for (const [categoryName, categoryUrl] of Object.entries(NOTION_PAGES)) {
        console.log(`\n【${categoryName}】`);
        
        if (categoryName === "顧客洞察專案") {
            const subUrls = {
                "2025/11": "https://www.notion.so/2025-11-2e5d1d3a5f4e80479c3eedb927df91da",
                "2025/12": "https://www.notion.so/2025-12-2e5d1d3a5f4e807c885bdeaccd9a944d",
                "2026/01": "https://www.notion.so/2026-01-2e5d1d3a5f4e80ca847edd3259913f54",
                "2026/02": "https://www.notion.so/2026-02-2fed1d3a5f4e80149903fbf8ba98f9b2",
                "DM & CI": "https://www.notion.so/DM-CI-2e5d1d3a5f4e80859b9ccf5b8e0e74e3",
                "雙週會進度報告": "https://www.notion.so/2e5d1d3a5f4e8030a997d430f0c7196c",
                "DM & IT & 阿北": "https://www.notion.so/DM-IT-2e5d1d3a5f4e803eb5aeef6366779ca5"
            };
            
            for (const [subName, subUrl] of Object.entries(subUrls)) {
                let count = 0;
                console.log(`  → ${subName}`);
                
                try {
                    await page.goto(subUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
                    await page.waitForTimeout(5000);
                    
                    const meetingsOnPage = await getAllPageLinks(page);
                    
                    // 只取前 3 篇
                    const limitedMeetings = meetingsOnPage.slice(0, MAX_MEETINGS_PER_CATEGORY);
                    
                    if (limitedMeetings.length === 0) {
                        const info = await extractMeetingInfo(page, categoryName);
                        if (info.title || info.summary) {
                            allMeetings.push({
                                category: categoryName,
                                subcategory: subName,
                                title: info.title,
                                date: info.date,
                                summary: info.summary,
                                notes: info.notes
                            });
                            console.log(`    ✓ ${info.title.substring(0, 30)}...`);
                            count++;
                        }
                    } else {
                        for (const meeting of limitedMeetings) {
                            if (count >= MAX_MEETINGS_PER_CATEGORY) break;
                            
                            try {
                                // 如果有 URL 就導航，否則從當前頁面提取
                                if (meeting.url && meeting.url.includes('/so/')) {
                                    await page.goto(meeting.url, { waitUntil: "domcontentloaded", timeout: 60000 });
                                    await page.waitForTimeout(4000);
                                }
                                
                                const info = await extractMeetingInfo(page, categoryName);
                                
                                // 始终使用列表中识别的日期（更准确）
                                if (meeting.dateText) {
                                    info.date = parseRelativeDate(meeting.dateText);
                                }
                                
                                if (info.title || info.summary) {
                                    allMeetings.push({
                                        category: categoryName,
                                        subcategory: subName,
                                        title: info.title,
                                        date: info.date,
                                        summary: info.summary,
                                        notes: info.notes
                                    });
                                    console.log(`    ✓ ${info.title.substring(0, 30)} (${info.date})...`);
                                    count++;
                                }
                            } catch (e) {
                                console.error(`    ✗ Error: ${e.message}`);
                            }
                        }
                    }
                } catch (e) {
                    console.error(`  ✗ Error: ${e.message}`);
                }
            }
            
        } else {
            // 一般分類
            let count = 0;
            
            try {
                await page.goto(categoryUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
                await page.waitForTimeout(10000); // 增加等待时间
                
                // 直接从当前页面提取所有会议（带各自摘要）
                const allFromPage = await extractAllMeetingsFromPage(page, categoryName, "");
                console.log(`  → Found ${allFromPage.length} meetings on page`);
                
                if (allFromPage.length > 0) {
                    for (const meeting of allFromPage) {
                        if (count >= MAX_MEETINGS_PER_CATEGORY) break;
                        allMeetings.push(meeting);
                        console.log(`  ✓ ${meeting.title.substring(0, 35)} (${meeting.date})...`);
                        count++;
                    }
                } else {
                    // 回退到旧逻辑
                    const subpages = await getAllPageLinks(page);
                    const limitedSubpages = subpages.slice(0, MAX_MEETINGS_PER_CATEGORY);
                    
                    if (limitedSubpages.length === 0) {
                        const info = await extractMeetingInfo(page, categoryName);
                        if (info.title || info.summary) {
                            allMeetings.push({
                                category: categoryName,
                                subcategory: "",
                                title: info.title,
                                date: info.date,
                                summary: info.summary,
                                notes: info.notes
                            });
                            console.log(`  ✓ ${info.title.substring(0, 35)}...`);
                            count++;
                        }
                    } else {
                        for (const sub of limitedSubpages) {
                            if (count >= MAX_MEETINGS_PER_CATEGORY) break;
                            
                            try {
                                if (sub.url && sub.url.includes('/so/')) {
                                    await page.goto(sub.url, { waitUntil: "domcontentloaded", timeout: 60000 });
                                    await page.waitForTimeout(4000);
                                }
                                
                                const info = await extractMeetingInfo(page, categoryName);
                                
                                if (sub.dateText) {
                                    info.date = parseRelativeDate(sub.dateText);
                                }
                                
                                if (info.title || info.summary) {
                                    allMeetings.push({
                                        category: categoryName,
                                        subcategory: sub.title,
                                        title: info.title,
                                        date: info.date,
                                        summary: info.summary,
                                        notes: info.notes
                                    });
                                    console.log(`  ✓ ${info.title.substring(0, 35)} (${info.date})...`);
                                    count++;
                                }
                            } catch (e) {
                                console.error(`  ✗ Error: ${e.message}`);
                            }
                        }
                    }
                }
            } catch (e) {
                console.error(`✗ Error: ${e.message}`);
            }
        }
    }
    
    await browser.close();
    
    // 存檔
    console.log(`\n總共取得 ${allMeetings.length} 筆會議記錄`);
    console.log(`存檔中：${OUTPUT_FILE}...`);
    
    let markdown = "# JC 會議記錄總整理\n\n";
    markdown += `> 日期：${dateStr}\n`;
    markdown += "> 來源：Notion 公開頁面\n\n";
    markdown += "---\n\n";
    
    let currentCategory = "";
    
    for (const meeting of allMeetings) {
        if (meeting.category !== currentCategory) {
            currentCategory = meeting.category;
            markdown += `\n## ${currentCategory}\n\n`;
        }
        
        const title = meeting.title || "（無標題）";
        markdown += `### ${title}\n`;
        markdown += `- **類別**：\`${meeting.category}\`\n`;
        markdown += `- **子類別**：\`${meeting.subcategory || "（無）"}\`\n`;
        markdown += `- **時間**：\`${meeting.date || "（未知）"}\`\n`;
        
        const summary = meeting.summary || "（無）";
        // 移除长度限制
        markdown += `- **摘要**：${summary}\n`;
        
        const notes = meeting.notes || "（無）";
        // 移除长度限制
        markdown += `- **筆記**：${notes}\n`;
        
        markdown += "\n---\n\n";
    }
    
    fs.writeFileSync(OUTPUT_FILE, markdown, 'utf-8');
    console.log(`✅ 完成！已存進：${OUTPUT_FILE}`);
}

main().catch(console.error);
