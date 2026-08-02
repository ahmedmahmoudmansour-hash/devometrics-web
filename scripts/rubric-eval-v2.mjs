// v2 — weighted rubric eval, fixing v1's judge-parsing failures (33% of
// scorings came back unparsable last run) by forcing the judge through
// Anthropic's structured tool-calling instead of free-text JSON, and by
// checking JSON validity programmatically (JSON.parse) instead of asking
// the judge to eyeball it.
//
// Weights (per the reviewer's framework):
//   correctness 25%, rubricCompliance 20%, completeness 15%,
//   calibration 15%, hallucinationResistance 10%, jsonValidity 5%,
//   latency 5%, cost 5%
// jsonValidity/latency/cost are computed programmatically, not judged.
// latency/cost are scored relative to the fastest/cheapest model in the
// comparison set for that task (100 = best in set), since they're not
// naturally 0-100 like the qualitative dimensions.
//
// Run from devometrics-web/:
//   node --env-file=.env.local scripts/rubric-eval-v2.mjs

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const WEIGHTS = {
  correctness: 0.25,
  rubricCompliance: 0.20,
  completeness: 0.15,
  calibration: 0.15,
  hallucinationResistance: 0.10,
  jsonValidity: 0.05,
  latency: 0.05,
  cost: 0.05,
};

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

function tryParseJson(text) {
  const cleaned = text.replace(/```json\n?|```/g, "").trim();
  try {
    return { ok: true, value: JSON.parse(cleaned) };
  } catch {
    return { ok: false, value: null };
  }
}

async function callAnthropic(modelId, systemPrompt, userMessage, maxTokens) {
  const t0 = Date.now();
  const res = await anthropic.messages.create({
    model: modelId,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });
  const text = res.content.find((b) => b.type === "text")?.text ?? "";
  return { modelId, text, inTok: res.usage.input_tokens, outTok: res.usage.output_tokens, ms: Date.now() - t0 };
}

async function callOpenRouter(modelId, systemPrompt, userMessage, maxTokens) {
  const t0 = Date.now();
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelId,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });
  if (!r.ok) throw new Error(`OpenRouter ${r.status} (${modelId}): ${await r.text()}`);
  const data = await r.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  return { modelId, text, inTok: data.usage?.prompt_tokens ?? 0, outTok: data.usage?.completion_tokens ?? 0, ms: Date.now() - t0 };
}

async function callModel(modelId, systemPrompt, userMessage, maxTokens) {
  return modelId.startsWith("claude-")
    ? callAnthropic(modelId, systemPrompt, userMessage, maxTokens)
    : callOpenRouter(modelId, systemPrompt, userMessage, maxTokens);
}

// Judge forced through tool-calling — cannot return malformed output.
const JUDGE_TOOL = {
  name: "record_scores",
  description: "Record rubric scores for a candidate AI output against a gold-standard reference.",
  input_schema: {
    type: "object",
    properties: {
      correctness: { type: "integer", minimum: 0, maximum: 100, description: "Is the substance factually/logically right vs. the gold standard?" },
      rubricCompliance: { type: "integer", minimum: 0, maximum: 100, description: "Did it follow the task's explicit format/behavior instructions (e.g. required fields, 'never show raw numbers', tone/structure rules)?" },
      completeness: { type: "integer", minimum: 0, maximum: 100, description: "Is the answer fully finished, not cut off or missing required sections?" },
      calibration: { type: "integer", minimum: 0, maximum: 100, description: "Where the task involves confidence/certainty, does it track actual evidence strength (low confidence on thin evidence, high on strong)? Score 100 if the task has no calibration dimension." },
      hallucinationResistance: { type: "integer", minimum: 0, maximum: 100, description: "Does it avoid inventing facts, numbers, or claims not present in the source material?" },
      note: { type: "string", description: "One sentence on the main gap vs. gold, if any" },
    },
    required: ["correctness", "rubricCompliance", "completeness", "calibration", "hallucinationResistance", "note"],
  },
};

async function judge(taskLabel, rubricNotes, taskPrompt, goldAnswer, candidateAnswer) {
  const res = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 500,
    system: `You are an impartial quality judge for the real product task "${taskLabel}". Score the CANDIDATE answer against the GOLD STANDARD (treat gold as the best-achievable reference, not necessarily flawless — 100 means matching gold's substance/rigor, not identical wording).\n\nTask-specific notes: ${rubricNotes}`,
    tools: [JUDGE_TOOL],
    tool_choice: { type: "tool", name: "record_scores" },
    messages: [
      { role: "user", content: `ORIGINAL TASK PROMPT:\n${taskPrompt}\n\nGOLD STANDARD ANSWER:\n${goldAnswer}\n\nCANDIDATE ANSWER TO SCORE:\n${candidateAnswer || "(empty — model returned no text)"}` },
    ],
  });
  const toolUse = res.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("Judge did not return structured output");
  return toolUse.input;
}

