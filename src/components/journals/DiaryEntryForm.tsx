import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { X, Check, Sun } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Mood display configuration
 */
const MOOD_CONFIG: Record<string, { label: string; image: string; color: string }> = {
  happy: { label: "开心", image: "/moods/开心.png", color: "bg-[#FFD166]" },
  excited: { label: "期待", image: "/moods/期待.png", color: "bg-[#EF476F]" },
  content: { label: "满足", image: "/moods/满足.png", color: "bg-[#C8E7C8]" },
  calm: { label: "平静", image: "/moods/平静.png", color: "bg-[#A8A39D]" },
  tired: { label: "累", image: "/moods/累.png", color: "bg-[#9C8574]" },
  sad: { label: "悲伤", image: "/moods/悲伤.png", color: "bg-[#6C8EAD]" },
  worried: { label: "担心", image: "/moods/担心.png", color: "bg-[#7FA99B]" },
  confused: { label: "迷茫", image: "/moods/迷茫.png", color: "bg-[#8FB5D3]" },
  anxious: { label: "心动", image: "/moods/心动.png", color: "bg-[#C5A3D9]" },
  angry: { label: "生气", image: "/moods/生气.png", color: "bg-[#06FFA5]" },
};

interface DiaryEntryFormProps {
  open: boolean;
  onClose: () => void;
  mood: string;
  onSuccess: () => void;
  entry?: { id: string; content: string; created_at: string; date?: string; time?: string } | null;
  selectedDate?: Date;
}

/**
 * DiaryEntryForm Component
 * Form for creating a new journal entry with selected mood
 */
