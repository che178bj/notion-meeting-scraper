#!/usr/bin/env node
/**
 * 将原始爬虫输出转换为按日期分类的 Markdown 格式
 */

const fs = require('fs');
const path = require('path');

const INPUT_FILE = '/home/ubuntu/.openclaw/workspace/meetings_2026-02-19.md';
const OUTPUT_ROOT = '/home/ubuntu/.openclaw/workspace/notion-meeting-scraper/output-v2';

function parseOriginalFormat(content) {
    const meetings = [];
    const lines = content.split('\n');
    
    let currentCategory = '';
    let currentMeeting = null;
    let inSummary = false;
    let inNotes = false;
    let summaryLines = [];
    let notesLines = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();
        
        // 检测分类标题 ## 
        if (trimmedLine.startsWith('## ') && !trimmedLine.startsWith('### ')) {
            currentCategory = trimmedLine.replace('## ', '').trim();
            continue;
        }
        
        // 检测会议标题 ###
        if (trimmedLine.startsWith('### ')) {
            // 保存之前的会议
            if (currentMeeting) {
                currentMeeting.summary = summaryLines.join('\n').trim();
                currentMeeting.notes = notesLines.join('\n').trim();
                if (currentMeeting.notes === '（無）' || currentMeeting.notes === '') {
                    currentMeeting.notes = '';
                }
                meetings.push(currentMeeting);
            }
            
            const title = trimmedLine.replace('### ', '').trim();
            currentMeeting = {
                category: currentCategory,
                subcategory: '',
                title: title,
                date: '',
                summary: '',
                notes: ''
            };
            inSummary = false;
            inNotes = false;
            summaryLines = [];
            notesLines = [];
            continue;
        }
        
        // 检测子类别
        if (trimmedLine.includes('**子類別**')) {
            // 使用简单匹配 - 提取两个 ` 之间的内容
            const match = trimmedLine.match(/`(.+?)`/);
            if (match && currentMeeting) {
                currentMeeting.subcategory = match[1];
                if (currentMeeting.subcategory === '（無）') {
                    currentMeeting.subcategory = '';
                }
            }
            continue;
        }
        
        // 检测时间字段 - 使用简单匹配
        if (trimmedLine.includes('**時間**')) {
            // 使用简单匹配 - 提取日期
            const match = trimmedLine.match(/`(.+?)`/);
            if (match && currentMeeting) {
                const dateStr = match[1];
                const dateMatch = dateStr.match(/(\d+)年(\d+)月(\d+)日/);
                if (dateMatch) {
                    currentMeeting.date = dateMatch[0];
                }
            }
            continue;
        }
        
        // 检测摘要开始
        if (trimmedLine.includes('**摘要**')) {
            inSummary = true;
            inNotes = false;
            // 提取冒号后面的内容
            const match = trimmedLine.match(/摘要[：:]\s*(.+)/);
            if (match) {
                summaryLines.push(match[1]);
            }
            continue;
        }
        
        // 检测笔记开始
        if (trimmedLine.includes('**筆記**')) {
            inSummary = false;
            inNotes = true;
            // 提取冒号后面的内容
            const match = trimmedLine.match(/筆記[：:]\s*(.+)/);
            if (match) {
                notesLines.push(match[1]);
            }
            continue;
        }
        
        // 收集摘要内容
        if (inSummary && trimmedLine) {
            // 检查是否是新的字段标记（如 ### 或 --- 或新的 - **）
            if (trimmedLine.startsWith('---') || trimmedLine.startsWith('## ')) {
                inSummary = false;
                continue;
            }
            // 如果是列表项或段落内容，加入摘要
            if (trimmedLine.startsWith('- ')) {
                summaryLines.push(trimmedLine.substring(2));
            } else if (!trimmedLine.startsWith('- **')) {
                summaryLines.push(trimmedLine);
            }
        }
        
        // 收集笔记内容
        if (inNotes && trimmedLine) {
            if (trimmedLine.startsWith('---') || trimmedLine.startsWith('## ')) {
                inNotes = false;
                continue;
            }
            if (trimmedLine.startsWith('- ')) {
                notesLines.push(trimmedLine.substring(2));
            } else if (!trimmedLine.startsWith('- **')) {
                notesLines.push(trimmedLine);
            }
        }
    }
    
    // 保存最后一个会议
    if (currentMeeting) {
        currentMeeting.summary = summaryLines.join('\n').trim();
        currentMeeting.notes = notesLines.join('\n').trim();
        if (currentMeeting.notes === '（無）' || currentMeeting.notes === '') {
            currentMeeting.notes = '';
        }
        meetings.push(currentMeeting);
    }
    
    return meetings;
}

