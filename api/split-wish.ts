/**
 * Split wish into todo list using AI
 * 使用AI将心愿拆解为待办清单
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

    try {
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: "Server misconfigured: OPENROUTER_API_KEY missing" });
        }

        const body = (req as { body?: unknown }).body as { wish?: string } | undefined;
        const wish = body?.wish;

        if (!wish || !wish.trim()) {
            return res.status(400).json({ error: "Invalid request: wish required" });
        }

        const systemPrompt = `你是一个目标拆解专家。用户会给你一个心愿或目标，你需要将它拆解为3-6个具体的、可执行的待办事项。

要求：
1. 待办事项要具体、可操作
2. 按照逻辑顺序排列
3. 每个事项用简洁的中文描述（10-20字）
4. 确保事项之间有递进关系
5. 返回格式为JSON数组，例如：["事项1", "事项2", "事项3"]

只返回JSON数组，不要其他文字。`;

        const userPrompt = `用户的心愿是：${wish.trim()}

请拆解为待办清单（返回JSON数组）：`;

        // 获取模型列表
        const models = getChatModelsForRequest();
        let openrouterRes: Response | null = null;
        let lastError = "";

        // 依次尝试模型
        for (const model of models) {
            try {
                console.log(`[SplitWish] Trying model: ${model}`);
                const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${apiKey}`,
                        "HTTP-Referer": req.headers.referer || "https://soul-bloom-diary.vercel.app",
                        "X-Title": "Soul Bloom Diary",
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: [
                            {
                                role: "system",
                                content: systemPrompt
                            },
                            {
                                role: "user",
                                content: userPrompt
                            }
                        ],
                        temperature: 0.7,
                        max_tokens: 300,
                    }),
                });

                if (response.ok) {
                    openrouterRes = response;
                    console.log(`[SplitWish] Successfully connected to model: ${model}`);
                    break;
                } else {
                    const text = await response.text().catch(() => "");
                    lastError = `Model ${model} failed: ${response.status} ${text}`;
                    console.warn(`[SplitWish] ${lastError}`);
                }
            } catch (e) {
                lastError = `Model ${model} error: ${e instanceof Error ? e.message : String(e)}`;
                console.warn(`[SplitWish] ${lastError}`);
            }
        }

        if (!openrouterRes) {
            return res.status(500).json({ 
                error: "Failed to split wish",
                details: `All models failed. Last error: ${lastError}` 
            });
        }

        const data = await openrouterRes.json() as {
            choices?: Array<{
                message?: {
                    content?: string;
                };
            }>;
        };

        console.log('[SplitWish] OpenRouter响应数据:', JSON.stringify(data, null, 2));

        let todoList: string[] = [];
        const content = data.choices?.[0]?.message?.content?.trim();

        console.log('[SplitWish] AI返回的原始内容:', content);
        console.log('[SplitWish] 内容长度:', content?.length || 0);

        if (content) {
            try {
                // 尝试解析JSON数组
                const jsonMatch = content.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    console.log('[SplitWish] 找到JSON数组:', jsonMatch[0]);
                    todoList = JSON.parse(jsonMatch[0]);
                    console.log('[SplitWish] 解析后的数组:', todoList);
                } else {
                    console.log('[SplitWish] 未找到JSON格式，尝试按行分割');
                    // 如果不是JSON格式，尝试按行分割
                    const lines = content.split('\n');
                    console.log('[SplitWish] 分割后的行数:', lines.length);
                    todoList = lines
                        .map(line => line.trim())
                        .filter(line => line && !line.match(/^[0-9]+[.)]/))
                        .map(line => line.replace(/^[-*•]\s*/, '').trim())
                        .filter(line => line.length > 0)
                        .slice(0, 6);
                    console.log('[SplitWish] 处理后的待办清单:', todoList);
                }
            } catch (parseError) {
                console.error('[SplitWish] ❌ 解析响应失败:', parseError);
                console.error('[SplitWish] 解析错误详情:', {
                    error: parseError instanceof Error ? parseError.message : String(parseError),
                    content: content
                });
                // 使用默认拆解
                todoList = [
                    "明确目标和期望",
                    "制定实施计划",
                    "开始第一步行动",
                    "持续跟踪进度"
                ];
            }
        } else {
            console.warn('[SplitWish] ⚠️ AI返回内容为空');
        }

        // 确保返回的是数组
        if (!Array.isArray(todoList) || todoList.length === 0) {
            console.warn('[SplitWish] ⚠️ 待办清单为空或不是数组，使用默认值');
            todoList = [
                "明确目标和期望",
                "制定实施计划",
                "开始第一步行动",
                "持续跟踪进度"
            ];
        }

        console.log('[SplitWish] ✅ 最终返回的待办清单:', todoList);

        return res.status(200).json({ 
            todoList: todoList.slice(0, 6) // 最多返回6项
        });

    } catch (error) {
        console.error("Error in split-wish:", error);
        return res.status(500).json({ 
            error: "Internal server error",
            details: error instanceof Error ? error.message : "Unknown error"
        });
    }
}

