import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { BottomNav } from "@/components/ui/bottom-nav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AIRole {
  id: string;
  name: string;
  description: string;
  avatar_url: string;
  user_id: string;
  is_system?: boolean;
}

type TabType = 'friends' | 'created' | 'plaza';

/**
 * Friends Page Component
 * Chat with AI companions for support and guidance
 */
const Friends = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [allRoles, setAllRoles] = useState<AIRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('friends');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchAIRoles = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.log('[Friends] User not logged in');
        setLoading(false);
        return;
      }

      setCurrentUserId(user.id);

      // 获取所有角色（用户创建的 + 系统预设的）
      const { data, error } = await supabase
        .from('ai_roles')
        .select('id, name, description, avatar_url, user_id')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[Friends] Error fetching AI roles:', error);
        toast({
          title: "加载失败",
          description: error.message,
          variant: "destructive",
        });
      } else {
        console.log(`[Friends] Loaded ${data?.length || 0} AI roles`);
        setAllRoles(data || []);
      }
      setLoading(false);
    };

    fetchAIRoles();
  }, [toast]);

  // 过滤不同类别的角色
  const friendsRoles = allRoles; // 全部角色
  const createdRoles = allRoles.filter(role => role.user_id === currentUserId);
  const plazaRoles = allRoles.filter(role => role.user_id !== currentUserId); // 系统预设或其他用户的角色

  const getCurrentRoles = () => {
    switch (activeTab) {
      case 'friends':
        return friendsRoles;
      case 'created':
        return createdRoles;
      case 'plaza':
        return plazaRoles;
      default:
        return [];
    }
  };

  // 根据搜索关键词过滤角色
  const filteredRoles = getCurrentRoles().filter(role => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return role.name.toLowerCase().includes(query) || 
           role.description?.toLowerCase().includes(query);
  });

  const currentRoles = filteredRoles;

  return (
    <div className="min-h-screen pb-24 pt-6 px-4 bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <div className="max-w-md mx-auto mb-6">
        <h1 className="text-xl font-medium text-foreground">我一直都在</h1>
      </div>

      {/* Search Bar */}
      <div className="max-w-md mx-auto mb-6">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="搜索AI好友..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-muted/50 rounded-full text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-pink-200"
            />
          </div>
          <button
            onClick={() => navigate('/create-friend')}
            className="w-8 h-8 flex-shrink-0 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
          >
            <Plus className="w-5 h-5 text-foreground" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-md mx-auto mb-6">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('friends')}
            className={`px-4 py-2 rounded-full text-sm transition-colors ${
              activeTab === 'friends'
                ? 'bg-pink-100 text-pink-600'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            好友 {friendsRoles.length}
          </button>
          <button
            onClick={() => setActiveTab('created')}
            className={`px-4 py-2 rounded-full text-sm transition-colors ${
              activeTab === 'created'
                ? 'bg-pink-100 text-pink-600'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            创建 {createdRoles.length}
          </button>
          <button
            onClick={() => setActiveTab('plaza')}
            className={`px-4 py-2 rounded-full text-sm transition-colors ${
              activeTab === 'plaza'
                ? 'bg-pink-100 text-pink-600'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            广场 {plazaRoles.length}
          </button>
        </div>
      </div>

      {/* Role List */}
      <div className="max-w-md mx-auto">
        {loading ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">加载中...</p>
          </div>
        ) : currentRoles.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">暂无角色</p>
          </div>
        ) : (
          currentRoles.map((role, index) => (
            <div key={role.id}>
              <div
                onClick={() => navigate(`/chat/${role.id}`)}
                className="flex items-start gap-3 py-4 cursor-pointer hover:bg-muted/30 transition-colors"
              >
                <Avatar className="w-12 h-12 flex-shrink-0">
                  <AvatarImage src={role.avatar_url} alt={role.name} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white">
                    {role.name.slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-medium text-foreground mb-0.5">{role.name}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    {role.description || '点击开始对话'}
                  </p>
                </div>
              </div>
              {index < currentRoles.length - 1 && (
                <div className="ml-[60px] border-b border-gray-200/50"></div>
              )}
            </div>
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Friends;
