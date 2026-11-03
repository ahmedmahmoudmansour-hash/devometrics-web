// The two AI steps of a role-based assessment. Neither touches the database.
//   1. Writing the questions for a competency (cheaper model; done once per competency version and level band, then reused).
//   2. Judging written answers against the five level descriptions (the stronger model, because the result is a score).
// The AI only judges evidence. Level and score come from the fixed rule in scoring.ts.

import Anthropic from "@anthropic-ai/sdk";
import { callOpenRouterJson } from "@/lib/ai/openrouter";
import {
  SCORING_RULE,
  averageEvidence,
  combineEvidence,
  confidenceFor,
  isAnswered,
  resultFromEvidence,
  validateJudgements,
  wordCount,
  type CompetencyResult,
  type Confidence,
  type EvidenceQuote,
  type ItemJudgement,
} from "@/lib/assessment/scoring";
import { STYLE_BRIEF, nextLevelText, type AssessmentLanguage, type DefinitionText, type ItemStyle } from "@/lib/assessment/definitions";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const QUESTION_MODEL = "openai/gpt-5.4-mini";
export const JUDGE_MODEL = "claude-sonnet-5";

export type Usage = { model: string; inputTokens: number; outputTokens: number };

const ARABIC_LETTERS = /[؀-ۿ]/g;
// Scripts that must never appear in a question: Cyrillic, Greek, Hebrew, Devanagari, Thai, Japanese, Chinese, Korean.
// (A model sometimes drops a stray word in another language into an otherwise correct question.)
const STRAY_SCRIPTS = /[Ͱ-ϿЀ-ӿ֐-׿ऀ-ॿ฀-๿぀-ヿ㐀-鿿가-힯＀-￯]/;
const ARABIC_SCRIPT = /[؀-ۿ]/;

// True when the text is written in the requested language and contains no stray script.
export function looksLike(language: AssessmentLanguage, text: string): boolean {
  if (STRAY_SCRIPTS.test(text)) return false;
  const letters = (text.match(/[A-Za-z؀-ۿ]/g) ?? []).length;
  if (letters === 0) return false;
  const arabic = (text.match(ARABIC_LETTERS) ?? []).length;
  if (language === "ar") return arabic / letters > 0.6;
  return !ARABIC_SCRIPT.test(text);
}

// ---------------------------------------------------------------------------------------------------------------
// 1. Questions

export async function generateQuestions(input: {
  definition: DefinitionText;
  style: ItemStyle;
  requiredBand: number;
  roleTitle: string;
  language: AssessmentLanguage;
  count: number;
}): Promise<{ prompts: string[]; usage: Usage }> {
  const levels = Object.entries(input.definition.levels)
    .filter(([, text]) => text.trim())
    .map(([level, text]) => `Level ${level}: ${text}`)
    .join("\n");
  const system =
    `LANGUAGE: Write every question in ${input.language === "ar" ? "Modern Standard Arabic (Fusha)" : "English"}. ` +
    "You write assessment questions for one workplace competency. Each question must be answerable in writing in 40 to 120 words, " +
    "specific to the role, concrete rather than abstract, and open: it should let a person show how well they do the work, not just recall facts. " +
    "Never mention levels, scores or the descriptions. Do not ask about salary or personal matters. Make the questions different from each other.";
  const user =
    `COMPETENCY: ${input.definition.name}\nDESCRIPTION: ${input.definition.description || "(none)"}\n` +
    (levels ? `LEVEL DESCRIPTIONS:\n${levels}\n` : "") +
    `ROLE: ${input.roleTitle || "(unspecified)"}\nTARGET LEVEL FOR THIS ROLE: ${input.requiredBand} of 5\n` +
    `QUESTION STYLE: ${STYLE_BRIEF[input.style]}.\nWrite exactly ${input.count} question${input.count === 1 ? "" : "s"}.`;

  const schema = {
    type: "object" as const,
    properties: { questions: { type: "array", items: { type: "string" } } },
    required: ["questions"],
  };
  // The questions are checked before they are saved. If a draft fails (wrong count, wrong language, a stray word in
  // another script, a duplicate), try again; only give up after three drafts.
  let usage: Usage = { model: QUESTION_MODEL, inputTokens: 0, outputTokens: 0 };
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, model, inputTokens, outputTokens } = await callOpenRouterJson<{ questions: string[] }>({
      model: QUESTION_MODEL,
      maxTokens: 900,
      system,
      user,
      jsonSchema: { name: "record_assessment_questions", schema },
    });
    usage = { model, inputTokens: usage.inputTokens + inputTokens, outputTokens: usage.outputTokens + outputTokens };
    const prompts = (data.questions ?? []).map((q) => String(q).trim());
    if (
      prompts.length === input.count &&
      prompts.every((q) => q.length >= 10 && q.length <= 1500) &&
      prompts.every((q) => looksLike(input.language, q)) &&
      new Set(prompts.map((q) => q.toLowerCase())).size === prompts.length
    ) {
      return { prompts, usage };
    }
  }
  throw new Error("The model did not return questions that pass the checks");
}

