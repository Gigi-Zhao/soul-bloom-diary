/**
 * 模型配置
 * 修改此处的常量来更换使用的模型
 */

import { getChatModelsForRequest } from '../src/lib/model-config.js';

// Helper to extract clean sentences for duplicate detection
function extractSentences(text: string): Set<string> {
    if (!text || typeof text !== 'string') return new Set();
    // Split by Chinese/English sentence terminators
    return new Set(
        text.split(/([。！？.!?\n]+)/)
            .map(s => s.trim())
            .filter(s => s.length > 6) // Minimal length to avoid matching "Yes", "Hello", etc.
    );
}

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
            ## 请用第二人称‘你’或用户的名字来指代用户，想象你在和真实的人对话，完全代入情境中。
            
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

        const finalMessages = messages.map(msg => {
            if (msg.role === 'system' && typeof msg.content === 'string') {
                return { ...msg, content: msg.content + "\n\n" + narrativeEnhancementRules };
            }
            return msg;
        });

        // 获取模型列表（包含请求指定的模型和默认模型列表）
        const models = getChatModelsForRequest();
        
        let lastError = "";

        // Collect all previous message sentences for strict duplicate checking
        const historySentences = new Set<string>();
        if (messages && Array.isArray(messages)) {
            messages.forEach(msg => {
                if ((msg.role === 'assistant' || msg.role === 'user') && typeof msg.content === 'string') {
                   const sents = extractSentences(msg.content);
                   sents.forEach(s => historySentences.add(s));
                }
            });
        }

        // Retry Loop for Duplicate Content
        const maxRetries = 3; 
        let currentMessages = [...finalMessages];

        // 依次尝试模型
        for (const model of models) {
             let retryCount = 0;
             while(retryCount <= maxRetries) {
                try {
                    console.log(`[Chat] Trying model: ${model}, Attempt: ${retryCount + 1}`);
                    
                    // On retry, we use non-streaming to inspect content first
                    // But to keep simple structure we stream but buffer it? 
                    // Better: We request non-streaming for validation, then if valid, we send it out.
                    // However, that prevents streaming UI effect.
                    // Compromise: We stream, but if we detect duplicates, we abort and retry silently? 
                    // No, client already receiving stream. 
                    // Better Strategy here: We MUST request full completion first, check it, then stream it out via our own stream if good.
                    // This adds latency but guarantees unique content.
                    
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
                            messages: currentMessages,
                            stream: false, // Turn off streaming to validate content
                            frequency_penalty: 0.5,
                            presence_penalty: 0.3,
                            temperature: 0.85,
                        }),
                    });

                    if (!response.ok) {
                        const text = await response.text().catch(() => "");
                        lastError = `Model ${model} failed: ${response.status} ${text}`;
                        console.warn(`[Chat] ${lastError}`);
                        break; // Try next model on API error
                    }

                    const json = await response.json();
                    const content = json.choices?.[0]?.message?.content || "";

                    // 1. Check for sentence-level duplicates
                    const newSentences = extractSentences(content);
                    const duplicateSentences: string[] = [];
                    for (const s of newSentences) {
                        if (historySentences.has(s)) {
                            duplicateSentences.push(s);
                        }
                    }

                    if (duplicateSentences.length > 0) {
                        console.warn(`[Chat] Detected duplicate content (Attempt ${retryCount+1}):`, duplicateSentences);
                        
                        // REJECT & RETRY
                        if (retryCount < maxRetries) {
                            retryCount++;
                            // Add direct instruction to avoid specific duplicated sentences
                            const warningMsg = {
                                role: "system",
                                content: `[SYSTEM WARNING] Your previous response contained repeated sentences found in history. \nABSOLUTELY FORBIDDEN to use these sentences again: \n${duplicateSentences.map(s => `"${s}"`).join('\n')}\n\nPlease rewrite entirely with new phrasing and actions.`
                            };
                            // Append warning temporary to messages
                           currentMessages = [...finalMessages, warningMsg];
                           continue;
                        } else {
                            // Max retries reached, just accept it (fallback)
                            console.warn("[Chat] Max retries reached for duplicates. Sending anyway.");
                            // Fall through to send logic
                        }
                    }

                    // Content is valid (or max retries), stream it back to client manually
                    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
                    res.setHeader("Cache-Control", "no-cache, no-transform");
                    res.setHeader("Connection", "keep-alive");
                    
                    const maybeFlush = res as unknown as { flushHeaders?: () => void };
                    if (typeof maybeFlush.flushHeaders === "function") {
                        maybeFlush.flushHeaders();
                    }

                    // Manually simulate stream
                    const chunks = content.split(/(.{10})/g).filter(Boolean); // Split into small chunks
                    for (const chunk of chunks) {
                        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
                        // Small delay not needed for Vercel functions really, but good for UI feel? 
                        // No, act as fast as possible.
                    }
                    res.write(`data: [DONE]\n\n`);
                    res.end();
                    return; // Done successfully

                } catch (e) {
                    lastError = `Model ${model} error: ${e instanceof Error ? e.message : String(e)}`;
                    console.warn(`[Chat] ${lastError}`);
                    break; // Try next model on exception
                }
             }
             // If loop finished due to max retries on duplicates but 'continue' logic failed??
             // Actually structure above breaks on API error to next model.
             // If we need next model, we break inner loop.
        }

        // If we get here, all models failed
        res.statusCode = 500;
        return res.status(500).json({ error: `All models failed. Last error: ${lastError}` });

    } catch (err: unknown) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
        const message = err instanceof Error ? err.message : "Unexpected server error";
        res.write(`event: error\n`);
        res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
        res.end();
    }
}
