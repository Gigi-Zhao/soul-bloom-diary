/**
 * 生成对话标题的 API 端点（非流式响应）
 */

const DEFAULT_TITLE_MODEL = 'mistralai/mistral-small-3.2-24b-instruct:free';

interface VercelRequestLike {
    method?: string;
    headers: Record<string, string | undefined>;
    body?: unknown;
}

interface VercelResponseLike {
    setHeader: (name: string, value: string) => void;
    status: (code: number) => VercelResponseLike;
    json: (body: unknown) => void;
    end: () => void;
}

export default async function handler(req: VercelRequestLike, res: VercelResponseLike) {
    // Handle OPTIONS for CORS
    if (req.method === "OPTIONS") {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        return res.status(200).end();
    }

    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    // Set CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/json");

    try {
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: "Server misconfigured: OPENROUTER_API_KEY missing" });
        }

        const body = (req as { body?: unknown }).body as
            | { model?: string; prompt?: string }
            | undefined;
        
        const model = body?.model;
        const prompt = body?.prompt;
        
        if (!prompt || typeof prompt !== 'string') {
            return res.status(400).json({ error: "Invalid request: prompt required" });
        }

        // 使用配置的模型或请求指定的模型
        const usedModel = (model && model.trim()) ? model : DEFAULT_TITLE_MODEL;

        // 调用 OpenRouter API（非流式）
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
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 50,
                stream: false, // 非流式响应
            }),
        });

        if (!openrouterRes.ok) {
            const errorText = await openrouterRes.text().catch(() => "");
            return res.status(openrouterRes.status).json({ 
                error: `Upstream error: ${errorText}` 
            });
        }

        // 解析 JSON 响应
        const data = await openrouterRes.json() as {
            choices?: Array<{
                message?: {
                    content?: string;
                };
            }>;
        };

        const generatedTitle = data.choices?.[0]?.message?.content?.trim();

        if (!generatedTitle) {
            return res.status(500).json({ error: "Failed to generate title" });
        }

        // 返回生成的标题
        return res.status(200).json({ title: generatedTitle });

    } catch (err: unknown) {
        console.error('Error generating title:', err);
        return res.status(500).json({ 
            error: err instanceof Error ? err.message : "Internal server error" 
        });
    }
}
