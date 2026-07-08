-- Personal reference notes on a milestone, distinct from the AI-generated
-- description/success_indicator — the user's own reminders, not content the
-- system produced. Purely for their own use, never read by any AI prompt.
alter table public.milestones
  add column if not exists user_notes text;
