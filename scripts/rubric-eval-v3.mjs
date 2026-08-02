// v3 — 10 distinct inputs per task type (not the same prompt repeated),
// testing generalization instead of one lucky/unlucky roll. Reports:
// avg quality, stdev, failure rate, avg latency, p95 latency, avg cost,
// and reliability (success rate) as its own metric — with a final
// reliability-adjusted score (avgQuality * successRate), not just an
// average that hides flakiness.
//
// Run from devometrics-web/:
//   node --env-file=.env.local scripts/rubric-eval-v3.mjs

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Weights for the 6 per-response judged/checked dimensions, renormalized to
// 100 (latency/cost/reliability are reported as their own separate stats
// per the reviewer's request, not folded into this composite).
const RAW_WEIGHTS = { correctness: 25, rubricCompliance: 20, completeness: 15, calibration: 15, hallucinationResistance: 10, jsonValidity: 5 };
const WEIGHT_SUM = Object.values(RAW_WEIGHTS).reduce((a, b) => a + b, 0); // 90

const PRICING = {
  "claude-fable-5": { input: 10.0, output: 50.0 },
  "claude-sonnet-5": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
  "google/gemini-3.6-flash": { input: 1.5, output: 7.5 },
  "google/gemini-3.5-flash-lite": { input: 0.3, output: 2.5 },
  "deepseek/deepseek-v4-pro": { input: 0.435, output: 0.87 },
  "openai/gpt-5-mini": { input: 0.25, output: 2.0 },
  "openai/gpt-5.4-mini": { input: 0.75, output: 4.5 },
  "meta-llama/llama-3.3-70b-instruct": { input: 0.13, output: 0.4 },
};
function priceOf(key, inTok, outTok) {
  const p = PRICING[key];
  return (inTok / 1_000_000) * p.input + (outTok / 1_000_000) * p.output;
}

const CANDIDATE_MODELS = [
  "claude-sonnet-5",
  "claude-haiku-4-5",
  "google/gemini-3.6-flash",
  "google/gemini-3.5-flash-lite",
  "deepseek/deepseek-v4-pro",
  "openai/gpt-5-mini",
  "openai/gpt-5.4-mini",
  "meta-llama/llama-3.3-70b-instruct",
];

// ---------------- Task type definitions ----------------

const CV_SYSTEM = `You are a competency extraction engine. Score the candidate against the target role across exactly these 8 dimensions: Technical Skills, Leadership, Strategic Thinking, Communication, Critical Thinking, People Management, Financial Literacy, AI & Digital Skills.
Ground every score in specific evidence from the CV. Do not invent accomplishments. When the CV gives little or no signal for a dimension, say so plainly in the rationale and lower confidence accordingly rather than guessing a mid-range number to look complete.
Return ONLY a JSON array of exactly 8 objects: {"dimension": string, "currentLevel": 0-100, "targetLevel": 0-100, "confidence": 0-100, "rationale": "1-2 sentences citing specific CV evidence or its absence"}
No prose before or after the JSON array.`;

