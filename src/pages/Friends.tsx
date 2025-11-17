import { useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { BottomNav } from "@/components/ui/bottom-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, MessageCircle, Sparkles, Plus, Trash2 } from "lucide-react";
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

interface AIRole {
  id: string;
  name: string;
  description: string;
  avatar_url: string;
}

/**
 * Friends Page Component
 * Chat with AI companions for support and guidance
 */
const Friends = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [aiRoles, setAiRoles] = useState<AIRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<AIRole | null>(null);
  const [swipedRoleId, setSwipedRoleId] = useState<string | null>(null);
  
  // Touch handling for swipe
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const [swipeOffset, setSwipeOffset] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    const fetchAIRoles = async () => {
      const { data, error } = await supabase
        .from('ai_roles')
        .select('id, name, description, avatar_url')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching AI roles:', error);
        toast({
          title: "加载失败",
          description: error.message,
          variant: "destructive",
        });
      } else {
        setAiRoles(data || []);
      }
      setLoading(false);
    };

    fetchAIRoles();
  }, [toast]);

  const handleTouchStart = (e: React.TouchEvent, roleId: string) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent, roleId: string) => {
    touchEndX.current = e.touches[0].clientX;
    const offset = touchStartX.current - touchEndX.current;
    
    // Only allow left swipe (positive offset)
    if (offset > 0 && offset <= 100) {
      setSwipeOffset(prev => ({ ...prev, [roleId]: offset }));
    }
  };

  const handleTouchEnd = (roleId: string) => {
    const offset = touchStartX.current - touchEndX.current;
    
    // If swiped more than 50px to the left, show delete button
    if (offset > 50) {
      setSwipeOffset(prev => ({ ...prev, [roleId]: 100 }));
      setSwipedRoleId(roleId);
    } else {
      // Reset swipe
      setSwipeOffset(prev => ({ ...prev, [roleId]: 0 }));
      setSwipedRoleId(null);
    }
  };

  const handleDeleteClick = (role: AIRole, e: React.MouseEvent) => {
    e.stopPropagation();
    setRoleToDelete(role);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!roleToDelete) return;

    try {
      // Delete the AI role - this will cascade to conversations and messages
      const { error } = await supabase
        .from('ai_roles')
        .delete()
        .eq('id', roleToDelete.id);

      if (error) throw error;

      // Update local state
      setAiRoles(prev => prev.filter(role => role.id !== roleToDelete.id));
      
      // Reset swipe state
      setSwipeOffset(prev => {
        const newOffset = { ...prev };
        delete newOffset[roleToDelete.id];
        return newOffset;
      });
      setSwipedRoleId(null);

      toast({
        title: "删除成功",
        description: `已删除 ${roleToDelete.name}`,
      });
    } catch (error) {
      console.error('Error deleting AI role:', error);
      toast({
        title: "删除失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setRoleToDelete(null);
    }
  };

  const handleCardClick = (roleId: string) => {
    // Don't navigate if the card is swiped
    if (swipedRoleId !== roleId) {
      navigate(`/chat/${roleId}`);
    } else {
      // Reset swipe instead
      setSwipeOffset(prev => ({ ...prev, [roleId]: 0 }));
      setSwipedRoleId(null);
    }
  };

  return (
    <div className="min-h-screen pb-24 pt-8 px-4 bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="max-w-md mx-auto mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center shadow-[0_4px_16px_hsl(var(--primary)/0.3)]">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">AI 伙伴</h1>
            <p className="text-sm text-muted-foreground">与智能伙伴聊天，获得支持与指引</p>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-md mx-auto space-y-4">
        {loading ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">加载中...</p>
          </div>
        ) : (
          <>
            {/* Create new AI friend button */}
            <Card 
              className="transition-all duration-300 hover:shadow-[0_4px_16px_hsl(var(--primary)/0.2)] cursor-pointer bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20"
              onClick={() => navigate('/create-friend')}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center">
                    <Plus className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base font-semibold">创建你的专属AI伙伴</CardTitle>
                    <p className="text-sm text-muted-foreground">点击开始创建</p>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* AI Companions list */}
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
              <h2 className="text-lg font-semibold text-foreground">我的 AI 伙伴</h2>
              
              {aiRoles.map((role, index) => (
                <div key={role.id} className="relative overflow-hidden">
                  {/* Main Card with Swipe */}
                  <div
                    className="relative transition-transform duration-300 ease-out"
                    style={{
                      transform: `translateX(-${swipeOffset[role.id] || 0}px)`,
                    }}
                    onTouchStart={(e) => handleTouchStart(e, role.id)}
                    onTouchMove={(e) => handleTouchMove(e, role.id)}
                    onTouchEnd={() => handleTouchEnd(role.id)}
                  >
                    <Card 
                      className="transition-all duration-300 hover:shadow-[0_4px_16px_hsl(var(--primary)/0.2)] cursor-pointer"
                      onClick={() => handleCardClick(role.id)}
                    >
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <Avatar className="w-12 h-12 border-2 border-primary/20">
                            <AvatarImage src={role.avatar_url} />
                            <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white">
                              {role.name.slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <CardTitle className="text-base font-semibold">{role.name}</CardTitle>
                            <p className="text-sm text-muted-foreground">{role.description}</p>
                          </div>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            className="hover:bg-primary/10 hover:text-primary transition-all duration-300"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/chat/${role.id}`);
                            }}
                          >
                            <MessageCircle className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardHeader>
                    </Card>
                  </div>

                  {/* Delete Button (revealed when swiped) */}
                  <div
                    className="absolute top-0 right-0 h-full flex items-center justify-center bg-destructive w-[100px] rounded-r-lg"
                    style={{
                      opacity: (swipeOffset[role.id] || 0) / 100,
                    }}
                  >
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive-foreground hover:bg-destructive-foreground/20"
                      onClick={(e) => handleDeleteClick(role, e)}
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Info card */}
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
              <Card className="bg-gradient-to-br from-accent/20 to-primary/20 border-accent/30">
                <CardContent className="pt-6">
                  <p className="text-sm text-center text-muted-foreground">
                    与AI伙伴聊天，获得专业的情感支持和生活指导
                  </p>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              是否要永久删除你的朋友 {roleToDelete?.name}？此操作将删除所有与该角色相关的对话记录，且无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>否</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              是
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BottomNav />
    </div>
  );
};

export default Friends;
