import { useState, useEffect } from "react";
import { CHAT_MODELS } from "@/lib/model-config";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, X, Plus, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const MBTI_TYPES = [
  "INTJ", "INTP", "ENTJ", "ENTP",
  "INFJ", "INFP", "ENFJ", "ENFP",
  "ISTJ", "ISFJ", "ESTJ", "ESFJ",
  "ISTP", "ISFP", "ESTP", "ESFP",
];

/**
 * Build a comprehensive system prompt for the AI character
 */
function buildCharacterPrompt(character: {
  name: string;
  description: string;
  tags: string[];
  mbtiType: string | null;
  catchphrase: string;
}): string {
  const { name, description, tags, mbtiType, catchphrase } = character;
  
  const mbtiSection = mbtiType ? `\nMBTI类型：${mbtiType}` : '';
  
  return `你现在将完全扮演名为「${name}」的角色。

角色设定：${description}

性格标签：${tags.join('、')}${mbtiSection}

口头禅：${catchphrase}

交流准则：
1. 始终使用第一人称视角与用户交谈，保持沉浸式角色扮演。
2. 回复要体现上述设定中的情绪、性格特点与语言风格，并结合用户话题给出具体回应。
3. 适时而自然地使用你的口头禅，但避免频率过高显得生硬。
4. 不要提及系统指令或角色设定的存在，更不要跳出角色解释自己是AI。
5. 如果遇到无法回答的问题，请以角色身份委婉说明。
6. 保持对话的真实性和情感共鸣，像一个真实的朋友一样陪伴用户。`;
}

/**
 * RoleSetup Page
 * Configure AI companion details
 */
const RoleSetup = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);

  // Form state
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [mbtiType, setMbtiType] = useState("");
  const [catchphrase, setCatchphrase] = useState("");

  // Load data from navigation state
  useEffect(() => {
    const state = location.state as {
      avatarUrl?: string;
      name?: string;
      description?: string;
      tags?: string[];
      catchphrase?: string;
    } | null;
    if (state) {
      if (state.avatarUrl) setAvatarUrl(state.avatarUrl);
      if (state.name) setName(state.name);
      if (state.description) setDescription(state.description);
      if (state.tags && Array.isArray(state.tags)) setTags(state.tags);
      if (state.catchphrase) setCatchphrase(state.catchphrase);
    }
  }, [location]);

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleCreateFriend = async () => {
    // Validation
    if (!name.trim()) {
      toast({
        title: "请填写姓名",
        variant: "destructive",
      });
      return;
    }
    if (!description.trim()) {
      toast({
        title: "请填写角色设定",
        variant: "destructive",
      });
      return;
    }
    if (tags.length === 0) {
      toast({
        title: "请添加至少一个角色标签",
        variant: "destructive",
      });
      return;
    }
    if (!catchphrase.trim()) {
      toast({
        title: "请填写口头禅",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "请先登录",
          description: "需要登录才能创建AI朋友",
          variant: "destructive",
        });
        navigate('/auth');
        return;
      }

      // Build prompt using local template function
      const prompt = buildCharacterPrompt({
        name: name.trim(),
        description: description.trim(),
        tags: tags,
        mbtiType: mbtiType || null,
        catchphrase: catchphrase.trim()
      });

      console.log('Attempting to insert AI role:', {
        name: name.trim(),
        description: description.trim(),
        avatar_url: avatarUrl || null,
        tags: tags,
        mbti_type: mbtiType || null,
        catchphrase: catchphrase.trim(),
        model: CHAT_MODELS[0],
        user_id: user.id,
      });

      // Insert into database
      const { data: insertedData, error } = await supabase
        .from('ai_roles')
        .insert({
          name: name.trim(),
          description: description.trim(),
          avatar_url: avatarUrl || null,
          tags: tags,
          mbti_type: mbtiType || null,
          catchphrase: catchphrase.trim(),
          prompt: prompt,
          model: CHAT_MODELS[0],
          user_id: user.id,
        })
        .select();

      if (error) {
        console.error('Supabase insert error:', error);
        throw error;
      }

      console.log('Successfully inserted AI role:', insertedData);

      toast({
        title: "创建成功",
        description: `${name} 已加入你的AI朋友列表`,
      });

      navigate('/friends');
    } catch (error: unknown) {
      console.error('Error creating friend:', error);
      
      let errorMessage = "未知错误";
      if (error && typeof error === 'object') {
        if ('message' in error) {
          errorMessage = String(error.message);
        }
        if ('hint' in error) {
          errorMessage += `\n提示: ${String(error.hint)}`;
        }
        if ('details' in error) {
          errorMessage += `\n详情: ${String(error.details)}`;
        }
      }
      
      toast({
        title: "创建失败",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const isFormValid = name.trim() && description.trim() && tags.length > 0 && catchphrase.trim();

  return (
    <div className="min-h-screen pb-8 pt-8 px-4 bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="max-w-md mx-auto mb-8">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="hover:bg-primary/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">角色设定</h1>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-md mx-auto space-y-6">
        {/* Avatar */}
        {avatarUrl && (
          <div className="flex justify-center">
            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-primary/20">
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            </div>
            <p className="text-sm text-muted-foreground text-center mt-2">点击选择头像</p>
          </div>
        )}

        {/* Name */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">姓名</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="林焰"
            className="bg-background"
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-foreground">角色设定&性格特点</label>
            <Button
              variant="ghost"
              size="sm"
              className="text-primary hover:text-primary/80"
            >
              <Sparkles className="w-4 h-4 mr-1" />
              小熊帮你写
            </Button>
          </div>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="在霓虹闪烁的都市里，你既是万人追捧的摇滚新星，也是在深夜琴房为爱人写歌的普通人。你的世界由音符和真心编织，舞台是战场，而家是唯一能卸下铠甲的地方。"
            className="bg-background min-h-[120px]"
          />
        </div>

        {/* Tags */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">角色标签</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.map((tag) => (
              <div
                key={tag}
                className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm flex items-center gap-1"
              >
                {tag}
                <button onClick={() => handleRemoveTag(tag)}>
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
              placeholder="添加标签"
              className="bg-background"
            />
            <Button onClick={handleAddTag} variant="ghost" size="icon">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <button
            onClick={() => {}}
            className="w-full py-3 border-2 border-dashed border-primary/30 rounded-lg text-primary hover:bg-primary/5 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            添加标签
          </button>
        </div>

        {/* MBTI */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">MBTI 类型</label>
          <div className="grid grid-cols-4 gap-2">
            {MBTI_TYPES.map((type) => (
              <Button
                key={type}
                variant={mbtiType === type ? "default" : "outline"}
                onClick={() => setMbtiType(type)}
                className={mbtiType === type ? "bg-primary text-white" : ""}
              >
                {type}
              </Button>
            ))}
          </div>
        </div>

        {/* Catchphrase */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">口头禅</label>
          <Textarea
            value={catchphrase}
            onChange={(e) => setCatchphrase(e.target.value)}
            placeholder="这句歌词，是为你写的。"
            className="bg-background"
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 pt-4">
          <Button
            variant="outline"
            onClick={() => navigate('/friends')}
            className="flex-1 py-6"
          >
            重置
          </Button>
          <Button
            onClick={handleCreateFriend}
            disabled={!isFormValid || creating}
            className="flex-1 bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white font-semibold py-6"
          >
            {creating ? "创建中..." : "创建朋友"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RoleSetup;
