import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { X, Check, Sun } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Mood display configuration
 */
const MOOD_CONFIG: Record<string, { label: string; emoji: string; color: string; face: string }> = {
  happy: { label: "开心", emoji: "😊", color: "bg-[#F4D35E]", face: "⋅⋅\n ͜" },
  excited: { label: "兴奋", emoji: "😃", color: "bg-[#EE964B]", face: "⋅ ⋅\n ͜" },
  content: { label: "满足", emoji: "😌", color: "bg-[#C8E7C8]", face: "˘ ˘\n ᵕ" },
  calm: { label: "平静", emoji: "😐", color: "bg-[#A8A39D]", face: "⋅ ⋅\n o" },
  tired: { label: "疲惫", emoji: "😑", color: "bg-[#9C8574]", face: "– –\n ⌇" },
  sad: { label: "难过", emoji: "😢", color: "bg-[#6C8EAD]", face: "⋅ ⋅\n ︵" },
  worried: { label: "担忧", emoji: "😰", color: "bg-[#7FA99B]", face: "– –\n ⌢" },
  sleepy: { label: "困倦", emoji: "😴", color: "bg-[#8FB5D3]", face: "˘ ˘\n ︵" },
  anxious: { label: "焦虑", emoji: "😔", color: "bg-[#C5A3D9]", face: "˘ ˘\n ︿" },
  angry: { label: "生气", emoji: "😠", color: "bg-[#F4A5AE]", face: "ˇ ˇ\n ︿" },
};

interface DiaryEntryFormProps {
  open: boolean;
  onClose: () => void;
  mood: string;
  onSuccess: () => void;
  entry?: { id: string; content: string; created_at: string } | null;
}

/**
 * DiaryEntryForm Component
 * Form for creating a new journal entry with selected mood
 */
export const DiaryEntryForm = ({ open, onClose, mood, onSuccess, entry }: DiaryEntryFormProps) => {
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  
  const moodConfig = MOOD_CONFIG[mood] || MOOD_CONFIG.happy;
  const entryDate = entry ? new Date(entry.created_at) : new Date();

  // Pre-populate content when viewing existing entry
  useState(() => {
    if (entry) {
      setContent(entry.content);
    }
  });

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
        const { error } = await supabase
          .from('journal_entries')
          .insert({
            user_id: user.id,
            mood: mood,
            content: content.trim(),
            comment_count: 0,
          });

        if (error) throw error;
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
        <div className="mx-4 bg-white border-4 border-black p-6">
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
            <div className={`w-32 h-32 rounded-full ${moodConfig.color} flex items-center justify-center shadow-lg`}>
              <span className="text-4xl font-medium text-black/80 whitespace-pre-line text-center leading-tight">
                {moodConfig.face}
              </span>
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
