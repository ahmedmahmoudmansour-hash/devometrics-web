// Separate from actions.ts deliberately — that file is "use server", which
// only allows async function exports; a plain const there breaks the
// Turbopack production build ("Only async functions are allowed to be
// exported in a 'use server' file"), same reasoning as CANDIDATE_CV_BUCKET
// living in lib/hiring/constants.ts rather than candidateActions.ts.
export const LEAVE_ATTACHMENTS_BUCKET = "leave-attachments";
