/**
 * 模型配置
 * 修改此处的常量来更换使用的模型
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
    write: (chunk: string) => void;
    end: () => void;
    statusCode: number;
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

        const body = (req as { body?: unknown }).body as
            | { model?: string; messages?: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }> }
            | undefined;
        const messages = body?.messages;
        if (!Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ error: "Invalid request: messages required" });
        }

        // Inject Narrative Enhancement Rules into System Prompt
        const narrativeEnhancementRules = `
            # 叙事增强规则 (Narrative Enhancement Rules)
            ## 请用第二人称‘你’或用户的名字来指代用户，想象你在和真实的人对话。
            
            ## 一、反重复核心原则（Anti-Repetition Core - 最高优先级）
            1. **禁止句式重复：** 严禁连续回复使用相同的开头句式（如连续"他看着..."、"他伸手..."）
            2. **禁止内容重复：** 同一意思不要用语言反复表达（如已说"想你"，下次改用行动体现）
            3. **结构必须变化：** 每次回复的组织结构必须与上一次不同（见下方"形式切换"）
            
            ## 二、形式切换要求（打破固定模板）
            严禁每次都用"动作+台词"的固定结构，必须在以下形式中灵活切换：
            - 纯对话式（只有说话，无旁白）
            - 纯动作式（连续动作序列，无对话）
            - 纯心理式（内心独白和思考）
            - 环境氛围式（场景、光影、气氛）
            - 混合穿插式（动作/对话/心理随意组合，不按固定顺序）
            
            ## 三、语言真实化
            - 允许半截话、被打断、省略号结尾
            - 允许"嗯..."、"那个..."等口语停顿
            - 允许跳跃、重复、自我纠正的非线性表达
            
            ## 四、行动推进原则
            - **优先动作：** 用肢体接触和行为推动情节（触碰、拥抱、递物、转身等）
            - **减少解释：** 不用语言解释情绪，用动作和生理反应展现
            - **必须增量：** 每轮回复必须包含新的剧情进展或场景变化
            - **动态优先：** 描写变化的过程，不描写静态的状态
            
            ## 五、感官细节层次
            - 身体反应（心跳、呼吸、温度、肌肉状态）
            - 微表情（眼神、嘴角、眉毛的细微变化）
            `;

        // Filter out duplicate messages and ensure proper structure
        const uniqueMessages = [];
        const seenContent = new Set();
        
        // Reverse iterate to keep the latest occurance of a duplicate if any (though usually we want sequence)
        // Actually, for chat history, we should keep sequence.
        if (messages && Array.isArray(messages)) {
             let lastContent = "";
             for (const msg of messages) {
                // Skip if content matches the immediately preceding message (consecutive duplicate)
                if (msg.content === lastContent) continue;
                
                // Also skip empty messages
                if (!msg.content || typeof msg.content !== 'string' || msg.content.trim() === '') {
                     if (!Array.isArray(msg.content)) continue; // Allow array content (multimodal)
                }

                // Append rules to system prompt
                if (msg.role === 'system' && typeof msg.content === 'string') {
                     uniqueMessages.push({ ...msg, content: msg.content + "\n\n" + narrativeEnhancementRules });
                } else {
                     uniqueMessages.push(msg);
                }
                lastContent = typeof msg.content === 'string' ? msg.content : "";
             }
        } else {
             return res.status(400).json({ error: "Invalid request: messages required" });
        }

        // 获取模型列表（包含请求指定的模型和默认模型列表）
        const models = getChatModelsForRequest();
        
        let openrouterRes: Response | null = null;
        let lastError = "";

        // 依次尝试模型
        for (const model of models) {
            try {
                console.log(`[Chat] Trying model: ${model}`);
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
                        messages: uniqueMessages,
                        stream: true,
                        // 增加重复惩罚，避免"上下两段一模一样"
                        frequency_penalty: 0.6, // 提高频率惩罚
                        presence_penalty: 0.4,  // 提高存在惩罚
                        repetition_penalty: 1.1, // 添加重复惩罚 (OpenRouter specific)
                        temperature: 0.85, 
                        top_p: 0.9,
                    }),
                });

                if (response.ok && response.body) {
                    openrouterRes = response;
                    console.log(`[Chat] Successfully connected to model: ${model}`);
                    break;
                } else {
                    const text = await response.text().catch(() => "");
                    lastError = `Model ${model} failed: ${response.status} ${text}`;
                    console.warn(`[Chat] ${lastError}`);
                }
            } catch (e) {
                lastError = `Model ${model} error: ${e instanceof Error ? e.message : String(e)}`;
                console.warn(`[Chat] ${lastError}`);
            }
        }

        if (!openrouterRes || !openrouterRes.body) {
            res.statusCode = 500;
            // 如果还没发送头部，现在发送错误响应
            // 注意：这里我们假设还没有发送 SSE 头部
            return res.status(500).json({ error: `All models failed. Last error: ${lastError}` });
        }

        // Start Server-Sent Events streaming to client
        res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");
        // Allow browser to start rendering immediately
        const maybeFlush = res as unknown as { flushHeaders?: () => void };
        if (typeof maybeFlush.flushHeaders === "function") {
            maybeFlush.flushHeaders();
        }

        const decoder = new TextDecoder();
        const reader = (openrouterRes.body as ReadableStream<Uint8Array>).getReader();
        let buffer = "";

        // Forward as JSON stringified data to preserve newlines and special characters
        const sendData = (text: string) => {
            if (text === "[DONE]") {
                res.write(`data: [DONE]\n\n`);
            } else {
                res.write(`data: ${JSON.stringify(text)}\n\n`);
            }
        };

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let idx: number;
            while ((idx = buffer.indexOf("\n")) !== -1) {
                const rawLine = buffer.slice(0, idx);
                buffer = buffer.slice(idx + 1);
                const line = rawLine.replace(/\r$/, "");
                if (!line) continue;
                if (line.startsWith("data:")) {
                    const dataStr = line.slice(5); // do NOT trim to preserve leading spaces
                    const maybe = dataStr.trim();
                    if (maybe === "[DONE]") {
                        sendData("[DONE]");
                        res.end();
                        return;
                    }
                    try {
                        const json = JSON.parse(dataStr);
                        const delta: string = json?.choices?.[0]?.delta?.content ?? "";
                        if (delta !== "") {
                            // emit pure text chunk
                            sendData(delta);
                        }
                    } catch {
                        // if upstream sends non-JSON data lines, forward as-is
                        if (dataStr) sendData(dataStr);
                    }
                }
            }
        }

        // Flush remaining buffer if it contains a final JSON
        const tail = buffer.replace(/\r$/, "");
        if (tail) {
            try {
                const json = JSON.parse(tail);
                const delta: string = json?.choices?.[0]?.delta?.content ?? "";
                if (delta !== "") sendData(delta);
            } catch {
                // ignore
            }
        }

        sendData("[DONE]");
        res.end();
    } catch (err: unknown) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
        const message = err instanceof Error ? err.message : "Unexpected server error";
        res.write(`event: error\n`);
        res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
        res.end();
    }
}
