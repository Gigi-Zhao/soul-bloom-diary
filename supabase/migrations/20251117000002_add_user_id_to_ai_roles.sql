-- Add user_id column to ai_roles table to track who created each AI role
ALTER TABLE public.ai_roles
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for better query performance
CREATE INDEX idx_ai_roles_user_id ON public.ai_roles(user_id);

-- Update existing policy to allow users to delete only their own AI roles
DROP POLICY IF EXISTS "Authenticated users can delete AI roles" ON public.ai_roles;

CREATE POLICY "Users can delete their own AI roles"
ON public.ai_roles
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Update existing policy to allow users to update only their own AI roles
DROP POLICY IF EXISTS "Authenticated users can update AI roles" ON public.ai_roles;

CREATE POLICY "Users can update their own AI roles"
ON public.ai_roles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Keep the insert policy as is (users can create AI roles)
-- Keep the select policy as is (AI roles are viewable by everyone)
