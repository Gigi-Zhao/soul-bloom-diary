/**
 * Daydream API - 白日梦沉浸式故事生成
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

interface DreamSetup {
    identity: string;
    dailyLife: string;
    person: string;
    tone: string;
}

interface MessageHistory {
    role: 'narrator' | 'npc' | 'user';
    content: string;
}

interface RequestBody {
    setup: DreamSetup;
    history: MessageHistory[];
    currentChapter: number;
    isInitial: boolean;
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

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/json");

    try {
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: "Server misconfigured: OPENROUTER_API_KEY missing" });
        }

        const body = (req as { body?: unknown }).body as RequestBody | undefined;
        if (!body || !body.setup) {
            return res.status(400).json({ error: "Invalid request: setup required" });
        }

        const { setup, history, currentChapter, isInitial } = body;

        // 构建系统提示词
        const systemPrompt = buildSystemPrompt(setup, currentChapter);
        
        // 构建消息历史
        const messages = buildMessages(systemPrompt, history, isInitial);

        // 获取模型列表
        const models = getChatModelsForRequest();
        
        let lastError = "";

        // 尝试不同的模型
        for (const model of models) {
            try {
                console.log(`[Daydream] Trying model: ${model}`);
                
                const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${apiKey}`,
                        "HTTP-Referer": req.headers.referer || "https://soul-bloom-diary.vercel.app",
                        "X-Title": "Soul Bloom Diary - Daydream",
                    },
                    body: JSON.stringify({
                        model: model,
                        messages,
                        temperature: 0.9,
                        max_tokens: 2000,
                    }),
                });

                if (!response.ok) {
                    const text = await response.text().catch(() => "");
                    lastError = `Model ${model} failed: ${response.status} ${text}`;
                    console.warn(`[Daydream] ${lastError}`);
                    continue;
                }

                const data = await response.json();
                const content = data.choices?.[0]?.message?.content;

                if (!content) {
                    lastError = `Model ${model} returned empty content`;
                    console.warn(`[Daydream] ${lastError}`);
                    continue;
                }

                console.log(`[Daydream] Successfully generated with model: ${model}`);
                console.log(`[Daydream] Raw response: ${content}`);

                // 解析AI返回的内容
                const parsedResponse = parseAIResponse(content, currentChapter);
                
                return res.status(200).json(parsedResponse);

            } catch (e) {
                lastError = `Model ${model} error: ${e instanceof Error ? e.message : String(e)}`;
                console.warn(`[Daydream] ${lastError}`);
            }
        }

        // 所有模型都失败了
        return res.status(500).json({ 
            error: `All models failed. Last error: ${lastError}`,
            options: ["继续探索", "回想刚才", "做点别的"]
        });

    } catch (error) {
        console.error('[Daydream] Unexpected error:', error);
        return res.status(500).json({ 
            error: error instanceof Error ? error.message : "Unknown error",
            options: ["继续探索", "回想刚才", "做点别的"]
        });
    }
}

// 构建系统提示词
function buildSystemPrompt(setup: DreamSetup, currentChapter: number): string {
    const chapterGoals = {
        1: "描绘主角的灰色日常，营造压抑感，为后续转机做铺垫",
        2: "引入关键转机事件或人物，打破日常的沉闷",
        3: "推进剧情发展，加深主角与关键人物/事件的联系",
        4: "达到故事高潮，情感或剧情达到最强烈的时刻",
        5: "收束故事，给予主角和读者一个完整的结局（开放式或明确式）"
    };

    return `你是一位擅长创作沉浸式互动小说的作家。你正在为用户创作一个个性化的白日梦故事。

**用户设定：**
- 身份：${setup.identity}
- 日常：${setup.dailyLife}
- 想遇到的人：${setup.person}
- 故事基调：${setup.tone}

**当前章节：第${currentChapter}章（共5章）**
**章节目标：${chapterGoals[currentChapter as keyof typeof chapterGoals] || "推进故事情节"}**

**写作要求：**
1. 使用第二人称("你")来增强代入感
2. 环境描写要细腻生动，调动五感
3. 对话要符合人物性格，自然流畅
4. 根据用户的选择自然推进剧情
5. 每次回应包含150-300字的内容
6. 在关键节点提供3个有深度的选择

**重要：你必须严格按照以下JSON格式返回（不要包含其他文字）：**
{
  "narrator": "环境描写和旁白文本（必填，使用第二人称'你'）",
  "npc_say": "NPC的对话内容（可选，如果有对话才填写）",
  "options": ["选项A描述", "选项B描述", "选项C描述"],
  "chapter_end": false,
  "current_chapter": ${currentChapter}
}

**关于章节推进：**
- 当当前章节的故事目标基本达成时，将 chapter_end 设为 true
- 第5章结束后，chapter_end 保持为 true，故事自然收尾`;
}

// 消息类型定义
interface ChatMessage {
    role: string;
    content: string;
}

// 构建消息数组
function buildMessages(systemPrompt: string, history: MessageHistory[], isInitial: boolean): ChatMessage[] {
    const messages: ChatMessage[] = [
        { role: "system", content: systemPrompt }
    ];

    if (isInitial) {
        // 初始化时
        messages.push({
            role: "user",
            content: "故事开始。请为我展开第一章的开篇，描绘我的日常生活场景。"
        });
    } else {
        // 将历史记录转换为对话格式
        for (const msg of history) {
            if (msg.role === 'narrator' || msg.role === 'npc') {
                // AI的内容（旁白和NPC）
                const content: string[] = [];
                if (msg.role === 'narrator') {
                    content.push(`旁白：${msg.content}`);
                } else {
                    content.push(`对话：${msg.content}`);
                }
                messages.push({
                    role: "assistant",
                    content: content.join('\n')
                });
            } else if (msg.role === 'user') {
                // 用户的选择
                messages.push({
                    role: "user",
                    content: msg.content
                });
            }
        }
    }

    return messages;
}

// AI响应类型
interface ParsedAIResponse {
    narrator?: string;
    npc_say?: string;
    options: string[];
    chapter_end: boolean;
    current_chapter: number;
}

// 解析AI返回的内容
function parseAIResponse(content: string, currentChapter: number): ParsedAIResponse {
    try {
        // 尝试提取JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            
            // 验证必填字段
            if (!parsed.narrator) {
                throw new Error("Missing narrator field");
            }
            
            // 确保options是数组且有3个选项
            if (!Array.isArray(parsed.options) || parsed.options.length === 0) {
                parsed.options = [
                    "继续这样做",
                    "换个方式试试",
                    "观察周围的情况"
                ];
            }
            
            // 确保有chapter信息
            if (typeof parsed.current_chapter !== 'number') {
                parsed.current_chapter = currentChapter;
            }
            
            if (typeof parsed.chapter_end !== 'boolean') {
                parsed.chapter_end = false;
            }
            
            return parsed;
        }
        
        // 如果没有找到JSON格式，尝试智能解析文本
        throw new Error("No valid JSON found");
        
    } catch (error) {
        console.error('[Daydream] Failed to parse AI response:', error);
        console.log('[Daydream] Raw content:', content);
        
        // 降级处理：将整个内容作为旁白
        return {
            narrator: content.slice(0, 500), // 限制长度
            npc_say: undefined,
            options: [
                "继续探索",
                "停下来思考",
                "换个角度看问题"
            ],
            chapter_end: false,
            current_chapter: currentChapter
        };
    }
}
