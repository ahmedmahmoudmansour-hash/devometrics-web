import { comp, family, role } from "../build";

// General management roles, mostly built on the standard behavioural competencies plus a few management practices.
export const MANAGEMENT = family(
  "management",
  "Management and Leadership",
  "Leading teams, departments and the organisation: planning, people, performance, change and results.",
  [
    comp("mgmt.planning_budget", "Business Planning and Budget Ownership", "functional", "Setting goals, planning the work and owning a budget and its results.", [
      "Understands the team's goals and plan.",
      "Helps prepare plans and tracks simple budgets, with guidance.",
      "Plans the team's work, owns a budget and explains variances.",
      "Plans for a department or function, manages larger budgets and links plans to strategy.",
      "Sets the plan and budget for the organisation or a major division and answers for results.",
    ]),
    comp("mgmt.performance", "Performance and Talent Management", "functional", "Setting expectations, giving feedback and developing the people in your team.", [
      "Passes on instructions and reports team progress.",
      "Gives simple feedback and supports reviews, with guidance.",
      "Sets clear goals, reviews performance fairly and develops team members.",
      "Builds high-performing teams, handles underperformance well and develops future managers.",
      "Builds the organisation's talent pipeline and a culture of accountability and development.",
    ]),
    comp("mgmt.change", "Change Management", "functional", "Helping people through change so that it sticks.", [
      "Follows and communicates a planned change.",
      "Supports a change in the team and gathers reactions, with guidance.",
      "Leads a change in the team, explains the reasons and deals with resistance.",
      "Leads change across a function, builds support and measures adoption.",
      "Leads organisation-wide transformation and builds the capacity to change.",
    ]),
    comp("mgmt.decision_making", "Cross-Functional Decision Making", "behavioural", "Making sound decisions that work across teams and balance competing priorities.", [
      "Makes routine decisions within clear rules.",
      "Makes decisions in the team and asks for advice on others.",
      "Makes timely, reasoned decisions and involves the right people.",
      "Balances conflicting priorities across functions and explains the trade-offs.",
      "Makes high-stakes decisions under uncertainty and sets the decision-making culture.",
    ]),
  ],
  [
    role("mgmt.team_leader", "Team Leader", "Lead", 4, "management",
      "Leads a small team day to day: allocates work, supports people and keeps results on track.",
      { "mgmt.planning_budget": 2, "mgmt.performance": 3, "mgmt.decision_making": 3 }, { Leadership: 3, "People Management": 3, Communication: 3, "Critical Thinking": 3 }),
    role("mgmt.department_manager", "Department Manager", "Manager", 6, "management",
      "Leads a department: plan, budget, people, performance and change.",
      { "mgmt.planning_budget": 4, "mgmt.performance": 4, "mgmt.change": 3, "mgmt.decision_making": 4 }, { Leadership: 4, "People Management": 4, "Strategic Thinking": 3, Communication: 4, "Critical Thinking": 4, "Financial Literacy": 3 }),
    role("mgmt.senior_manager", "Senior Manager", "Senior", 7, "management",
      "Leads several teams or a large function and contributes to the organisation's plans.",
      { "mgmt.planning_budget": 4, "mgmt.performance": 4, "mgmt.change": 4, "mgmt.decision_making": 4 }, { Leadership: 4, "People Management": 4, "Strategic Thinking": 4, Communication: 4, "Critical Thinking": 4, "Financial Literacy": 4 }),
    role("mgmt.director", "Director", "Head", 8, "management",
      "Directs a major function: strategy, results, leaders and its role in the organisation.",
      { "mgmt.planning_budget": 5, "mgmt.performance": 5, "mgmt.change": 4, "mgmt.decision_making": 5 }, { Leadership: 5, "People Management": 4, "Strategic Thinking": 5, Communication: 5, "Critical Thinking": 5, "Financial Literacy": 4 }),
    role("mgmt.general_manager", "General Manager", "Head", 9, "management",
      "Runs a business unit or the whole organisation and is accountable for its overall results.",
      { "mgmt.planning_budget": 5, "mgmt.performance": 5, "mgmt.change": 5, "mgmt.decision_making": 5 }, { Leadership: 5, "People Management": 5, "Strategic Thinking": 5, Communication: 5, "Critical Thinking": 5, "Financial Literacy": 5 }),
  ]
);
