import type { FamilyTranslation } from "./types";
import { HR_AR } from "./hr";
import { FINANCE_AR } from "./finance";
import { IT_AR } from "./it";
import { CUSTOMER_SERVICE_AR } from "./customerService";
import { ADMINISTRATION_AR } from "./administration";
import { OPERATIONS_AR } from "./operations";
import { ENGINEERING_AR } from "./engineering";
import { SALES_AR } from "./sales";
import { MARKETING_AR } from "./marketing";
import { LEGAL_AR } from "./legal";
import { PROJECT_MANAGEMENT_AR } from "./projectManagement";
import { MANAGEMENT_AR } from "./management";
import { DATA_AR } from "./data";
import { PRODUCT_AR } from "./product";
import { RETAIL_AR } from "./retail";
import { MANUFACTURING_AR } from "./manufacturing";
import { EDUCATION_AR } from "./education";

// Arabic wording, keyed by the family key used in the English bank.
export const AR_BANK: Record<string, FamilyTranslation> = {
  hr: HR_AR,
  finance: FINANCE_AR,
  it: IT_AR,
  customer_service: CUSTOMER_SERVICE_AR,
  administration: ADMINISTRATION_AR,
  operations: OPERATIONS_AR,
  engineering: ENGINEERING_AR,
  sales: SALES_AR,
  marketing: MARKETING_AR,
  legal: LEGAL_AR,
  project_management: PROJECT_MANAGEMENT_AR,
  management: MANAGEMENT_AR,
  data: DATA_AR,
  product: PRODUCT_AR,
  retail: RETAIL_AR,
  manufacturing: MANUFACTURING_AR,
  education: EDUCATION_AR,
};

// The ladder-step labels shown beside a role.
export const LEVEL_LABEL_AR: Record<string, string> = {
  Entry: "مبتدئ",
  Mid: "متوسط",
  Senior: "أول",
  Lead: "قائد",
  Manager: "مدير",
  Head: "رئيس",
};
