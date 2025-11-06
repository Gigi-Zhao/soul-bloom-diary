import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY not configured');
    }

    const { image } = await req.json();
    if (!image) {
      throw new Error('Image is required');
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://soul-bloom-diary.vercel.app",
        "X-Title": "Soul Bloom Diary",
      },
      body: JSON.stringify({
        model: "meta-llama/llama-4-maverick:free",
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
      const text = await response.text();
      console.error("OpenRouter error:", response.status, text);
      throw new Error(`OpenRouter API error: ${text}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response from AI');
    }

    // Parse JSON from the response
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : content;
      const result = JSON.parse(jsonStr);

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      // Return a fallback response
      return new Response(JSON.stringify({
        name: "未命名角色",
        description: "一个神秘而独特的角色，等待你来定义TA的故事。",
        tags: ["神秘", "独特", "有趣"],
        catchphrase: "让我们一起创造精彩的故事吧！"
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('Error in analyze-character:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
