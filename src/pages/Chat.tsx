import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  sender_name?: string;
  sender_avatar?: string;
}

const Chat = () => {
  const { friendId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [friendName, setFriendName] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Mock friend data - in production, fetch from profiles table
  const mockFriends: Record<string, { name: string; initials: string }> = {
    "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11": { name: "Emma Wilson", initials: "EW" },
    "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22": { name: "Alex Chen", initials: "AC" },
    "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33": { name: "Sarah Johnson", initials: "SJ" },
  };

  useEffect(() => {
    // Get current user
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUserId(user.id);
      }
    });

    // Set friend name from mock data
    if (friendId && mockFriends[friendId]) {
      setFriendName(mockFriends[friendId].name);
    }
  }, [friendId]);

  useEffect(() => {
    if (!currentUserId || !friendId) return;

    // Fetch messages
    fetchMessages();

    // Subscribe to new messages - listen for all messages between these two users
    const channel = supabase
      .channel(`messages-${currentUserId}-${friendId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          const newMsg = payload.new as Message;
          // Only add messages that are between this conversation pair
          if (
            (newMsg.sender_id === currentUserId && newMsg.receiver_id === friendId) ||
            (newMsg.sender_id === friendId && newMsg.receiver_id === currentUserId)
          ) {
            setMessages((prev) => [...prev, newMsg]);
            scrollToBottom();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, friendId]);

  const fetchMessages = async () => {
    if (!currentUserId || !friendId) return;

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${currentUserId})`)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading messages:', error);
      toast({
        title: "Error loading messages",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setMessages(data || []);
      setTimeout(scrollToBottom, 100);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUserId || !friendId) return;

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          sender_id: currentUserId,
          receiver_id: friendId,
          content: newMessage.trim(),
        });

      if (error) {
        console.error('Error sending message:', error);
        toast({
          title: "Error sending message",
          description: error.message,
          variant: "destructive",
        });
      } else {
        setNewMessage("");
        scrollToBottom();

        // Call AI backend to get character reply and store it
        try {
          // Prefer env-based base URL for local dev; use relative path in production
          const apiBase = (import.meta as any)?.env?.VITE_API_BASE_URL ?? '';
          const primaryEndpoint = apiBase ? `${apiBase.replace(/\/$/, '')}/api/chat` : '/api/chat';
          const fallbackEndpoint = 'https://soul-bloom-diary.vercel.app/api/chat';

          const makeRequest = async (url: string) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 20000);
            try {
              const res = await fetch(url, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'deepseek/deepseek-chat-v3.1:free',
                  messages: [
                    { role: 'system', content: `You are ${friendName}. Reply concisely.` },
                    { role: 'user', content: newMessage.trim() },
                  ],
                }),
                signal: controller.signal,
                cache: 'no-store',
              });
              return res;
            } finally {
              clearTimeout(timeoutId);
            }
          };

          // Try primary endpoint first
          let aiRes = await makeRequest(primaryEndpoint);

          // If 404, retry with fallback absolute vercel URL
          if (aiRes.status === 404 && primaryEndpoint !== fallbackEndpoint) {
            aiRes = await makeRequest(fallbackEndpoint);
          }

          if (!aiRes.ok) {
            const text = await aiRes.text().catch(() => '');
            throw new Error(`AI API error: ${aiRes.status} ${text}`);
          }

          const aiJson = await aiRes.json().catch(() => ({}));
          const aiText =
            aiJson?.content ??
            aiJson?.message?.content ??
            aiJson?.choices?.[0]?.message?.content ??
            aiJson?.choices?.[0]?.text ??
            '';

          if (aiText) {
            const { error: replyError } = await supabase
              .from('messages')
              .insert({
                sender_id: friendId,
                receiver_id: currentUserId,
                content: aiText,
              });
            if (replyError) {
              console.error('Error saving AI reply:', replyError);
              toast({
                title: 'Error saving AI reply',
                description: replyError.message,
                variant: 'destructive',
              });
            } else {
              scrollToBottom();
            }
          }
        } catch (err: any) {
          console.error('AI chat error:', err);
          toast({
            title: 'AI chat error',
            description: err?.name === 'AbortError'
              ? 'Request timeout. Please retry.'
              : (err?.message ?? 'Failed to get AI reply'),
            variant: 'destructive',
          });
        }
      }
    } catch (err) {
      console.error('Error in handleSendMessage:', err);
      toast({
        title: "Error sending message",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  const friend = friendId ? mockFriends[friendId] : null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/friends")}
          className="hover:bg-primary/10"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <Avatar className="w-10 h-10 border-2 border-primary/20">
          <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${friendName}`} />
          <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white">
            {friend?.initials || "?"}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="font-semibold text-foreground">{friendName}</h1>
          <p className="text-xs text-muted-foreground">Online</p>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((message) => {
          const isSent = message.sender_id === currentUserId;
          const senderName = isSent ? "You" : friendName;
          return (
            <div
              key={message.id}
              className={`flex gap-2 ${isSent ? "justify-end" : "justify-start"}`}
            >
              {!isSent && (
                <Avatar className="w-8 h-8 flex-shrink-0 mt-1">
                  <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${friendName}`} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-xs">
                    {friend?.initials || "?"}
                  </AvatarFallback>
                </Avatar>
              )}
              <div className={`flex flex-col ${isSent ? "items-end" : "items-start"}`}>
                {!isSent && (
                  <p className="text-xs text-muted-foreground mb-1 px-2">{senderName}</p>
                )}
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                    isSent
                      ? "bg-gradient-to-r from-primary to-accent text-white"
                      : "bg-muted text-foreground"
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                  <p className={`text-xs mt-1 ${isSent ? "text-white/70" : "text-muted-foreground"}`}>
                    {new Date(message.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
              {isSent && (
                <Avatar className="w-8 h-8 flex-shrink-0 mt-1">
                  <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=user`} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-xs">
                    U
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSendMessage}
        className="bg-card border-t border-border px-4 py-3 flex items-center gap-2"
      >
        <Input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1"
        />
        <Button
          type="submit"
          size="icon"
          className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
          disabled={!newMessage.trim()}
        >
          <Send className="w-5 h-5" />
        </Button>
      </form>
    </div>
  );
};

export default Chat;
