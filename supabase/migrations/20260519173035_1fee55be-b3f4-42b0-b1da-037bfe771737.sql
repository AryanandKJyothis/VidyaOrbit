-- Explicit deny policies so plan rows can never be created or modified by end users.
-- Service-role writes still work because RLS is bypassed for service_role.
CREATE POLICY "no client insert subscriptions" ON public.subscriptions
  FOR INSERT TO authenticated, anon WITH CHECK (false);

CREATE POLICY "no client update subscriptions" ON public.subscriptions
  FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);

CREATE POLICY "no client delete subscriptions" ON public.subscriptions
  FOR DELETE TO authenticated, anon USING (false);