const CV_VARIANTS = [
  { role: "Regional Sales Manager", jd: "Lead a team of 6 account executives, build and defend the quarterly forecast, negotiate enterprise contracts with C-level buyers, decide which accounts to invest in vs exit under a fixed budget.", cv: "Layla Haddad\nRegional Sales Director, MedTech Solutions (2022-present)\n- Manages 8 AEs across 4 countries; builds the quarterly forecast presented to CFO/CEO.\n- Grew regional revenue $8M to $14M; owns a $1.2M OpEx budget.\n- Exited two sub-$50K SMB accounts to fund a $2M enterprise deal that closed.\n- Negotiates directly with C-level buyers at 6 enterprise accounts.\nEducation: MBA, INSEAD." },
  { role: "Regional Sales Manager", jd: "Lead a team of 6 account executives, build and defend the quarterly forecast, negotiate enterprise contracts with C-level buyers, decide which accounts to invest in vs exit under a fixed budget.", cv: "Youssef Nabil\nMarketing Coordinator, BrightWave Media (2023-present)\n- Manages social media content calendar, coordinates with design team.\n- No sales quota, no client-facing revenue responsibility.\nMarketing Intern, BrightWave Media (2022-2023)\n- Data entry and scheduling support.\nEducation: BA Communications, Cairo University.\nNo sales, management, budget, or negotiation experience of any kind." },
  { role: "Regional Sales Manager", jd: "Lead a team of 6 account executives, build and defend the quarterly forecast, negotiate enterprise contracts with C-level buyers, decide which accounts to invest in vs exit under a fixed budget.", cv: "Ahmed Al-Farsi\nSenior Account Executive, Acme Software (2021-present)\n- Carried $2.1M quota, closed 108% FY2025. Mentored two junior AEs.\n- Negotiated a 3-year renewal at smaller discount via multi-year term instead.\nAccount Executive, Acme Software (2019-2021)\n- Top 3 of 12 AEs. Built a competitor-battlecard doc.\nEducation: BA Business Administration, AUB.\nNo formal management experience; never owned a budget or built a forecast." },
  { role: "Engineering Manager", jd: "Lead a team of 8 backend engineers, own the service's on-call rotation and reliability targets, run performance reviews, and make build-vs-buy tradeoffs for infrastructure spend.", cv: "Priya Nair\nStaff Engineer, Northwind Cloud (2021-present)\n- Tech lead for a 6-engineer team; ran the on-call rotation and cut P1 incidents 40%.\n- Owns the infra budget forecast ($400K/yr); led a build-vs-buy decision that saved $120K/yr.\n- Conducted performance calibration for 6 engineers as a delegated tech lead, though not the formal manager of record.\nSenior Engineer, Northwind Cloud (2018-2021)\n- Shipped the company's core billing pipeline rewrite.\nEducation: BS Computer Science, Cairo University." },
  { role: "Engineering Manager", jd: "Lead a team of 8 backend engineers, own the service's on-call rotation and reliability targets, run performance reviews, and make build-vs-buy tradeoffs for infrastructure spend.", cv: "Karim Osman\nSoftware Engineer II, PixelForge Games (2022-present)\n- Writes gameplay backend code; fixes bugs assigned via sprint board.\n- Has never been on an on-call rotation or managed a budget.\nJunior Developer, PixelForge Games (2020-2022)\n- Bug fixes and QA support.\nEducation: BS Computer Science, Alexandria University.\nNo people-management, budget, or reliability-ownership experience stated." },
  { role: "Product Manager", jd: "Own the roadmap for a B2B SaaS product line, run quarterly planning with engineering and design leads, define success metrics, and make prioritization tradeoffs against a fixed engineering capacity.", cv: "Nadia Farouk\nSenior PM, Vantage Analytics (2020-present)\n- Owns roadmap for a $6M ARR product line; runs quarterly planning with 2 eng leads and 1 design lead.\n- Defined the product's north-star metric (weekly active workspaces) and tied it to 3 OKRs.\n- Made a hard prioritization call to cut a requested enterprise feature in favor of onboarding fixes — churn dropped 8% next quarter.\nAssociate PM, Vantage Analytics (2018-2020)\n- Ran user research and wrote specs.\nEducation: MBA, London Business School." },
  { role: "Financial Controller", jd: "Own monthly close and financial reporting for a 200-person company, manage a team of 3 accountants, present variance analysis to the CFO, and maintain internal controls under a fixed audit budget.", cv: "Hana Kim\nSenior Accountant, Delta Freight (2021-present)\n- Prepares journal entries and assists with monthly close under the Controller's direction.\n- Has not managed staff or presented directly to executive leadership.\nStaff Accountant, Delta Freight (2019-2021)\n- AP/AR processing.\nEducation: BS Accounting, Seoul National University. CPA in progress.\nNo team-management or executive-presentation experience stated." },
  { role: "Customer Success Manager", jd: "Own renewal and expansion targets for a book of 40 mid-market accounts, run quarterly business reviews with client stakeholders, and flag at-risk accounts to the VP of CS with a remediation plan.", cv: "Omar Aziz\nCustomer Success Manager, CloudSuite (2022-present)\n- Owns a 35-account book; hit 112% of expansion target in FY2025.\n- Runs QBRs with client VPs; built a churn-risk scoring model now used team-wide.\n- Flagged 3 at-risk accounts last quarter with remediation plans; saved 2 of them.\nCS Associate, CloudSuite (2020-2022)\n- Supported onboarding for new accounts.\nEducation: BA Business, University of Jordan." },
  { role: "HR Business Partner", jd: "Partner with department heads on org design and workforce planning for a 300-person division, lead a small team of HR generalists, and manage a headcount budget under CFO oversight.", cv: "Layla Zayed\nHR Generalist, Beacon Retail (2022-present)\n- Handles employee relations cases and onboarding logistics for a 50-person store cluster.\n- Has not led org-design work, managed staff, or owned a headcount budget.\nHR Coordinator, Beacon Retail (2020-2022)\n- Scheduling and payroll support.\nEducation: BA Psychology, Qatar University.\nNo strategic HR, people-management, or budget experience stated." },
  { role: "VP of Marketing", jd: "Own brand and demand-generation strategy for a Series C startup, manage a $2M annual marketing budget, lead a team of 12 across content/growth/brand, and report pipeline impact directly to the CEO and board.", cv: "Rania Saleh\nDirector of Marketing, Fintech co. Nexa (2021-present)\n- Leads a team of 9 across content, growth, and brand; owns a $1.4M budget.\n- Reports pipeline-sourced revenue directly to the CEO monthly; presented to the board twice.\n- Rebuilt the demand-gen funnel, cutting CAC 22% while growing pipeline 35%.\nSenior Marketing Manager, Nexa (2018-2021)\n- Ran paid acquisition channels.\nEducation: MBA, INSEAD." },
];

