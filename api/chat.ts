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
                        messages,
                        stream: true,
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

        // Forward as plain text data lines; preserve spaces and newlines
        const sendData = (text: string) => {
            res.write(`data: ${text}\n\n`);
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
