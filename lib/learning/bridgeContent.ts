// "Bridge the gap" — curated content generated from a person's actual
// measured Gap Analysis score for one dimension, not pulled from a fixed
// course catalog. This is the direct answer to the #1 complaint about
// generic learning platforms (28% of employees say training doesn't match
// their real job needs — Content-Relevance Gap, 2026 L&D research): every
// piece of content here is generated for THIS person's THIS gap, not
// browsed from a shared library.

export type KnowledgeCheckQuestion = {
  question: string;
  options: string[];
  correctIndex: number;
};

export type ExternalResource = {
  title: string;
  url: string;
  source: string;
  description: string;
};

export type BridgeContent = {
  // A hypothesis, not a diagnosis — the #1 mistake in corporate L&D per
  // 2026 research is treating every gap as a knowledge problem solvable by
  // "assign a course," when it might really be a motivation or systemic
  // issue that content alone can't fix.
  diagnosticNote: string;
  // Exactly one clear next step, not a list — the second-most-cited
  // complaint about learning platforms is decision paralysis from too much
  // choice.
  recommendedActivity: string;
  microLesson: {
    title: string;
    body: string;
    knowledgeCheck: KnowledgeCheckQuestion[];
  };
  reflectionQuestion: string;
  // Real, web-search-verified resources only — never fabricated. See
  // generateBridgeContent's two-call design: a web_search-only call
  // gathers real links first, then a second structured call is instructed
  // to only ever echo/reformat those, never invent additional ones.
  externalResources: ExternalResource[];
};
