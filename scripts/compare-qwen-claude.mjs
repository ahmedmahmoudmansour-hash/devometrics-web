// Throwaway comparison script — not part of the app, not imported anywhere,
// safe to delete once you're done evaluating. Runs the same CV-scoring-style
// prompt (mirroring lib/gap-analysis/extract.ts) against Claude and one or
// more OpenRouter models side by side, across multiple CVs of varying fit,
// so calibration differences (not just one lucky/unlucky sample) show up.
//
// Run from the devometrics-web/ directory:
//   node --env-file=.env.local scripts/compare-qwen-claude.mjs

import Anthropic from "@anthropic-ai/sdk";

const TARGET_ROLE = "Regional Sales Manager";

const JOB_DESCRIPTION = `We're hiring a Regional Sales Manager to own revenue for our MENA region.
Responsibilities: lead a team of 6 account executives, build and defend the
quarterly forecast to the VP of Sales, negotiate enterprise contracts
directly with C-level buyers, and identify which underperforming accounts
to invest in vs. exit. Requires strong people management, comfort reading
a P&L, and the judgment to make resourcing tradeoffs under a fixed budget.`;

const TEST_CASES = [
  {
    label: "Mixed fit (Ahmed Al-Farsi)",
    cvText: `Ahmed Al-Farsi
Senior Account Executive, Acme Software (2021–present)
- Carried a $2.1M annual quota, closed at 108% for FY2025.
- Mentored two junior AEs; one was promoted to Account Executive within a year.
- Negotiated a 3-year renewal with our largest MENA customer after they
  threatened to churn to a competitor over pricing — kept the account at a
  smaller discount than requested by proposing a multi-year term instead.

Account Executive, Acme Software (2019–2021)
- Consistently ranked top 3 of 12 AEs on the regional team.
- Built a self-serve competitor-battlecard doc that the team still uses.

Education: BA Business Administration, American University of Beirut.
No formal management experience; has never owned a budget or built a
forecast independently.`,
  },
  {
    label: "Strong fit (Layla Haddad)",
    cvText: `Layla Haddad
Regional Sales Director, MedTech Solutions (2022–present)
- Manages a team of 8 account executives across 4 countries; personally
  built the team's quarterly forecast model and presents it directly to
  the CFO and CEO each quarter.
- Grew regional revenue from $8M to $14M in two years; owns a $1.2M annual
  OpEx budget for the region.
- Decided to exit two underperforming SMB accounts (each under $50K/year)
  to reallocate a rep's time toward a $2M enterprise opportunity — the
  enterprise deal closed within the same fiscal year.
- Negotiates directly with C-level buyers (CFOs, VPs of Procurement) at
  6 enterprise accounts.
- Promoted three account executives to senior roles under her management;
  two now run their own territories.

Senior Account Executive, MedTech Solutions (2019–2022)
- Built and maintained her own pipeline forecast in Salesforce; trained
  the wider team on forecast hygiene.

Education: MBA, INSEAD.`,
  },
  {
    label: "Weak fit (Youssef Nabil)",
    cvText: `Youssef Nabil
Marketing Coordinator, BrightWave Media (2023–present)
- Manages the company's social media content calendar and coordinates
  with the design team on campaign assets.
- No sales quota, no direct client-facing revenue responsibility.
- Assisted in organizing two internal team events.

Marketing Intern, BrightWave Media (2022–2023)
- Supported the marketing team with data entry and scheduling.

Education: BA Communications, Cairo University.
No sales experience, no people-management experience, no budget
ownership, and no client negotiation experience of any kind.`,
  },
];

const SYSTEM_PROMPT = `You are a competency extraction engine. Score the candidate against the
target role across exactly these 8 dimensions: Technical Skills, Leadership,
Strategic Thinking, Communication, Critical Thinking, People Management,
Financial Literacy, AI & Digital Skills.

Ground every score in specific evidence from the CV. Do not invent
accomplishments. When the CV gives little or no signal for a dimension, say
so plainly in the rationale and lower confidence accordingly rather than
guessing a mid-range number to look complete.

Return ONLY a JSON array of exactly 8 objects, one per dimension, each
shaped like:
{"dimension": string, "currentLevel": 0-100, "targetLevel": 0-100, "confidence": 0-100, "rationale": "1-2 sentences citing specific CV evidence or its absence"}
No prose before or after the JSON array.`;

