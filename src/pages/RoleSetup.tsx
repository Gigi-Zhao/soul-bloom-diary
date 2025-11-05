import { useState, useEffect } from "react";
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
  const [generatingPrompt, setGeneratingPrompt] = useState(false);

  // Load data from navigation state
  useEffect(() => {
    const state = location.state as any;
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

  const handleGeneratePrompt = async () => {
    setGeneratingPrompt(true);
    try {
      const response = await fetch('/api/generate-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          description,
          tags,
          mbtiType,
          catchphrase,
        }),
      });

      if (!response.ok) {
        throw new Error('生成提示词失败');
      }

      const data = await response.json();
      toast({
        title: "生成成功",
        description: "已生成角色提示词",
      });
      return data.prompt;
    } catch (error) {
      console.error('Error generating prompt:', error);
      toast({
        title: "生成失败",
        description: "无法生成提示词，将使用默认格式",
        variant: "destructive",
      });
      // Fallback to manual prompt generation
      return `你是${name}。${description}\n性格特点：${tags.join('、')}\nMBTI类型：${mbtiType}\n口头禅：${catchphrase}`;
    } finally {
      setGeneratingPrompt(false);
    }
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
      // Generate prompt
      const prompt = await handleGeneratePrompt();

      // Insert into database
      const { error } = await supabase
        .from('ai_roles')
        .insert({
          name: name.trim(),
          description: description.trim(),
          avatar_url: avatarUrl || null,
          tags: tags,
          mbti_type: mbtiType || null,
          catchphrase: catchphrase.trim(),
          prompt: prompt,
          model: 'minimax/minimax-m2:free',
        });

      if (error) throw error;

      toast({
        title: "创建成功",
        description: `${name} 已加入你的AI朋友列表`,
      });

      navigate('/friends');
    } catch (error: any) {
      console.error('Error creating friend:', error);
      toast({
        title: "创建失败",
        description: error.message,
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
            disabled={!isFormValid || creating || generatingPrompt}
            className="flex-1 bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white font-semibold py-6"
          >
            {creating || generatingPrompt ? "创建中..." : "创建朋友"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RoleSetup;
