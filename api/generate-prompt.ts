interface VercelRequestLike {
    method?: string;
    headers: Record<string, string | undefined>;
    body?: unknown;
}

interface VercelResponseLike {
    setHeader: (name: string, value: string) => void;
    status: (code: number) => VercelResponseLike;
    json: (body: unknown) => void;
}

export default async function handler(req: VercelRequestLike, res: VercelResponseLike) {
    // Handle OPTIONS for CORS
    if (req.method === "OPTIONS") {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        return res.status(200).json({});
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
            return res.status(500).json({ error: "Server misconfigured: OPENROUTER_API_KEY missing" });
        }

        const body = (req as { body?: unknown }).body as {
            name?: string;
            description?: string;
            tags?: string[];
            mbtiType?: string;
            catchphrase?: string;
        } | undefined;

        const { name, description, tags, mbtiType, catchphrase } = body || {};

        if (!name || !description) {
            return res.status(400).json({ error: "Invalid request: name and description required" });
        }

        // Generate a comprehensive system prompt for the AI character
        const promptRequest = `根据以下角色信息，生成一个详细的AI角色扮演系统提示词（直接返回提示词内容，不要有额外说明）：

角色名字：${name}
角色设定：${description}
性格标签：${tags?.join('、') || '无'}
MBTI类型：${mbtiType || '无'}
口头禅：${catchphrase || '无'}

要求：
1. 提示词要让AI完全沉浸在这个角色中
2. 包含角色的性格、说话方式、行为特点
3. 如果有MBTI类型，要体现该类型的特征
4. 要提醒AI适当使用口头禅
5. 提示词要详细但不超过300字
6. 使用第一人称`;

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
                "HTTP-Referer": req.headers.referer || "https://soul-bloom-diary.vercel.app",
                "X-Title": "Soul Bloom Diary",
            },
            body: JSON.stringify({
                model: "mistralai/mistral-small:free",
                messages: [
                    {
                        role: "user",
                        content: promptRequest
                    }
                ],
            }),
        });

        if (!response.ok) {
            const text = await response.text().catch(() => "");
            console.error("OpenRouter error:", response.status, text);
            return res.status(response.status).json({ error: `Upstream error: ${text}` });
        }

        const data = await response.json();
        const prompt = data.choices?.[0]?.message?.content;

        if (!prompt) {
            return res.status(500).json({ error: "No response from AI" });
        }

        return res.status(200).json({ prompt: prompt.trim() });
    } catch (err: unknown) {
        console.error("Error in generate-prompt:", err);
        const message = err instanceof Error ? err.message : "Unexpected server error";
        return res.status(500).json({ error: message });
    }
}
