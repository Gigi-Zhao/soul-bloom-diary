import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
  last_message?: string;
  last_message_time?: string;
}

interface AIRole {
  id: string;
  name: string;
  avatar_url: string;
}

const ConversationHistory = () => {
  const { roleId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [aiRole, setAiRole] = useState<AIRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Fetch AI role
      if (roleId) {
        const { data: role, error: roleError } = await supabase
          .from('ai_roles')
          .select('id, name, avatar_url')
          .eq('id', roleId)
          .single();

        if (roleError) {
          console.error('Error fetching AI role:', roleError);
          navigate("/friends");
          return;
        }
        setAiRole(role);

        // Fetch conversations
        const { data: convData, error: convError } = await supabase
          .from('conversations')
          .select('id, title, updated_at')
          .eq('user_id', user.id)
          .eq('ai_role_id', roleId)
          .order('updated_at', { ascending: false });

        if (convError) {
          console.error('Error fetching conversations:', convError);
          toast({
            title: "加载失败",
            description: convError.message,
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        // Fetch last message for each conversation
        const conversationsWithMessages = await Promise.all(
          (convData || []).map(async (item) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const conv = item as any;
            const { data: messages, error: msgError } = await supabase
              .from('messages')
              .select('content, created_at')
              .eq('conversation_id', (conv as unknown as { id: string }).id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle() as { data: { content: string; created_at: string } | null; error: unknown };

            if (msgError) {
              console.error(`Error fetching messages for conversation ${(conv as unknown as { id: string }).id}:`, msgError);
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const msg = messages as any;
            return {
              ...conv,
              last_message: msg ? msg.content : '暂无消息',
              last_message_time: msg ? msg.created_at : conv.updated_at,
            };
          })
        );

        setConversations(conversationsWithMessages as unknown as Conversation[]);
      }
      setLoading(false);
    };

    fetchData();
  }, [roleId, navigate, toast]);

  const handleDeleteConversation = async () => {
    if (!conversationToDelete) return;

    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationToDelete);

    if (error) {
      console.error('Error deleting conversation:', error);
      toast({
        title: "删除失败",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "删除成功",
        description: "对话已删除",
      });
      setConversations(conversations.filter(c => c.id !== conversationToDelete));
    }

    setDeleteDialogOpen(false);
    setConversationToDelete(null);
  };

  const handleNewConversation = () => {
    navigate(`/chat/${roleId}`);
  };

  const handleConversationClick = (conversationId: string) => {
    navigate(`/chat/${roleId}?conversation=${conversationId}`, {
      state: { from: '/conversation-history' }
    });
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 48) {
      return '昨天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }) + ' ' +
        date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }
  };

  if (!aiRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/friends")}
            className="hover:bg-primary/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Avatar className="w-10 h-10 border-2 border-primary/20">
            <AvatarImage src={aiRole.avatar_url} />
            <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white">
              {aiRole.name.slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="font-semibold text-foreground">{aiRole.name}</h1>
            <p className="text-xs text-muted-foreground">对话历史</p>
          </div>
        </div>
        <Button
          onClick={handleNewConversation}
          className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
          size="sm"
        >
          <Plus className="w-4 h-4 mr-1" />
          新对话
        </Button>
      </header>

      {/* Conversation List */}
      <div className="max-w-2xl mx-auto px-4 py-4">
        {loading ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">加载中...</p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">暂无对话记录</p>
            <Button
              onClick={handleNewConversation}
              className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
            >
              <Plus className="w-4 h-4 mr-2" />
              开始新对话
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className="bg-card border border-border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleConversationClick(conversation.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-medium text-foreground truncate">
                        {conversation.title}
                      </h3>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="flex-shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConversationToDelete(conversation.id);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                      {conversation.last_message}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(conversation.last_message_time || conversation.updated_at)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这个对话吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConversation}
              className="bg-destructive hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ConversationHistory;
