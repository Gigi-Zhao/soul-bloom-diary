/**
 * AI Comment Generation API
 * Generates AI role comments for journal entries
 */

const DEFAULT_MODEL = 'meituan/longcat-flash-chat:free';

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

    const usedModel = (model && model.trim()) ? model : DEFAULT_MODEL;
    
    console.log('[generate-comment] Generating comment for:', {
      aiRoleName,
      mood: journalMood,
      contentLength: journalContent.length,
      model: usedModel
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

    const openrouterRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": req.headers.referer || "https://soul-bloom-diary.vercel.app",
        "X-Title": "Soul Bloom Diary",
      },
      body: JSON.stringify({
        model: usedModel,
        messages,
        temperature: 0.8,
        max_tokens: 300,
      }),
    });

    if (!openrouterRes.ok) {
      const errorText = await openrouterRes.text().catch(() => "");
      console.error('[generate-comment] OpenRouter error:', openrouterRes.status, errorText);
      return res.status(openrouterRes.status).json({ 
        error: `AI service error: ${openrouterRes.status}`,
        details: errorText 
      });
    }

    const data = await openrouterRes.json();
    const comment = data.choices?.[0]?.message?.content?.trim();

    if (!comment) {
      console.error('[generate-comment] No comment generated:', data);
      return res.status(500).json({ error: "Failed to generate comment" });
    }

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
