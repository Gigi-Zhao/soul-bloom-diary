import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronLeft } from "lucide-react";
import { format } from "date-fns";

interface JournalEntry {
  id: string;
  created_at: string;
  content: string;
  mood: string;
  comment_count: number;
  date?: string;
  time?: string;
}

interface JournalComment {
  id: string;
  content: string;
  created_at: string;
  is_read: boolean;
  ai_role: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
}

const MOOD_EMOJIS: Record<string, { image: string; color: string }> = {
  happy: { image: "/moods/开心.png", color: "bg-[#FFD166]" },
  excited: { image: "/moods/期待.png", color: "bg-[#EF476F]" },
  content: { image: "/moods/满足.png", color: "bg-[#C8E7C8]" },
  calm: { image: "/moods/平静.png", color: "bg-[#A8A39D]" },
  tired: { image: "/moods/累.png", color: "bg-[#9C8574]" },
  sad: { image: "/moods/悲伤.png", color: "bg-[#6C8EAD]" },
  worried: { image: "/moods/担心.png", color: "bg-[#7FA99B]" },
  confused: { image: "/moods/迷茫.png", color: "bg-[#8FB5D3]" },
  anxious: { image: "/moods/心动.png", color: "bg-[#C5A3D9]" },
  angry: { image: "/moods/生气.png", color: "bg-[#06FFA5]" },
};

/**
 * Journal Detail Page Component
 * Displays a journal entry with AI role comments
 */
const JournalDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [comments, setComments] = useState<JournalComment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEntryAndComments = async () => {
      if (!id) return;

      try {
        console.log('[JournalDetail] Fetching entry:', id);
        
        // Fetch entry
        const { data: entryData, error: entryError } = await supabase
          .from('journal_entries')
          .select('*')
          .eq('id', id)
          .single();

        if (entryError) throw entryError;
        
        console.log('[JournalDetail] Entry fetched:', entryData);
        setEntry(entryData);

        // Fetch comments with AI role info
        const { data: commentsData, error: commentsError } = await supabase
          .from('journal_comments')
          .select(`
            id,
            content,
            created_at,
            is_read,
            ai_role:ai_roles (
              id,
              name,
              avatar_url
            )
          `)
          .eq('journal_entry_id', id)
          .order('created_at', { ascending: true });

        if (commentsError) throw commentsError;

        console.log('[JournalDetail] Comments fetched:', commentsData);
        setComments(commentsData as unknown as JournalComment[]);

        // Mark all comments as read
        const unreadCommentIds = commentsData
          ?.filter(c => !c.is_read)
          .map(c => c.id) || [];

        if (unreadCommentIds.length > 0) {
          console.log('[JournalDetail] Marking comments as read:', unreadCommentIds);
          const { error: updateError } = await supabase
            .from('journal_comments')
            .update({ is_read: true })
            .in('id', unreadCommentIds);

          if (updateError) {
            console.error('[JournalDetail] Error marking comments as read:', updateError);
          }
        }
      } catch (error) {
        console.error('[JournalDetail] Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEntryAndComments();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">日记不存在</p>
      </div>
    );
  }

  const moodConfig = MOOD_EMOJIS[entry.mood];

  return (
    <div className="min-h-screen pb-8 bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/journals')}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">日记详情</h1>
            <p className="text-xs text-muted-foreground">
              {entry.date || format(new Date(entry.created_at), 'yyyy年M月d日')}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Journal Entry */}
        <Card className="bg-card/80 backdrop-blur">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 flex items-center justify-center flex-shrink-0">
                {moodConfig?.image ? (
                  <img src={moodConfig.image} alt="mood" className="w-12 h-12 object-contain" />
                ) : (
                  <span className="text-2xl">📝</span>
                )}
              </div>
              <div className="space-y-0.5">
                <div className="text-sm text-muted-foreground">
                  {entry.time || format(new Date(entry.created_at), 'hh:mm')} {format(new Date(entry.created_at), 'a').toUpperCase()}
                </div>
                <div className="text-sm text-muted-foreground">
                  周{['日', '一', '二', '三', '四', '五', '六'][new Date(entry.created_at).getDay()]}
                </div>
              </div>
            </div>
            <div className="ml-[60px]">
              <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                {entry.content}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Comments Section */}
        {comments.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold px-2">AI 伙伴的评论 ({comments.length})</h2>
            {comments.map((comment) => (
              <Card key={comment.id} className="bg-card/60 backdrop-blur">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="w-10 h-10 border-2 border-primary/20 flex-shrink-0">
                      <AvatarImage src={comment.ai_role.avatar_url || undefined} />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-sm">
                        {comment.ai_role.name.slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{comment.ai_role.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(comment.created_at), 'HH:mm')}
                        </span>
                      </div>
                      <p className="text-sm text-foreground/90 leading-relaxed">
                        {comment.content}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {comments.length === 0 && (
          <div className="text-center py-8">
            <p className="text-muted-foreground text-sm">暂无评论</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default JournalDetail;
