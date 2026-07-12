-- Lets a platform admin (Ahmed) read contact form submissions from inside
-- the dashboard instead of only via email/the Supabase table editor.
-- Reuses the same public.is_admin() helper already used to gate every
-- other pilot-wide admin view (0013) — still insert-only for everyone else.
drop policy if exists "Admins can read contact inquiries" on public.contact_inquiries;
create policy "Admins can read contact inquiries"
  on public.contact_inquiries for select
  using (public.is_admin());
