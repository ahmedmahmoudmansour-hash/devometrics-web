import type { BankFamily } from "./types";
import { HR } from "./families/hr";
import { FINANCE } from "./families/finance";
import { IT } from "./families/it";
import { CUSTOMER_SERVICE } from "./families/customerService";
import { ADMINISTRATION } from "./families/administration";
import { OPERATIONS } from "./families/operations";
import { ENGINEERING } from "./families/engineering";
import { SALES } from "./families/sales";
import { MARKETING } from "./families/marketing";
import { LEGAL } from "./families/legal";
import { PROJECT_MANAGEMENT } from "./families/projectManagement";
import { MANAGEMENT } from "./families/management";
import { DATA } from "./families/data";
import { PRODUCT } from "./families/product";
import { RETAIL } from "./families/retail";
import { EXTRA_ROLES } from "./extraRoles";

export type { BankFamily, BankRole, BankCompetency, Level } from "./types";

// Version of the bank's content. Bump when wording changes, so a company can tell which version it imported.
export const JOB_BANK_VERSION = "starter-2";

const BASE: BankFamily[] = [HR, FINANCE, IT, CUSTOMER_SERVICE, ADMINISTRATION, OPERATIONS, ENGINEERING, SALES, MARKETING, LEGAL, PROJECT_MANAGEMENT, MANAGEMENT, DATA, PRODUCT, RETAIL];

// Each family plus the extra roles written for it.
export const JOB_BANK: BankFamily[] = BASE.map((f) => ({ ...f, roles: [...f.roles, ...(EXTRA_ROLES[f.key] ?? [])] }));

export function jobBankStats(bank: BankFamily[] = JOB_BANK) {
  return {
    families: bank.length,
    roles: bank.reduce((n, f) => n + f.roles.length, 0),
    competencies: bank.reduce((n, f) => n + f.competencies.length, 0),
  };
}