// ---------------------------------------------------------------------------------------------------------------
// 2. Judging

const JUDGE_TOOL = {
  name: "record_judgements",
  description: "Record, for each answered item, how far the answer shows each of the five level descriptions.",
  input_schema: {
    type: "object" as const,
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            item: { type: "integer", description: "1-based item number" },
            insufficient: { type: "boolean", description: "true if the answer is empty, off-topic, or too thin or vague to judge at all" },
            levels: {
              type: "array",
              description: "Exactly five entries, levels 1 to 5 in order",
              items: {
                type: "object",
                properties: {
                  level: { type: "integer", minimum: 1, maximum: 5 },
                  shown: { type: "integer", enum: [0, 1, 2], description: "0 not shown, 1 partly shown, 2 clearly shown" },
                  quote: { type: "string", description: "A short quote copied word for word from the ANSWER. Empty string when shown is 0." },
                },
                required: ["level", "shown", "quote"],
              },
            },
          },
          required: ["item", "insufficient", "levels"],
        },
      },
    },
    required: ["items"],
  },
};

function judgeSystem(language: AssessmentLanguage): string {
  return (
    "You are a careful assessor of workplace competencies. You judge written answers against the level descriptions of ONE competency. " +
    "For each answer and each of the five levels, decide how far the answer shows what that level describes: 0 = not shown, 1 = partly shown, 2 = clearly shown. " +
    "Rules: judge only evidence actually present in the answer. Ignore fluency, length, confidence and buzzwords: an answer full of jargon but with no concrete action, reasoning or example shows nothing. " +
    "A level counts as shown if the answer demonstrates it directly, or demonstrates a higher level that clearly includes it. Do not credit things the person did not say. " +
    "For every judgement above 0 give a short quote copied word for word from the ANSWER text (in its original language). Never quote the question or the level descriptions; if you cannot find words in the answer that show it, the judgement is 0. " +
    "Mark an answer insufficient if it is empty, off-topic, or too vague to judge. " +
    `The answers are in ${language === "ar" ? "Arabic" : "English"}. Do not give an overall score.`
  );
}

type JudgeOnce = { items: ItemJudgement[]; quotes: EvidenceQuote[]; usage: Usage; quotesChecked: number; quotesRejected: number };

async function judgeOnce(input: {
  definition: DefinitionText;
  type: string;
  roleTitle: string;
  language: AssessmentLanguage;
  questions: string[];
  answers: string[]; // only the answered items, in order
}): Promise<JudgeOnce | null> {
  const levelLines = [1, 2, 3, 4, 5].map((l) => `Level ${l}: ${input.definition.levels[String(l)] || "(no description given)"}`).join("\n");
  const body = input.answers.map((a, i) => `Item ${i + 1}\nQuestion: ${input.questions[i]}\nAnswer: ${a}`).join("\n\n");
  const user = `Competency: ${input.definition.name} (${input.type})\nDescription: ${input.definition.description}\nRole: ${input.roleTitle}\n\nLevel descriptions:\n${levelLines}\n\n${body}`;

  const usage: Usage = { model: JUDGE_MODEL, inputTokens: 0, outputTokens: 0 };
  // One retry if the output is structurally invalid. A bad quote never fails the competency (see validateJudgements).
  for (let attempt = 0; attempt < 2; attempt++) {
    let raw: unknown;
    try {
      const response = await anthropic.messages.create({
        model: JUDGE_MODEL,
        max_tokens: 3500,
        system: judgeSystem(input.language),
        tools: [JUDGE_TOOL],
        tool_choice: { type: "tool", name: JUDGE_TOOL.name },
        messages: [{ role: "user", content: user }],
      });
      usage.model = response.model;
      usage.inputTokens += response.usage.input_tokens;
      usage.outputTokens += response.usage.output_tokens;
      const block = response.content.find((b) => b.type === "tool_use");
      raw = block && block.type === "tool_use" ? (block.input as { items?: unknown }).items : null;
    } catch (err) {
      console.error("judgeOnce call failed:", err);
      continue;
    }
    const v = validateJudgements(raw, input.answers);
    if (v.ok) return { items: v.items, quotes: v.quotes, usage, quotesChecked: v.quotesChecked, quotesRejected: v.quotesRejected };
  }
  return null;
}

