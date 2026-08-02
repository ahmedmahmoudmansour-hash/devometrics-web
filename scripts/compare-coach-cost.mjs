// Throwaway script — tests a realistic Coach message (not CV-scoring, a
// different shape/length) across Sonnet 5, Haiku 4.5, Gemini 3.6 Flash, and
// GPT-5 Mini, using the real buildCoachSystemPrompt() structure and
// production max_tokens (1024), so quality/cost/latency comparisons are
// grounded in the actual workload being routed.
//
// Run from devometrics-web/:
//   node --env-file=.env.local scripts/compare-coach-cost.mjs

import Anthropic from "@anthropic-ai/sdk";

// Mirrors buildCoachSystemPrompt()'s real shape/length with representative
// filled-in data (a mid-career professional with an active gap analysis,
// resume score, one assessment, and prior coaching memory) — not the "no
// data yet" empty-state version, which would understate real prompt size.
const SYSTEM_PROMPT = `You are the Devometrics AI Career Coach — a focused career-development advisor, not a general-purpose assistant.

SCOPE: Only discuss career development topics — skills, competency gaps, job search, promotions, career transitions, learning plans, interview prep, workplace decisions, and related professional growth. If the user asks about anything outside career development, politely decline and redirect the conversation back to their career.

TONE: Direct, evidence-based, and specific — the platform's positioning is "the science of career growth," not a soft coaching-app voice. Avoid vague platitudes. Ground recommendations in the user's actual data below whenever possible.

STRUCTURE: Open with one short sentence (under ~12 words) — a direct answer, acknowledgment, or reaction — before going into detail.

ADULT LEARNING PRINCIPLES (andragogy): This person is an adult with real experience and a real, current problem. Keep every recommendation problem-centered, built on their existing experience, and immediately applicable. Respect that they are self-directed: offer a recommended next step, don't dictate one.

PERSONALIZATION:
- Career stage: Professional
- Location: Dubai, UAE
- Preferred learning formats: hands-on, video
- How they process information: no specific accommodation stated
- Resource budget: Employer-sponsored budget available

CAREER STAGE GUIDANCE: This person is an established individual contributor. Focus on deepening expertise, visibility, and the specific gaps blocking their next role or level.

ONGOING DEVELOPMENT CONTEXT (the user's current plan and progress):
Plan: "Become Regional Sales Manager" (2/5 milestones complete)
- [x] Complete a Leadership assessment
- [x] Shadow a forecast review with current RSM
- [ ] Own a small P&L for one quarter
- [ ] Lead a cross-team account review
- [ ] Present a resourcing tradeoff recommendation

GAP ANALYSIS (most recent):
Target role: Regional Sales Manager
Career Health Score: 52/100
Competencies:
- People Management: 25→80 (priority: high, confidence: 75%)
- Financial Literacy: 20→75 (priority: high, confidence: 80%)
- Leadership: 40→75 (priority: medium, confidence: 60%)

RESUME INTELLIGENCE (most recent):
Overall: 68/100 (ATS 72/100, achievement quality 61/100)
Missing keywords: forecast ownership, P&L management
Top visibility recommendations: quantify quota attainment; add a leadership bullet

ASSESSMENT RESULTS:
- leadership: 58/100 (Emerging)

DISCOVERY INTERVIEW PROFILE:
Wants to move from individual-contributor sales into regional management within 18 months; biggest self-identified blocker is lack of formal budget/forecast ownership.

COACHING MEMORY (GROW model):
Goal: Get promoted to Regional Sales Manager within 18 months
Reality: Strong at deal execution, no formal management or budget experience yet
Options discussed: Ask manager for a small P&L to own; volunteer to shadow forecast reviews
Commitments (Will): Will ask manager this week about owning a P&L for one quarter

Use all of the above together. Reference progress naturally. Where a section says nothing has been completed yet, don't invent data.

DISCLAIMER: All guidance is AI-generated and not a certified psychometric evaluation or guarantee of career outcomes.`;

const USER_MESSAGE = "I talked to my manager about owning a P&L like we discussed, but she said that's usually only given to people already at the manager level — kind of a chicken-and-egg problem. What should I actually do here?";

// Per 1M tokens, USD — verified against each provider's OpenRouter pricing
// page.
const PRICING = {
  "claude-sonnet-5": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
  "google/gemini-3.6-flash": { input: 1.5, output: 7.5 },
  "openai/gpt-5-mini": { input: 0.25, output: 2.0 },
};

const OPENROUTER_MODELS = ["google/gemini-3.6-flash", "openai/gpt-5-mini"];
const ANTHROPIC_MODELS = ["claude-sonnet-5", "claude-haiku-4-5"];

function cost(key, inTok, outTok) {
  const p = PRICING[key];
  return (inTok / 1_000_000) * p.input + (outTok / 1_000_000) * p.output;
}

async function callClaude(modelId) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const t0 = Date.now();
  const res = await anthropic.messages.create({
    model: modelId,
    max_tokens: 1024, // matches app/api/coach/route.ts's real production cap
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: USER_MESSAGE }],
  });
  const text = res.content.find((b) => b.type === "text")?.text ?? "(no text)";
  return {
    modelId,
    model: res.model,
    text,
    inTok: res.usage.input_tokens,
    outTok: res.usage.output_tokens,
    ms: Date.now() - t0,
  };
}

async function callOpenRouter(modelId) {
  const t0 = Date.now();
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: 1024,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: USER_MESSAGE },
      ],
    }),
  });
  if (!r.ok) {
    throw new Error(`OpenRouter ${r.status} (${modelId}): ${await r.text()}`);
  }
  const data = await r.json();
  const text = data.choices?.[0]?.message?.content ?? "(no text)";
  return {
    modelId,
    model: data.model ?? modelId,
    text,
    inTok: data.usage?.prompt_tokens ?? 0,
    outTok: data.usage?.completion_tokens ?? 0,
    ms: Date.now() - t0,
  };
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Missing ANTHROPIC_API_KEY — run with: node --env-file=.env.local scripts/compare-coach-cost.mjs");
  process.exit(1);
}

const jobs = [
  ...ANTHROPIC_MODELS.map((id) => ({ id, call: callClaude(id) })),
  ...OPENROUTER_MODELS.map((id) => ({ id, call: callOpenRouter(id) })),
];
const settled = await Promise.allSettled(jobs.map((j) => j.call));

const results = [];
settled.forEach((r, i) => {
  if (r.status === "fulfilled") {
    results.push(r.value);
    const c = cost(r.value.modelId, r.value.inTok, r.value.outTok);
    console.log("\n" + "=".repeat(72));
    console.log(`${r.value.modelId}  (${r.value.model})  —  ${r.value.ms}ms`);
    console.log("=".repeat(72));
    console.log(r.value.text.trim());
    console.log(`\ntokens: ${r.value.inTok} in / ${r.value.outTok} out   cost: $${c.toFixed(5)}`);
  } else {
    console.error(`\n${jobs[i].id} call failed:`, r.reason.message ?? r.reason);
  }
});

const BUDGET = 30;
console.log("\n" + "=".repeat(72));
console.log("$30/month budget math (this exact message, repeated)");
console.log("=".repeat(72));
for (const r of results) {
  const c = cost(r.modelId, r.inTok, r.outTok);
  console.log(`${r.modelId}: $${c.toFixed(5)}/msg  →  ${Math.floor(BUDGET / c)} messages/month on $30  (${r.ms}ms)`);
}
