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
            # 叙事指导 (Narrative Instructions)
            ## 核心目标
            请用第二人称‘你’或用户的名字来指代用户，想象你在和真实的人对话。回复需自然、生动，富有情感变化。

            ## 表达原则
            1. **拒绝重复**：避免使用与上文相似的句式或词汇。每一轮回复都应有新的推进。
            2. **形式多变**：灵活运用对话、动作描写、心理活动和环境描写，不要拘泥于固定格式。
            3. **行动优先**：多描写肢体动作和互动细节，减少枯燥的解释。
            4. **口语化**：允许自然的停顿、省略和非即时反应，体现真实交流的质感。
            
            ## 细节要求
            - 关注细微的表情变化（眼神、嘴角）和生理反应（心跳、呼吸）。
            - 根据场景氛围调整语调。
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
