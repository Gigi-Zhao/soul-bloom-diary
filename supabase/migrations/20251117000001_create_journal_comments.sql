-- Create journal_comments table to store AI role comments on journal entries
CREATE TABLE public.journal_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  ai_role_id UUID NOT NULL REFERENCES public.ai_roles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  is_read BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(journal_entry_id, ai_role_id)
);

-- Enable Row Level Security
ALTER TABLE public.journal_comments ENABLE ROW LEVEL SECURITY;

-- Users can view comments on their own journal entries
CREATE POLICY "Users can view comments on their journal entries"
ON public.journal_comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.journal_entries
    WHERE journal_entries.id = journal_comments.journal_entry_id
    AND journal_entries.user_id = auth.uid()
  )
);

-- Users can update comments on their own journal entries (for marking as read)
CREATE POLICY "Users can update comments on their journal entries"
ON public.journal_comments
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.journal_entries
    WHERE journal_entries.id = journal_comments.journal_entry_id
    AND journal_entries.user_id = auth.uid()
  )
);

-- AI system can insert comments
CREATE POLICY "System can insert comments"
ON public.journal_comments
FOR INSERT
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_journal_comments_entry_id ON public.journal_comments(journal_entry_id);
CREATE INDEX idx_journal_comments_ai_role_id ON public.journal_comments(ai_role_id);
CREATE INDEX idx_journal_comments_created_at ON public.journal_comments(created_at);

-- Function to update journal entry comment count
CREATE OR REPLACE FUNCTION update_journal_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.journal_entries
    SET comment_count = comment_count + 1
    WHERE id = NEW.journal_entry_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.journal_entries
    SET comment_count = GREATEST(0, comment_count - 1)
    WHERE id = OLD.journal_entry_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically update comment count
CREATE TRIGGER update_comment_count_on_insert
AFTER INSERT ON public.journal_comments
FOR EACH ROW
EXECUTE FUNCTION update_journal_comment_count();

CREATE TRIGGER update_comment_count_on_delete
AFTER DELETE ON public.journal_comments
FOR EACH ROW
EXECUTE FUNCTION update_journal_comment_count();
