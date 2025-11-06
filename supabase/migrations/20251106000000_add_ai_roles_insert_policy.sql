-- Add INSERT policy for ai_roles table to allow authenticated users to create AI roles
CREATE POLICY "Authenticated users can create AI roles"
ON public.ai_roles
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Add UPDATE policy for ai_roles table to allow users to update AI roles
CREATE POLICY "Authenticated users can update AI roles"
ON public.ai_roles
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Add DELETE policy for ai_roles table to allow users to delete AI roles
CREATE POLICY "Authenticated users can delete AI roles"
ON public.ai_roles
FOR DELETE
TO authenticated
USING (true);
