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
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    try {
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: "Server misconfigured: OPENROUTER_API_KEY missing" });
        }

        const body = (req as { body?: unknown }).body as
            | { model?: string; messages?: Array<{ role: string; content: string }> }
            | undefined;
        const model = body?.model;
        const messages = body?.messages;
        if (!Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ error: "Invalid request: messages required" });
        }

        const usedModel = typeof model === "string" && model.trim() ? model : "minimax/minimax-m2:free";

        // Start Server-Sent Events streaming to client
        res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");
        // Allow browser to start rendering immediately
        const maybeFlush = res as unknown as { flushHeaders?: () => void };
        if (typeof maybeFlush.flushHeaders === "function") {
            maybeFlush.flushHeaders();
        }

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
                stream: true,
            }),
        });

        if (!openrouterRes.ok || !openrouterRes.body) {
            const text = await openrouterRes.text().catch(() => "");
            res.statusCode = openrouterRes.ok ? 500 : openrouterRes.status;
            res.write(`event: error\n`);
            res.write(`data: ${JSON.stringify({ error: `Upstream error: ${text}` })}\n\n`);
            return res.end();
        }

        const decoder = new TextDecoder();
        const reader = (openrouterRes.body as ReadableStream<Uint8Array>).getReader();
        let buffer = "";
        const send = (event: string, data: unknown) => {
            res.write(`event: ${event}\n`);
            res.write(`data: ${typeof data === "string" ? data : JSON.stringify(data)}\n\n`);
        };

        // Forward OpenRouter SSE chunks; normalize to small "token" events for frontend
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let lineEnd: number;
            while ((lineEnd = buffer.indexOf("\n")) !== -1) {
                const line = buffer.slice(0, lineEnd).trim();
                buffer = buffer.slice(lineEnd + 1);
                if (!line) continue;
                if (line.startsWith("data:")) {
                    const dataStr = line.slice(5).trim();
                    if (dataStr === "[DONE]") {
                        send("done", "done");
                        res.end();
                        return;
                    }
                    try {
                        const json = JSON.parse(dataStr);
                        const delta = json?.choices?.[0]?.delta?.content ?? "";
                        if (delta) {
                            send("token", delta);
                        }
                    } catch {
                        // Forward raw line if not JSON
                        send("token", dataStr);
                    }
                }
            }
        }

        // Flush remaining buffer if any
        if (buffer.trim()) {
            try {
                const json = JSON.parse(buffer.trim());
                const delta = json?.choices?.[0]?.delta?.content ?? "";
                if (delta) send("token", delta);
            } catch {
                send("token", buffer.trim());
            }
        }

        send("done", "done");
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
