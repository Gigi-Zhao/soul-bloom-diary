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
    oneSentence: string;
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
    isInitial: boolean;
}

export default async function handler(req: VercelRequestLike, res: VercelResponseLike) {
    console.log('[Daydream API] 🚀 收到请求:', req.method);
    
    // Handle OPTIONS for CORS
    if (req.method === "OPTIONS") {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        return res.status(200).end();
    }

    if (req.method !== "POST") {
        console.error('[Daydream API] ❌ 错误的请求方法:', req.method);
        res.setHeader("Allow", "POST");
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/json");

    try {
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            console.error('[Daydream API] ❌ 缺少API密钥');
            return res.status(500).json({ error: "Server misconfigured: OPENROUTER_API_KEY missing" });
        }

        const body = (req as { body?: unknown }).body as RequestBody | undefined;
        console.log('[Daydream API] 📦 请求体:', JSON.stringify(body, null, 2));
        
        if (!body || !body.setup) {
            console.error('[Daydream API] ❌ 请求体错误');
            return res.status(400).json({ error: "Invalid request: setup required" });
        }

        const { setup, history, isInitial } = body;
        
        console.log('[Daydream API] 📝 设定信息:', setup);
        console.log('[Daydream API] 🔄 是否初始化:', isInitial);
        console.log('[Daydream API] 📜 历史消息数量:', history?.length || 0);

        // 构建系统提示词
        const systemPrompt = buildSystemPrompt(setup);
        console.log('[Daydream API] 🧠 系统提示词长度:', systemPrompt.length);
        
        // 构建消息历史
        const messages = buildMessages(systemPrompt, history, isInitial);
        console.log('[Daydream API] 📬 构建的消息数量:', messages.length);
        
        // 详细输出每条消息的完整内容
        console.log('[Daydream API] 📋 完整上下文内容:');
        console.log('='.repeat(80));
        messages.forEach((msg, index) => {
            console.log(`\n[消息 ${index + 1}] 角色: ${msg.role}`);
            console.log('-'.repeat(80));
            console.log(msg.content);
            console.log('-'.repeat(80));
        });
        console.log('='.repeat(80));

        // 获取模型列表
        const models = getChatModelsForRequest();
        
        let lastError = "";

        // 尝试不同的模型
        for (const model of models) {
            try {
                console.log(`[Daydream API] 🤖 尝试模型: ${model}`);
                
                const openrouterPayload = {
                    model: model,
                    messages,
                    temperature: 0.8,
                    max_tokens: 2000,
                };
                console.log('[Daydream API] 📤 OpenRouter请求载荷:', JSON.stringify(openrouterPayload, null, 2));
                
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
                        temperature: 0.8,
                        max_tokens: 2000,
                    }),
                });

                console.log(`[Daydream API] 📥 OpenRouter响应状态: ${response.status}`);
                
                if (!response.ok) {
                    const text = await response.text().catch(() => "");
                    lastError = `Model ${model} failed: ${response.status} ${text}`;
                    console.warn(`[Daydream API] ⚠️ ${lastError}`);
                    continue;
                }

                const data = await response.json();
                console.log('[Daydream API] 📦 OpenRouter返回数据:', JSON.stringify(data, null, 2));
                
                const content = data.choices?.[0]?.message?.content;

                if (!content) {
                    lastError = `Model ${model} returned empty content`;
                    console.warn(`[Daydream API] ⚠️ ${lastError}`);
                    continue;
                }

                console.log(`[Daydream API] ✅ 成功生成内容，模型: ${model}`);
                console.log(`[Daydream API] 📝 原始内容: ${content}`);

                // 解析AI返回的内容
                const parsedResponse = parseAIResponse(content);
                console.log('[Daydream API] 🎯 解析后的响应:', JSON.stringify(parsedResponse, null, 2));
                
                return res.status(200).json(parsedResponse);

            } catch (e) {
                lastError = `Model ${model} error: ${e instanceof Error ? e.message : String(e)}`;
                console.error(`[Daydream API] ❌ ${lastError}`);
                if (e instanceof Error && e.stack) {
                    console.error(`[Daydream API] 堆栈信息:`, e.stack);
                }
            }
        }

        // 所有模型都失败了
        console.error('[Daydream API] ❌ 所有模型都失败');
        return res.status(500).json({ 
            error: `All models failed. Last error: ${lastError}`,
            options: ["继续探索", "回想刚才", "做点别的"]
        });

    } catch (error) {
        console.error('[Daydream API] ❌ 未预期错误:', error);
        if (error instanceof Error) {
            console.error('[Daydream API] 错误堆栈:', error.stack);
        }
        return res.status(500).json({ 
            error: error instanceof Error ? error.message : "Unknown error",
            options: ["继续探索", "回想刚才", "做点别的"]
        });
    }
}

