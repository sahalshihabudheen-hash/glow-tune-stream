-- Fix overly-permissive INSERT policy on lyrics.
-- Lyrics are written exclusively by the get-lyrics edge function using the
-- service role (which bypasses RLS), so no broad authenticated INSERT is needed.
DROP POLICY IF EXISTS "Authenticated users can insert lyrics" ON public.lyrics;

CREATE POLICY "Admins can insert lyrics"
ON public.lyrics
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));