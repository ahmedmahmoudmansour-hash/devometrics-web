// Input caps and rate limits for AI-calling routes. Both exist for the same
// reason: nothing else in this app stands between a request and a billable
// Claude API call, so these are the only thing preventing runaway cost.

export const MAX_COACH_MESSAGE_LENGTH = 4000;
export const MAX_CV_LENGTH = 20000;
export const MAX_JOB_DESCRIPTION_LENGTH = 10000;
export const MAX_TARGET_ROLE_LENGTH = 200;
export const MAX_PERFORMANCE_DATA_LENGTH = 10000;

export const COACH_RATE_LIMIT_WINDOW_MINUTES = 1;
export const COACH_RATE_LIMIT_MAX_MESSAGES = 10;

// Separate from the anti-abuse throttle above — this is the actual Free-tier
// pricing limit ("Limited AI coaching (10 messages/mo)"), a calendar-month
// quota rather than a per-minute one.
export const COACH_FREE_MONTHLY_MESSAGE_LIMIT = 10;

export const GAP_ANALYSIS_RATE_LIMIT_WINDOW_MINUTES = 60;
export const GAP_ANALYSIS_RATE_LIMIT_MAX_RUNS = 5;

export const MAX_RESUME_LENGTH = 20000;
export const RESUME_RATE_LIMIT_WINDOW_MINUTES = 60;
export const RESUME_RATE_LIMIT_MAX_RUNS = 5;

export const MAX_DISCOVERY_ANSWER_LENGTH = 1000;
export const DISCOVERY_RATE_LIMIT_WINDOW_MINUTES = 60;
export const DISCOVERY_RATE_LIMIT_MAX_RUNS = 5;

export const MAX_PLATFORM_CHAT_MESSAGE_LENGTH = 1000;
export const MAX_PLATFORM_CHAT_HISTORY = 10;

export const MAX_CASE_STUDY_RESPONSE_LENGTH = 2000;
export const CASE_STUDY_RATE_LIMIT_WINDOW_MINUTES = 60;
export const CASE_STUDY_RATE_LIMIT_MAX_RUNS = 20;

// Free-tier pricing limit for the standard (non-case-study) assessments —
// a lifetime cap on how many *distinct* assessments a free account can ever
// complete, not a monthly one; retaking an already-completed assessment
// doesn't count against it.
export const FREE_ASSESSMENT_LIMIT = 2;

export const MAX_SPEECH_TEXT_LENGTH = 2000;

// Two real Claude calls per generation (a web-search call, then a
// structured-synthesis call) — cheap per click (roughly 5-7 cents), but
// nothing else stops someone from spam-clicking Regenerate, so this is the
// actual cost guard, same reasoning as every other AI-calling route above.
export const BRIDGE_CONTENT_RATE_LIMIT_WINDOW_MINUTES = 60;
export const BRIDGE_CONTENT_RATE_LIMIT_MAX_RUNS = 10;

// Manager-entered interview notes on a hiring candidate — admin-gated (not
// self-serve), so no per-window rate limit needed, same posture as the
// other admin-only AI-calling actions in lib/jobArchitecture and
// lib/succession (a length cap, not a request-count throttle).
export const MAX_INTERVIEW_NOTE_LENGTH = 4000;

// CV scoring is admin-gated but, unlike interview notes above, IS a
// bulk-shaped action — an admin can add many candidates to one posting in a
// sitting, and nothing else stands between that and a burst of Claude calls
// (e.g. a careless bulk upload, or a retry loop on a flaky network). Window
// is daily rather than hourly like most other limits here, since reviewing a
// real applicant stack in one afternoon is normal, expected usage.
//
// The limit scales with headcount rather than being a flat number: a real
// enterprise account can legitimately need well over 100 scores/day during
// an active hiring push, and a flat cap would either block that (lost
// revenue, false-positive abuse signal) or — at a company small enough for
// 100/day to be generous — do nothing to bound cost. BASE is the floor for
// small accounts; PER_EMPLOYEE lets larger accounts scale up from there.
export const HIRING_CV_SCORE_RATE_LIMIT_WINDOW_MINUTES = 1440;
export const HIRING_CV_SCORE_RATE_LIMIT_BASE_RUNS = 100;
export const HIRING_CV_SCORE_RATE_LIMIT_PER_EMPLOYEE = 0.5;

export function hiringCvScoreDailyLimit(employeeCount: number): number {
  return Math.max(
    HIRING_CV_SCORE_RATE_LIMIT_BASE_RUNS,
    Math.ceil(employeeCount * HIRING_CV_SCORE_RATE_LIMIT_PER_EMPLOYEE)
  );
}

export const MAX_ROLEPLAY_MESSAGE_LENGTH = 2000;
// Roleplay sessions store the whole conversation as one row (jsonb array),
// so per-message rate limiting doesn't map to a row count the way other
// features' limits do — instead cap new-session creation per window, and
// cap turns within a single session as the runaway-cost guard.
export const ROLEPLAY_SESSION_RATE_LIMIT_WINDOW_MINUTES = 60;
export const ROLEPLAY_SESSION_RATE_LIMIT_MAX_NEW_SESSIONS = 10;
export const MAX_ROLEPLAY_TURNS = 40;
