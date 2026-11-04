import { comp, family, role } from "../build";

// Law differs by country. The wording is deliberately general: a company adapts it to its own jurisdiction.
export const LEGAL = family(
  "legal",
  "Legal, Risk and Compliance",
  "Contracts, regulation, risk, ethics and data protection.",
  [
    comp("leg.contracts", "Contract Drafting and Review", "technical", "Writing and reviewing agreements so that rights and risks are clear and fair.", [
      "Prepares standard contracts from approved templates.",
      "Fills in and checks standard contracts and flags unusual terms, with review.",
      "Drafts and reviews common contracts alone, negotiates standard terms and tracks obligations.",
      "Drafts and negotiates complex or high-value agreements and advises on risk allocation.",
      "Sets the contracting approach, advises on strategic transactions and handles the most complex agreements.",
    ]),
    comp("leg.regulatory", "Regulatory and Compliance Knowledge", "functional", "Knowing the laws and regulations that apply and making sure the organisation follows them.", [
      "Knows that rules apply and where to find them.",
      "Applies the main rules to routine matters, with guidance.",
      "Applies the relevant rules correctly, monitors compliance and reports breaches.",
      "Interprets rules for new situations, advises managers and leads compliance reviews.",
      "Owns the compliance programme, tracks regulatory change and engages regulators.",
    ]),
    comp("leg.risk", "Risk Identification and Assessment", "functional", "Finding, rating and reducing the risks the organisation faces.", [
      "Records risks reported by others.",
      "Describes and rates simple risks using the standard method, with guidance.",
      "Identifies and assesses risks, proposes controls and keeps the risk register current.",
      "Leads risk assessments for major decisions, models impact and tracks mitigation.",
      "Sets the risk framework and appetite and reports the overall risk position to leadership.",
    ]),
    comp("leg.research", "Legal Research and Analysis", "technical", "Finding the law and reasoning from it to a clear, supported answer.", [
      "Finds a given law or case using the research tools.",
      "Researches a defined question and summarises findings, with review.",
      "Researches and analyses questions alone and gives a clear, reasoned answer.",
      "Handles complex or conflicting authorities and produces advice that others rely on.",
      "Resolves novel questions and shapes the organisation's legal position.",
    ]),
    comp("leg.policy", "Policy and Procedure Development", "functional", "Writing policies and procedures people can follow and managers can enforce.", [
      "Keeps policy documents organised and up to date.",
      "Updates policies from instructions and checks consistency, with review.",
      "Drafts clear policies and procedures, consults those affected and communicates them.",
      "Leads policy programmes, aligns policies with law and strategy and checks they are followed.",
      "Sets the policy framework and governance for the organisation.",
    ]),
    comp("leg.data_protection", "Data Protection and Privacy", "technical", "Protecting personal data and meeting privacy law and good practice.", [
      "Follows the data-handling rules.",
      "Applies privacy rules to routine requests and records, with guidance.",
      "Handles data requests, privacy notices and incidents correctly and advises on common cases.",
      "Leads privacy assessments and incident response and advises on new systems and transfers.",
      "Owns the privacy programme, advises leadership and engages regulators.",
    ]),
    comp("leg.ethics_investigations", "Ethics and Investigations", "functional", "Handling concerns about misconduct fairly, confidentially and thoroughly.", [
      "Records and escalates reported concerns.",
      "Gathers facts for a defined concern, with guidance.",
      "Investigates routine concerns fairly and confidentially and writes a clear report.",
      "Leads serious investigations, protects those who raise concerns and recommends action.",
      "Sets the ethics and investigation framework and handles the most serious or sensitive cases.",
    ]),
  ],
  [
    role("leg.assistant", "Legal Assistant", "Entry", 2, "ic",
      "Supports the legal team with documents, records, research tasks and deadlines.",
      { "leg.contracts": 2, "leg.research": 2, "leg.policy": 1, "leg.data_protection": 1 }, { Communication: 3, "Critical Thinking": 2 }),
    role("leg.compliance_officer", "Compliance Officer", "Mid", 4, "ic",
      "Monitors compliance with laws and policies, trains staff and reports breaches and risks.",
      { "leg.regulatory": 4, "leg.risk": 3, "leg.policy": 3, "leg.data_protection": 3, "leg.ethics_investigations": 3 }, { Communication: 4, "Critical Thinking": 4 }),
    role("leg.risk_analyst", "Risk Analyst", "Mid", 4, "ic",
      "Identifies and assesses risks, tracks controls and reports on the risk position.",
      { "leg.risk": 4, "leg.regulatory": 3, "leg.policy": 2 }, { Communication: 3, "Critical Thinking": 5, "Financial Literacy": 3 }),
    role("leg.counsel", "Legal Counsel", "Senior", 6, "ic",
      "Advises the organisation on legal matters, drafts and negotiates contracts and manages disputes.",
      { "leg.contracts": 5, "leg.research": 4, "leg.regulatory": 4, "leg.risk": 3, "leg.data_protection": 3 }, { Communication: 4, "Critical Thinking": 5, "Strategic Thinking": 3 }),
    role("leg.head", "Head of Legal and Compliance", "Head", 8, "management",
      "Leads legal, risk and compliance and advises leadership on legal exposure and governance.",
      { "leg.regulatory": 5, "leg.risk": 5, "leg.contracts": 4, "leg.policy": 4, "leg.data_protection": 4, "leg.ethics_investigations": 4 },
      { Leadership: 4, "People Management": 4, "Strategic Thinking": 4, Communication: 5, "Critical Thinking": 5 }),
  ]
);