// 构建系统提示词
function buildSystemPrompt(setup: DreamSetup): string {
    return `

# Role (角色设定)
你是一位荣获“星云奖”的互动小说家，擅长用王家卫电影的风格，充满试探、克制、欲言又止，多用眼神描写。你的专长是捕捉人物之间微妙的张力、潜台词以及环境的氛围感，营造勾人心弦、符合现实逻辑的刺激故事情节。

# Goal (目标)
根据用户的设定，生成一段符合现实逻辑、情节勾人紧凑的故事。故事必须逻辑严密、情感细腻，且具备电影般的画面感，让用户有沉浸式、身临其境的感觉。

# 用户设定
- 故事核心：${setup.oneSentence}
- 身份：${setup.identity}
- 日常：${setup.dailyLife}
- 想遇到的人：${setup.person}
- 故事基调：${setup.tone}

# 写作要求
1. Show, Don't Tell (展示而非讲述): 严禁直接写“他很生气”、“她很感动”。必须描写：“他捏皱了手中的易拉罐，指关节泛白”或“她低下头，快速眨了眨眼，试图把眼泪逼回去”。
2. Sensory Details (五感描写): 每一段剧情必须至少包含一种非视觉描写（声音、气味、温度、触感）。例如：雨后泥土的腥味、旧空调的嗡嗡声、冰啤酒外壁的水珠滑过指尖。
3. Dialogue Reality (对话真实感):
   - 拒绝“教科书式对话”。
   - 加入口语特征（犹豫、打断、省略）。
   - NPC 说话必须符合其人设，带有一点“攻击性”或“隐藏意图”，不要做单纯的应声虫。
4. Logic Guardrails (逻辑护栏): 剧情发展必须遵循物理逻辑和人性逻辑。不要发生无缘无故的爱恨，所有转折必须有铺垫。

# 关于narrator（旁白）和npc_say（对话）的区分
- narrator：包含环境描写、心理活动、动作描述，以及**除了“想遇到的人”以外其他所有配角/路人的对话**（请用第三人称描述他们的语言，如"老板让你快点干活"）。
- npc_say：**仅限“想遇到的人”（${setup.person}）的直接对话**。不要包含"他说"、"她说"等引导语，直接写对话内容。如果${setup.person}本轮没有说话，此字段留空。
- 只有${setup.person}才有资格与用户直接对话（使用'npc_say'），其他人物的互动一律放入旁白（narrator）中一笔带过。

# 关于选项的格式
- 选项必须使用第一人称，像真实对话一样
- ❌ 错误示例："欣然接受邀约，并问他平时都在哪里演出"
- ✅ 正确示例："好呀，你平时都在哪里演出呀？"

**重要：你必须严格按照以下JSON格式返回（不要包含其他文字，不要用markdown代码块包裹）：**
{
  "narrator": "旁白内容。描写环境、氛围、主角的内心独白。字数控制在 200 字以内，注重画面感。",
  "npc_say": "NPC的台词。如果此时没有 NPC，留空。台词要简短、有力，符合人设。",
  "options": [
    "（选项A：顺从/常规反应）",
    "（选项B：反抗/意外反应 - 必须制造冲突）",
    "（选项C：探索/深究细节）"
  ]
}

`;
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
            content: "故事开始。请为我展开第一章的开篇，为核心情节的发生展开铺垫。"
        });
    } else {
        // 将历史记录转换为对话格式
        // 需要将旁白和NPC对话按轮次合并
        let currentAssistantContent: string[] = [];
        
        for (let i = 0; i < history.length; i++) {
            const msg = history[i];
            
            if (msg.role === 'narrator' || msg.role === 'npc') {
                // 收集AI的内容（旁白和NPC）
                if (msg.role === 'narrator') {
                    currentAssistantContent.push(`旁白：${msg.content}`);
                } else {
                    currentAssistantContent.push(`对话：${msg.content}`);
                }
                
                // 检查下一条是否还是AI消息
                const nextMsg = history[i + 1];
                if (!nextMsg || nextMsg.role === 'user') {
                    // 如果下一条是用户消息或没有下一条，就提交当前的assistant消息
                    if (currentAssistantContent.length > 0) {
                        messages.push({
                            role: "assistant",
                            content: currentAssistantContent.join('\n')
                        });
                        currentAssistantContent = [];
                    }
                }
            } else if (msg.role === 'user') {
                // 用户的选择
                let content = msg.content;
                
                // 如果是最后一条消息（即当前用户的最新输入），添加强力引导
                if (i === history.length - 1) {
                    content += "\n\n（请根据我的这个行动/选择，继续推进剧情。请严格按照JSON格式返回，包含narrator, npc_say(可选), options等字段）";
                    console.log('[Daydream API] 🔧 已为最新用户消息添加引导提示');
                }

                messages.push({
                    role: "user",
                    content: content
                });
            }
        }
        
        // 如果最后还有未提交的assistant内容
        if (currentAssistantContent.length > 0) {
            messages.push({
                role: "assistant",
                content: currentAssistantContent.join('\n')
            });
        }
    }

    console.log('[Daydream API] 📜 构建的消息历史:');
    console.log(`总共 ${messages.length} 条消息`);
    messages.forEach((msg, index) => {
        const preview = msg.content.length > 100 
            ? msg.content.substring(0, 100) + '...' 
            : msg.content;
        console.log(`  [${index}] ${msg.role}: ${preview}`);
    });

    return messages;
}