function buildUserMessage(cvText) {
  return `TARGET ROLE:\n${TARGET_ROLE}\n\nJOB DESCRIPTION:\n${JOB_DESCRIPTION}\n\nCANDIDATE BACKGROUND (CV):\n${cvText}`;
}

// Per 1M tokens, USD — verified against each provider's OpenRouter pricing
// page (never guessed; a stale/wrong figure here would silently misprice
// every comparison run).
const PRICING = {
  "claude-sonnet-5": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
  "qwen/qwen3.7-plus": { input: 0.32, output: 1.28 },
  "deepseek/deepseek-v4-pro": { input: 0.435, output: 0.87 },
  "google/gemini-3.6-flash": { input: 1.5, output: 7.5 },
  "google/gemini-3.5-flash-lite": { input: 0.3, output: 2.5 },
};

// Add/remove OpenRouter model ids here to change what this script compares
// against Claude. Each must have a matching PRICING entry above.
const OPENROUTER_MODELS = ["google/gemini-3.6-flash"];

// Direct-Anthropic model ids to also compare (no OpenRouter dependency —
// these run even when OpenRouter credits are exhausted).
const ANTHROPIC_MODELS = ["claude-sonnet-5", "claude-haiku-4-5"];

function cost(key, inTok, outTok) {
  const p = PRICING[key];
  if (!p) return null;
  return (inTok / 1_000_000) * p.input + (outTok / 1_000_000) * p.output;
}

async function callClaude(modelId, userMessage) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const t0 = Date.now();
  const res = await anthropic.messages.create({
    model: modelId,
    max_tokens: 4096, // matches lib/gap-analysis/extract.ts's real production cap
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });
  const text = res.content.find((b) => b.type === "text")?.text ?? "(no text)";
  return {
    provider: modelId,
    priceKey: modelId,
    model: res.model,
    text,
    inTok: res.usage.input_tokens,
    outTok: res.usage.output_tokens,
    ms: Date.now() - t0,
  };
}

async function callOpenRouter(modelId, userMessage) {
  const t0 = Date.now();
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: 4096, // matches lib/gap-analysis/extract.ts's real production cap
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    }),
  });
  if (!r.ok) {
    throw new Error(`OpenRouter ${r.status} (${modelId}): ${await r.text()}`);
  }
  const data = await r.json();
  const text = data.choices?.[0]?.message?.content ?? "(no text)";
  return {
    provider: modelId,
    priceKey: modelId,
    model: data.model ?? modelId,
    text,
    inTok: data.usage?.prompt_tokens ?? 0,
    outTok: data.usage?.completion_tokens ?? 0,
    ms: Date.now() - t0,
  };
}

function printResult(r) {
  console.log("\n" + "-".repeat(72));
  console.log(`${r.provider}  (${r.model})  —  ${r.ms}ms`);
  console.log("-".repeat(72));
  console.log(r.text.trim());
  const c = cost(r.priceKey, r.inTok, r.outTok);
  console.log(
    `\ntokens: ${r.inTok} in / ${r.outTok} out` +
      (c !== null ? `   est. cost: $${c.toFixed(5)}` : "")
  );
}

if (!process.env.ANTHROPIC_API_KEY || !process.env.OPENROUTER_API_KEY) {
  console.error(
    "Missing ANTHROPIC_API_KEY or OPENROUTER_API_KEY — run with:\n" +
      "  node --env-file=.env.local scripts/compare-qwen-claude.mjs"
  );
  process.exit(1);
}

for (const testCase of TEST_CASES) {
  console.log("\n" + "=".repeat(72));
  console.log(`TEST CASE: ${testCase.label}`);
  console.log("=".repeat(72));

  const userMessage = buildUserMessage(testCase.cvText);
  const jobs = [
    ...ANTHROPIC_MODELS.map((id) => ({ label: id, call: callClaude(id, userMessage) })),
    ...OPENROUTER_MODELS.map((id) => ({ label: id, call: callOpenRouter(id, userMessage) })),
  ];
  const results = await Promise.allSettled(jobs.map((j) => j.call));

  results.forEach((r, i) => {
    if (r.status === "fulfilled") printResult(r.value);
    else console.error(`\n${jobs[i].label} call failed:`, r.reason.message ?? r.reason);
  });
}
