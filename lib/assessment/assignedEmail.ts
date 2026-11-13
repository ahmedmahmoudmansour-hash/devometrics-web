// The email a person gets when someone assigns them an assessment: what it is, how long it takes, the rules, what happens to the
// result, and a button to open it. Built as a pure function (tested), sent best-effort: a failed email never undoes an assignment.
import { renderEmail, escapeHtml } from "@/lib/email/template";
import { sendEmail } from "@/lib/email/resend";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Lang = "en" | "ar";

export type AssignedEmailInput =
  | { kind: "check"; language: Lang; employeeName: string; orgName: string; assignerName: string; roleTitle: string; url: string; questionCount: number; minutes: number }
  | { kind: "role"; language: Lang; employeeName: string; orgName: string; assignerName: string; roleTitle: string; url: string; competencyCount: number; questionsPerCompetency: number; retentionMonths: number };

const e = escapeHtml;
const li = (text: string) => `<li style="margin:0 0 6px;">${text}</li>`;
const p = (html: string) => `<p style="font-size:15px;line-height:1.7;margin:0 0 14px;">${html}</p>`;
const h = (text: string) => `<p style="font-size:13px;font-weight:700;color:#16161a;margin:18px 0 6px;">${text}</p>`;

export function buildAssessmentAssignedEmail(i: AssignedEmailInput): { subject: string; preheader: string; footerNote: string; html: string } {
  const ar = i.language === "ar";
  const name = e(i.employeeName);
  const org = e(i.orgName);
  const by = e(i.assignerName);
  const role = e(i.roleTitle);
  const button = (label: string) =>
    `<p style="margin:22px 0 0;"><a href="${e(i.url)}" style="background:#3f7a67;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:8px;display:inline-block;">${e(label)}</a></p>`;
  const list = (items: string[]) => `<ul style="font-size:14px;line-height:1.65;margin:0 0 6px;padding-${ar ? "right" : "left"}:20px;">${items.map(li).join("")}</ul>`;

  let subject: string;
  let preheader: string;
  let footerNote: string;
  let body: string;

  if (i.kind === "check") {
    if (!ar) {
      subject = `${i.orgName}: a knowledge check has been assigned to you`;
      preheader = `${i.questionCount} questions, ${i.minutes} minutes, for your role as ${i.roleTitle}`;
      footerNote = "You're getting this because someone at your organization assigned you an assessment on Devometrics.";
      body =
        `<h2 style="color:#16161a;font-size:20px;margin:0 0 16px;">A knowledge check for you</h2>` +
        p(`Hello ${name},`) +
        p(`<strong>${by}</strong> at <strong>${org}</strong> has assigned you a knowledge check for your role, <strong>${role}</strong>.`) +
        h("What it is") +
        list([
          `Short right-or-wrong questions on the knowledge your role needs, each with one best answer.`,
          `<strong>${i.questionCount} questions</strong>, marked automatically as soon as you submit.`,
        ]) +
        h("Time and rules") +
        list([
          `<strong>${i.minutes} minutes in total.</strong> The clock starts the first time you open it, cannot be paused or restarted, and the check submits itself when time runs out. Unanswered questions count as wrong.`,
          `Work from your own knowledge. Leaving the page is recorded and shown to your manager.`,
          `Once you submit, your answers cannot be changed.`,
        ]) +
        h("What happens next") +
        list([
          `You see your score, a breakdown by competency, and the right answer with the reason for each question.`,
          `Your manager can see it too. It is a quick indication of where you are, not a verdict, and not a basis for a hiring or promotion decision.`,
        ]) +
        p(`<span style="color:#6b6a64;font-size:13px;">Tip: find a quiet ${Math.max(10, Math.ceil(i.minutes / 5) * 5 + 5)} minutes before you start.</span>`) +
        button("Open my knowledge check");
    } else {
      subject = `${i.orgName}: كُلِّفت باختبار معرفة`;
      preheader = `${i.questionCount} سؤالًا، ${i.minutes} دقائق، لدورك ${i.roleTitle}`;
      footerNote = "وصلتك هذه الرسالة لأن أحدًا في مؤسستك كلّفك بتقييم على Devometrics.";
      body =
        `<h2 style="color:#16161a;font-size:20px;margin:0 0 16px;">اختبار معرفة لك</h2>` +
        p(`مرحبًا ${name}،`) +
        p(`كلّفك <strong>${by}</strong> في <strong>${org}</strong> باختبار معرفة لدورك: <strong>${role}</strong>.`) +
        h("ما هو الاختبار") +
        list([`أسئلة قصيرة (صح وخطأ) عن المعرفة التي يتطلبها دورك، ولكل سؤال إجابة واحدة هي الأفضل.`, `<strong>${i.questionCount} سؤالًا</strong>، تُصحَّح تلقائيًا فور الإرسال.`]) +
        h("الوقت والقواعد") +
        list([
          `<strong>${i.minutes} دقائق في المجموع.</strong> يبدأ الوقت عند فتح الاختبار لأول مرة، ولا يمكن إيقافه أو إعادته، ويُرسَل الاختبار تلقائيًا عند انتهاء الوقت. الأسئلة بلا إجابة تُحتسب خطأً.`,
          `اعتمد على معرفتك. مغادرة الصفحة تُسجَّل وتظهر لمديرك.`,
          `بعد الإرسال لا يمكن تغيير إجاباتك.`,
        ]) +
        h("بعد ذلك") +
        list([
          `ترى نتيجتك وتفصيلها حسب الكفاءة، والإجابة الصحيحة مع سببها لكل سؤال.`,
          `يستطيع مديرك الاطلاع عليها أيضًا. هي مؤشر سريع لموقعك وليست حكمًا نهائيًا، ولا تُبنى عليها قرارات التوظيف أو الترقية.`,
        ]) +
        button("افتح اختبار المعرفة");
    }
  } else if (!ar) {
    subject = `${i.orgName}: a role assessment has been assigned to you`;
    preheader = `${i.competencyCount} competencies for your role as ${i.roleTitle}`;
    footerNote = "You're getting this because someone at your organization assigned you an assessment on Devometrics.";
    body =
      `<h2 style="color:#16161a;font-size:20px;margin:0 0 16px;">A role assessment for you</h2>` +
      p(`Hello ${name},`) +
      p(`<strong>${by}</strong> at <strong>${org}</strong> has assigned you a role assessment for your role, <strong>${role}</strong>.`) +
      h("What it is") +
      list([
        `Written questions on <strong>${i.competencyCount} competencies</strong> your role requires: ${i.questionsPerCompetency} per competency, answered in your own words.`,
        `Your answers are scored against the level descriptions for each competency.`,
      ]) +
      h("How to do it") +
      list([
        `No time limit. You can save a draft and finish later. Once you submit, your answers cannot be changed.`,
        `Write in your own words: pasting text into the answer boxes is turned off.`,
        `Concrete examples from your own work score better than general statements.`,
      ]) +
      h("What happens next") +
      list([
        `Your answers are scored with AI. Your manager reviews the result and can confirm or adjust it before it is used for anything.`,
        `The result is an estimate of what you showed in your answers, not a final verdict.`,
        `Your written answers are kept for ${i.retentionMonths} months and then deleted.`,
      ]) +
      button("Open my role assessment");
  } else {
    subject = `${i.orgName}: كُلِّفت بتقييم دور`;
    preheader = `${i.competencyCount} كفاءة لدورك ${i.roleTitle}`;
    footerNote = "وصلتك هذه الرسالة لأن أحدًا في مؤسستك كلّفك بتقييم على Devometrics.";
    body =
      `<h2 style="color:#16161a;font-size:20px;margin:0 0 16px;">تقييم دور لك</h2>` +
      p(`مرحبًا ${name}،`) +
      p(`كلّفك <strong>${by}</strong> في <strong>${org}</strong> بتقييم دور لدورك: <strong>${role}</strong>.`) +
      h("ما هو التقييم") +
      list([
        `أسئلة مكتوبة عن <strong>${i.competencyCount} كفاءة</strong> يتطلبها دورك، ${i.questionsPerCompetency} لكل كفاءة، تجيب عنها بكلماتك.`,
        `تُصحَّح إجاباتك وفق وصف المستويات لكل كفاءة.`,
      ]) +
      h("كيف تجيب") +
      list([
        `لا يوجد وقت محدد. يمكنك حفظ مسودة وإكمالها لاحقًا. بعد الإرسال لا يمكن تغيير إجاباتك.`,
        `اكتب بكلماتك: اللصق في خانات الإجابة معطَّل.`,
        `الأمثلة الملموسة من عملك تنال تقديرًا أفضل من العبارات العامة.`,
      ]) +
      h("بعد ذلك") +
      list([
        `تُصحَّح إجاباتك بالذكاء الاصطناعي، ويراجع مديرك النتيجة ويمكنه تأكيدها أو تعديلها قبل استخدامها في أي أمر.`,
        `النتيجة تقدير لما أظهرته في إجاباتك وليست حكمًا نهائيًا.`,
        `تُحفظ إجاباتك المكتوبة ${i.retentionMonths} شهرًا ثم تُحذف.`,
      ]) +
      button("افتح تقييم الدور");
  }

  const wrapped = ar ? `<div dir="rtl" style="text-align:right;">${body}</div>` : body;
  return { subject, preheader: e(preheader), footerNote, html: renderEmail({ preheader: e(preheader), bodyHtml: wrapped, footerNote }) };
}