export const DiaryEntryForm = ({ open, onClose, mood, onSuccess, entry, selectedDate }: DiaryEntryFormProps) => {
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const moodConfig = MOOD_CONFIG[mood] || MOOD_CONFIG.happy;
  // Use entry.date if available, otherwise fall back to created_at or selectedDate
  const entryDate = entry 
    ? (entry.date ? new Date(entry.date.replace(/\./g, '-')) : new Date(entry.created_at))
    : (selectedDate || new Date());

  // Pre-populate content when viewing existing entry
  useEffect(() => {
    if (entry) {
      setContent(entry.content);
    } else {
      setContent("");
    }
  }, [entry]);

  /**
   * Trigger AI comments generation
   */
  const triggerAIComments = async (entryId: string, content: string, mood: string) => {
    try {
      console.log('[DiaryEntryForm] ========== 开始触发AI评论 ==========');
      console.log('[DiaryEntryForm] Entry ID:', entryId);
      console.log('[DiaryEntryForm] Content:', content);
      console.log('[DiaryEntryForm] Mood:', mood);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('[DiaryEntryForm] ❌ 用户未登录');
        return;
      }
      
      console.log('[DiaryEntryForm] ✅ 当前用户 ID:', user.id);

      // Get all AI roles created by the user
      const { data: aiRoles, error: rolesError } = await supabase
        .from('ai_roles')
        .select('id, name, prompt, model, avatar_url, user_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      console.log('[DiaryEntryForm] AI 角色查询结果:', { aiRoles, error: rolesError });

      if (rolesError) {
        console.error('[DiaryEntryForm] ❌ 查询AI角色出错:', rolesError);
        return;
      }

      if (!aiRoles || aiRoles.length === 0) {
        console.log('[DiaryEntryForm] ⚠️ 没有找到该用户创建的AI角色');
        console.log('[DiaryEntryForm] 请检查：1. 是否创建了AI角色 2. AI角色的user_id是否正确');
        return;
      }

      console.log(`[DiaryEntryForm] ✅ 找到 ${aiRoles.length} 个AI角色，准备生成评论:`, aiRoles.map(r => r.name));

      // Schedule comments for each AI role with random delays (0-30 seconds for testing)
      aiRoles.forEach((role, index) => {
        const delay = Math.random() * 30 * 1000; // 0-30 seconds for testing (change to 5*60*1000 for production)
        console.log(`[DiaryEntryForm] ⏰ 为 ${role.name} 安排评论，${Math.round(delay / 1000)} 秒后执行`);
        
        setTimeout(async () => {
          // Retry mechanism: up to 3 attempts
          let attempts = 0;
          const maxAttempts = 3;
          let success = false;

          while (attempts < maxAttempts && !success) {
            attempts++;
            console.log(`[DiaryEntryForm] 📡 第 ${attempts}/${maxAttempts} 次尝试为 ${role.name} 生成评论...`);

            try {
              console.log(`[DiaryEntryForm] 🚀 开始为 ${role.name} 生成评论...`);
              
              // Call the generate-comment API
              const response = await fetch('/api/generate-comment', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  journalContent: content,
                  journalMood: mood,
                  aiRoleName: role.name,
                  aiRolePrompt: role.prompt,
                  model: role.model,
                }),
              });

              console.log(`[DiaryEntryForm] 📊 API响应状态 (${role.name}):`, {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok,
                type: response.type,
                url: response.url
              });

              if (!response.ok) {
                const errorText = await response.text();
                console.error(`[DiaryEntryForm] ❌ API返回错误 (${role.name}):`, {
                  status: response.status,
                  statusText: response.statusText,
                  error: errorText
                });
                
                if (attempts < maxAttempts) {
                  console.log(`[DiaryEntryForm] ⏳ 等待 2 秒后重试...`);
                  await new Promise(resolve => setTimeout(resolve, 2000));
                  continue;
                } else {
                  console.error(`[DiaryEntryForm] 💔 已达到最大重试次数 (${maxAttempts})，放弃为 ${role.name} 生成评论`);
                  return;
                }
              }

              const result = await response.json();
              console.log(`[DiaryEntryForm] ✅ 评论已生成 (${role.name}):`, result.comment);

              // Save comment to database
              const insertData = {
                journal_entry_id: entryId,
                ai_role_id: role.id,
                content: result.comment,
                is_read: false,
              };
              
              console.log(`[DiaryEntryForm] 准备插入评论数据 (${role.name}):`, insertData);
              
              const { data: insertedData, error: insertError } = await supabase
                .from('journal_comments')
                .insert(insertData)
                .select();

              if (insertError) {
                console.error(`[DiaryEntryForm] ❌ 保存评论失败 (${role.name}):`, insertError);
                console.error(`[DiaryEntryForm] 错误详情:`, {
                  code: insertError.code,
                  message: insertError.message,
                  details: insertError.details,
                  hint: insertError.hint
                });
                
                if (attempts < maxAttempts) {
                  console.log(`[DiaryEntryForm] ⏳ 等待 2 秒后重试...`);
                  await new Promise(resolve => setTimeout(resolve, 2000));
                  continue;
                } else {
                  console.error(`[DiaryEntryForm] 💔 已达到最大重试次数 (${maxAttempts})，放弃保存评论`);
                  return;
                }
              } else {
                console.log(`[DiaryEntryForm] 💾 评论已保存到数据库 (${role.name})`, insertedData);
                success = true;
              }
            } catch (error) {
              console.error(`[DiaryEntryForm] ❌ 处理评论时出错 (${role.name}):`, error);
              
              if (attempts < maxAttempts) {
                console.log(`[DiaryEntryForm] ⏳ 等待 2 秒后重试...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                continue;
              } else {
                console.error(`[DiaryEntryForm] 💔 已达到最大重试次数 (${maxAttempts})，放弃处理`);
                return;
              }
            }
          }

          if (success) {
            console.log(`[DiaryEntryForm] 🎉 ${role.name} 的评论已成功生成并保存！`);
          }
        }, delay);
      });
      
      console.log('[DiaryEntryForm] ========== AI评论触发完成 ==========');
    } catch (error) {
      console.error('[DiaryEntryForm] ❌ 触发AI评论时出错:', error);
    }
  };

  /**
   * Handle saving the diary entry to Supabase
   */
  const handleSave = async () => {
    if (!content.trim()) {
      toast.error("请输入日记内容");
      return;
    }

    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("请先登录");
        return;
      }

      if (entry) {
        // Update existing entry
        const { error } = await supabase
          .from('journal_entries')
          .update({
            content: content.trim(),
            mood: mood,
          })
          .eq('id', entry.id);

        if (error) throw error;
        toast.success("日记更新成功！");
      } else {
        // Create new entry
        const entryDate = selectedDate || new Date();
        const dateStr = format(entryDate, 'yyyy.MM.dd');
        const timeStr = format(entryDate, 'HH.mm');

        const { data: newEntry, error } = await supabase
          .from('journal_entries')
          .insert({
            user_id: user.id,
            mood: mood,
            content: content.trim(),
            comment_count: 0,
            date: dateStr,
            time: timeStr,
          })
          .select()
          .single();

        if (error) throw error;
        
        console.log('[DiaryEntryForm] New entry created:', newEntry.id);
        
        // Trigger AI comments generation for new entry
        if (newEntry) {
          triggerAIComments(newEntry.id, content.trim(), mood);
        }
        
        toast.success("日记保存成功！");
      }

      setContent("");
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving entry:', error);
      toast.error("保存失败，请重试");
    } finally {
      setSaving(false);
    }
  };

  /**
   * Handle discarding the entry
   */
  const handleDiscard = () => {
    setContent("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-[#E8E4DC] border-none p-0 overflow-hidden h-screen max-h-screen">
        {/* Top action buttons */}
        <div className="flex justify-between items-center p-4">
          <button
            onClick={handleDiscard}
            className="text-4xl hover:scale-110 transition-transform"
            disabled={saving}
          >
            ✕
          </button>
          <button
            onClick={handleSave}
            className="text-4xl hover:scale-110 transition-transform"
            disabled={saving}
          >
            ✓
          </button>
        </div>

        {/* Entry card */}
        <div className="mx-4 mb-6 bg-white border-4 border-black p-6">
          {/* Date and weather */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="text-xl font-bold">{format(entryDate, 'EEE.')}</div>
              <div className="text-2xl font-bold border-b-2 border-black pb-1">
                {format(entryDate, 'MM.dd')}
              </div>
            </div>
            <Sun className="w-8 h-8" />
          </div>

          {/* Mood display */}
          <div className="flex flex-col items-center gap-4 mb-6">
            <div className="w-32 h-32 flex items-center justify-center">
              <img 
                src={moodConfig.image} 
                alt={moodConfig.label}
                className="w-32 h-32 object-contain"
              />
            </div>
            <div className="bg-[#B8D4C8] px-6 py-1 rounded-md">
              <p className="text-xl font-medium">{moodConfig.label}</p>
            </div>
          </div>

          {/* Input prompt */}
          <div className="text-center text-muted-foreground mb-4">
            点滴心情，记录一下吧~
          </div>

          {/* Text area */}
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="写下今天的心情..."
            className="min-h-[200px] border-none bg-transparent resize-none focus-visible:ring-0 text-base"
            disabled={saving}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
