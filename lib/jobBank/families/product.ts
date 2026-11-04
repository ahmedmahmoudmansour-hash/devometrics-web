import { comp, family, role } from "../build";

export const PRODUCT = family(
  "product",
  "Product and Design",
  "Understanding users, deciding what to build and designing products and experiences people can use.",
  [
    comp("prod.discovery", "User Research and Product Discovery", "technical", "Finding out who the users are, what they need and which problems are worth solving.", [
      "Takes notes in user sessions and collects feedback.",
      "Runs simple interviews and surveys and summarises results, with guidance.",
      "Plans and runs research, finds patterns and turns them into clear needs.",
      "Combines research with data to shape product direction and coaches others in research.",
      "Sets the research and discovery approach and makes user insight central to decisions.",
    ]),
    comp("prod.prioritisation", "Roadmapping and Prioritisation", "functional", "Deciding what to do first and why, and showing the plan.", [
      "Keeps a list of requested features.",
      "Ranks items using a given method, with guidance.",
      "Builds and explains a roadmap, balances value, effort and risk and says no with reasons.",
      "Aligns roadmaps across teams and trade-offs with strategy and resources.",
      "Sets the product strategy and portfolio priorities and defends them to leadership.",
    ]),
    comp("prod.requirements", "Requirements and Backlog Management", "technical", "Describing what needs building clearly enough for a team to build it.", [
      "Writes simple requirements from a template.",
      "Writes clear stories and acceptance criteria, with review.",
      "Maintains a well-ordered backlog and writes precise requirements the team can build from.",
      "Handles complex, cross-team requirements and keeps scope controlled.",
      "Sets the standards for requirements and resolves the hardest scope and dependency problems.",
    ]),
    comp("prod.ux_design", "Interaction and UX Design", "technical", "Designing how a product works and feels so that tasks are easy.", [
      "Follows design patterns and guidelines.",
      "Designs simple screens and flows and applies patterns, with review.",
      "Designs complete flows, tests them with users and improves them.",
      "Designs complex products, builds design systems and mentors designers.",
      "Sets the design direction and standards and solves the hardest experience problems.",
    ]),
    comp("prod.visual_design", "Visual and Graphic Design", "technical", "Creating clear, attractive and consistent visual work.", [
      "Prepares simple visual assets from templates.",
      "Produces clean layouts and graphics that follow the brand, with review.",
      "Creates distinctive, consistent visual work for many uses without review.",
      "Leads visual design for large projects, extends the brand and coaches others.",
      "Defines the visual identity and quality bar and produces the organisation's signature work.",
    ]),
    comp("prod.usability_testing", "Usability Testing and Product Metrics", "technical", "Checking that the product works for people and measuring whether it succeeds.", [
      "Observes tests and records what happens.",
      "Runs simple usability tests and reports findings, with guidance.",
      "Plans and runs tests, defines success measures and reports results clearly.",
      "Designs experiments and metrics frameworks and links them to goals.",
      "Sets the measurement approach and uses evidence to steer the product strategy.",
    ]),
  ],
  [
    role("prod.ux_designer", "UX Designer", "Mid", 4, "ic",
      "Designs flows and interactions that make the product easy to use, and tests them with users.",
      { "prod.ux_design": 4, "prod.discovery": 3, "prod.usability_testing": 3, "prod.visual_design": 2 }, { Communication: 4, "Critical Thinking": 4, "AI & Digital Skills": 3 }),
    role("prod.ui_designer", "UI and Graphic Designer", "Mid", 3, "ic",
      "Creates the visual design of screens, materials and brand assets.",
      { "prod.visual_design": 4, "prod.ux_design": 3, "prod.usability_testing": 2 }, { Communication: 3, "Critical Thinking": 3, "AI & Digital Skills": 3 }),
    role("prod.ux_researcher", "UX Researcher", "Mid", 4, "ic",
      "Plans and runs research to understand users and turns it into insight for product decisions.",
      { "prod.discovery": 4, "prod.usability_testing": 4, "prod.prioritisation": 2 }, { Communication: 4, "Critical Thinking": 5 }),
    role("prod.product_owner", "Product Owner", "Senior", 5, "ic",
      "Owns the backlog of a team: sets priorities, writes requirements and makes sure the right things get built.",
      { "prod.requirements": 4, "prod.prioritisation": 4, "prod.discovery": 3, "prod.usability_testing": 3 }, { Communication: 4, "Critical Thinking": 4, "Strategic Thinking": 3 }),
    role("prod.product_manager", "Product Manager", "Senior", 6, "management",
      "Owns a product's strategy, roadmap and results, and leads the cross-functional team that builds it.",
      { "prod.prioritisation": 5, "prod.discovery": 4, "prod.requirements": 4, "prod.usability_testing": 4, "prod.ux_design": 3 },
      { Leadership: 3, "People Management": 3, "Strategic Thinking": 4, Communication: 5, "Critical Thinking": 4, "Financial Literacy": 3 }),
  ]
);
