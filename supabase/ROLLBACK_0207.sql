-- ROLLBACK for migration 0207 (knowledge checks). Emergency use only.
-- Removes the table and so every stored knowledge check. The application then shows "needs migration 0207" where checks would be.
drop table if exists public.knowledge_checks;
drop function if exists public.knowledge_checks_guard();
drop function if exists public.knowledge_check_member_ok(uuid, uuid);
