/**
 * Generate attractive bubble message based on latest journal entry
 * 根据最新日记生成吸引用户聊天的气泡消息
 */

const DEFAULT_CHAT_MODEL = 'meituan/longcat-flash-chat:free';

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

        const body = (req as { body?: unknown }).body as
            | { 
                journalContent?: string; 
                mood?: string;
                aiRoleName?: string;
            }
            | undefined;

        const journalContent = body?.journalContent;
        const mood = body?.mood || "😊";
        const aiRoleName = body?.aiRoleName || "小兵";

        if (!journalContent || !journalContent.trim()) {
            return res.status(400).json({ error: "Invalid request: journalContent required" });
        }

        const currentTime = new Date().toLocaleString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });

        // 构建优化后的 prompt
        const systemPrompt = `# Role
你叫"${aiRoleName}"，是用户的亲密AI伙伴。

# Task
用户刚发布了一条"碎碎念"（日记），你需要根据内容生成一条 **简短的、主要用于发起对话的** 气泡消息。

# Context Data
- 用户日记内容: "${journalContent}" 
- 用户心情标签: "${mood}"
- 当前时间: "${currentTime}"

# Constraints (非常重要)
1. **字数限制**: 控制在 15-30字以内，太长用户不想看。
2. **拒绝复读**: 不要重复用户的原话，要在这个基础上延伸。
3. **结尾策略**: 尽量以一个轻松的"封闭式问题"或"感叹+反问"结尾，诱导用户回复。
4. **语气**: 保持轻松、亲密、自然，像朋友一样聊天。

# Examples
- Case 1 (用户说累):
  用户: "今天好累啊，不想动。"
  AI: "抱抱！是不是工作太满啦？今晚要不要早点躺平追个剧？" (共鸣+提议)

- Case 2 (用户说去玩):
  用户: "周末要去模块节玩啦！"
  AI: "哇！是你一直念叨的那个吗？听说现场超炸的！准备好蹦迪装备没？" (激动+细节提问)

# Output
请直接输出气泡消息内容，不要包含任何其他说明或前缀。`;

        const openrouterRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
                "HTTP-Referer": req.headers.referer || "https://soul-bloom-diary.vercel.app",
                "X-Title": "Soul Bloom Diary",
            },
            body: JSON.stringify({
                model: DEFAULT_CHAT_MODEL,
                messages: [
                    {
                        role: "system",
                        content: systemPrompt
                    },
                    {
                        role: "user",
                        content: "请生成回复："
                    }
                ],
                temperature: 0.8, // 稍高一点的温度让回复更有创意
                max_tokens: 100, // 限制token数量确保简短
            }),
        });

        if (!openrouterRes.ok) {
            const errorText = await openrouterRes.text();
            console.error("OpenRouter error:", errorText);
            return res.status(openrouterRes.status).json({ 
                error: "Failed to generate message",
                details: errorText 
            });
        }

        const data = await openrouterRes.json() as {
            choices?: Array<{
                message?: {
                    content?: string;
                };
            }>;
        };

        const generatedMessage = data.choices?.[0]?.message?.content?.trim();

        if (!generatedMessage) {
            return res.status(500).json({ error: "No message generated" });
        }

        return res.status(200).json({ 
            message: generatedMessage 
        });

    } catch (error) {
        console.error("Error in generate-bubble-message:", error);
        return res.status(500).json({ 
            error: "Internal server error",
            details: error instanceof Error ? error.message : "Unknown error"
        });
    }
}
