// Throwaway script — rubric-based quality eval. For each real task type
// (CV scoring, Coach reply, JD generation): Claude Fable 5 generates a gold-
// standard answer, every candidate model generates its own answer, then
// Sonnet 5 acts as an independent judge scoring each candidate against the
// gold standard on a task-specific 0-100 rubric. This replaces eyeballing
// responses with an actual measured "% as good as Fable" number per model.
//
// Run from devometrics-web/:
//   node --env-file=.env.local scripts/rubric-eval.mjs

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

function cost(key, inTok, outTok) {
  const p = PRICING[key];
  if (!p) return null;
  return (inTok / 1_000_000) * p.input + (outTok / 1_000_000) * p.output;
}

async function callAnthropic(modelId, systemPrompt, userMessage, maxTokens) {
  const t0 = Date.now();
  const res = await anthropic.messages.create({
    model: modelId,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });
  const text = res.content.find((b) => b.type === "text")?.text ?? "(no text)";
  return { modelId, model: res.model, text, inTok: res.usage.input_tokens, outTok: res.usage.output_tokens, ms: Date.now() - t0 };
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
  const text = data.choices?.[0]?.message?.content ?? "(no text)";
  return { modelId, model: data.model ?? modelId, text, inTok: data.usage?.prompt_tokens ?? 0, outTok: data.usage?.completion_tokens ?? 0, ms: Date.now() - t0 };
}

async function callModel(modelId, systemPrompt, userMessage, maxTokens) {
  if (modelId.startsWith("claude-")) return callAnthropic(modelId, systemPrompt, userMessage, maxTokens);
  return callOpenRouter(modelId, systemPrompt, userMessage, maxTokens);
}

async function judge(taskLabel, rubricPrompt, taskPrompt, goldAnswer, candidateAnswer) {
  const res = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 500,
    system: `You are an impartial quality judge for AI outputs on a real product task: "${taskLabel}". You will be given the original task prompt, a GOLD STANDARD answer (treat as the best-achievable reference, not necessarily flawless), and a CANDIDATE answer to score against it.

${rubricPrompt}

Score the candidate 0-100 on each rubric dimension, where 100 means fully matching the gold standard's quality on that dimension (not "identical text" — equivalent substance/rigor). Return ONLY JSON: {"dimensionScores": {...}, "overall": 0-100, "note": "1 sentence on the main gap, if any"}`,
    messages: [
      {
        role: "user",
        content: `ORIGINAL TASK PROMPT:\n${taskPrompt}\n\nGOLD STANDARD ANSWER:\n${goldAnswer}\n\nCANDIDATE ANSWER TO SCORE:\n${candidateAnswer}`,
      },
    ],
  });
  const text = res.content.find((b) => b.type === "text")?.text ?? "{}";
  try {
    return JSON.parse(text.replace(/```json\n?|```/g, "").trim());
  } catch {
    return { overall: null, note: "judge output unparsable", raw: text };
  }
}

// ---------------- Task definitions (real production prompt shapes) ----------------

