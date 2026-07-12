-- Contact form submissions (Sales / Support / Careers). Replaces relying
-- solely on mailto: links, which silently fail for any visitor without a
-- desktop mail client configured and leave no record if the resulting
-- email is missed. Every submission is both stored here (a durable record,
-- queryable via the Supabase table editor) and emailed to the matching
-- team inbox — see lib/contact/actions.ts.
create table if not exists public.contact_inquiries (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('sales', 'support', 'careers')),
  name text not null,
  email text not null,
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.contact_inquiries enable row level security;

-- Submitted by anonymous site visitors, not signed-in users — insert-only,
-- no read/update/delete policy at all, so submissions aren't readable via
-- the public API even by the person who submitted them (review happens
-- directly in the Supabase table editor, matching the solo-operator scale
-- of every other admin-only surface in this app so far).
drop policy if exists "Anyone can submit a contact inquiry" on public.contact_inquiries;
create policy "Anyone can submit a contact inquiry"
  on public.contact_inquiries for insert
  to anon, authenticated
  with check (true);