export type CompetencyScoring = {
  result: CompetencyResult | { status: "scoring_failed" };
  confidence: Confidence | null;
  confidenceReasons: string[];
  quotes: EvidenceQuote[];
  rationale: string | null;
  nextLevelGap: string | null;
  judgements: number;
  usages: Usage[];
};

// Scores one competency from the person's written answers: two independent judgements, averaged, then the fixed rule.
// `questions` and `answers` are parallel (one entry per item the person was given; an unanswered item is "").
export async function scoreCompetency(input: {
  definition: DefinitionText;
  type: string;
  roleTitle: string;
  language: AssessmentLanguage;
  questions: string[];
  answers: string[];
  judgements?: number;
}): Promise<CompetencyScoring> {
  const judgementsWanted = input.judgements ?? 2;
  const answeredIdx = input.answers.map((a, i) => (isAnswered(a) ? i : -1)).filter((i) => i >= 0);
  const base = { quotes: [] as EvidenceQuote[], rationale: null, nextLevelGap: null, judgements: judgementsWanted, usages: [] as Usage[] };
  if (answeredIdx.length < SCORING_RULE.minAnswered) {
    return { ...base, result: resultFromEvidence(null, "too_few_answers"), confidence: null, confidenceReasons: ["too_few_answers"] };
  }

  const questions = answeredIdx.map((i) => input.questions[i]);
  const answers = answeredIdx.map((i) => input.answers[i]);
  const runs = await Promise.all(Array.from({ length: judgementsWanted }, () => judgeOnce({ definition: input.definition, type: input.type, roleTitle: input.roleTitle, language: input.language, questions, answers })));
  const usages = runs.flatMap((r) => (r ? [r.usage] : []));
  if (runs.some((r) => r === null)) {
    // A judgement that could not be read means no score at all, never a partial one.
    return { ...base, usages, result: { status: "scoring_failed" }, confidence: null, confidenceReasons: ["scoring_failed"] };
  }
  const ok = runs as JudgeOnce[];
  const evidence = combineEvidence(ok.map((r) => averageEvidence(r.items)));
  const result = resultFromEvidence(evidence, "insufficient_evidence");

  // Per-item levels (judgements averaged) feed the confidence.
  const perItemLevels = answers.map((_, i) => {
    const shown = [0, 1, 2, 3, 4].map((l) => ok.reduce((sum, r) => sum + r.items[i].shown[l], 0) / ok.length);
    const r = resultFromEvidence(shown);
    return r.status === "scored" ? r.level : null;
  });
  const avgWords = answers.reduce((sum, a) => sum + wordCount(a), 0) / answers.length;
  const conf = confidenceFor({ answered: answeredIdx.length, total: input.answers.length, perItemLevels, avgWords });
  const reasons: string[] = [];
  if (answeredIdx.length < input.answers.length) reasons.push("some_items_unanswered");
  if (conf.spread > 1) reasons.push("items_differ");
  if (avgWords < 40) reasons.push("short_answers");
  const rejected = ok.reduce((sum, r) => sum + r.quotesRejected, 0);
  if (rejected > 0) reasons.push("some_evidence_not_verified");

  // Evidence quotes: keep each verified quote once, mapped back to the item the person actually answered.
  const seen = new Set<string>();
  const quotes: EvidenceQuote[] = [];
  for (const r of ok) {
    for (const q of r.quotes) {
      const key = `${q.item}|${q.level}|${q.quote}`;
      if (seen.has(key)) continue;
      seen.add(key);
      quotes.push({ ...q, item: answeredIdx[q.item - 1] + 1 });
    }
  }

  let rationale: string | null = null;
  let nextLevelGap: string | null = null;
  if (result.status === "scored") {
    const top = quotes.filter((q) => q.level === result.level).sort((a, b) => b.shown - a.shown).slice(0, 2);
    rationale = top.length ? top.map((q) => `"${q.quote}"`).join("  ·  ") : null;
    nextLevelGap = nextLevelText(input.definition.levels, result.level);
  }
  return { result, confidence: result.status === "scored" ? conf.label : null, confidenceReasons: reasons, quotes, rationale, nextLevelGap, judgements: judgementsWanted, usages };
}
