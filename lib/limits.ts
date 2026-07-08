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

export const MAX_SPEECH_TEXT_LENGTH = 2000;

export const MAX_ROLEPLAY_MESSAGE_LENGTH = 2000;
// Roleplay sessions store the whole conversation as one row (jsonb array),
// so per-message rate limiting doesn't map to a row count the way other
// features' limits do — instead cap new-session creation per window, and
// cap turns within a single session as the runaway-cost guard.
export const ROLEPLAY_SESSION_RATE_LIMIT_WINDOW_MINUTES = 60;
export const ROLEPLAY_SESSION_RATE_LIMIT_MAX_NEW_SESSIONS = 10;
export const MAX_ROLEPLAY_TURNS = 40;
