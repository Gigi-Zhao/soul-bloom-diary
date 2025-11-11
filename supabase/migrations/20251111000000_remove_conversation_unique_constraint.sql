-- Remove the unique constraint on conversations table to allow multiple conversations
-- between the same user and AI role

-- Drop the existing unique constraint
ALTER TABLE public.conversations
DROP CONSTRAINT IF EXISTS conversations_user_id_ai_role_id_title_key;

-- Add index for better query performance when fetching conversations
CREATE INDEX IF NOT EXISTS idx_conversations_user_ai_updated 
ON public.conversations(user_id, ai_role_id, updated_at DESC);
