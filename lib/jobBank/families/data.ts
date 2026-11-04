import { comp, family, role } from "../build";

export const DATA = family(
  "data",
  "Data and Analytics",
  "Collecting, preparing, analysing and presenting data, and building the systems and models that use it.",
  [
    comp("data.preparation", "Data Preparation and Quality", "technical", "Getting data into a clean, trustworthy form that can be analysed.", [
      "Follows a procedure to load and tidy simple data sets.",
      "Cleans and combines common data sources and flags obvious errors, with guidance.",
      "Prepares complex data reliably, checks quality and documents what was done.",
      "Designs repeatable preparation, sets quality rules and finds the cause of data problems.",
      "Sets data-quality standards across the organisation and builds the practices that keep data trustworthy.",
    ]),
    comp("data.statistics", "Statistics and Modelling", "technical", "Using statistical methods to find patterns, test ideas and predict outcomes.", [
      "Calculates simple averages and percentages.",
      "Applies standard statistical methods to clear questions, with guidance.",
      "Chooses suitable methods, builds and checks models and explains uncertainty.",
      "Builds advanced models, tests assumptions rigorously and guides others on method.",
      "Sets analytical standards, solves novel modelling problems and is the authority on method.",
    ]),
    comp("data.visualisation", "Data Visualisation and Storytelling", "functional", "Showing findings in a way people understand and act on.", [
      "Produces simple charts from a template.",
      "Builds clear charts and tables and writes short summaries, with review.",
      "Builds dashboards and reports that answer the question and explains the message to managers.",
      "Designs insight stories for senior audiences and coaches others in clear presentation.",
      "Shapes how the organisation uses data to decide and communicates complex findings persuasively.",
    ]),
    comp("data.engineering", "Data Engineering and Pipelines", "technical", "Building the systems that collect, move and store data reliably.", [
      "Runs existing data jobs and reports failures.",
      "Maintains simple data pipelines and queries, with guidance.",
      "Builds and maintains reliable pipelines and data stores and fixes failures.",
      "Designs scalable data architecture, tunes performance and automates monitoring.",
      "Sets the data platform strategy and architecture and guides technology and cost choices.",
    ]),
    comp("data.machine_learning", "Machine Learning and AI Applications", "technical", "Using machine learning and AI to solve real problems responsibly.", [
      "Knows what machine learning is and where it is used.",
      "Trains and evaluates simple models with guidance.",
      "Builds, evaluates and deploys models for defined problems and monitors them.",
      "Designs end-to-end machine-learning solutions, handles bias and drift and mentors others.",
      "Sets the AI approach, assesses risk and ethics and leads the most complex or novel solutions.",
    ]),
    comp("data.governance", "Data Governance, Privacy and Ethics", "functional", "Using data lawfully, securely and fairly.", [
      "Follows the rules for handling data.",
      "Applies access and privacy rules to routine work, with guidance.",
      "Handles data lawfully and securely, documents sources and flags risks.",
      "Designs governance controls, assesses privacy and fairness and trains others.",
      "Owns the data governance framework and ethical standards and advises leadership.",
    ]),
  ],
  [
    role("data.analyst", "Data Analyst", "Mid", 3, "ic",
      "Prepares data, builds reports and dashboards and explains what the data shows.",
      { "data.preparation": 3, "data.visualisation": 4, "data.statistics": 3, "data.governance": 2 }, { Communication: 4, "Critical Thinking": 4, "AI & Digital Skills": 4 }),
    role("data.bi_developer", "Business Intelligence Developer", "Mid", 4, "ic",
      "Builds and maintains the dashboards, reports and data models the business uses every day.",
      { "data.visualisation": 4, "data.preparation": 4, "data.engineering": 3, "data.governance": 2 }, { Communication: 3, "Critical Thinking": 4, "AI & Digital Skills": 4 }),
    role("data.engineer", "Data Engineer", "Senior", 5, "ic",
      "Builds and runs the pipelines and stores that deliver reliable data to analysts and models.",
      { "data.engineering": 4, "data.preparation": 4, "data.governance": 3, "data.statistics": 2 }, { Communication: 3, "Critical Thinking": 4, "AI & Digital Skills": 5 }),
    role("data.scientist", "Data Scientist", "Senior", 6, "ic",
      "Builds statistical and machine-learning models that answer business questions and predict outcomes.",
      { "data.statistics": 5, "data.machine_learning": 4, "data.preparation": 4, "data.visualisation": 3, "data.governance": 3 }, { Communication: 4, "Critical Thinking": 5, "AI & Digital Skills": 5 }),
    role("data.manager", "Head of Data and Analytics", "Head", 8, "management",
      "Leads the data function, platform and ethics and turns data into decisions across the organisation.",
      { "data.governance": 5, "data.visualisation": 4, "data.statistics": 4, "data.engineering": 4, "data.machine_learning": 3, "data.preparation": 4 },
      { Leadership: 4, "People Management": 4, "Strategic Thinking": 4, Communication: 5, "Critical Thinking": 5, "AI & Digital Skills": 5 }),
  ]
);
