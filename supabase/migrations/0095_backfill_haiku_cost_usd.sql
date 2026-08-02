-- Data fix, not a schema change: confirmed live (not from docs) that
-- requesting model "claude-haiku-4-5" from the Anthropic API returns
-- response.model = "claude-haiku-4-5-20251001" -- a dated snapshot the
-- app's AI_USAGE_PRICING map (lib/aiUsage/track.ts) had no entry for.
-- Every Coach/Roleplay/coach_grow_memory/coach_session_summary call since
-- those features moved to Haiku this session recorded a real row in
-- ai_usage_events with the correct token counts, but computeCostUsd's
-- lookup missed and silently wrote cost_usd = 0 for every one of them --
-- the platform admin's AI spend dashboard has been showing $0.00 for real
-- usage, not because nothing happened.
--
-- The application code is now fixed (computeCostUsd normalizes a trailing
-- -YYYYMMDD before the pricing lookup) so this exact gap can't recur for
-- future rows -- this migration only repairs the rows already written
-- wrong. Recomputing from the stored token counts is a pure function of
-- data already on the row, so this is safe to run more than once: it
-- always converges to the same correct value, not a delta applied on top
-- of a delta.
update public.ai_usage_events
set cost_usd = (input_tokens::numeric / 1000000) * 1.0 + (output_tokens::numeric / 1000000) * 5.0
where model = 'claude-haiku-4-5-20251001';
