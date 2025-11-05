interface VercelRequestLike {
    method?: string;
    headers: Record<string, string | undefined>;
    body?: unknown;
}

interface VercelResponseLike {
    setHeader: (name: string, value: string) => void;
    status: (code: number) => VercelResponseLike;
    json: (body: unknown) => void;
}

export default async function handler(req: VercelRequestLike, res: VercelResponseLike) {
    // Handle OPTIONS for CORS
    if (req.method === "OPTIONS") {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        return res.status(200).json({});
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

        const body = (req as { body?: unknown }).body as { image?: string } | undefined;
        const image = body?.image;

        if (!image) {
            return res.status(400).json({ error: "Invalid request: image required" });
        }

        // Use Mistral Small vision model to analyze the character
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
                "HTTP-Referer": req.headers.referer || "https://soul-bloom-diary.vercel.app",
                "X-Title": "Soul Bloom Diary",
            },
            body: JSON.stringify({
                model: "mistralai/mistral-small:free",
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: `分析这张图片中的角色，提取以下信息并以JSON格式返回（仅返回JSON，不要有其他文字）：
{
  "name": "角色名字（如果无法识别，给一个合适的名字）",
  "description": "详细的角色设定和性格特点描述（50-100字）",
  "tags": ["标签1", "标签2", "标签3"]（3-5个描述性标签）,
  "catchphrase": "一句符合角色性格的口头禅"
}`
                            },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:image/jpeg;base64,${image}`
                                }
                            }
                        ]
                    }
                ],
            }),
        });

        if (!response.ok) {
            const text = await response.text().catch(() => "");
            console.error("OpenRouter error:", response.status, text);
            return res.status(response.status).json({ error: `Upstream error: ${text}` });
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            return res.status(500).json({ error: "No response from AI" });
        }

        // Parse JSON from the response
        try {
            // Extract JSON from the response (in case there's extra text)
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            const jsonStr = jsonMatch ? jsonMatch[0] : content;
            const result = JSON.parse(jsonStr);

            return res.status(200).json(result);
        } catch (parseError) {
            console.error("Failed to parse AI response:", content);
            // Return a fallback response
            return res.status(200).json({
                name: "未命名角色",
                description: "一个神秘而独特的角色，等待你来定义TA的故事。",
                tags: ["神秘", "独特", "有趣"],
                catchphrase: "让我们一起创造精彩的故事吧！"
            });
        }
    } catch (err: unknown) {
        console.error("Error in analyze-character:", err);
        const message = err instanceof Error ? err.message : "Unexpected server error";
        return res.status(500).json({ error: message });
    }
}
