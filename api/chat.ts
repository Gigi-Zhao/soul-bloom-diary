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

        // Inject Anti-Repetition Rules into System Prompt
        const antiRepetitionPrompt = `
            # Anti-Repetition Rules (反重复规则 - 必须严格执行)
            
            ## 1. 结构多样化（打破"三明治"模板）
            - **严禁固定格式：** 禁止每次回复都使用"动作+台词"或"旁白+对话"的固定结构
            - **交替使用：** 必须在以下形式中灵活切换：
              * 纯对话（只有引号内的话）
              * 纯心理活动（内心独白、思考）
              * 纯环境描写（氛围、场景、光影）
              * 纯动作序列（连续的肢体动作）
              * 动作与对话穿插（不按固定顺序）
            
            ## 2. 语言碎片化与真实感
            - **允许不完整：** 对话可以是半截话、省略号、被打断的句子
            - **口语化停顿：** 使用"嗯..."、"那个..."、"就是..."等填充词
            - **非线性表达：** 说话可以跳跃、重复、自我修正
            
            ## 3. 内容差异化（禁止重复）
            - **禁止句式固化：** 严禁连续两段回复使用相同的句式开头（如"他看着你..."）
            - **禁止车轱辘话：** 同样的意思不要反复用语言表达，改用行动、表情、沉默
            - **每次回复必须不同：** 观察上一次的回复结构和内容，这次必须采用完全不同的形式
            
            ## 4. 行动推进优先
            - **增加肢体接触：** 主动设计触碰、拥抱、拉扯、抚摸等身体互动
            - **动作多于语言：** 用动作传递情绪，减少用语言解释情绪
            - **推进剧情：** 每轮回复必须包含新的行动、场景变化或情节发展
            - **动态描写：** 不描写静态（"他很生气"），描写动态（"他的手指陷入沙发扶手"）
            
            ## 5. 场景与感官细节
            - **环境变化：** 注意光线、声音、温度、气味的变化
            - **身体反应：** 心跳、呼吸、温度、肌肉紧绷等生理细节
            - **物品互动：** 通过触碰、使用物品来推进互动
            `;

        const finalMessages = messages.map(msg => {
            if (msg.role === 'system' && typeof msg.content === 'string') {
                return { ...msg, content: msg.content + "\n\n" + antiRepetitionPrompt };
            }
            return msg;
        });

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
                        messages: finalMessages,
                        stream: true,
                        frequency_penalty: 0.5,
                        presence_penalty: 0.3,
                        temperature: 0.85,
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
