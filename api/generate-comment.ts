/**
 * AI Comment Generation API
 * Generates AI role comments for journal entries
 */

import { getChatModelsForRequest } from './model-config';

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
  // Handle OPTIONS for CORS
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.status(200);
    if (res.end) res.end();
    return;
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error('[generate-comment] OPENROUTER_API_KEY missing');
      return res.status(500).json({ error: "Server misconfigured: API key missing" });
    }

    const body = (req as { body?: unknown }).body as
      | { 
          journalContent: string;
          journalMood: string;
          aiRoleName: string;
          aiRolePrompt: string;
          model?: string;
        }
      | undefined;

    const { journalContent, journalMood, aiRoleName, aiRolePrompt, model } = body || {};

    if (!journalContent || !journalMood || !aiRoleName || !aiRolePrompt) {
      console.error('[generate-comment] Missing required fields:', { 
        hasContent: !!journalContent, 
        hasMood: !!journalMood, 
        hasName: !!aiRoleName, 
        hasPrompt: !!aiRolePrompt 
      });
      return res.status(400).json({ error: "Missing required fields" });
    }

    console.log('[generate-comment] Generating comment for:', {
      aiRoleName,
      mood: journalMood,
      contentLength: journalContent.length,
      model: model || 'default list'
    });

    // Construct the prompt for AI comment generation
    const systemPrompt = `${aiRolePrompt}

你现在要以${aiRoleName}的身份，对用户的日记进行评论。请注意：
1. 评论应该简短（50-150字），温暖且有个性
2. 根据日记的心情（${journalMood}）给予适当的回应
3. 保持你角色的独特风格和语气
4. 不要使用"作为XX"这样的开头，直接给出评论
5. 可以适当使用emoji增加亲和力`;

    const userPrompt = `用户的日记内容：
${journalContent}

心情：${journalMood}

请给出你的评论：`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ];

    console.log('[generate-comment] Calling OpenRouter API...');

    // 获取模型列表
    const models = getChatModelsForRequest();
    let openrouterRes: Response | null = null;
    let lastError = "";

    // 依次尝试模型
    for (const m of models) {
        try {
            console.log(`[generate-comment] Trying model: ${m}`);
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`,
                    "HTTP-Referer": req.headers.referer || "https://soul-bloom-diary.vercel.app",
                    "X-Title": "Soul Bloom Diary",
                },
                body: JSON.stringify({
                    model: m,
                    messages,
                    temperature: 0.8,
                    max_tokens: 300,
                }),
            });

            if (response.ok) {
                openrouterRes = response;
                console.log(`[generate-comment] Successfully connected to model: ${m}`);
                break;
            } else {
                const text = await response.text().catch(() => "");
                lastError = `Model ${m} failed: ${response.status} ${text}`;
                console.warn(`[generate-comment] ${lastError}`);
            }
        } catch (e) {
            lastError = `Model ${m} error: ${e instanceof Error ? e.message : String(e)}`;
            console.warn(`[generate-comment] ${lastError}`);
        }
    }

    if (!openrouterRes) {
      console.error('[generate-comment] All models failed:', lastError);
      return res.status(500).json({ error: `All models failed. Last error: ${lastError}` });
    }

    const data = await openrouterRes.json();
    let comment = data.choices?.[0]?.message?.content?.trim();

    if (!comment) {
      console.error('[generate-comment] No comment generated:', data);
      return res.status(500).json({ error: "Failed to generate comment" });
    }

    // 格式化评论，去除多余空格（特别是中文字符之间的空格）
    let formatted = comment.trim();
    
    // 循环处理，直到没有更多中文字符之间的空格
    let previousResult = '';
    while (formatted !== previousResult) {
      previousResult = formatted;
      // 去除中文字符/数字/emoji之间的单个空格
      formatted = formatted.replace(/([\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef0-9\u{1F300}-\u{1F9FF}]) +([\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef0-9\u{1F300}-\u{1F9FF}])/gu, '$1$2');
      // 去除中文字符和中文标点之间的空格
      formatted = formatted.replace(/([\u4e00-\u9fa5]) +([，。！？；：、""''（）【】《》])/g, '$1$2');
      formatted = formatted.replace(/([，。！？；：、""''（）【】《》]) +([\u4e00-\u9fa5])/g, '$1$2');
      // 去除中文标点之间的空格
      formatted = formatted.replace(/([，。！？；：、""''（）【】《》]) +([，。！？；：、""''（）【】《》])/g, '$1$2');
    }
    
    comment = formatted
      // 合并多个连续空格为单个空格（但保留换行符）
      .replace(/[ \t]+/g, ' ')
      // 去除行首行尾空格（但保留换行符）
      .split('\n')
      .map(line => line.trim())
      .join('\n')
      // 去除超过两个的连续换行符
      .replace(/\n{3,}/g, '\n\n')
      // 最后再次去除首尾空白
      .trim();

    console.log('[generate-comment] Comment generated successfully:', {
      aiRoleName,
      commentLength: comment.length
    });

    return res.status(200).json({ comment });

  } catch (error) {
    console.error('[generate-comment] Error:', error);
    return res.status(500).json({ 
      error: "Internal server error",
      message: error instanceof Error ? error.message : String(error)
    });
  }
}
