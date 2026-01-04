/**
 * 生成对话标题的 API 端点（非流式响应）
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

        // 获取模型列表
        const models = getChatModelsForRequest();
        const endpoint = "https://openrouter.ai/api/v1/chat/completions";
        let openrouterRes: Response | null = null;
        let lastErrorText = "";
        let lastStatus = 500;

        // 依次尝试模型
        for (const m of models) {
            try {
                console.log(`[Title API] Calling upstream model ${m}`);
                const response = await fetch(endpoint, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${apiKey}`,
                        "HTTP-Referer": req.headers.referer || "https://soul-bloom-diary.vercel.app",
                        "X-Title": "Soul Bloom Diary",
                    },
                    body: JSON.stringify({
                        model: m,
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

                if (response.ok) {
                    openrouterRes = response;
                    console.log(`[Title API] Successfully connected to model: ${m}`);
                    break;
                } else {
                    lastStatus = response.status;
                    const text = await response.text().catch(() => "");
                    lastErrorText = `Model ${m} failed: ${response.status} ${text}`;
                    console.warn(`[Title API] ${lastErrorText}`);
                }
            } catch (e) {
                lastErrorText = `Model ${m} error: ${e instanceof Error ? e.message : String(e)}`;
                console.warn(`[Title API] ${lastErrorText}`);
            }
        }

        if (!openrouterRes) {
            return res.status(lastStatus).json({ error: `All models failed. Last error: ${lastErrorText}` });
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
            console.warn('[Title API] Empty title in response');
            return res.status(500).json({ error: 'Failed to generate title', details: 'Empty response from AI' });
        }

        // success
        return res.status(200).json({ title: generatedTitle });

    } catch (err: unknown) {
        console.error('Error generating title:', err);
        return res.status(500).json({ 
            error: err instanceof Error ? err.message : "Internal server error" 
        });
    }
}
