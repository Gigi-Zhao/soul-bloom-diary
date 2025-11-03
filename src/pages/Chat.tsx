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
    "friend-1": { name: "Emma Wilson", initials: "EW" },
    "friend-2": { name: "Alex Chen", initials: "AC" },
    "friend-3": { name: "Sarah Johnson", initials: "SJ" },
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

    // Subscribe to new messages
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=in.(${currentUserId},${friendId}),receiver_id=in.(${currentUserId},${friendId})`
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => [...prev, newMsg]);
          scrollToBottom();
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

    const { error } = await supabase
      .from('messages')
      .insert({
        sender_id: currentUserId,
        receiver_id: friendId,
        content: newMessage.trim(),
      });

    if (error) {
      toast({
        title: "Error sending message",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setNewMessage("");
      scrollToBottom();
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
          return (
            <div
              key={message.id}
              className={`flex ${isSent ? "justify-end" : "justify-start"}`}
            >
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
