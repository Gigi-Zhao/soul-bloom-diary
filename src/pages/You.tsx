import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Calendar, Music, Archive, Heart, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { BottomNav } from "@/components/ui/bottom-nav";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AIRole {
  id: string;
  name: string;
  avatar_url: string;
  catchphrase: string;
}

/**
 * You Page Component
 * Main character profile page with AI companion interaction
 */
const You = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [aiRole, setAiRole] = useState<AIRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [relationshipDays, setRelationshipDays] = useState<number>(0);
  const [touchFeedback, setTouchFeedback] = useState<{ text: string; x: number; y: number } | null>(null);
  const hasInitializedRef = useRef(false);
  const characterAreaRef = useRef<HTMLDivElement>(null);
  const [userName, setUserName] = useState<string>("小Q");

  // Calculate relationship days since first journal entry
  useEffect(() => {
    const calculateDays = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: firstJournal } = await supabase
          .from('journal_entries')
          .select('created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (firstJournal) {
          const firstDate = new Date(firstJournal.created_at);
          const today = new Date();
          const diffTime = Math.abs(today.getTime() - firstDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          setRelationshipDays(diffDays);
        }
      } catch (error) {
        console.error('Error calculating relationship days:', error);
      }
    };

    calculateDays();
  }, []);

  // Handle character touch feedback
  const handleCharacterTouch = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!characterAreaRef.current) return;

    const feedbackTexts = ["嘿嘿，痒~", "我在听呢", "想听歌了吗？", "嗯？怎么了？"];
    const randomText = feedbackTexts[Math.floor(Math.random() * feedbackTexts.length)];

    const rect = characterAreaRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setTouchFeedback({ text: randomText, x, y });
    setTimeout(() => setTouchFeedback(null), 1000);
  };


  useEffect(() => {
    if (hasInitializedRef.current) {
      return;
    }

    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate("/auth");
          return;
        }

        // Try to find '小兵' first
        const { data: defaultRole, error: defaultRoleError } = await supabase
          .from('ai_roles')
          .select('id, name, avatar_url, catchphrase')
          .eq('name', '小兵')
          .limit(1)
          .maybeSingle();

        if (defaultRoleError) throw defaultRoleError;

        if (defaultRole) {
          setAiRole(defaultRole);
        } else {
          // Fallback to user's first role if '小兵' not found
          const { data: roleData, error: roleError } = await supabase
            .from('ai_roles')
            .select('id, name, avatar_url, catchphrase')
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle();

          if (roleError) throw roleError;
          
          if (roleData) {
            setAiRole(roleData);
          } else {
            // Fallback to any first role
            const { data: firstRole } = await supabase
              .from('ai_roles')
              .select('id, name, avatar_url, catchphrase')
              .limit(1)
              .maybeSingle();
            
            if (firstRole) {
              setAiRole(firstRole);
            } else {
              toast({
                title: "未找到角色",
                description: "请先创建一个AI角色",
                variant: "destructive",
              });
              navigate("/friends");
              return;
            }
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: "加载失败",
          description: error instanceof Error ? error.message : "未知错误",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
        hasInitializedRef.current = true;
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBubbleClick = () => {
    if (!aiRole) return;
    
    const initialContent = aiRole.catchphrase || `嘿！有什么想和我分享的吗？`;

    navigate(`/chat/${aiRole.id}`, {
      state: { initialAIMessage: initialContent, from: '/you' }
    });
  };

  const handleChatClick = () => {
    if (aiRole) {
      navigate(`/chat/${aiRole.id}`, {
        state: { from: '/you' }
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-purple-50 via-pink-50 to-purple-50">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  if (!aiRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-purple-50 via-pink-50 to-purple-50">
        <p className="text-muted-foreground">未找到角色</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f0f0] relative overflow-hidden">
      {/* Background layer - full screen */}
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(230, 218, 245, 0.7) 0%, rgba(255, 235, 240, 0.9) 100%), url('https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80')`,
        }}
      />

      {/* Content layer */}
      <div className="relative z-10 h-screen flex flex-col px-5 py-5 max-w-md mx-auto">
        
        {/* Header relationship pill */}
        <div className="flex justify-center mt-10">
          <div className="bg-white/50 backdrop-blur-[10px] px-5 py-2 rounded-full flex items-center gap-2 border border-white/40" style={{
            boxShadow: '0 4px 15px rgba(0,0,0,0.05)'
          }}>
            <span className="text-sm font-semibold text-[#4A4A4A]">{aiRole.name}</span>
            <span className="text-base" style={{ animation: 'heartbeat 1.5s infinite' }}>❤️</span>
            <span className="text-sm font-semibold text-[#4A4A4A]">{userName}</span>
            <div className="w-px h-3 bg-[#ddd] mx-1" />
            <span className="text-sm font-semibold text-[#9D85BE]">{relationshipDays} Days</span>
          </div>
        </div>

        {/* Spacer to push dashboard to bottom */}
        <div className="flex-1 flex flex-col items-center justify-center w-full">
          
          {/* Minimalist Whisper Module */}
          <div className="group flex items-center gap-3 bg-white/30 backdrop-blur-[2px] hover:bg-white/40 transition-all duration-500 px-5 py-3 rounded-full border border-white/20 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_15px_rgba(0,0,0,0.05)] cursor-default animate-in fade-in slide-in-from-bottom-4 duration-1000 max-w-[85%]">
            
            {/* Avatar Circle */}
            <div className="w-8 h-8 rounded-full bg-white/60 flex items-center justify-center overflow-hidden shrink-0 border border-white/40 shadow-sm">
               {aiRole?.name === '小兵' && aiRole.avatar_url ? (
                  <img src={aiRole.avatar_url} alt="小兵" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm">💂‍♂️</span>
                )}
            </div>

            {/* Text */}
            <p className="text-[#666] text-sm font-medium tracking-wide leading-relaxed">
              这段时间，你在慢慢变勇敢。
            </p>
            
          </div>

        </div>
      </div>

      {/* Dashboard grid - Fixed at bottom above tab bar */}
      <div className="fixed bottom-24 left-0 right-0 px-5 z-10">
        <div className="max-w-md mx-auto bg-white/50 backdrop-blur-[10px] rounded-3xl p-4 grid grid-cols-4 gap-2.5">
          <div 
            onClick={handleChatClick}
            className="flex flex-col items-center gap-2 cursor-pointer transition-transform duration-200 active:scale-90"
          >
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-2xl" style={{
              boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
            }}>
              💬
            </div>
            <span className="text-[11px] text-[#4A4A4A]">聊天</span>
          </div>

          <div 
            onClick={() => navigate('/journals')}
            className="flex flex-col items-center gap-2 cursor-pointer transition-transform duration-200 active:scale-90"
          >
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-2xl" style={{
              boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
            }}>
              💗
            </div>
            <span className="text-[11px] text-[#4A4A4A]">梦想清单</span>
          </div>

          <div 
            onClick={() => navigate('/profile')}
            className="flex flex-col items-center gap-2 cursor-pointer transition-transform duration-200 active:scale-90"
          >
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-2xl" style={{
              boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
            }}>
              🧸
            </div>
            <span className="text-[11px] text-[#4A4A4A]">纪念物</span>
          </div>

          <div 
            onClick={() => navigate('/journals')}
            className="flex flex-col items-center gap-2 cursor-pointer transition-transform duration-200 active:scale-90"
          >
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-2xl" style={{
              boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
            }}>
              💭
            </div>
            <span className="text-[11px] text-[#4A4A4A]">想法</span>
          </div>
        </div>
      </div>

      <BottomNav />      {/* Add keyframes for animations */}
      <style>{`
        @keyframes heartbeat {
          0% { transform: scale(1); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes fadeUp {
          0% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-20px); }
        }
      `}</style>
    </div>
  );
};

export default You;