const COACH_SYSTEM_BASE = (careerStage, gapContext, planContext, memoryContext) => `You are the Devometrics AI Career Coach — a focused career-development advisor. TONE: Direct, evidence-based, and specific. STRUCTURE: Open with one short sentence (under ~12 words) before going into detail.
PERSONALIZATION: Career stage: ${careerStage}.
GAP ANALYSIS (most recent): ${gapContext}
ONGOING DEVELOPMENT CONTEXT: ${planContext}
COACHING MEMORY: ${memoryContext}`;

const COACH_VARIANTS = [
  { careerStage: "Professional", gapContext: "Target role: Regional Sales Manager. Career Health Score: 52/100. People Management: 25→80 (high priority); Financial Literacy: 20→75 (high priority).", planContext: "Plan: \"Become RSM\" (2/5 milestones) - [x] Leadership assessment - [x] Shadow forecast review - [ ] Own a P&L slice - [ ] Cross-team account review - [ ] Present a resourcing tradeoff", memoryContext: "Goal: RSM within 18 months. Will: Ask manager about owning a P&L slice this week.", userMessage: "I talked to my manager about owning a P&L like we discussed, but she said that's usually only given to people already at the manager level — kind of a chicken-and-egg problem. What should I actually do here?" },
  { careerStage: "Manager", gapContext: "Target role: Senior Engineering Manager. Career Health Score: 71/100. Strategic Thinking: 55→80 (high priority).", planContext: "Plan: \"Step up to Senior EM\" (3/4 milestones) - [x] Own a cross-team initiative - [x] Mentor a new manager - [x] Present to VP Eng - [ ] Own a headcount planning cycle", memoryContext: "Goal: Senior EM within a year. Reality: Just got promoted to manager 3 months ago, team of 5.", userMessage: "I got promoted to manager 3 months ago and I still feel like I'm faking it every day in 1:1s. My skip-level said I'm doing fine but I don't believe her. How do I actually know if I'm doing okay?" },
  { careerStage: "Professional", gapContext: "Target role: Senior Product Designer. Career Health Score: 64/100. Communication: 50→75 (medium priority).", planContext: "Plan: \"Senior Designer track\" (1/4 milestones) - [x] Ship a cross-team project", memoryContext: "No coaching memory yet — this is effectively a first conversation.", userMessage: "A coworker presented an idea in a meeting that was basically my idea from a Slack thread last week, and everyone credited her. I didn't say anything in the moment. Should I bring it up now, and how?" },
  { careerStage: "Professional", gapContext: "Target role: Data Science Manager. Career Health Score: 58/100. People Management: 30→75 (high priority).", planContext: "Plan: \"Move into data leadership\" (0/3 milestones) - none started yet", memoryContext: "Goal: still exploring whether management or staff IC track is the right move.", userMessage: "My manager offered me a chance to lead a new analytics pod — 3 people, brand new team, no existing process. I've never managed anyone. Part of me wants it, part of me thinks I should say no and stay an IC a bit longer. How do I actually decide?" },
  { careerStage: "Early-career professional", gapContext: "Target role: Software Engineer II. Career Health Score: 45/100. Technical Skills: 55→75 (high priority).", planContext: "Plan: \"Get to Engineer II\" (2/5 milestones) - [x] Ship 3 features solo - [x] Pass code review without major revisions", memoryContext: "No coaching memory yet — this is effectively a first conversation.", userMessage: "My manager asked me to own the migration of our biggest service to the new framework — it's way bigger than anything I've done before. I said yes but now I'm panicking. What should I actually do in the first week?" },
  { careerStage: "Manager", gapContext: "Target role: Director of Operations. Career Health Score: 68/100. Critical Thinking: 60→80 (medium priority).", planContext: "Plan: \"Director track\" (2/4 milestones) - [x] Own a P&L for one region - [x] Run a cross-functional escalation", memoryContext: "Reality: Managing a direct report, Sam, who has missed two deadlines this quarter. First time handling underperformance.", userMessage: "This is the first time I've had to deal with someone underperforming on my team. Sam missed another deadline this week. I don't want to be the manager who just writes people up, but I also can't keep covering for him. What's the actual first step?" },
  { careerStage: "Professional", gapContext: "Target role: Senior Account Executive. Career Health Score: 74/100. Financial Literacy: 55→70 (low priority).", planContext: "Plan: \"Senior AE promotion\" (3/3 milestones) - all complete, awaiting review", memoryContext: "Reality: Received a competing offer from another company at 20% higher base.", userMessage: "I got an offer from a competitor for 20% more than I make now. I don't actually want to leave — I like my team — but I don't know how to bring this up to my manager without it sounding like a threat. How do I frame the conversation?" },
  { careerStage: "Manager", gapContext: "Target role: currently unclear — reassessing.", planContext: "No development plan yet.", memoryContext: "Reality: Has been in the same manager role for 4 years, describes feeling burned out and unmotivated.", userMessage: "Honestly I'm not sure I even want to keep doing this job. I've been a manager for 4 years and I feel completely burned out. I don't know if I want a new role here or if I should just leave the field. Where do I even start untangling this?" },
  { careerStage: "Professional", gapContext: "Target role: Senior Marketing Manager. Career Health Score: 62/100. Leadership: 45→70 (medium priority).", planContext: "Plan: \"Return-to-work ramp\" (1/3 milestones) - [x] Reconnect with stakeholders", memoryContext: "Reality: Returned from 4 months of parental leave 3 weeks ago; was leading a campaign launch before leave.", userMessage: "I just came back from parental leave and found out the campaign I was leading got reassigned to someone else while I was out, and nobody really explained why. I don't want to seem like I'm not committed but I'm also frustrated. How do I bring this up?" },
  { careerStage: "Professional", gapContext: "Target role: Engineering Manager. Career Health Score: 55/100. People Management: 20→75 (high priority).", planContext: "Plan: \"IC to manager pivot\" (0/4 milestones) - none started yet", memoryContext: "Reality: 8 years as a senior IC engineer, has never managed anyone, considering the switch for the first time.", userMessage: "I've been a senior engineer for 8 years and I've always said I'd never want to manage people. Lately I'm not so sure — I like mentoring more than I expected to. But I'm scared I'll be bad at it and there's no going back easily once people know I tried and it didn't work. How do people actually figure this out?" },
];

