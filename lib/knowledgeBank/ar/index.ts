import type { QuestionTranslation } from "../types";

// Arabic wording, keyed by question id ("competency key#level"). The correct option keeps its position, so the answer
// key is shared with English. Filled in family by family; a question without Arabic is simply not offered in Arabic.
export const AR_QUESTIONS: Record<string, QuestionTranslation> = {};