const TASKS = [
  {
    label: "CV competency scoring",
    maxTokens: 2048,
    hasCalibration: true,
    rubricNotes: "This task requires per-dimension confidence scores. Calibration is critical: a model that stays confident despite explicit negative evidence (e.g. 'no formal management experience') should score LOW on calibration even if the underlying level score is reasonable.",
    system: `You are a competency extraction engine. Score the candidate against the target role across exactly these 8 dimensions: Technical Skills, Leadership, Strategic Thinking, Communication, Critical Thinking, People Management, Financial Literacy, AI & Digital Skills.

Ground every score in specific evidence from the CV. Do not invent accomplishments. When the CV gives little or no signal for a dimension, say so plainly in the rationale and lower confidence accordingly rather than guessing a mid-range number to look complete.

Return ONLY a JSON array of exactly 8 objects: {"dimension": string, "currentLevel": 0-100, "targetLevel": 0-100, "confidence": 0-100, "rationale": "1-2 sentences citing specific CV evidence or its absence"}
No prose before or after the JSON array.`,
    user: `TARGET ROLE:\nRegional Sales Manager\n\nJOB DESCRIPTION:\nWe're hiring a Regional Sales Manager to own revenue for our MENA region. Responsibilities: lead a team of 6 account executives, build and defend the quarterly forecast to the VP of Sales, negotiate enterprise contracts directly with C-level buyers, and identify which underperforming accounts to invest in vs. exit. Requires strong people management, comfort reading a P&L, and the judgment to make resourcing tradeoffs under a fixed budget.\n\nCANDIDATE BACKGROUND (CV):\nAhmed Al-Farsi\nSenior Account Executive, Acme Software (2021–present)\n- Carried a $2.1M annual quota, closed at 108% for FY2025.\n- Mentored two junior AEs; one was promoted to Account Executive within a year.\n- Negotiated a 3-year renewal with our largest MENA customer after they threatened to churn to a competitor over pricing — kept the account at a smaller discount than requested by proposing a multi-year term instead.\n\nAccount Executive, Acme Software (2019–2021)\n- Consistently ranked top 3 of 12 AEs on the regional team.\n- Built a self-serve competitor-battlecard doc that the team still uses.\n\nEducation: BA Business Administration, American University of Beirut.\nNo formal management experience; has never owned a budget or built a forecast independently.`,
  },
  {
    label: "Coach reply",
    maxTokens: 1024,
    hasCalibration: false,
    rubricNotes: "No calibration dimension applies — score calibration as 100 automatically. Rubric compliance = opens with a short direct sentence per the system prompt's STRUCTURE rule. Correctness = actionable, specific advice. Completeness = fully finished, not cut off.",
    system: `You are the Devometrics AI Career Coach — a focused career-development advisor. TONE: Direct, evidence-based, and specific. STRUCTURE: Open with one short sentence (under ~12 words) before going into detail.

PERSONALIZATION: Career stage: Professional. Location: Dubai, UAE.

GAP ANALYSIS (most recent): Target role: Regional Sales Manager. Career Health Score: 52/100. Competencies: People Management: 25→80 (priority: high, confidence: 75%); Financial Literacy: 20→75 (priority: high, confidence: 80%); Leadership: 40→75 (priority: medium, confidence: 60%).

ONGOING DEVELOPMENT CONTEXT: Plan: "Become Regional Sales Manager" (2/5 milestones complete) - [x] Complete a Leadership assessment - [x] Shadow a forecast review with current RSM - [ ] Own a small P&L for one quarter - [ ] Lead a cross-team account review - [ ] Present a resourcing tradeoff recommendation

COACHING MEMORY: Goal: Get promoted to Regional Sales Manager within 18 months. Commitments (Will): Will ask manager this week about owning a P&L for one quarter.`,
    user: `I talked to my manager about owning a P&L like we discussed, but she said that's usually only given to people already at the manager level — kind of a chicken-and-egg problem. What should I actually do here?`,
  },
  {
    label: "Job Description generation",
    maxTokens: 1500,
    hasCalibration: false,
    rubricNotes: "No calibration dimension applies — score calibration as 100 automatically. Rubric compliance = MUST NOT show raw 0-100 competency numbers or mention a '0-100 scale' — this is an explicit, testable instruction; violating it should score rubricCompliance near 0 regardless of other quality. Hallucination = no invented responsibilities/culture language beyond the given role data.",
    system: `You write clear, professional, candidate-facing job descriptions. Ground every claim strictly in the role data given — never invent responsibilities, years of experience, culture/values language, or requirements not implied by the data. Competency targets given are internal scoring data on a 0-100 scale — translate them into natural-language requirements; never show the raw numbers or mention a "0-100 scale" in the output.

Return ONLY a JSON object: {"summary": "2-3 sentence role summary", "responsibilities": ["...", "..."], "requirements": ["...", "..."], "niceToHave": ["...", "..."]}
No prose before or after the JSON.`,
    user: `ROLE: Senior Data Analyst\nFAMILY: Data & Analytics\nLEVEL: Senior (grade 6/10, individual-contributor track)\n\nRESPONSIBILITIES (internal notes):\nOwns the weekly revenue reporting pipeline, partners with Sales and Finance on forecast accuracy, builds self-serve dashboards for the exec team, mentors 1-2 junior analysts on SQL and dashboard best practices.\n\nREQUIRED COMPETENCY PROFILE (internal scoring):\nCritical Thinking: target 85/100\nTechnical Skills: target 80/100\nCommunication: target 70/100\nAI & Digital Skills: target 65/100`,
  },
];

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