const JD_SYSTEM = `You write clear, professional, candidate-facing job descriptions. Ground every claim strictly in the role data given — never invent responsibilities, years of experience, culture/values language, or requirements not implied by the data. Competency targets given are internal scoring data on a 0-100 scale — translate them into natural-language requirements; never show the raw numbers or mention a "0-100 scale" in the output.
Return ONLY a JSON object: {"summary": "2-3 sentence role summary", "responsibilities": ["...", "..."], "requirements": ["...", "..."], "niceToHave": ["...", "..."]}
No prose before or after the JSON.`;

const JD_VARIANTS = [
  { role: "Senior Data Analyst", family: "Data & Analytics", level: "Senior, grade 6/10, IC track", notes: "Owns weekly revenue reporting pipeline, partners with Sales/Finance on forecast accuracy, builds self-serve exec dashboards, mentors 1-2 junior analysts.", targets: "Critical Thinking: 85, Technical Skills: 80, Communication: 70, AI & Digital Skills: 65" },
  { role: "Product Manager", family: "Product", level: "Mid, grade 5/10, IC track", notes: "Owns roadmap for one product surface, runs sprint planning with 1 eng lead, writes specs, conducts user interviews.", targets: "Strategic Thinking: 70, Communication: 75, Critical Thinking: 75" },
  { role: "Customer Success Lead", family: "Customer Success", level: "Senior, grade 6/10, IC track", notes: "Owns renewal targets for a 30-account book, runs QBRs, escalates at-risk accounts, mentors 1 junior CSM.", targets: "Communication: 80, People Management: 40, Critical Thinking: 65" },
  { role: "DevOps Engineer", family: "Engineering", level: "Mid, grade 5/10, IC track", notes: "Maintains CI/CD pipelines, owns on-call rotation participation, manages cloud infra cost monitoring.", targets: "Technical Skills: 85, AI & Digital Skills: 70, Critical Thinking: 70" },
  { role: "HR Business Partner", family: "People", level: "Senior, grade 6/10, IC track", notes: "Partners with 2 department heads on workforce planning, handles employee relations escalations, supports org design projects.", targets: "Communication: 80, Strategic Thinking: 60, People Management: 50" },
  { role: "Financial Controller", family: "Finance", level: "Senior, grade 7/10, management track", notes: "Owns monthly close, manages a team of 3 accountants, presents variance analysis to CFO, maintains internal controls.", targets: "Financial Literacy: 90, Leadership: 60, Critical Thinking: 75" },
  { role: "Marketing Manager", family: "Marketing", level: "Mid, grade 5/10, IC track", notes: "Owns paid acquisition channels, manages a $200K quarterly budget, reports CAC/pipeline metrics to Director of Marketing.", targets: "Financial Literacy: 55, Technical Skills: 60, Communication: 65" },
  { role: "Junior Software Engineer", family: "Engineering", level: "Junior, grade 2/10, IC track", notes: "Ships small features under senior guidance, fixes bugs from sprint board, participates in code review.", targets: "Technical Skills: 50, Critical Thinking: 45" },
  { role: "VP of Sales", family: "Sales", level: "Executive, grade 9/10, management track", notes: "Owns company-wide revenue target, manages 3 regional sales directors, presents forecast to board quarterly.", targets: "Leadership: 90, Financial Literacy: 85, Strategic Thinking: 90" },
  { role: "Office Operations Coordinator", family: "Operations", level: "Foundational, grade 2/10, IC track", notes: "Manages office vendor relationships, coordinates onboarding logistics for new hires, handles facilities requests.", targets: "Communication: 50, Critical Thinking: 40" },
];

