import { JOB_BANK } from "@/lib/jobBank";
import { questionId, type KnowledgeQuestion, type QuestionTranslation } from "./types";
import { HR_Q } from "./families/hr";
import { FINANCE_Q } from "./families/finance";
import { IT_Q } from "./families/it";
import { CUSTOMER_SERVICE_Q } from "./families/customerService";
import { ADMINISTRATION_Q } from "./families/administration";
import { OPERATIONS_Q } from "./families/operations";
import { ENGINEERING_Q } from "./families/engineering";
import { SALES_Q } from "./families/sales";
import { MARKETING_Q } from "./families/marketing";
import { LEGAL_Q } from "./families/legal";
import { PROJECT_MANAGEMENT_Q } from "./families/projectManagement";
import { MANAGEMENT_Q } from "./families/management";
import { DATA_Q } from "./families/data";
import { PRODUCT_Q } from "./families/product";
import { RETAIL_Q } from "./families/retail";
import { MANUFACTURING_Q } from "./families/manufacturing";
import { EDUCATION_Q } from "./families/education";
import { AR_QUESTIONS } from "./ar";

export type { KnowledgeQuestion, QuestionTranslation } from "./types";

// Version of the bank's content. Bump when a question or an answer changes, so a stored check can say which version it used.
export const KNOWLEDGE_BANK_VERSION = "knowledge-1";

export const KNOWLEDGE_BANK: KnowledgeQuestion[] = [
  ...HR_Q, ...FINANCE_Q, ...IT_Q, ...CUSTOMER_SERVICE_Q, ...ADMINISTRATION_Q, ...OPERATIONS_Q, ...ENGINEERING_Q, ...SALES_Q, ...MARKETING_Q,
  ...LEGAL_Q, ...PROJECT_MANAGEMENT_Q, ...MANAGEMENT_Q, ...DATA_Q, ...PRODUCT_Q, ...RETAIL_Q, ...MANUFACTURING_Q, ...EDUCATION_Q,
];

const BY_ID = new Map(KNOWLEDGE_BANK.map((k) => [questionId(k.competencyKey, k.level), k]));

export const getQuestion = (id: string): KnowledgeQuestion | null => BY_ID.get(id) ?? null;

// The wording of a question in a language, or null when it has none in that language.
export function questionText(id: string, language: "en" | "ar"): QuestionTranslation | null {
  const k = BY_ID.get(id);
  if (!k) return null;
  if (language === "en") return { stem: k.stem, options: k.options, why: k.why };
  return AR_QUESTIONS[id] ?? null;
}

export const isAvailable = (id: string, language: "en" | "ar") => questionText(id, language) !== null;

export function knowledgeStats() {
  return {
    questions: KNOWLEDGE_BANK.length,
    competencies: new Set(KNOWLEDGE_BANK.map((k) => k.competencyKey)).size,
    totalCompetencies: JOB_BANK.reduce((n, f) => n + f.competencies.length, 0),
    arabic: Object.keys(AR_QUESTIONS).length,
  };
}