if (!process.env.ANTHROPIC_API_KEY || !process.env.OPENROUTER_API_KEY) {
  console.error("Missing ANTHROPIC_API_KEY or OPENROUTER_API_KEY");
  process.exit(1);
}

const allResults = [];

for (const task of TASKS) {
  console.log("\n" + "#".repeat(76));
  console.log(`TASK: ${task.label}`);
  console.log("#".repeat(76));

  console.log("\nGenerating gold standard (Fable 5)...");
  const gold = await callAnthropic("claude-fable-5", task.system, task.user, task.maxTokens);
  console.log(`Gold standard ready — ${gold.ms}ms`);

  const rows = [];
  for (const modelId of CANDIDATE_MODELS) {
    try {
      const candidate = await callModel(modelId, task.system, task.user, task.maxTokens);
      const rawCost = priceOf(modelId, candidate.inTok, candidate.outTok);
      const jsonCheck = tryParseJson(candidate.text);
      const scores = await judge(task.label, task.rubricNotes, task.user, gold.text, candidate.text);
      rows.push({
        modelId,
        ms: candidate.ms,
        rawCost,
        jsonValid: jsonCheck.ok,
        ...scores,
        calibration: task.hasCalibration ? scores.calibration : 100,
      });
      console.log(`\n${modelId}: ${candidate.ms}ms, $${rawCost.toFixed(5)}, jsonValid=${jsonCheck.ok} — ${scores.note}`);
    } catch (err) {
      rows.push({ modelId, error: err.message ?? String(err) });
      console.error(`\n${modelId} failed:`, err.message ?? err);
    }
  }

  // Normalize latency/cost relative to the best (lowest) in this task's set.
  const okRows = rows.filter((r) => !r.error);
  const minMs = Math.min(...okRows.map((r) => r.ms));
  const minCost = Math.min(...okRows.map((r) => r.rawCost));
  for (const r of okRows) {
    r.latencyScore = Math.round((minMs / r.ms) * 100);
    r.costScore = Math.round((minCost / r.rawCost) * 100);
    r.jsonValidityScore = r.jsonValid ? 100 : 0;
    r.composite = Math.round(
      WEIGHTS.correctness * r.correctness +
        WEIGHTS.rubricCompliance * r.rubricCompliance +
        WEIGHTS.completeness * r.completeness +
        WEIGHTS.calibration * r.calibration +
        WEIGHTS.hallucinationResistance * r.hallucinationResistance +
        WEIGHTS.jsonValidity * r.jsonValidityScore +
        WEIGHTS.latency * r.latencyScore +
        WEIGHTS.cost * r.costScore
    );
  }

  allResults.push({ task: task.label, rows });
}

console.log("\n\n" + "=".repeat(90));
console.log("WEIGHTED COMPOSITE SCORES (25% correctness / 20% rubric / 15% complete / 15% calibration / 10% halluc. / 5% json / 5% latency / 5% cost)");
console.log("=".repeat(90));
for (const { task, rows } of allResults) {
  console.log(`\n${task}:`);
  const sorted = [...rows].sort((a, b) => (b.composite ?? -1) - (a.composite ?? -1));
  for (const r of sorted) {
    if (r.error) {
      console.log(`  ${r.modelId.padEnd(35)} FAILED — ${r.error}`);
    } else {
      console.log(
        `  ${r.modelId.padEnd(35)} composite ${String(r.composite).padStart(3)}/100   ` +
          `(correct ${r.correctness} rubric ${r.rubricCompliance} complete ${r.completeness} calib ${r.calibration} halluc ${r.hallucinationResistance} json ${r.jsonValidityScore} lat ${r.latencyScore} cost ${r.costScore})   ` +
          `$${r.rawCost.toFixed(5)}  ${r.ms}ms`
      );
    }
  }
}