// ---------------- Execution helpers ----------------

function tryParseJson(text) {
  try {
    return { ok: true, value: JSON.parse(text.replace(/```json\n?|```/g, "").trim()) };
  } catch {
    return { ok: false, value: null };
  }
}

async function callAnthropic(modelId, systemPrompt, userMessage, maxTokens) {
  const t0 = Date.now();
  const res = await anthropic.messages.create({ model: modelId, max_tokens: maxTokens, system: systemPrompt, messages: [{ role: "user", content: userMessage }] });
  const text = res.content.find((b) => b.type === "text")?.text ?? "";
  return { text, inTok: res.usage.input_tokens, outTok: res.usage.output_tokens, ms: Date.now() - t0 };
}
async function callOpenRouter(modelId, systemPrompt, userMessage, maxTokens) {
  const t0 = Date.now();
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: modelId, max_tokens: maxTokens, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }] }),
  });
  if (!r.ok) throw new Error(`OpenRouter ${r.status}: ${await r.text()}`);
  const data = await r.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  return { text, inTok: data.usage?.prompt_tokens ?? 0, outTok: data.usage?.completion_tokens ?? 0, ms: Date.now() - t0 };
}
async function callModel(modelId, systemPrompt, userMessage, maxTokens) {
  return modelId.startsWith("claude-") ? callAnthropic(modelId, systemPrompt, userMessage, maxTokens) : callOpenRouter(modelId, systemPrompt, userMessage, maxTokens);
}

