// Fixed question set HR fills in during/after the exit meeting — stable
// English identifiers (index-keyed), translated at the UI layer via
// t(`exitInterviewForm.questions.${i}`), same "stable identifier,
// translate at display" split used throughout this codebase. The AI
// analysis prompt also reads these in English regardless of UI locale,
// same reasoning as resolveAssessmentName staying English for AI context.
export const EXIT_INTERVIEW_QUESTIONS = [
  "What is your primary reason for leaving?",
  "What did you enjoy most about working here?",
  "What could we have done better?",
  "How would you describe your relationship with your manager?",
  "Did you feel you had opportunities to grow and develop here?",
  "Would you recommend this company to a friend as a place to work? Why or why not?",
  "Would you consider returning to this company in the future?",
  "Is there anything else you'd like to share?",
] as const;
