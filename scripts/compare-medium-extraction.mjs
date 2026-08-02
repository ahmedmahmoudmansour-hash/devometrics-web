// Throwaway script — benchmarks the two remaining tiers of the risk-based
// routing framework: "Medium (drafts & structured generation)" via a real
// Job Description generation task (mirrors lib/jobArchitecture/actions.ts's
// generateJobDescription), and "Extraction & preprocessing" via a real CV
// field-extraction task (mirrors lib/profile/extractCareerProfile.ts).
// Sonnet included as the reference baseline; Gemini 3.6 Flash and DeepSeek
// V4 Pro are the two candidates being decided between.
//
// Run from devometrics-web/:
//   node --env-file=.env.local scripts/compare-medium-extraction.mjs

import Anthropic from "@anthropic-ai/sdk";

const PRICING = {
  "claude-sonnet-5": { input: 3.0, output: 15.0 },
  "google/gemini-3.6-flash": { input: 1.5, output: 7.5 },
  "deepseek/deepseek-v4-pro": { input: 0.435, output: 0.87 },
};
const OPENROUTER_MODELS = ["google/gemini-3.6-flash", "deepseek/deepseek-v4-pro"];
const ANTHROPIC_MODELS = ["claude-sonnet-5"];

function cost(key, inTok, outTok) {
  const p = PRICING[key];
  return (inTok / 1_000_000) * p.input + (outTok / 1_000_000) * p.output;
}

// ---------- Task 1: Medium tier — Job Description generation ----------
const JD_SYSTEM_PROMPT = `You write clear, professional, candidate-facing job descriptions. Ground every claim strictly in the role data given — never invent responsibilities, years of experience, culture/values language, or requirements not implied by the data. Competency targets given are internal scoring data on a 0-100 scale — translate them into natural-language requirements; never show the raw numbers or mention a "0-100 scale" in the output.

Return ONLY a JSON object shaped like:
{"summary": "2-3 sentence role summary", "responsibilities": ["...", "..."], "requirements": ["...", "..."], "niceToHave": ["...", "..."]}
No prose before or after the JSON.`;

const JD_USER_MESSAGE = `ROLE: Senior Data Analyst
FAMILY: Data & Analytics
LEVEL: Senior (grade 6/10, individual-contributor track)

RESPONSIBILITIES (internal notes):
Owns the weekly revenue reporting pipeline, partners with Sales and Finance on forecast accuracy, builds self-serve dashboards for the exec team, mentors 1-2 junior analysts on SQL and dashboard best practices.

REQUIRED COMPETENCY PROFILE (internal scoring):
Critical Thinking: target 85/100
Technical Skills: target 80/100
Communication: target 70/100
AI & Digital Skills: target 65/100`;

// ---------- Task 2: Extraction & preprocessing — CV field extraction ----------
const EXTRACT_SYSTEM_PROMPT = `Extract this person's job history, skills, and qualifications from the CV text below, exactly as stated. Do not invent roles, dates, employers, or credentials that aren't in the text. If a field genuinely isn't stated (e.g. no end date), use an empty string rather than guessing. Most recent job first.

Return ONLY a JSON object shaped like:
{"jobHistory": [{"title": "...", "company": "...", "duration": "...", "description": "1-2 sentence summary"}], "skills": ["..."], "qualifications": [{"credential": "...", "institution": "...", "year": "..."}]}
No prose before or after the JSON.`;

const EXTRACT_USER_MESSAGE = `Ahmed Al-Farsi
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
forecast independently.`;

async function callClaude(modelId, systemPrompt, userMessage, maxTokens) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
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

async function runTask(label, systemPrompt, userMessage, maxTokens) {
  console.log("\n" + "=".repeat(72));
  console.log(`TASK: ${label}`);
  console.log("=".repeat(72));

  const jobs = [
    ...ANTHROPIC_MODELS.map((id) => ({ id, call: callClaude(id, systemPrompt, userMessage, maxTokens) })),
    ...OPENROUTER_MODELS.map((id) => ({ id, call: callOpenRouter(id, systemPrompt, userMessage, maxTokens) })),
  ];
  const settled = await Promise.allSettled(jobs.map((j) => j.call));

  settled.forEach((r, i) => {
    if (r.status === "fulfilled") {
      const c = cost(r.value.modelId, r.value.inTok, r.value.outTok);
      console.log("\n" + "-".repeat(72));
      console.log(`${r.value.modelId}  (${r.value.model})  —  ${r.value.ms}ms`);
      console.log("-".repeat(72));
      console.log(r.value.text.trim());
      console.log(`\ntokens: ${r.value.inTok} in / ${r.value.outTok} out   cost: $${c.toFixed(5)}`);
    } else {
      console.error(`\n${jobs[i].id} call failed:`, r.reason.message ?? r.reason);
    }
  });
}

if (!process.env.ANTHROPIC_API_KEY || !process.env.OPENROUTER_API_KEY) {
  console.error("Missing ANTHROPIC_API_KEY or OPENROUTER_API_KEY");
  process.exit(1);
}

await runTask("Medium tier — Job Description generation", JD_SYSTEM_PROMPT, JD_USER_MESSAGE, 1200);
await runTask("Extraction tier — CV field extraction", EXTRACT_SYSTEM_PROMPT, EXTRACT_USER_MESSAGE, 2048);