const JUDGE_TOOL = {
  name: "record_scores",
  description: "Record rubric scores for a candidate AI output against a gold-standard reference.",
  input_schema: {
    type: "object",
    properties: {
      correctness: { type: "integer", minimum: 0, maximum: 100 },
      rubricCompliance: { type: "integer", minimum: 0, maximum: 100 },
      completeness: { type: "integer", minimum: 0, maximum: 100 },
      calibration: { type: "integer", minimum: 0, maximum: 100 },
      hallucinationResistance: { type: "integer", minimum: 0, maximum: 100 },
      note: { type: "string" },
    },
    required: ["correctness", "rubricCompliance", "completeness", "calibration", "hallucinationResistance", "note"],
  },
};
async function judge(taskLabel, rubricNotes, taskPrompt, goldAnswer, candidateAnswer) {
  const res = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 400,
    system: `You are an impartial quality judge for "${taskLabel}". Score CANDIDATE vs GOLD STANDARD (gold = best-achievable reference, not necessarily flawless; 100 = matches gold's substance/rigor). ${rubricNotes}`,
    tools: [JUDGE_TOOL],
    tool_choice: { type: "tool", name: "record_scores" },
    messages: [{ role: "user", content: `TASK PROMPT:\n${taskPrompt}\n\nGOLD STANDARD:\n${goldAnswer}\n\nCANDIDATE:\n${candidateAnswer || "(empty)"}` }],
  });
  const toolUse = res.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("Judge did not return structured output");
  return toolUse.input;
}

function stats(nums) {
  const n = nums.length;
  const mean = nums.reduce((a, b) => a + b, 0) / n;
  const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const sorted = [...nums].sort((a, b) => a - b);
  const p95 = sorted[Math.min(n - 1, Math.ceil(0.95 * n) - 1)];
  return { mean, stdev: Math.sqrt(variance), p95 };
}

async function runOneVariant(taskLabel, requiresJson, rubricNotes, systemPrompt, userMessage, maxTokens) {
  const gold = await callAnthropic("claude-fable-5", systemPrompt, userMessage, maxTokens);
  const perModel = {};
  await Promise.all(
    CANDIDATE_MODELS.map(async (modelId) => {
      try {
        const candidate = await callModel(modelId, systemPrompt, userMessage, maxTokens);
        const c = priceOf(modelId, candidate.inTok, candidate.outTok);
        const jsonOk = requiresJson ? tryParseJson(candidate.text).ok : true;
        const scores = await judge(taskLabel, rubricNotes, userMessage, gold.text, candidate.text);
        const quality =
          ((RAW_WEIGHTS.correctness * scores.correctness +
            RAW_WEIGHTS.rubricCompliance * scores.rubricCompliance +
            RAW_WEIGHTS.completeness * scores.completeness +
            RAW_WEIGHTS.calibration * scores.calibration +
            RAW_WEIGHTS.hallucinationResistance * scores.hallucinationResistance +
            RAW_WEIGHTS.jsonValidity * (jsonOk ? 100 : 0)) /
            WEIGHT_SUM) |
          0;
        perModel[modelId] = { ok: true, quality, ms: candidate.ms, cost: c, jsonOk };
      } catch (err) {
        perModel[modelId] = { ok: false, error: err.message ?? String(err) };
      }
    })
  );
  return perModel;
}

