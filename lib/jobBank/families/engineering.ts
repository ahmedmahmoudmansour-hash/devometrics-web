import { comp, family, role } from "../build";

// A general engineering family that fits mechanical, electrical, civil and similar disciplines. A company adapts the
// technical wording to its own discipline.
export const ENGINEERING = family(
  "engineering",
  "Engineering",
  "Designing, building, testing and maintaining physical and technical systems, in any engineering discipline.",
  [
    comp("eng.design", "Engineering Design and Drawing", "technical", "Turning requirements into designs and drawings that can be built and maintained.", [
      "Reads drawings and specifications and makes simple changes to existing designs.",
      "Produces parts of a design from a given brief, with review.",
      "Designs components and systems from requirements alone and prepares clear drawings.",
      "Designs complex systems, evaluates alternatives and reviews others' designs.",
      "Sets design standards and approves critical designs, solving novel technical problems.",
    ]),
    comp("eng.analysis", "Technical Analysis and Calculation", "technical", "Using engineering principles and calculation to size, check and justify decisions.", [
      "Performs simple calculations using given formulas.",
      "Performs standard calculations and checks results against expectations, with guidance.",
      "Selects the right method, performs and documents calculations and checks them independently.",
      "Analyses complex situations, uses advanced methods and tools and challenges assumptions.",
      "Develops methods, resolves disputed or novel analyses and is trusted as the technical authority.",
    ]),
    comp("eng.maintenance", "Maintenance and Reliability", "technical", "Keeping equipment safe and working through planned maintenance, diagnosis and improvement.", [
      "Follows maintenance checklists and reports faults.",
      "Carries out routine maintenance and simple repairs, with guidance.",
      "Plans and carries out maintenance, diagnoses common faults alone and keeps clear records.",
      "Diagnoses complex failures, finds root causes and improves maintenance plans and reliability.",
      "Sets the maintenance strategy, manages asset life and cost and builds reliability across the site.",
    ]),
    comp("eng.project_execution", "Project Execution and Site Supervision", "functional", "Delivering engineering work on site to time, cost, quality and safety.", [
      "Assists on site and follows instructions and safety rules.",
      "Supervises small tasks and records progress, with guidance.",
      "Supervises work packages, coordinates contractors and keeps work to plan and safe.",
      "Leads projects or major packages, manages risk and cost and resolves conflicts between trades.",
      "Directs large or critical projects and is accountable for delivery and results.",
    ]),
    comp("eng.standards_safety", "Codes, Standards and Safety", "functional", "Applying the relevant codes, standards and safe engineering practice.", [
      "Knows that codes and safety rules apply and where to find them.",
      "Applies the main standards to routine work, with guidance.",
      "Applies the correct codes and safe practice consistently and identifies hazards.",
      "Interprets standards for complex cases, leads risk and safety reviews and advises others.",
      "Sets the safety and compliance approach and represents the organisation to authorities and clients.",
    ]),
    comp("eng.testing_qa", "Testing and Quality Assurance", "technical", "Checking that work meets specification through testing, inspection and records.", [
      "Assists with tests and records readings.",
      "Carries out standard tests and inspections and reports results, with guidance.",
      "Plans and carries out tests, interprets results and raises non-conformances.",
      "Designs test plans, investigates failures and improves test methods.",
      "Owns the quality and test regime and approves release of critical work.",
    ]),
    comp("eng.documentation", "Technical Documentation and Reporting", "functional", "Recording and explaining technical work clearly for others.", [
      "Fills in standard forms and logs accurately.",
      "Writes simple technical notes and reports, with review.",
      "Writes clear technical reports and procedures that others can follow.",
      "Writes complex technical documents for clients and authorities and reviews others' work.",
      "Sets documentation standards and writes the definitive technical records.",
    ]),
  ],
  [
    role("eng.graduate", "Graduate Engineer", "Entry", 2, "ic",
      "Learns the work under supervision: assists with design, tests, site tasks and documentation.",
      { "eng.design": 2, "eng.analysis": 2, "eng.maintenance": 2, "eng.standards_safety": 2, "eng.documentation": 2 }, { Communication: 2, "Critical Thinking": 3, "AI & Digital Skills": 3 }),
    role("eng.design_engineer", "Design Engineer", "Mid", 4, "ic",
      "Designs components and systems, performs the supporting calculations and prepares drawings and specifications.",
      { "eng.design": 4, "eng.analysis": 4, "eng.standards_safety": 3, "eng.documentation": 3, "eng.testing_qa": 3, "eng.project_execution": 2 }, { Communication: 3, "Critical Thinking": 4, "AI & Digital Skills": 4 }),
    role("eng.maintenance_engineer", "Maintenance Engineer", "Mid", 4, "ic",
      "Plans and carries out maintenance, diagnoses faults and improves equipment reliability and safety.",
      { "eng.maintenance": 4, "eng.analysis": 3, "eng.standards_safety": 4, "eng.testing_qa": 3, "eng.documentation": 3, "eng.project_execution": 2 }, { Communication: 3, "Critical Thinking": 4 }),
    role("eng.project_engineer", "Project Engineer", "Mid", 4, "ic",
      "Delivers engineering packages on site: coordination, supervision, progress, quality and safety.",
      { "eng.project_execution": 4, "eng.standards_safety": 4, "eng.documentation": 3, "eng.testing_qa": 3, "eng.analysis": 3 }, { Communication: 4, "Critical Thinking": 3, "Financial Literacy": 2 }),
    role("eng.senior", "Senior Engineer", "Senior", 6, "ic",
      "Leads technical work and design, reviews others and solves the hardest technical problems.",
      { "eng.design": 5, "eng.analysis": 5, "eng.standards_safety": 4, "eng.testing_qa": 4, "eng.documentation": 4, "eng.maintenance": 3, "eng.project_execution": 3 },
      { Communication: 4, "Critical Thinking": 5, Leadership: 3, "AI & Digital Skills": 4 }),
    role("eng.manager", "Engineering Manager", "Manager", 8, "management",
      "Leads engineers and engineering work: planning, standards, budget, people and results.",
      { "eng.project_execution": 5, "eng.standards_safety": 5, "eng.design": 4, "eng.testing_qa": 4, "eng.maintenance": 4 },
      { Leadership: 4, "People Management": 4, "Strategic Thinking": 3, Communication: 4, "Critical Thinking": 4, "Financial Literacy": 3 }),
  ]
);