// AI响应类型
interface ParsedAIResponse {
    narrator?: string;
    npc_say?: string;
    options: string[];
}

// 解析AI返回的内容
function parseAIResponse(content: string): ParsedAIResponse {
    console.log('[Daydream API] 🔍 开始解析AI响应');
    try {
        // 尝试提取JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            console.log('[Daydream API] 📦 找到JSON匹配:', jsonMatch[0]);
            const parsed = JSON.parse(jsonMatch[0]);
            console.log('[Daydream API] ✅ JSON解析成功:', parsed);
            
            // 验证必填字段
            if (!parsed.narrator) {
                console.error('[Daydream API] ❌ 缺少narrator字段');
                throw new Error("Missing narrator field");
            }
            
            // 确保options是数组且有选项
            if (!Array.isArray(parsed.options) || parsed.options.length === 0) {
                console.warn('[Daydream API] ⚠️ options为空，使用默认选项');
                parsed.options = [
                    "继续这样做",
                    "换个方式试试",
                    "观察周围的情况"
                ];
            }
            
            return parsed;
        }
        
        // 如果没有找到JSON格式，尝试智能解析文本
        console.warn('[Daydream API] ⚠️ 未找到标准JSON格式，尝试解析结构化文本');
        
        // 尝试解析结构化文本
        // 格式如：旁白：... 对话：... 选项：...
        // 使用更宽松的匹配模式
        const cleanContent = content
            .replace(/```json\s*/g, '')
            .replace(/```\s*/g, '')
            .replace(/\*\*/g, '') // 去除可能的markdown加粗
            .trim();
        
        // 更强大的正则，匹配"旁白："后的所有内容直到遇到"对话："或"选项："
        // 支持中文"旁白"和英文"Narrator"，支持冒号或空格作为分隔符
        const narratorMatch = cleanContent.match(/(?:旁白|Narrator)(?:\s*[：:]|\s+)\s*([\s\S]*?)(?=(?:对话|NPC|Say|选项|Options)(?:\s*[：:]|\s+)|$)/i);
        const npcMatch = cleanContent.match(/(?:对话|NPC|Say)(?:\s*[：:]|\s+)\s*([\s\S]*?)(?=(?:选项|Options)(?:\s*[：:]|\s+)|$)/i);
        const optionsMatch = cleanContent.match(/(?:选项|Options)(?:\s*[：:]|\s+)\s*([\s\S]*?)$/i);

        if (narratorMatch || npcMatch || optionsMatch) {
            console.log('[Daydream API] 📝 识别到文本格式，尝试手动提取');
            
            // 如果有旁白标记就用标记内容，否则如果只有一段文字默认作为旁白
            let narrator = "";
            if (narratorMatch) {
                narrator = narratorMatch[1].trim();
            } else if (!npcMatch && !optionsMatch) {
                // 如果什么标记都没有，整个作为旁白
                 narrator = cleanContent;
            } else {
                // 有其它标记但没旁白标记，尝试取第一段
                const parts = cleanContent.split(/(?:对话|NPC|Say|选项|Options)(?:\s*[：:]|\s+)/i);
                if (parts.length > 0 && parts[0].trim()) {
                    narrator = parts[0].trim().replace(/^(?:旁白|Narrator)(?:\s*[：:]|\s+)\s*/i, '');
                }
            }

            const npc_say = npcMatch ? npcMatch[1].trim() : undefined;
            const optionsText = optionsMatch ? optionsMatch[1].trim() : "";
            
            console.log('[Daydream API] 🔍 提取结果:', { 
                narrator: narrator.substring(0, 50), 
                npc_say: npc_say?.substring(0, 50), 
                optionsText: optionsText.substring(0, 100) 
            });
            
            // 解析选项 "1. xxx 2. xxx" 或 "- xxx" 或数组格式
            let options: string[] = [];
            if (optionsText) {
                // 尝试解析JSON数组格式
                if (optionsText.trim().startsWith('[')) {
                    try {
                        options = JSON.parse(optionsText);
                        console.log('[Daydream API] ✅ JSON数组解析成功:', options);
                    } catch (e) {
                        console.warn('[Daydream API] ⚠️ 无法解析选项JSON');
                    }
                }
                
                if (options.length === 0) {
                    // 尝试按数字序号分割 (如 1. 选项一 2. 选项二)
                    // 修正正则，去掉多余的反斜杠
                    const numberedOptions = optionsText.split(/(?:\d+[.、)]|[ABC][.、)])\s*/).filter(s => s.trim()).map(s => s.trim());
                    if (numberedOptions.length >= 2) {
                        options = numberedOptions;
                        console.log('[Daydream API] ✅ 数字序号解析成功:', options);
                    } else {
                        // 尝试按行分割
                        options = optionsText.split(/[\n;；]/).filter(s => s.trim().length > 5)
                            .map(s => s.replace(/^[-*•"'`\s\d.、)）]+/, '').replace(/["'`]\s*$/, '').trim());
                        console.log('[Daydream API] ✅ 行分割解析:', options);
                    }
                }
            }
            
            // 兜底选项
            if (options.length === 0) {
                 options = [
                    "继续",
                    "尝试其他方式",
                    "思考一会"
                ];
            }
            
            return {
                narrator: narrator || "...", // 确保不为空
                npc_say: npc_say,
                options: options.slice(0, 3) // 最多取3个
            };
        }

        throw new Error("No valid JSON or structured text found");
        
    } catch (error) {
        console.error('[Daydream API] ❌ 解析AI响应失败:', error);
        console.log('[Daydream API] 📝 原始内容:', content);
        
        // 降级处理：将整个内容作为旁白
        console.log('[Daydream API] 🔄 使用最基础降级方案');
        return {
            narrator: content.slice(0, 500), // 限制长度
            npc_say: undefined,
            options: [
                "继续探索",
                "停下来思考",
                "换个角度看问题"
            ]
        };
    }
}