// ---------------- Main ----------------

if (!process.env.ANTHROPIC_API_KEY || !process.env.OPENROUTER_API_KEY) {
  console.error("Missing ANTHROPIC_API_KEY or OPENROUTER_API_KEY");
  process.exit(1);
}

const TASK_TYPES = [
  // CV competency scoring and Coach reply already completed successfully in
  // the prior run (before the Anthropic account ran out of credit) — only
  // Job Description generation is re-run here to avoid re-paying for and
  // re-printing results that are already known.
  {
    label: "Job Description generation",
    requiresJson: true,
    maxTokens: 1500,
    rubricNotes: "Rubric compliance: MUST NOT show raw 0-100 numbers or mention a '0-100 scale' — near-zero score if violated. Hallucination = no invented responsibilities/culture language beyond given data.",
    variants: JD_VARIANTS.map((v) => ({
      system: JD_SYSTEM,
      user: `ROLE: ${v.role}\nFAMILY: ${v.family}\nLEVEL: ${v.level}\n\nRESPONSIBILITIES (internal notes):\n${v.notes}\n\nREQUIRED COMPETENCY PROFILE (internal scoring):\n${v.targets}`,
    })),
  },
];

const finalTables = {};

for (const taskType of TASK_TYPES) {
  console.log("\n" + "#".repeat(76));
  console.log(`TASK TYPE: ${taskType.label} (${taskType.variants.length} distinct inputs)`);
  console.log("#".repeat(76));

  const perModelRuns = Object.fromEntries(CANDIDATE_MODELS.map((m) => [m, []]));

  for (let i = 0; i < taskType.variants.length; i++) {
    const v = taskType.variants[i];
    console.log(`\n  Variant ${i + 1}/${taskType.variants.length}...`);
    const results = await runOneVariant(taskType.label, taskType.requiresJson, taskType.rubricNotes, v.system, v.user, taskType.maxTokens);
    for (const modelId of CANDIDATE_MODELS) perModelRuns[modelId].push(results[modelId]);
  }

  const rows = CANDIDATE_MODELS.map((modelId) => {
    const runs = perModelRuns[modelId];
    const ok = runs.filter((r) => r.ok);
    const failureRate = ((runs.length - ok.length) / runs.length) * 100;
    if (ok.length === 0) return { modelId, failureRate, noSuccesses: true };
    const q = stats(ok.map((r) => r.quality));
    const lat = stats(ok.map((r) => r.ms));
    const avgCost = ok.reduce((a, r) => a + r.cost, 0) / ok.length;
    const reliability = 100 - failureRate;
    const finalScore = Math.round(q.mean * (reliability / 100));
    return {
      modelId,
      avgQuality: Math.round(q.mean),
      stdevQuality: Math.round(q.stdev),
      failureRate: Math.round(failureRate),
      reliability: Math.round(reliability),
      avgLatencyMs: Math.round(lat.mean),
      p95LatencyMs: Math.round(lat.p95),
      avgCost,
      finalScore,
    };
  });

  finalTables[taskType.label] = rows;

  console.log(`\n  ${taskType.label} — RESULTS (10 distinct inputs, ranked by reliability-adjusted final score)`);
  const sorted = [...rows].sort((a, b) => (b.finalScore ?? -1) - (a.finalScore ?? -1));
  for (const r of sorted) {
    if (r.noSuccesses) {
      console.log(`    ${r.modelId.padEnd(35)} 100% FAILURE RATE — no successful runs`);
    } else {
      console.log(
        `    ${r.modelId.padEnd(35)} final ${String(r.finalScore).padStart(3)}  |  quality ${r.avgQuality}±${r.stdevQuality}  |  reliability ${r.reliability}% (fail ${r.failureRate}%)  |  lat avg ${r.avgLatencyMs}ms p95 ${r.p95LatencyMs}ms  |  cost avg $${r.avgCost.toFixed(5)}`
      );
    }
  }
}

console.log("\n\n" + "=".repeat(90));
console.log("FULL SUMMARY — all task types");
console.log("=".repeat(90));
console.log(JSON.stringify(finalTables, null, 2));
