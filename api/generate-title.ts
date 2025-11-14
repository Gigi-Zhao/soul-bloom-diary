/**
 * 生成对话标题的 API 端点（非流式响应）
 */

const DEFAULT_TITLE_MODEL = 'meituan/longcat-flash-chat:free';

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

        // 调用 OpenRouter API（非流式），带重试逻辑（最多3次）
        const endpoint = "https://openrouter.ai/api/v1/chat/completions";
        const maxAttempts = 3;
        let attempt = 0;
        let lastErrorText = "";
        let lastStatus = 500;

        const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

        while (attempt < maxAttempts) {
            attempt += 1;
            try {
                console.log(`[Title API] Attempt ${attempt} - calling upstream model ${usedModel}`);
                const openrouterRes = await fetch(endpoint, {
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

                lastStatus = openrouterRes.status;

                if (!openrouterRes.ok) {
                    // capture body for logging
                    const errorText = await openrouterRes.text().catch(() => "");
                    lastErrorText = errorText;
                    console.warn(`[Title API] Upstream returned status ${openrouterRes.status}: ${errorText}`);

                    // Retry on rate limit (429) or server errors (5xx)
                    if (openrouterRes.status === 429 || (openrouterRes.status >= 500 && openrouterRes.status < 600)) {
                        if (attempt < maxAttempts) {
                            const backoff = attempt * 1000; // 1s, 2s, 3s
                            console.log(`[Title API] Retrying after ${backoff}ms...`);
                            await sleep(backoff);
                            continue;
                        }
                    }

                    // Non-retriable or exhausted retries -> return error
                    return res.status(openrouterRes.status).json({ error: `Upstream error: ${errorText}` });
                }

                // parse JSON
                const data = await openrouterRes.json() as {
                    choices?: Array<{
                        message?: {
                            content?: string;
                        };
                    }>;
                };

                const generatedTitle = data.choices?.[0]?.message?.content?.trim();

                if (!generatedTitle) {
                    lastErrorText = JSON.stringify(data);
                    console.warn('[Title API] Empty title in response, will retry if attempts remain');
                    if (attempt < maxAttempts) {
                        const backoff = attempt * 1000;
                        await sleep(backoff);
                        continue;
                    }
                    return res.status(500).json({ error: 'Failed to generate title', details: lastErrorText });
                }

                // success
                return res.status(200).json({ title: generatedTitle });
            } catch (err: unknown) {
                console.error('[Title API] Request error:', err);
                if (attempt < maxAttempts) {
                    const backoff = attempt * 1000;
                    console.log(`[Title API] Network error, retrying after ${backoff}ms`);
                    await sleep(backoff);
                    continue;
                }

                return res.status(500).json({ error: err instanceof Error ? err.message : 'Network error' });
            }
        }

        // exhausted retries
        return res.status(lastStatus || 500).json({ error: `Upstream error after ${maxAttempts} attempts`, details: lastErrorText });

    } catch (err: unknown) {
        console.error('Error generating title:', err);
        return res.status(500).json({ 
            error: err instanceof Error ? err.message : "Internal server error" 
        });
    }
}