function convertDateToIso(dateStr) {
    if (!dateStr) return '';
    
    // 格式: 2025年11月24日
    const match = dateStr.match(/(\d+)年(\d+)月(\d+)日/);
    if (match) {
        const year = match[1];
        const month = match[2].padStart(2, '0');
        const day = match[3].padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    return '';
}

function sanitizeFilename(name) {
    if (!name) return '';
    // 使用子类别名称（如果有的话）
    const safe = (name || '')
        .replace(/\//g, '-')
        .replace(/&/g, 'and')
        .replace(/ /g, '_')
        .replace(/[\\:*?"<>|]/g, '')
        .substring(0, 50);
    return safe;
}

function formatMeetingMarkdown(meeting) {
    const dateIso = convertDateToIso(meeting.date);
    const dateStr = dateIso.replace(/-/g, '');
    
    const lines = [
        '---',
        `category: ${meeting.category}`,
        `subcategory: ${meeting.subcategory || ''}`,
        `date: ${dateIso}`,
        `crawled_at: ${new Date().toISOString()}`,
        '---',
        '',
        '## 📋 會議資訊',
        '',
        '| 項目 | 內容 |',
        '|------|------|',
        `| 分類 | ${meeting.category} |`,
        meeting.subcategory ? `| 子類別 | ${meeting.subcategory} |` : '',
        `| 日期 | ${meeting.date} |`,
        '',
        '---',
        ''
    ];
    
    // 过滤空行
    lines.push(`## 📋 ${meeting.title}`);
    lines.push('');
    
    if (meeting.summary) {
        lines.push('## 📝 摘要');
        lines.push('');
        lines.push(meeting.summary);
        lines.push('');
    }
    
    if (meeting.notes) {
        lines.push('## 📓 筆記');
        lines.push('');
        meeting.notes.split('\n').forEach(line => {
            if (line.trim()) {
                lines.push(`- ${line.trim()}`);
            }
        });
        lines.push('');
    }
    
    lines.push('---');
    
    return lines.join('\n');
}

// 主程序
function main() {
    console.log('读取原始输出...');
    const content = fs.readFileSync(INPUT_FILE, 'utf-8');
    
    console.log('解析会议...');
    const meetings = parseOriginalFormat(content);
    
    console.log(`找到 ${meetings.length} 个会议`);
    
    // 显示前几个会议
    meetings.slice(0, 3).forEach(m => {
        console.log(`\n--- ${m.title} (${m.date}) ---`);
        console.log(`摘要: ${m.summary.substring(0, 100)}...`);
        console.log(`笔记: ${m.notes ? m.notes.substring(0, 50) : '(无)'}`);
    });
    
    // 创建输出目录
    if (!fs.existsSync(OUTPUT_ROOT)) {
        fs.mkdirSync(OUTPUT_ROOT, { recursive: true });
    }
    
    // 按日期分类保存
    let totalSaved = 0;
    
    for (const meeting of meetings) {
        const dateIso = convertDateToIso(meeting.date);
        
        if (!dateIso) {
            console.log(`⚠️ 跳过: ${meeting.title} (无日期)`);
            continue;
        }
        
        const dateFolder = path.join(OUTPUT_ROOT, dateIso);
        if (!fs.existsSync(dateFolder)) {
            fs.mkdirSync(dateFolder, { recursive: true });
        }
        
        const dateStr = dateIso.replace(/-/g, '');
        // 使用子类别+分类作为文件名
        const namePart = meeting.subcategory 
            ? `${sanitizeFilename(meeting.subcategory)}-${sanitizeFilename(meeting.category)}`
            : sanitizeFilename(meeting.category);
        const filename = `meetings-${namePart}-${dateStr}.md`;
        const filepath = path.join(dateFolder, filename);
        
        const markdown = formatMeetingMarkdown(meeting);
        fs.writeFileSync(filepath, markdown, 'utf-8');
        
        console.log(`💾 ${dateIso}: ${filename}`);
        totalSaved++;
    }
    
    console.log(`\n✅ 完成！共保存 ${totalSaved} 个会议`);
}

main();
