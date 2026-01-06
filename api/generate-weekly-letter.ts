/**
 * Generate Weekly Summary Letter API
 * 生成周度总结信件
 */

import { getChatModelsForRequest } from '../src/lib/model-config.js';

interface VercelRequestLike {
  method?: string;
  headers: Record<string, string | undefined>;
  body?: unknown;
}

interface VercelResponseLike {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => VercelResponseLike;
  json: (body: unknown) => void;
  end?: () => void;
}

export default async function handler(req: VercelRequestLike, res: VercelResponseLike) {
  // 仅允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body as { 
      journalEntries: Array<{
        date: string;
        mood?: string;
        content: string;
      }>;
      weekStartDate: string;
      weekEndDate: string;
    };

    const { journalEntries, weekStartDate, weekEndDate } = body;

    if (!journalEntries || !Array.isArray(journalEntries) || journalEntries.length === 0) {
      return res.status(400).json({ error: 'No journal entries provided' });
    }

    // 构建日记摘要
    const journalSummary = journalEntries
      .map(entry => {
        const mood = entry.mood ? `[心情: ${entry.mood}]` : '';
        return `${entry.date} ${mood}\n${entry.content}`;
      })
      .join('\n\n---\n\n');

    // 构建提示词
    const prompt = `你是一位温柔、善解人意的心灵导师。请基于用户本周（${weekStartDate} 至 ${weekEndDate}）的日记内容，撰写一封治愈、温暖的周度总结信件。

**用户本周的日记：**
${journalSummary}

**要求：**
1. 以第二人称"你"称呼用户，语气温柔、关怀、治愈
2. 总结本周的情绪变化、重要事件和成长瞬间
3. 给予积极的肯定和鼓励，帮助用户看到自己的进步
4. 如果发现困扰或压力，给予温柔的建议和支持
5. 展望下周，传递希望和力量
6. 信件长度适中，约300-500字
7. 以温暖的祝福结尾
8. 落款为"你的心灵伙伴"
9. 不要使用markdown格式，直接输出纯文本

请开始撰写这封信：`;

    // 获取模型列表
    const models = getChatModelsForRequest();
    
    let lastError: Error | null = null;
    
    // 依次尝试每个模型
    for (const model of models) {
      try {
        console.log(`[WeeklyLetter] 尝试使用模型: ${model}`);
        
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'HTTP-Referer': 'https://soul-bloom-diary.vercel.app',
            'X-Title': 'Soul Bloom Diary'
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'user', content: prompt }
            ],
            temperature: 0.8,
            max_tokens: 1500
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[WeeklyLetter] 模型 ${model} 请求失败:`, response.status, errorText);
          lastError = new Error(`API returned ${response.status}: ${errorText}`);
          continue;
        }

        const data = await response.json();
        
        if (!data.choices?.[0]?.message?.content) {
          console.error(`[WeeklyLetter] 模型 ${model} 响应格式不正确:`, data);
          lastError = new Error('Invalid response format');
          continue;
        }

        let content = data.choices[0].message.content;

        // 清理输出格式
        content = content
          // 移除可能的markdown标记
          .replace(/```.*?\n/g, '')
          .replace(/```/g, '')
          // 移除标题标记
          .replace(/^#+\s+/gm, '')
          // 移除加粗标记
          .replace(/\*\*(.*?)\*\*/g, '$1')
          // 移除斜体标记
          .replace(/\*(.*?)\*/g, '$1')
          // 合并多个连续空格
          .replace(/[ \t]+/g, ' ')
          // 移除行首行尾空格
          .split('\n')
          .map((line: string) => line.trim())
          .join('\n')
          // 移除超过两个的连续换行
          .replace(/\n{3,}/g, '\n\n')
          .trim();

        console.log(`[WeeklyLetter] ✅ 成功使用模型 ${model} 生成周度总结`);
        
        return res.status(200).json({
          content,
          model,
          weekStartDate,
          weekEndDate
        });

      } catch (error) {
        console.error(`[WeeklyLetter] 模型 ${model} 发生错误:`, error);
        lastError = error instanceof Error ? error : new Error(String(error));
        continue;
      }
    }

    // 所有模型都失败了
    console.error('[WeeklyLetter] ❌ 所有模型都失败了');
    throw lastError || new Error('All models failed');

  } catch (error) {
    console.error('[WeeklyLetter] 生成周度总结时出错:', error);
    return res.status(500).json({ 
      error: 'Failed to generate weekly letter',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
