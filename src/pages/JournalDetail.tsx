import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronLeft, MoreVertical, Trash2 } from "lucide-react";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

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
  happy: { image: "/moods/happy.png", color: "bg-[#FFD166]" },
  excited: { image: "/moods/excited.png", color: "bg-[#EF476F]" },
  content: { image: "/moods/content.png", color: "bg-[#C8E7C8]" },
  calm: { image: "/moods/calm.png", color: "bg-[#A8A39D]" },
  tired: { image: "/moods/tired.png", color: "bg-[#9C8574]" },
  sad: { image: "/moods/sad.png", color: "bg-[#6C8EAD]" },
  worried: { image: "/moods/worried.png", color: "bg-[#7FA99B]" },
  confused: { image: "/moods/confused.png", color: "bg-[#8FB5D3]" },
  anxious: { image: "/moods/anxious.png", color: "bg-[#C5A3D9]" },
  angry: { image: "/moods/angry.png", color: "bg-[#06FFA5]" },
};

/**
 * Journal Detail Page Component
 * Displays a journal entry with AI role comments
 */
const JournalDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [comments, setComments] = useState<JournalComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  console.log('[JournalDetail] showDeleteDialog:', showDeleteDialog);

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const unreadCommentIds = (commentsData as any[])
          ?.filter(c => !c.is_read)
          .map(c => c.id) || [];

        if (unreadCommentIds.length > 0) {
          console.log('[JournalDetail] Marking comments as read:', unreadCommentIds);
          const { error: updateError } = await supabase
            .from('journal_comments')
            // @ts-expect-error Supabase types mismatch
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .update({ is_read: true } as any)
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

  const handleDeleteJournal = async () => {
    if (!id) return;

    setIsDeleting(true);
    try {
      // Delete the journal entry (comments will be deleted automatically due to cascade)
      const { error } = await supabase
        .from('journal_entries')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "删除成功",
        description: "日记已被删除",
        duration: 2000,
      });

      // Navigate back to journals page and force refresh
      setTimeout(() => {
        window.location.href = '/journals';
      }, 1000);
    } catch (error) {
      console.error('[JournalDetail] Error deleting journal:', error);
      toast({
        title: "删除失败",
        description: "删除日记时出错，请稍后再试",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

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
      <div className="sticky top-0 z-[110] bg-background/80 backdrop-blur-lg border-b">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/journals', { replace: true, state: { refresh: true } })}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">日记详情</h1>
            <p className="text-xs text-muted-foreground">
              {entry.date || format(new Date(entry.created_at), 'yyyy年M月d日')}
            </p>
          </div>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="更多选项"
                className="relative"
              >
                <MoreVertical className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" alignOffset={-80} className="z-[150]" sideOffset={8}>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive cursor-pointer"
                onSelect={(e) => {
                  console.log('[JournalDetail] Delete menu item clicked');
                  e.preventDefault();
                  setShowDeleteDialog(true);
                  console.log('[JournalDetail] setShowDeleteDialog called');
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                删除日记
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
                  {format(new Date(entry.created_at), 'hh:mm a').toUpperCase()}
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
            {/* Section label - left aligned */}
            <div className="px-2">
              <span className="text-sm text-muted-foreground/70">
                💭 朋友们的回应
              </span>
            </div>

            {/* All comments in one card */}
            <Card className="bg-card/80 backdrop-blur">
              <CardContent className="p-6 space-y-5">
                {comments.map((comment, index) => (
                  <div key={comment.id}>
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
                    {/* Divider between comments (not after last one) */}
                    {index < comments.length - 1 && (
                      <div className="mt-5 border-t border-border/20"></div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {comments.length === 0 && (
          <div className="text-center py-8">
            <p className="text-muted-foreground text-sm">✨ 朋友睡着了哦</p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确定要删除这篇日记吗？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作无法撤销。删除后，这篇日记及其所有评论都将被永久删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteJournal}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "删除中..." : "确定删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default JournalDetail;
