export type BlogSection = {
  heading?: string;
  paragraphs: string[];
};

export type BlogPost = {
  slug: string;
  title: string;
  category: "Career Development" | "Leadership" | "AI & Careers";
  excerpt: string;
  publishedDate: string; // ISO date
  readMinutes: number;
  sections: BlogSection[];
};

// Editorial/content-marketing posts — not user-generated, not tied to any
// database table. Static catalog (same pattern as lib/assessments/catalog.ts)
// since this is fixed marketing content, not something that needs a CMS or
// per-post editing UI yet.
export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "just-work-hard-isnt-a-career-strategy",
    title: "Why \"Just Work Hard\" Isn't a Career Strategy",
    category: "Career Development",
    excerpt:
      "Effort without a target is just motion. Here's what a real development plan looks like, and why most people never build one.",
    publishedDate: "2026-01-12",
    readMinutes: 6,
    sections: [
      {
        paragraphs: [
          "Ask most people how they plan to get promoted and you'll hear some version of \"I'll just keep doing good work.\" It's a reasonable instinct — and a weak strategy. Good work is necessary. It's rarely sufficient, because it doesn't tell you which of your skills are already strong enough, which ones are quietly holding you back, and which ones the next role actually requires that your current one never touched.",
          "A career strategy needs three things a work ethic alone can't supply: a target (the specific role or level you're aiming at), a baseline (an honest read of where your competencies stand today), and a gap (the measurable distance between the two). Without all three, \"working hard\" just means doing more of what you already know how to do.",
        ],
      },
      {
        heading: "What a gap actually looks like",
        paragraphs: [
          "Most competency gaps aren't dramatic. They're not \"this person can't lead a meeting.\" They're more like: strong on execution and technical depth, thinner on stakeholder communication and strategic framing — the exact profile of someone who's excellent at the job they have and unproven at the job they want. That's an ordinary, fixable gap. It's just invisible if nobody ever measures it.",
          "This is the core idea behind Devometrics' gap analysis: take your actual background and a real target job description, and produce a structured read of where the two diverge — not a vague \"areas for growth\" bullet point, but specific competency dimensions with specific levels attached.",
        ],
      },
      {
        heading: "From gap to plan",
        paragraphs: [
          "Once the gap is visible, the plan almost writes itself: which two or three dimensions matter most for the target role, what would move each one up a level, and roughly how long that takes. That's a development plan. It's ordered, it's measurable, and it's finished when the gap closes — which is a very different feeling from an open-ended \"keep working hard and see what happens.\"",
          "The uncomfortable truth is that most people delay this kind of clarity because getting an honest read on their own gaps is uncomfortable. But a plan built on an honest baseline beats a plan built on hope every time — because only one of them tells you when you're actually done.",
        ],
      },
    ],
  },
  {
    slug: "the-skills-gap-nobody-talks-about",
    title: "The Skills Gap Nobody Talks About",
    category: "Career Development",
    excerpt:
      "Not the labor-market skills gap you read about in the news — the personal one, between where you are and the role you actually want next.",
    publishedDate: "2026-01-19",
    readMinutes: 5,
    sections: [
      {
        paragraphs: [
          "\"Skills gap\" usually shows up in headlines about industries — not enough data engineers, too few skilled tradespeople. That gap is real, but it's not the one that actually determines whether you get your next promotion. The gap that matters to you personally is much narrower and much more specific: the distance between your current competency profile and the profile the role you want actually requires.",
          "This personal gap rarely gets named because naming it requires two things people avoid: a genuinely honest self-assessment, and a genuinely specific target. It's much easier to say \"I want to grow\" than to say \"I am a level 2 on strategic thinking and the role I want needs a level 4.\"",
        ],
      },
      {
        heading: "Why vague targets produce vague gaps",
        paragraphs: [
          "If your target is \"senior\" or \"more strategic,\" your gap analysis will be equally vague, and vague gaps don't produce plans — they produce good intentions. The fix isn't motivation, it's specificity: a real job description, a real set of competency dimensions, and an honest rating on each one.",
          "This is exactly why role-specific gap analysis (rather than generic \"career advice\") is the starting point of any Devometrics plan — the target has to be concrete before the gap means anything.",
        ],
      },
      {
        heading: "Closing it is more mundane than it sounds",
        paragraphs: [
          "Once the gap is specific, closing it is usually less dramatic than people expect — a handful of milestones, spread over a realistic timeline, aimed at two or three dimensions rather than everything at once. The skills gap nobody talks about isn't unsolvable. It's just invisible until someone measures it honestly.",
        ],
      },
    ],
  },
  {
    slug: "read-a-job-description-like-a-strategist",
    title: "How to Read a Job Description Like a Strategist, Not a Job Seeker",
    category: "Career Development",
    excerpt:
      "A job description is a competency map in disguise. Most people skim it for keywords. Here's how to actually read one.",
    publishedDate: "2026-01-26",
    readMinutes: 5,
    sections: [
      {
        paragraphs: [
          "Most people read a job description the way they read terms and conditions: fast, looking for the parts that matter to them (salary band, title, maybe the first bullet or two), and skip the rest. That's a job-seeker read. A strategist's read is slower and more useful — it treats the posting as a document written by someone trying to describe a competency profile in plain English, and tries to reverse-engineer that profile.",
        ],
      },
      {
        heading: "Separate the role from the wish list",
        paragraphs: [
          "Every posting mixes two things: what the role actually requires day to day, and what the hiring manager would love to have but will compromise on. \"5+ years\" is often negotiable. \"Experience presenting to executive stakeholders\" usually isn't, because it points at a specific competency (communication, or executive presence) the role structurally needs. Learning to tell these apart is most of the skill.",
          "A useful heuristic: requirements described in terms of outcomes or interactions (\"partners with product and design to define roadmap\") point at real competency needs. Requirements described in terms of checkboxes (\"familiarity with Jira\") are usually softer.",
        ],
      },
      {
        heading: "Turn the posting into a target",
        paragraphs: [
          "Once you've separated signal from wish list, you have something you can actually compare yourself against — a short list of competencies the role genuinely requires, each with an implied level. That's the input a real gap analysis needs, and it's why Devometrics asks for the actual job description rather than a job title: \"Senior Product Manager\" means something different at every company, but the posting itself usually tells you exactly what this one means.",
        ],
      },
    ],
  },
  {
    slug: "career-plateaus-are-a-data-problem",
    title: "Career Plateaus Are a Data Problem, Not a Motivation Problem",
    category: "Career Development",
    excerpt:
      "Feeling stuck rarely means you've stopped trying. More often it means you've stopped being able to see what's actually missing.",
    publishedDate: "2026-02-02",
    readMinutes: 5,
    sections: [
      {
        paragraphs: [
          "The standard advice for a career plateau is some version of \"push harder\" or \"be patient.\" Both assume the problem is willpower or timing. Often it's neither — it's that the person genuinely cannot see, from the inside, which specific gap is holding them back. Nobody plateaus on purpose. They plateau because the next step stopped being obvious.",
        ],
      },
      {
        heading: "Why the view from the inside is unreliable",
        paragraphs: [
          "You are, structurally, the worst-positioned person to evaluate your own competency gaps — not because you lack insight, but because you lack a comparison point. You know your own effort intimately and your own output only partially, and you have no clean way to compare either against what a specific target role actually requires. That's not a character flaw, it's a visibility problem.",
          "This is where external, structured measurement earns its keep — not to replace judgment, but to supply the comparison point that judgment alone can't generate. A competency framework mapped against a real target role gives you something to plateau against that isn't just vibes.",
        ],
      },
      {
        heading: "The plateau usually has a name",
        paragraphs: [
          "Once measured, most plateaus turn out to have a fairly boring, specific name: underdeveloped strategic thinking, thin stakeholder management, a leadership dimension that's never been tested because the person has never had direct reports. None of these are motivation problems. All of them are solvable once named — which is the entire point of running a gap analysis before assuming the problem is you.",
        ],
      },
    ],
  },
  {
    slug: "measure-your-career-health-like-fitness",
    title: "The Case for Measuring Your Career Health Like You'd Measure Your Fitness",
    category: "Career Development",
    excerpt:
      "Nobody expects to get fitter without tracking anything. Careers deserve the same discipline — and the same single number to check on.",
    publishedDate: "2026-02-09",
    readMinutes: 4,
    sections: [
      {
        paragraphs: [
          "Fitness culture normalized something career development never did: a simple number you check periodically to know if you're actually improving, not just staying busy. Resting heart rate, a 5K time, a weight trend line — none of these are the whole picture, but each gives you a fast, honest signal about direction. Careers rarely get the same treatment. People track title changes and salary, which are lagging indicators, not leading ones.",
        ],
      },
      {
        heading: "What a leading indicator would even look like",
        paragraphs: [
          "A useful career metric needs to move before the title does, not after — otherwise it's just a scoreboard, not a gauge. That means it has to be built from something more granular than \"how's work going\": actual competency levels across the dimensions that matter for where you're headed, assessment results, and progress against a specific development plan, all combined into one number that goes up when you're actually closing gaps and stalls when you're not.",
          "That's the reasoning behind Devometrics' Career Health Score — not a mood ring, and not a replacement for judgment, but a single number built from your real gap analysis and plan progress that you can check the way you'd check a resting heart rate: not obsessively, just often enough to notice a trend before it becomes a surprise.",
        ],
      },
      {
        heading: "The point isn't the number",
        paragraphs: [
          "Any single metric can be gamed or misread, careers included. The value isn't the digit itself — it's the habit of checking something concrete on a regular cadence, instead of only taking stock of your career once a year during a performance review, when it's too late to do much about what you find.",
        ],
      },
    ],
  },
  {
    slug: "leadership-skills-that-dont-show-up-on-a-resume",
    title: "The Leadership Skills That Don't Show Up on a Resume",
    category: "Leadership",
    excerpt:
      "Titles and bullet points describe what you did. Promotion decisions are made on something quieter and much harder to fake.",
    publishedDate: "2026-02-16",
    readMinutes: 6,
    sections: [
      {
        paragraphs: [
          "A resume is a list of outcomes: shipped this, grew that, managed a team of five. It's very good at describing what happened and almost useless at describing how someone thinks — which is usually what actually gets weighed in a promotion decision, especially once you're being considered for something above individual-contributor level.",
        ],
      },
      {
        heading: "The dimensions that quietly decide the room",
        paragraphs: [
          "Strategic thinking, people management, and change management rarely appear as resume bullets, because they don't produce a clean artifact the way \"launched a feature\" does. But they're exactly what a promotion committee is trying to assess when they ask \"is this person ready.\" Someone can have an outstanding execution record and still get passed over, not because the work wasn't good, but because nobody has evidence they can do the parts of the job that don't leave a paper trail.",
          "This is precisely why competency frameworks separate execution-oriented dimensions (critical thinking, technical depth) from leadership-oriented ones (people management, strategic thinking, change management) — they get built, evidenced, and evaluated differently, and conflating them is how strong individual contributors get stuck waiting for a promotion that never quite arrives.",
        ],
      },
      {
        heading: "You can't shortcut evidence, but you can create it",
        paragraphs: [
          "The fix isn't a better resume format — it's deliberately creating situations where these quieter competencies become visible: leading a cross-functional initiative, managing a conflict instead of avoiding it, making a case for a strategic bet and owning the outcome. A development plan that only targets resume-friendly wins will always underweight the leadership skills that actually decide the room.",
        ],
      },
    ],
  },
  {
    slug: "managing-up-down-and-sideways",
    title: "Managing Up, Down, and Sideways: The Competency Nobody Trains You For",
    category: "Leadership",
    excerpt:
      "Most leadership training focuses on managing a team. The harder, less-discussed skill is managing everyone who isn't your direct report.",
    publishedDate: "2026-02-23",
    readMinutes: 5,
    sections: [
      {
        paragraphs: [
          "Ask a new manager what leadership training they got, and they'll usually describe something about managing direct reports: one-on-ones, feedback, delegation. Almost nobody gets explicit training on the other two-thirds of the job — managing up to their own boss, and managing sideways across peers and other functions who owe them nothing and report to someone else entirely.",
        ],
      },
      {
        heading: "Why sideways is the hardest direction",
        paragraphs: [
          "Managing down works because there's formal authority backing it up, however lightly used. Managing up works because there's usually a shared incentive (your manager wants you to succeed). Managing sideways has neither — you're trying to align someone who has their own priorities, their own manager, and no obligation to defer to you, purely through communication and stakeholder management skill. It's the least-supported direction and often the one that determines whether a cross-functional initiative actually ships.",
        ],
      },
      {
        heading: "Treat it as a named competency",
        paragraphs: [
          "The fix starts with naming it: stakeholder management and communication aren't soft add-ons to \"real\" leadership skills, they're the specific competency that makes managing sideways possible at all. Once it's named, it can be assessed and developed the same way any other competency dimension can — with a specific target level, specific evidence, and a specific plan, rather than left as an unspoken expectation nobody ever explicitly develops.",
        ],
      },
    ],
  },
  {
    slug: "leadership-potential-assessments-measure-wrong-thing",
    title: "Why Most \"Leadership Potential\" Assessments Measure the Wrong Thing",
    category: "Leadership",
    excerpt:
      "Confidence, charisma, and executive presence are easy to spot and weakly correlated with whether someone can actually run a team.",
    publishedDate: "2026-03-02",
    readMinutes: 6,
    sections: [
      {
        paragraphs: [
          "Informal leadership potential assessments — the kind that happen in a hallway conversation after someone gives a confident presentation — tend to measure presence: does this person command a room, do they sound decisive, do they seem comfortable with authority. These traits are visible in five minutes and only loosely related to whether someone can manage people well, think strategically under ambiguity, or navigate organizational change without breaking things.",
        ],
      },
      {
        heading: "Presence is not the same as competency",
        paragraphs: [
          "Plenty of quietly excellent leaders are not the most commanding presence in the room, and plenty of confident presenters struggle the moment they have to manage a genuinely difficult personnel situation or make an unpopular strategic call. Presence is easy to observe and hard to fake convincingly for long — but it's a proxy, not the thing itself, and proxies mislead exactly when the stakes are highest.",
        ],
      },
      {
        heading: "What a structured framework does differently",
        paragraphs: [
          "A real competency framework separates leadership into distinct, individually assessable dimensions — leadership, people management, strategic thinking, change management — rather than one fuzzy \"potential\" impression. That doesn't remove judgment from the process, but it does force the judgment to attach to something specific and checkable, instead of resting entirely on how someone came across in a single meeting.",
          "This is also why executive-level assessments increasingly need to test culture and change management explicitly, not just infer them from general seniority — the skills that make someone a credible executive are distinct enough from general leadership presence that they deserve their own measurement.",
        ],
      },
    ],
  },
  {
    slug: "individual-contributor-to-manager-competency-shift",
    title: "From Individual Contributor to Manager: The Competency Shift Nobody Warns You About",
    category: "Leadership",
    excerpt:
      "The skills that got you promoted into management are frequently not the skills the new job actually needs.",
    publishedDate: "2026-03-09",
    readMinutes: 6,
    sections: [
      {
        paragraphs: [
          "The most common trap in a first management promotion is straightforward and almost universal: you get promoted because you were excellent at the individual contributor work, and then you keep doing individual contributor work — just with a bigger title and a team you're not quite managing. The competencies that earned the promotion (technical depth, execution, critical thinking) are not the ones the new role actually needs day to day.",
        ],
      },
      {
        heading: "The dimensions that suddenly matter",
        paragraphs: [
          "People management and communication go from optional to load-bearing overnight. So does a baseline level of strategic thinking, because a manager is now responsible for connecting their team's work to something larger than the immediate task. None of this is intuitive from the individual contributor seat, which is exactly why so many new managers default back to doing the work themselves — it's the competency profile they know they're good at.",
        ],
      },
      {
        heading: "Plan for the shift, don't wait to discover it",
        paragraphs: [
          "The useful move is treating the individual-contributor-to-manager transition as its own gap analysis, run before the promotion lands rather than six frustrating months after: which dimensions does the new role actually weight, where does the current profile fall short, and what's the plan to close that specific, predictable gap. It's a well-known transition with a well-known failure mode — there's no reason to walk into it unprepared.",
        ],
      },
    ],
  },
  {
    slug: "strategic-thinking-is-a-skill-not-a-trait",
    title: "Strategic Thinking Is a Skill, Not a Personality Trait",
    category: "Leadership",
    excerpt:
      "\"Some people just think strategically\" is a comforting myth for anyone who hasn't tried to build the skill deliberately.",
    publishedDate: "2026-03-16",
    readMinutes: 5,
    sections: [
      {
        paragraphs: [
          "Strategic thinking gets talked about like an innate trait — you either have the \"big picture mind\" or you don't. That framing is convenient and mostly wrong. Strategic thinking is a learnable, gradable competency, the same as writing or public speaking: it improves with deliberate practice, it can be assessed at a specific level, and it responds to the same close-the-gap approach as any other skill.",
        ],
      },
      {
        heading: "What the skill actually consists of",
        paragraphs: [
          "Underneath the vague label are specific, practicable sub-skills: connecting a decision to its second-order consequences, prioritizing under genuine resource constraints, and distinguishing a symptom from the underlying cause. Each of these can be practiced individually — through case-study style exercises, through structured decision reviews, through simply asking \"and then what happens\" one level deeper than feels natural.",
        ],
      },
      {
        heading: "Practice beats waiting to be born with it",
        paragraphs: [
          "This is the logic behind timed, scenario-based case-study exercises as a development tool: they force the specific sub-skills of strategic thinking into the open under realistic constraints, in a setting where getting it wrong costs nothing except a lower score on a practice exercise — rather than a real strategic call made for the first time in a real high-stakes meeting.",
        ],
      },
    ],
  },
  {
    slug: "how-ai-coaching-is-changing-professional-development",
    title: "How AI Coaching Is Changing What \"Professional Development\" Means",
    category: "AI & Careers",
    excerpt:
      "Executive coaching used to be scarce and expensive. AI didn't replace the value of coaching — it changed who can access it and how often.",
    publishedDate: "2026-03-23",
    readMinutes: 6,
    sections: [
      {
        paragraphs: [
          "For decades, real coaching — the kind where someone asks you pointed follow-up questions about a real decision you're facing, rather than handing you a generic framework — was reserved for people senior enough to have a budget for it. Everyone else got a book, a course, or a well-meaning but generic mentor conversation once a quarter if they were lucky.",
        ],
      },
      {
        heading: "What changes when coaching is always available",
        paragraphs: [
          "An AI coach doesn't replace a great human coach's judgment or relationship history, but it does remove the two biggest barriers to using coaching at all: cost and availability. A quick, structured coaching conversation about a real situation — a tricky manager conversation coming up tomorrow, a plan that's stalled, a milestone that keeps slipping — becomes something you can have the same day you need it, not something you save up for a quarterly session.",
          "That changes the cadence of development from occasional and reactive to continuous and proactive — closer to how the best-coached executives already operate, just without the six-figure retainer.",
        ],
      },
      {
        heading: "Memory is what makes it more than a chatbot",
        paragraphs: [
          "The meaningful difference between a coaching conversation and a generic chatbot exchange is continuity — a coach who remembers your last session, your stated goals, and your actual plan progress gives fundamentally different advice than one starting from zero every time. That's the design goal behind persistent coaching memory: the conversation should build on the last one, the same way a real coaching relationship does.",
        ],
      },
    ],
  },
  {
    slug: "practicing-hard-conversations-with-ai-roleplay",
    title: "Practicing Hard Conversations Before They Happen",
    category: "AI & Careers",
    excerpt:
      "The case for rehearsing a difficult conversation with an AI roleplay partner before you have it with an actual human who can fire you.",
    publishedDate: "2026-03-30",
    readMinutes: 5,
    sections: [
      {
        paragraphs: [
          "Every career eventually requires a conversation you'd rather not have: asking for a raise, pushing back on a manager, delivering difficult feedback, negotiating an offer. The advice for all of them is usually the same — \"practice it out loud beforehand\" — and almost nobody actually does, because the only available practice partner is either unavailable, awkward to ask, or the exact wrong audience (rehearsing your resignation conversation with a friend who works at the same company, for instance).",
        ],
      },
      {
        heading: "Why the rehearsal matters more than the script",
        paragraphs: [
          "A written script tells you what to say. It doesn't tell you what to do when the other person doesn't follow the script — when your manager pushes back harder than expected, or the interviewer asks the one question you hoped they wouldn't. That's the part rehearsal actually trains: staying composed and adaptive when the conversation doesn't go the way you planned, which is exactly the situation the real one will eventually produce.",
        ],
      },
      {
        heading: "A low-stakes partner that's always available",
        paragraphs: [
          "An AI roleplay partner can't replicate the full weight of the real conversation, and it shouldn't try to claim it's a validated clinical or psychometric tool — it's a low-stakes rehearsal space, not a certified assessment. What it can do is be available at 11pm the night before the real conversation, adapt when you go off-script, and let you run the same scenario three times until the words stop feeling foreign in your mouth. That's a meaningfully lower bar to clear than \"find a willing human at short notice,\" which is why most people who'd benefit from rehearsal never do it.",
        ],
      },
    ],
  },
  {
    slug: "what-ai-can-and-cant-tell-you-about-your-career",
    title: "What AI Can (and Can't) Tell You About Your Career",
    category: "AI & Careers",
    excerpt:
      "A useful, unhyped accounting of where AI genuinely helps with career decisions — and where it should stay out of the way.",
    publishedDate: "2026-04-06",
    readMinutes: 6,
    sections: [
      {
        paragraphs: [
          "It's easy to oversell what AI does for a career, and easy to dismiss it entirely in reaction to the overselling. Neither reaction is very useful. The honest answer is narrower and more useful than either extreme: AI is genuinely good at some specific parts of career development, and it's the wrong tool — sometimes actively risky — for others.",
        ],
      },
      {
        heading: "Where it genuinely helps",
        paragraphs: [
          "Structured comparison is a strength: reading a CV against a real job description and surfacing specific competency gaps is exactly the kind of pattern-matching-at-scale task AI is well suited to, done consistently and without the fatigue or bias that creeps into a tired hiring manager's fifth read of the day. Rehearsal is another: a roleplay partner that can run the same difficult conversation multiple times, patiently, without judgment, is something no human practice partner will do for free.",
          "Drafting and structuring is a third: turning a rough plan into organized milestones, or a messy set of notes into a clear action plan after a coaching session, is tedious for a human and fast for a model.",
        ],
      },
      {
        heading: "Where it should stay out of the way",
        paragraphs: [
          "AI should not be the final word on whether you're \"leadership material,\" whether you should take a specific job offer, or how to interpret a deeply personal career decision involving family, location, or values — those decisions need human judgment, context AI doesn't have, and often a human relationship with actual stakes in the outcome. The honest framing is that AI is a very good research assistant and rehearsal partner for your career, and a poor substitute for your own judgment or a trusted human mentor's.",
        ],
      },
    ],
  },
  {
    slug: "honest-case-for-ai-interview-prep",
    title: "The Honest Case for Using AI to Prep for Your Next Interview",
    category: "AI & Careers",
    excerpt:
      "Not \"AI will get you the job.\" A narrower, more defensible claim: repetition under realistic pressure is what interview prep actually needs.",
    publishedDate: "2026-04-13",
    readMinutes: 5,
    sections: [
      {
        paragraphs: [
          "Interview performance correlates more with repetition than with raw talent — the fifth time you've been asked \"tell me about a conflict with a coworker\" you answer better than the first, not because you got smarter, but because you got less nervous and more concise. The problem is that most people only get that repetition live, in real interviews, which is an expensive and stressful way to practice.",
        ],
      },
      {
        heading: "What practice needs to look like to help",
        paragraphs: [
          "Reading a list of common interview questions doesn't produce the same effect as actually answering them out loud, under a bit of time pressure, to something that responds and follows up. The value is in the retrieval and the improvisation, not in having read the \"correct\" answer somewhere — which is why a roleplay-style practice interview, where you speak your actual answer and get a real follow-up question, trains something a question bank never will.",
        ],
      },
      {
        heading: "The honest limits",
        paragraphs: [
          "This kind of practice will not replicate the specific pressure of a real hiring panel, and any tool that claims it can predict your odds of getting an offer should be treated with real skepticism. What it reasonably can do is make your third or fourth real interview feel like your fifteenth — smoother answers, less panic on the follow-up question, more of your attention available for actually connecting with the interviewer instead of scrambling for words.",
        ],
      },
    ],
  },
  {
    slug: "personality-competency-and-ai-real-data-for-careers",
    title: "Personality, Competency, and AI: Why Career Development Finally Has Real Data Behind It",
    category: "AI & Careers",
    excerpt:
      "For most of career history, development advice was generic because measuring the individual was too expensive. That constraint is gone.",
    publishedDate: "2026-04-20",
    readMinutes: 6,
    sections: [
      {
        paragraphs: [
          "Career advice has historically been generic for a boring, practical reason: individually assessing someone's competencies, personality traits, and specific gaps against a specific role used to require an expensive assessment center, a trained psychologist, or a corporate talent-management budget most people never had access to. Everyone else got books written for the average reader, because the average reader was the only audience anyone could economically serve.",
        ],
      },
      {
        heading: "What changes when individual measurement is cheap",
        paragraphs: [
          "A structured personality assessment (built on well-established frameworks like the Big Five) combined with a competency gap analysis against a real target role gives a genuinely individual picture — not \"advice for ambitious professionals\" in general, but a specific read on this person's specific strengths, gaps, and likely friction points. That combination used to be exclusively available through expensive corporate assessment centers. Doing it cheaply, quickly, and on demand is a real, material change, not a marketing claim.",
        ],
      },
      {
        heading: "Data narrows the advice, it doesn't replace the person",
        paragraphs: [
          "None of this replaces judgment, self-reflection, or a good mentor — it narrows the starting point so the judgment has something concrete to work with, instead of starting from a blank page every time. That's a meaningfully different, and meaningfully more useful, starting position than the generic career advice most people have had to make do with until now.",
        ],
      },
    ],
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}
