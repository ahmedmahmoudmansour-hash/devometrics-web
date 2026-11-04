import { comp, family, role } from "../build";

export const HR = family(
  "hr",
  "Human Resources",
  "People administration, hiring, employee relations, learning, reward and compliance.",
  [
    comp("hr.recruitment", "Recruitment and Selection", "functional", "Finding, assessing and choosing people for open roles, fairly and on evidence.", [
      "Knows the steps of a hiring process and helps schedule interviews with guidance.",
      "Screens CVs against a job description and asks prepared interview questions with support.",
      "Runs a full hiring process alone: sources, screens, interviews with a scorecard and records the reasons for the decision.",
      "Improves sourcing and selection quality, trains hiring managers in structured interviewing and fills hard-to-fill roles.",
      "Designs the organisation's selection system, sets standards for fairness and validity and tracks the quality of hires.",
    ]),
    comp("hr.employee_relations", "Employee Relations and Case Handling", "functional", "Handling employee queries, grievances, discipline and disputes fairly and on the record.", [
      "Knows who handles employee questions and records them accurately.",
      "Answers routine employee queries and follows the grievance procedure with guidance.",
      "Handles grievances, warnings and disputes alone, fairly and with correct documentation.",
      "Leads complex or sensitive cases, advises managers and reduces repeat disputes through early action.",
      "Shapes the employee-relations approach, handles high-risk cases and advises leaders on precedent and risk.",
    ]),
    comp("hr.learning", "Learning and Development Practice", "functional", "Finding learning needs, running programmes and showing that they worked.", [
      "Knows common types of training and supports the logistics of sessions.",
      "Runs sessions from a prepared plan and collects participant feedback.",
      "Identifies learning needs, designs and delivers programmes and checks whether they worked.",
      "Designs programmes across teams, builds internal trainers and links learning to business results.",
      "Sets the learning strategy, builds capability frameworks and proves the effect of learning on performance.",
    ]),
    comp("hr.reward_payroll", "Compensation, Benefits and Payroll Basics", "technical", "Administering pay, benefits and payroll accurately, and keeping reward fair.", [
      "Knows the main pay and benefit terms and the payroll calendar.",
      "Prepares routine payroll inputs and answers basic pay questions, with checks from a colleague.",
      "Administers pay and benefits accurately, reconciles payroll and applies policy consistently.",
      "Compares pay with the market, designs pay bands and resolves complex pay cases.",
      "Sets the reward strategy, balances cost and fairness and advises leaders on pay decisions.",
    ]),
    comp("hr.compliance", "Labour Law and HR Policy Compliance", "technical", "Applying employment law and company policy correctly and keeping records ready for inspection.", [
      "Knows that employment rules exist and where the policies are kept.",
      "Applies the main policies and labour-law basics to routine cases, with guidance.",
      "Applies labour law and policy correctly, keeps records audit-ready and knows when to escalate.",
      "Interprets the law in complex situations, updates policies and prepares the company for audits and inspections.",
      "Owns the compliance framework, anticipates legal change and manages legal and regulatory risk.",
    ]),
    comp("hr.analytics", "HR Data and Analytics", "technical", "Keeping people data accurate and turning it into findings that help decisions.", [
      "Enters HR data accurately in the system.",
      "Produces standard reports such as headcount and turnover.",
      "Analyses HR data, spots trends and presents clear findings to managers.",
      "Builds dashboards and simple models, links people data to business results and explains the limits of the data.",
      "Sets the people-analytics approach, safeguards data quality and ethical use and guides decisions with evidence.",
    ]),
  ],
  [
    role("hr.coordinator", "HR Coordinator", "Entry", 2, "ic",
      "Supports day-to-day HR administration: employee records, onboarding paperwork, interview scheduling and routine employee questions.",
      { "hr.recruitment": 1, "hr.employee_relations": 1, "hr.reward_payroll": 2, "hr.compliance": 1, "hr.analytics": 2 }, { Communication: 2, "Critical Thinking": 1 }),
    role("hr.generalist", "HR Generalist", "Mid", 3, "ic",
      "Provides the full range of HR support to a business area: employee relations, policy advice, recruitment support, pay administration and records.",
      { "hr.recruitment": 2, "hr.employee_relations": 3, "hr.learning": 2, "hr.reward_payroll": 2, "hr.compliance": 3, "hr.analytics": 2 }, { Communication: 3, "Critical Thinking": 2 }),
    role("hr.talent_acquisition", "Talent Acquisition Specialist", "Mid", 4, "ic",
      "Owns hiring for assigned roles: sourcing, screening, interviewing, offers and the candidate experience.",
      { "hr.recruitment": 4, "hr.compliance": 2, "hr.analytics": 3 }, { Communication: 3, "Critical Thinking": 3 }),
    role("hr.learning_specialist", "Learning and Development Specialist", "Mid", 4, "ic",
      "Finds learning needs, designs and delivers programmes, and measures their effect.",
      { "hr.learning": 4, "hr.analytics": 3, "hr.recruitment": 1 }, { Communication: 3, "Critical Thinking": 3 }),
    role("hr.manager", "HR Manager", "Manager", 6, "management",
      "Leads the HR team and service: employee relations, hiring, learning, reward and compliance for the organisation.",
      { "hr.recruitment": 3, "hr.employee_relations": 4, "hr.learning": 3, "hr.reward_payroll": 3, "hr.compliance": 4, "hr.analytics": 3 },
      { Leadership: 3, "People Management": 4, Communication: 4, "Strategic Thinking": 3, "Critical Thinking": 3 }),
  ]
);
