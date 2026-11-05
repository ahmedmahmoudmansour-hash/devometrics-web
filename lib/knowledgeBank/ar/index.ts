import type { QuestionTranslation } from "../types";
import { HR_AR_Q } from "./q_hr";
import { FINANCE_AR_Q } from "./q_finance";
import { IT_AR_Q } from "./q_it";
import { CUSTOMER_SERVICE_AR_Q } from "./q_customerService";
import { ADMINISTRATION_AR_Q } from "./q_administration";
import { OPERATIONS_AR_Q } from "./q_operations";
import { ENGINEERING_AR_Q } from "./q_engineering";
import { SALES_AR_Q } from "./q_sales";
import { MARKETING_AR_Q } from "./q_marketing";
import { LEGAL_AR_Q } from "./q_legal";
import { PROJECT_MANAGEMENT_AR_Q } from "./q_projectManagement";
import { MANAGEMENT_AR_Q } from "./q_management";
import { DATA_AR_Q } from "./q_data";
import { PRODUCT_AR_Q } from "./q_product";
import { RETAIL_AR_Q } from "./q_retail";
import { MANUFACTURING_AR_Q } from "./q_manufacturing";
import { EDUCATION_AR_Q } from "./q_education";

// Arabic wording, keyed by question id ("competency key#level"). The correct option keeps its position, so the answer key is
// shared with English. A question without Arabic is simply not offered in Arabic.
export const AR_QUESTIONS: Record<string, QuestionTranslation> = {
  ...HR_AR_Q,
  ...FINANCE_AR_Q,
  ...IT_AR_Q,
  ...CUSTOMER_SERVICE_AR_Q,
  ...ADMINISTRATION_AR_Q,
  ...OPERATIONS_AR_Q,
  ...ENGINEERING_AR_Q,
  ...SALES_AR_Q,
  ...MARKETING_AR_Q,
  ...LEGAL_AR_Q,
  ...PROJECT_MANAGEMENT_AR_Q,
  ...MANAGEMENT_AR_Q,
  ...DATA_AR_Q,
  ...PRODUCT_AR_Q,
  ...RETAIL_AR_Q,
  ...MANUFACTURING_AR_Q,
  ...EDUCATION_AR_Q,
};