const TASKS = [
  {
    label: "CV competency scoring",
    maxTokens: 2048,
    rubric: `Rubric dimensions:
- faithfulness: does every score cite specific CV evidence, with no invented accomplishments?
- calibration: does confidence drop when evidence is thin/absent, and rise only when evidence is strong? (this is the dimension that matters most — a model that's confident despite explicit negative evidence should score LOW here)
- completeness: are all 8 required dimensions present with valid scores?`,
    system: `You are a competency extraction engine. Score the candidate against the target role across exactly these 8 dimensions: Technical Skills, Leadership, Strategic Thinking, Communication, Critical Thinking, People Management, Financial Literacy, AI & Digital Skills.

Ground every score in specific evidence from the CV. Do not invent accomplishments. When the CV gives little or no signal for a dimension, say so plainly in the rationale and lower confidence accordingly rather than guessing a mid-range number to look complete.

Return ONLY a JSON array of exactly 8 objects: {"dimension": string, "currentLevel": 0-100, "targetLevel": 0-100, "confidence": 0-100, "rationale": "1-2 sentences citing specific CV evidence or its absence"}
No prose before or after the JSON array.`,
    user: `TARGET ROLE:\nRegional Sales Manager\n\nJOB DESCRIPTION:\nWe're hiring a Regional Sales Manager to own revenue for our MENA region. Responsibilities: lead a team of 6 account executives, build and defend the quarterly forecast to the VP of Sales, negotiate enterprise contracts directly with C-level buyers, and identify which underperforming accounts to invest in vs. exit. Requires strong people management, comfort reading a P&L, and the judgment to make resourcing tradeoffs under a fixed budget.\n\nCANDIDATE BACKGROUND (CV):\nAhmed Al-Farsi\nSenior Account Executive, Acme Software (2021–present)\n- Carried a $2.1M annual quota, closed at 108% for FY2025.\n- Mentored two junior AEs; one was promoted to Account Executive within a year.\n- Negotiated a 3-year renewal with our largest MENA customer after they threatened to churn to a competitor over pricing — kept the account at a smaller discount than requested by proposing a multi-year term instead.\n\nAccount Executive, Acme Software (2019–2021)\n- Consistently ranked top 3 of 12 AEs on the regional team.\n- Built a self-serve competitor-battlecard doc that the team still uses.\n\nEducation: BA Business Administration, American University of Beirut.\nNo formal management experience; has never owned a budget or built a forecast independently.`,
  },
  {
    label: "Coach reply",
    maxTokens: 1024,
    rubric: `Rubric dimensions:
- grounding: does the reply reference the user's actual provided data (gap analysis scores, plan milestones, resume gaps) rather than generic advice?
- actionability: does it give a specific, concrete next step, not vague encouragement?
- structure: does it open with a short direct sentence before elaborating, per the system prompt's instruction?`,
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
    rubric: `Rubric dimensions:
- accuracy: does it avoid inventing responsibilities, culture language, or requirements not implied by the role data given?
- noRawNumberLeak: does it correctly translate competency targets into natural language WITHOUT showing raw 0-100 numbers or mentioning a "0-100 scale" (this is an explicit instruction)?
- completeness: does it produce a full JD with summary, responsibilities, requirements, and nice-to-haves, not a truncated/partial result?`,
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

  // 1. Gold standard from Fable 5
  console.log("\nGenerating gold standard (Fable 5)...");
  const gold = await callAnthropic("claude-fable-5", task.system, task.user, task.maxTokens);
  const goldCost = cost("claude-fable-5", gold.inTok, gold.outTok);
  console.log(`Gold standard ready — ${gold.ms}ms, $${goldCost.toFixed(5)}`);

  // 2. Every candidate generates its own answer, then gets judged against gold
  for (const modelId of CANDIDATE_MODELS) {
    try {
      const candidate = await callModel(modelId, task.system, task.user, task.maxTokens);
      const candidateCost = cost(modelId, candidate.inTok, candidate.outTok);
      const verdict = await judge(task.label, task.rubric, task.user, gold.text, candidate.text);

      const row = {
        task: task.label,
        modelId,
        ms: candidate.ms,
        cost: candidateCost,
        overall: verdict.overall,
        note: verdict.note,
        dimensionScores: verdict.dimensionScores,
      };
      allResults.push(row);
      console.log(
        `\n${modelId}: ${candidate.ms}ms, $${candidateCost.toFixed(5)}, score ${verdict.overall ?? "?"}/100 — ${verdict.note ?? ""}`
      );
    } catch (err) {
      console.error(`\n${modelId} failed:`, err.message ?? err);
      allResults.push({ task: task.label, modelId, error: err.message ?? String(err) });
    }
  }
}

console.log("\n\n" + "=".repeat(76));
console.log("SUMMARY — score /100 vs Fable gold standard, cost, latency");
console.log("=".repeat(76));
for (const task of TASKS) {
  console.log(`\n${task.label}:`);
  const rows = allResults.filter((r) => r.task === task.label);
  for (const r of rows) {
    if (r.error) {
      console.log(`  ${r.modelId.padEnd(35)} FAILED — ${r.error}`);
    } else {
      console.log(
        `  ${r.modelId.padEnd(35)} score ${String(r.overall ?? "?").padStart(3)}/100   $${(r.cost ?? 0).toFixed(5).padStart(9)}   ${String(r.ms).padStart(6)}ms`
      );
    }
  }
}
