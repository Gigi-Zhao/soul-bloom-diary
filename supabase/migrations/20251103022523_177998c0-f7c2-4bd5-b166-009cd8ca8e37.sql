-- Create messages table for storing chat messages between users
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  read BOOLEAN NOT NULL DEFAULT false
);

-- Enable Row Level Security
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Users can view messages they sent or received
CREATE POLICY "Users can view their own messages" 
ON public.messages 
FOR SELECT 
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Users can send messages
CREATE POLICY "Users can send messages" 
ON public.messages 
FOR INSERT 
WITH CHECK (auth.uid() = sender_id);

-- Users can update messages they received (e.g., mark as read)
CREATE POLICY "Users can update received messages" 
ON public.messages 
FOR UPDATE 
USING (auth.uid() = receiver_id);

-- Create index for faster queries
CREATE INDEX idx_messages_sender_receiver ON public.messages(sender_id, receiver_id, created_at);
CREATE INDEX idx_messages_receiver_sender ON public.messages(receiver_id, sender_id, created_at);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;