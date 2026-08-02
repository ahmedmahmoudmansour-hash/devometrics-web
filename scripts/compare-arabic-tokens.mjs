// Throwaway script — tests whether Arabic content really costs more than
// English for the same Coach interaction, using Haiku (the model actually
// routed to Coach), so the ratio is real and specific to this workload, not
// a general assumption about tokenizers.
//
// Run from devometrics-web/:
//   node --env-file=.env.local scripts/compare-arabic-tokens.mjs

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PRICING = { "claude-haiku-4-5": { input: 1.0, output: 5.0 } };
function cost(inTok, outTok) {
  const p = PRICING["claude-haiku-4-5"];
  return (inTok / 1_000_000) * p.input + (outTok / 1_000_000) * p.output;
}

const EN_SYSTEM = `You are the Devometrics AI Career Coach — a focused career-development advisor. TONE: Direct, evidence-based, and specific. STRUCTURE: Open with one short sentence (under ~12 words) before going into detail.
PERSONALIZATION: Career stage: Professional. Location: Dubai, UAE.
GAP ANALYSIS (most recent): Target role: Regional Sales Manager. Career Health Score: 52/100. Competencies: People Management: 25→80 (priority: high, confidence: 75%); Financial Literacy: 20→75 (priority: high, confidence: 80%); Leadership: 40→75 (priority: medium, confidence: 60%).
ONGOING DEVELOPMENT CONTEXT: Plan: "Become Regional Sales Manager" (2/5 milestones complete) - [x] Complete a Leadership assessment - [x] Shadow a forecast review with current RSM - [ ] Own a small P&L for one quarter - [ ] Lead a cross-team account review - [ ] Present a resourcing tradeoff recommendation
COACHING MEMORY: Goal: Get promoted to Regional Sales Manager within 18 months. Commitments (Will): Will ask manager this week about owning a P&L for one quarter.`;
const EN_USER = `I talked to my manager about owning a P&L like we discussed, but she said that's usually only given to people already at the manager level — kind of a chicken-and-egg problem. What should I actually do here?`;

// Same content, real Arabic translation (Fusha, matching the app's existing
// translation register) — not machine-transliterated, an actual equivalent
// message a real Arabic-speaking user would send.
const AR_SYSTEM = `أنت مدرب ديفومتركس للتطوير المهني بالذكاء الاصطناعي — مستشار متخصص في التطوير المهني. النبرة: مباشرة، مبنية على الأدلة، ومحددة. البنية: ابدأ بجملة قصيرة مباشرة (أقل من 12 كلمة تقريبًا) قبل الخوض في التفاصيل.
التخصيص الشخصي: المرحلة المهنية: محترف. الموقع: دبي، الإمارات العربية المتحدة.
تحليل الفجوة (الأحدث): الدور المستهدف: مدير مبيعات إقليمي. مؤشر الصحة المهنية: 52/100. الكفاءات: إدارة الأفراد: 25→80 (أولوية عالية، ثقة 75%)؛ الثقافة المالية: 20→75 (أولوية عالية، ثقة 80%)؛ القيادة: 40→75 (أولوية متوسطة، ثقة 60%).
سياق التطوير المستمر: الخطة: "أصبح مدير مبيعات إقليمي" (2/5 معالم مكتملة) - [x] أكمل تقييم القيادة - [x] راقب مراجعة توقعات مع المدير الإقليمي الحالي - [ ] امتلك جزءًا من الميزانية لربع سنة واحد - [ ] قد مراجعة حساب متعددة الفرق - [ ] قدّم توصية بشأن مفاضلة الموارد
ذاكرة التدريب: الهدف: الترقية إلى مدير مبيعات إقليمي خلال 18 شهرًا. الالتزامات: سيسأل المدير هذا الأسبوع عن امتلاك جزء من الميزانية لربع سنة واحد.`;
const AR_USER = `تحدثت مع مديرتي عن امتلاك جزء من الميزانية كما اتفقنا، لكنها قالت إن هذا عادة ما يُمنح فقط لمن هم بالفعل في مستوى الإدارة — مشكلة الدجاجة والبيضة نوعًا ما. ما الذي يجب أن أفعله فعليًا هنا؟`;

async function run(label, system, user) {
  const t0 = Date.now();
  const res = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    system,
    messages: [{ role: "user", content: user }],
  });
  const text = res.content.find((b) => b.type === "text")?.text ?? "";
  const c = cost(res.usage.input_tokens, res.usage.output_tokens);
  console.log(`\n${"=".repeat(72)}\n${label} — ${Date.now() - t0}ms`);
  console.log(`input chars: ${system.length + user.length}   input tokens: ${res.usage.input_tokens}   output tokens: ${res.usage.output_tokens}   cost: $${c.toFixed(5)}`);
  console.log(text.trim().slice(0, 200) + "...");
  return { inTok: res.usage.input_tokens, outTok: res.usage.output_tokens, cost: c, inChars: system.length + user.length };
}

const en = await run("ENGLISH", EN_SYSTEM, EN_USER);
const ar = await run("ARABIC", AR_SYSTEM, AR_USER);

console.log(`\n${"=".repeat(72)}\nRATIO (Arabic / English)`);
console.log(`input tokens: ${(ar.inTok / en.inTok).toFixed(2)}x   (despite ${(ar.inChars / en.inChars).toFixed(2)}x the character count)`);
console.log(`output tokens: ${(ar.outTok / en.outTok).toFixed(2)}x`);
console.log(`cost: ${(ar.cost / en.cost).toFixed(2)}x`);