// Master switch for the assignment email. ON since the wording was approved (13 Nov 2026). Set to false and deploy to stop all
// assignment emails; while off, nothing is sent and the screen says nothing about email.
export const ASSESSMENT_EMAILS_ENABLED = true;

// Looks up who and what the email needs and sends it. Best effort: returns false (after logging) instead of throwing, so a
// problem with email never undoes the assignment the person just made. true = sent, false = could not send, null = no email
// was intended (assigned to yourself).
export async function sendAssessmentAssignedEmail(
  supabase: Supabase,
  args: { organizationId: string; employeeUserId: string; assignerUserId: string; roleTitle: string; language: Lang; detail: { kind: "check"; questionCount: number; minutes: number; checkId: string } | { kind: "role"; competencyCount: number; questionsPerCompetency: number; retentionMonths: number; assessmentId: string } },
  options?: { enabled?: boolean }
): Promise<boolean | null> {
  try {
    if (!(options?.enabled ?? ASSESSMENT_EMAILS_ENABLED)) return null;
    if (args.employeeUserId === args.assignerUserId) return null; // assigning to yourself needs no email
    const [{ data: employee }, { data: assigner }, { data: org }] = await Promise.all([
      supabase.from("profiles").select("full_name, email").eq("id", args.employeeUserId).maybeSingle<{ full_name: string | null; email: string }>(),
      supabase.from("profiles").select("full_name, email").eq("id", args.assignerUserId).maybeSingle<{ full_name: string | null; email: string }>(),
      supabase.from("organizations").select("name").eq("id", args.organizationId).maybeSingle<{ name: string }>(),
    ]);
    if (!employee?.email) return false;
    const common = {
      language: args.language,
      employeeName: employee.full_name?.trim() || employee.email,
      orgName: org?.name ?? "Your organization",
      assignerName: assigner?.full_name?.trim() || assigner?.email || "Your administrator",
      roleTitle: args.roleTitle,
    };
    const built =
      args.detail.kind === "check"
        ? buildAssessmentAssignedEmail({ ...common, kind: "check", url: `https://devometrics.com/dashboard/knowledge-check/${args.detail.checkId}`, questionCount: args.detail.questionCount, minutes: args.detail.minutes })
        : buildAssessmentAssignedEmail({ ...common, kind: "role", url: `https://devometrics.com/dashboard/role-assessment/${args.detail.assessmentId}`, competencyCount: args.detail.competencyCount, questionsPerCompetency: args.detail.questionsPerCompetency, retentionMonths: args.detail.retentionMonths });
    await sendEmail(employee.email, built.subject, built.html);
    return true;
  } catch (err) {
    console.error("Assessment assigned email failed:", err);
    return false;
  }
}
