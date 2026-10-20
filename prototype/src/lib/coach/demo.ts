// Demo mode: no model call. Deterministic, retrieval-backed answers so the
// prototype works without an API key. Guardrails behave exactly as in live mode.
import { itemById } from "../../data/catalog";
import { roleById, skillById } from "../../data/taxonomy";
import { profile } from "../skills";
import type { Employee, Lang, LearningPlan, Level } from "../types";
import { programmePolicySource } from "./guardrails";
import { certificateNames, journeyGuidance, timeNote, type CoachJourney } from "./journey";
import { nextStep, progressNudge } from "./nudge";
import { retrieve, tokenize, type Retrieved } from "./retrieval";

const RE = {
  practise: /(practi[cs]e|role ?play|try again|another (try|go)|ฝึก|ซ้อม|บทบาทสมมติ|อีกรอบ|ลองใหม่)/i,
  reflect: /(reflect|reflection|สะท้อนคิด|ทบทวนสิ่งที่ได้เรียน)/i,
  lesson: /(summar|this lesson|example|สรุป|บทเรียนนี้|ยกตัวอย่าง|ตัวอย่าง)/i,
  policy: /(affect|impact|used for|bonus|pay|salary|promot|มีผล|กระทบ|โบนัส|เงินเดือน|เลื่อนตำแหน่ง|นำไปใช้)/i,
  explain: /(result|gap|score|where do i stand|my level|explain my|ผลประเมิน|ผลของ|คะแนน|ช่องว่าง|ขาดอะไร|ระดับของ|จุดที่ต้องพัฒนา|อธิบายผล)/i,
  next: /(next step|what'?s next|after this (lesson|one|step)|what should i (learn|focus|study)|do next|where (do|should) i start|recommend|ขั้นต่อไป|ทำอะไรต่อ|เรียนอะไรต่อ|เริ่มจาก|ควรทำอะไร|แนะนำ)/i,
  nudge: /(how am i doing|my progress|keep (me )?going|motivat|on track|ทำไปถึงไหน|ไปถึงไหนแล้ว|ความคืบหน้า|กำลังใจ)/i,
  yes: /^\s*(yes|yeah|yep|ok|okay|sure|please|go ahead|let'?s|ได้|เอา|โอเค|ค่ะ|ครับ|ลอง|สนใจ)/i,
};

// Invisible markers on demo replies record which activity is waiting for the
// learner's answer, so the next turn continues it instead of starting over.
export const ROLEPLAY_MARK = "⁣"; // role-play scene: next turn gets SBI feedback
export const TEACHBACK_MARK = "⁤"; // teach-back / quick check: next turn is compared with the lesson
export const REFLECT_MARK = "⁠"; // reflection questions: next turn is acknowledged with a nudge
export const OFFER_HARDER_MARK = "⁢"; // "try a harder customer?": yes starts the harder scene
export const OFFER_REFLECT_MARK = "⁡"; // "want a reflection question?": yes starts reflection
const MARKS = [ROLEPLAY_MARK, TEACHBACK_MARK, REFLECT_MARK, OFFER_HARDER_MARK, OFFER_REFLECT_MARK];
export const continuesActivity = (prevAssistant?: string) => Boolean(prevAssistant && MARKS.some((m) => prevAssistant.includes(m)));

// Complaint lessons practise with the customer role-play; others use a teach-back.
const ROLEPLAY_LESSONS = new Set(["LA-104", "LA-105"]);

interface DemoIn {
  emp: Employee;
  lessonId?: string;
  lang: Lang;
  message: string;
  prevAssistant?: string;
  sources: Retrieved[];
  plan?: LearningPlan;
  overrides?: Record<string, Level>;
  journey?: CoachJourney;
}

function excerpt(text: string, query: string, lang: Lang) {
  const q = new Set(tokenize(query));
  const units = lang === "en" ? text.match(/[^.!?]+[.!?]+/g) ?? [text] : text.split(/\s+/);
  const scores = units.map((u) => new Set(tokenize(u).filter((t) => q.has(t))).size);
  const best = Math.max(0, scores.indexOf(Math.max(...scores)));
  const out: string[] = [];
  let len = 0;
  for (let i = Math.max(0, best - (lang === "en" ? 0 : 1)); i < units.length && len < (lang === "en" ? 320 : 260); i++) {
    out.push(units[i].trim());
    len += units[i].length;
  }
  return out.join(" ");
}

// Lesson points for teach-back feedback: sentences in English, space-separated
// Thai clauses merged until each is long enough to carry a point.
function lessonPoints(body: string, lang: Lang) {
  if (lang === "en") return (body.match(/[^.!?]+[.!?]+/g) ?? [body]).map((s) => s.trim()).filter(Boolean);
  const points: string[] = [];
  let cur = "";
  for (const unit of body.split(/\s+/)) {
    cur = cur ? `${cur} ${unit}` : unit;
    if (cur.length >= 25) {
      points.push(cur);
      cur = "";
    }
  }
  if (cur && points.length) points[points.length - 1] += ` ${cur}`;
  else if (cur) points.push(cur);
  return points;
}

const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n).replace(/\s+\S*$/, "")}…`);

function lessonSource(lessonId: string | undefined, lang: Lang) {
  const item = lessonId ? itemById(lessonId) : undefined;
  if (!item?.content) return undefined;
  const src = retrieve(item.title.en, lang, { pinned: [item.id], k: 1 });
  return src[0]?.sourceId === item.id ? { item, src } : undefined;
}

function rolePlay(lang: Lang, harder: boolean) {
  const src = retrieve("LAST complaint", lang, { pinned: ["LA-104"], k: 1 });
  const th = lang === "th";
  const text = harder
    ? th
      ? `มาลองแบบยากขึ้นค่ะ โค้ชเป็นลูกค้าคนเดิมที่กลับมาเป็นครั้งที่สองในวันนี้:\n"เมื่อเช้าก็มาแล้ว ไม่มีใครแก้ให้เลย ขอคุยกับผู้จัดการเดี๋ยวนี้!"\nคุณจะตอบลูกค้าว่าอย่างไรคะ ลองใช้ขั้นตอน LAST [S1]${ROLEPLAY_MARK}`
      : `Let's make it harder. I'm the same customer, back for the second time today:\n"I already came this morning and nobody fixed it. I want to speak to your manager, now!"\nHow do you respond? Use the LAST steps [S1].${ROLEPLAY_MARK}`
    : th
      ? `มาฝึกกันค่ะ โค้ชจะเล่นเป็นลูกค้านะคะ\nสถานการณ์: ลูกค้าถือพัดลมที่ซื้อเมื่อวานมาที่เคาน์เตอร์ แล้วพูดเสียงดังว่า\n"พัดลมที่ซื้อไปเมื่อวานเปิดไม่ติดเลย เสียเวลามาก ร้านนี้ขายของแบบนี้ได้ยังไง!"\nคุณจะตอบลูกค้าว่าอย่างไรคะ ลองใช้ขั้นตอน LAST [S1]${ROLEPLAY_MARK}`
      : `Let's practise. I'll play the customer.\nScene: a customer walks up holding a fan bought yesterday and says loudly:\n"This fan I bought yesterday won't even turn on. What a waste of my time!"\nHow do you respond? Try the LAST steps [S1].${ROLEPLAY_MARK}`;
  return { text, sources: src };
}

function rolePlayFeedback(lang: Lang, message: string, prevAssistant: string) {
  const src = retrieve("LAST listen apologise solve thank", lang, { pinned: ["LA-104"], k: 1 });
  const th = lang === "th";
  const harder = /(second time|ครั้งที่สอง)/i.test(prevAssistant);
  const apologised = /(sorry|apolog|ขอโทษ|ขออภัย)/i.test(message);
  const solved = /(exchange|refund|replace|check|manager|เปลี่ยน|คืนเงิน|ตรวจ|ดูให้|ผู้จัดการ)/i.test(message);
  const text = th
    ? `ดีมากค่ะ ลองดูฟีดแบ็กแบบ SBI นะคะ\n• สถานการณ์: ${harder ? "ลูกค้ากลับมาเป็นครั้งที่สองและขอคุยกับผู้จัดการ" : "ลูกค้าโกรธเรื่องพัดลมเสีย"}\n• พฤติกรรม: ${apologised ? "คุณขอโทษลูกค้าก่อน ซึ่งช่วยลดความตึงเครียด" : "คุณยังไม่ได้ขอโทษลูกค้า ลองเริ่มด้วยคำขอโทษสั้นๆ"}${solved ? (apologised ? " และเสนอทางแก้ที่ชัดเจน" : " ส่วนการเสนอทางแก้ทำได้ดีแล้วค่ะ") : " ลองเสนอทางแก้ที่ทำได้ทันที เช่น เปลี่ยนสินค้าตามนโยบาย"}\n• ผลกระทบ: ลูกค้ารู้สึกว่าได้รับการดูแล และมีโอกาสกลับมาซื้ออีก\nอย่าลืมขั้นสุดท้ายของ LAST คือขอบคุณลูกค้าที่บอกเรา [S1] ${harder ? `อยากให้โค้ชชวนสะท้อนคิดจากการฝึกนี้ไหมคะ${OFFER_REFLECT_MARK}` : `อยากลองอีกรอบกับลูกค้าที่โกรธกว่านี้ไหมคะ${OFFER_HARDER_MARK}`}`
    : `Nice work. Here's SBI feedback:\n• Situation: ${harder ? "a customer back for the second time, asking for the manager" : "an angry customer with a broken fan"}\n• Behaviour: ${apologised ? "you apologised first, which lowers the temperature" : "you didn't apologise yet; start with a short sorry"}${solved ? (apologised ? " and offered a clear fix" : ". You did offer a clear fix") : "; offer a fix you can do now, like an exchange under the returns policy"}\n• Impact: the customer feels looked after and is more likely to come back\nDon't forget the last LAST step: thank them for telling you [S1]. ${harder ? `Want a reflection question on this practice?${OFFER_REFLECT_MARK}` : `Want to try a harder customer?${OFFER_HARDER_MARK}`}`;
  return { text, sources: src };
}

function teachBack(lang: Lang, site: string, lesson: NonNullable<ReturnType<typeof lessonSource>>) {
  const title = lesson.item.title[lang];
  const text = lang === "th"
    ? `มาฝึก "${title}" กันค่ะ [S1] สมมติว่าเพื่อนร่วมงานใหม่ที่${site}ถามคุณว่าต้องทำอย่างไร ลองอธิบายให้เขาฟังสัก 2-3 ประโยค แล้วโค้ชจะเทียบคำตอบกับบทเรียนให้นะคะ${TEACHBACK_MARK}`
    : `Let's practise "${title}" [S1]. Imagine a new colleague at ${site} asks you how to do this. In 2 or 3 sentences, tell them what to do, and I'll check your answer against the lesson.${TEACHBACK_MARK}`;
  return { text, sources: lesson.src };
}

function teachBackFeedback(lang: Lang, message: string, lesson: NonNullable<ReturnType<typeof lessonSource>>) {
  const th = lang === "th";
  const said = new Set(tokenize(message));
  const points = lessonPoints(lesson.item.content![lang], lang).map((p) => {
    const toks = [...new Set(tokenize(p))];
    const shared = toks.filter((t) => said.has(t)).length;
    return { p, covered: shared >= 2 || (toks.length <= 3 && shared >= 1) };
  });
  const covered = points.filter((x) => x.covered).slice(0, 2).map((x) => `"${clip(x.p, 110)}"`);
  const missed = points.filter((x) => !x.covered).slice(0, 2).map((x) => `"${clip(x.p, 110)}"`);
  const title = lesson.item.title[lang];
  const lines = [th ? `ดีมากที่ลองตอบค่ะ เทียบกับบทเรียน "${title}" [S1]:` : `Good effort. Checked against "${title}" [S1]:`];
  if (covered.length) lines.push(...covered.map((c) => (th ? `• พูดถึงแล้ว: ${c}` : `• You covered: ${c}`)));
  else lines.push(th ? "• คำตอบยังไม่ได้ใช้ประเด็นจากบทเรียน ลองเริ่มจากประเด็นด้านล่างค่ะ" : "• Your answer didn't use the lesson's points yet; start with the one below.");
  if (missed.length) lines.push(...missed.map((m) => (th ? `• ครั้งหน้าลองเพิ่ม: ${m}` : `• Add next time: ${m}`)));
  else lines.push(th ? "• คุณพูดถึงประเด็นหลักครบแล้ว เยี่ยมมากค่ะ" : "• You covered all the key points. Well done.");
  lines.push(th ? `อยากให้โค้ชชวนสะท้อนคิดเพื่อนำไปใช้จริงไหมคะ${OFFER_REFLECT_MARK}` : `Want a reflection question to help it stick?${OFFER_REFLECT_MARK}`);
  return { text: lines.join("\n"), sources: lesson.src };
}

function teachBackAgain(lang: Lang, lesson: NonNullable<ReturnType<typeof lessonSource>>) {
  const title = lesson.item.title[lang];
  const text = lang === "th"
    ? `เล่าได้เลยค่ะ: คุณจะใช้เรื่อง "${title}" ในกะถัดไปอย่างไร [S1] ตอบสัก 2-3 ประโยคก็พอนะคะ${TEACHBACK_MARK}`
    : `Go ahead: in your own words, how would you use "${title}" on your next shift [S1]? 2 or 3 sentences is enough.${TEACHBACK_MARK}`;
  return { text, sources: lesson.src };
}

function reflectAgain(lang: Lang) {
  const text = lang === "th"
    ? `ค่อยๆ คิดได้เลยค่ะ ลองเล่าสั้นๆ ว่าในกะถัดไปคุณจะลองทำอะไรนะคะ${REFLECT_MARK}`
    : `Take your time. In a sentence or two, what will you try on your next shift?${REFLECT_MARK}`;
  return { text, sources: [] as Retrieved[] };
}

function reflection(d: DemoIn) {
  const th = d.lang === "th";
  const site = d.emp.site[d.lang];
  const lesson = lessonSource(d.lessonId, d.lang);
  if (lesson) {
    const title = lesson.item.title[d.lang];
    const text = th
      ? `มาสะท้อนคิดจากบทเรียน "${title}" กันค่ะ [S1]:\n1. ส่วนไหนของบทเรียนนี้ที่คุณเคยใช้ หรือจะนำไปใช้ที่${site}ได้บ้างคะ\n2. ผลที่เกิดขึ้น หรือผลที่คาดว่าจะเกิดเป็นอย่างไร\n3. ในกะถัดไป คุณจะลองทำอะไรคะ ลองพิมพ์เล่าให้โค้ชฟังได้เลยค่ะ${REFLECT_MARK}`
      : `Let's reflect on "${title}" [S1]:\n1. Which part of this lesson have you used, or could you use, at ${site}?\n2. What happened, or what do you expect to happen?\n3. What will you try on your next shift? Share your thoughts below.${REFLECT_MARK}`;
    return { text, sources: lesson.src };
  }
  const src = retrieve("SBI situation behaviour impact feedback", d.lang, { pinned: ["LA-102"], k: 1 });
  const text = th
    ? `มาสะท้อนคิด (Reflection) จากการปฏิบัติงานที่${site}กันค่ะ [S1]:\n1. ในสัปดาห์ที่ผ่านมา มีสถานการณ์ไหนที่คุณได้ลองให้ฟีดแบ็กหรือรับมือปัญหาหน้างานบ้างคะ\n2. ตอนนั้นคุณพูดหรือทำอย่างไร (Behaviour) และผลลัพธ์เป็นอย่างไร (Impact)\n3. ถ้ากลับไปทำอีกครั้ง คุณอยากปรับจุดไหนให้ดีขึ้นคะ ลองพิมพ์เล่าให้โค้ชฟังได้เลยค่ะ${REFLECT_MARK}`
    : `Let's reflect on your recent shift at ${site} [S1]:\n1. Think of one moment this week where you gave feedback or handled a store issue.\n2. What did you say or do (Behaviour), and how did the other person react (Impact)?\n3. What is one thing you would do differently next time? Share your thoughts below.${REFLECT_MARK}`;
  return { text, sources: src };
}

function reflectionThanks(d: DemoIn) {
  const th = d.lang === "th";
  const nudge = progressNudge(d.plan, d.lang, d.lessonId);
  const text = th
    ? `ขอบคุณที่สะท้อนคิดนะคะ การบอกว่าจะลองทำอะไรต่อ ช่วยให้นำไปใช้ได้จริงในกะถัดไปค่ะ\n${nudge.text}`
    : `Thanks for reflecting. Naming what you'll try next makes it easier to do on your next shift.\n${nudge.text}`;
  return { text, sources: [] as Retrieved[] };
}

export function demoAnswer(d: DemoIn): { text: string; sources: Retrieved[] } {
  const { emp, lang, message } = d;
  const th = lang === "th";
  const prev = d.prevAssistant ?? "";

  const policySource = programmePolicySource(message);
  if (policySource) {
    const source = d.sources.find((s) => s.sourceId === policySource);
    if (source) return { text: `${source.body} [S1]`, sources: [source] };
  }

  // Continue an activity the coach started, unless the learner asks for something new.
  const asksSomethingElse = [RE.practise, RE.reflect, RE.nudge, RE.explain, RE.next, RE.lesson].some((r) => r.test(message));
  if (!asksSomethingElse) {
    const yes = message.trim().length <= 40 && RE.yes.test(message);
    if (prev.includes(OFFER_HARDER_MARK) && yes) return rolePlay(lang, true);
    if (prev.includes(OFFER_REFLECT_MARK) && yes) return reflection(d);
    if (prev.includes(ROLEPLAY_MARK)) return rolePlayFeedback(lang, message, prev);
    const lesson = lessonSource(d.lessonId, lang);
    // A bare "yes" to an open question is not an answer yet, so ask again.
    if (prev.includes(TEACHBACK_MARK) && lesson) return yes ? teachBackAgain(lang, lesson) : teachBackFeedback(lang, message, lesson);
    if (prev.includes(REFLECT_MARK)) return yes ? reflectAgain(lang) : reflectionThanks(d);
  }

  if (RE.practise.test(message)) {
    const lesson = d.lessonId && !ROLEPLAY_LESSONS.has(d.lessonId) ? lessonSource(d.lessonId, lang) : undefined;
    return lesson ? teachBack(lang, emp.site[lang], lesson) : rolePlay(lang, false);
  }

  if (RE.reflect.test(message)) return reflection(d);

  if (RE.nudge.test(message) && !RE.policy.test(message)) {
    const guidance = journeyGuidance(d.journey, d.plan, lang);
    if (guidance) return { text: guidance, sources: [] };
    const nudge = progressNudge(d.plan, lang);
    const close = nudge.next ? (th ? "\nอยากให้โค้ชช่วยเริ่มขั้นตอนนี้ไหมคะ" : "\nWant help getting started on it?") : "";
    return { text: `${nudge.text}${close}`, sources: [] };
  }

  if (RE.explain.test(message) && !RE.policy.test(message)) {
    const p = profile(emp, d.overrides);
    const src = retrieve("results development only manager approves", lang, { pinned: ["KB-01"], k: 1 });
    // Terminal roles have no next-role gaps; explain the current role instead.
    const roleGaps = p.nextGaps.length ? p.nextGaps : p.current;
    const gaps = roleGaps.filter((g) => g.gap > 0).sort((a, b) => Number(b.critical) - Number(a.critical)).slice(0, 3);
    const met = roleGaps.filter((g) => g.gap === 0).length;
    const lines = gaps.map((g) => {
      const s = skillById(g.skillId);
      return th
        ? `• ${s.name.th}: ระดับ ${g.current} → ${g.required}${g.critical ? " (ทักษะสำคัญ)" : ""} ระดับถัดไปคือ "${s.levels[Math.min(3, g.current) as 0 | 1 | 2 | 3].th}"`
        : `• ${s.name.en}: L${g.current} → L${g.required}${g.critical ? " (critical)" : ""}. Next level means: "${s.levels[Math.min(3, g.current) as 0 | 1 | 2 | 3].en}"`;
    });
    const next = roleById(emp.nextRoleId ?? emp.roleId);
    const status = d.journey?.assessment;
    // Before the manager approves the skill check, the levels are estimates, not results.
    if (status && status !== "approved") {
      const intro = {
        not_started: th ? `คุณยังไม่ได้ทำแบบประเมินทักษะ ตอนนี้จึงมีแค่ค่าประมาณเริ่มต้น ยังไม่ใช่ผลประเมินค่ะ สำหรับตำแหน่ง${next.title.th} ค่าประมาณแนะนำให้พัฒนาก่อน:` : `You haven't done your skill check yet, so these are starting estimates, not results. For ${next.title.en} they suggest focusing on:`,
        changes_requested: th ? `หัวหน้าขอให้แก้ไขแบบประเมินทักษะ ตัวเลขนี้จึงยังเป็นค่าประมาณค่ะ สำหรับตำแหน่ง${next.title.th} แนะนำให้พัฒนาก่อน:` : `Your manager asked you to update your skill check, so these are still estimates. For ${next.title.en} they suggest focusing on:`,
        submitted: th ? `แบบประเมินทักษะของคุณรอหัวหน้าอนุมัติ ระดับนี้จึงยังไม่ใช่ผลสุดท้ายค่ะ สำหรับตำแหน่ง${next.title.th} คะแนนของคุณที่ตรวจกับคำถามสถานการณ์แล้วแนะนำให้พัฒนาก่อน:` : `Your skill check is with your manager, so these levels aren't final yet. For ${next.title.en}, your ratings checked against the scenarios suggest focusing on:`,
      }[status];
      const close = status === "submitted"
        ? th ? "เมื่อหัวหน้าอนุมัติแล้ว โค้ชจะอธิบายผลที่ยืนยันแล้วให้ได้ค่ะ" : "Once they approve it, I can explain your confirmed results."
        : th ? "อยากเริ่มแบบประเมินทักษะ 5 นาทีที่แท็บประเมินทักษะไหมคะ" : "Want to start the 5-minute skill check on the Skill check tab?";
      const text = th
        ? `${intro}\n${lines.join("\n")}\nหัวหน้าเป็นผู้ยืนยันผลสุดท้าย และผลใช้เพื่อการพัฒนาเท่านั้น [S1] ${close}`
        : `${intro}\n${lines.join("\n")}\nYour manager confirms the final results, which are used for development only [S1]. ${close}`;
      return { text, sources: src };
    }
    const certs = certificateNames(d.journey, lang);
    const certLine = certs.length ? (th ? `\nใบรับรองของคุณ (${certs.join(", ")}) นับรวมแล้ว แผนจะข้ามการอบรมที่ครอบคลุมอยู่แล้วค่ะ` : `\nYour certificates (${certs.join(", ")}) are counted, so your plan skips training they already cover.`) : "";
    const text = th
      ? `สำหรับตำแหน่ง${next.title.th} คุณผ่านเกณฑ์แล้ว ${met} จาก ${roleGaps.length} ทักษะค่ะ\nควรพัฒนาก่อน:\n${lines.join("\n")}\nผลนี้มาจากการประเมินตนเอง แบบทดสอบ และการอนุมัติของหัวหน้า และใช้เพื่อการพัฒนาเท่านั้น [S1]${certLine}\nอยากให้โค้ชแนะนำขั้นตอนแรกไหมคะ`
      : `For ${next.title.en} you already meet ${met} of ${roleGaps.length} skills.\nFocus first on:\n${lines.join("\n")}\nResults combine your self-assessment, a knowledge check and your manager's approval, and are used for development only [S1].${certLine}\nWant me to suggest a first step?`;
    return { text, sources: src };
  }

  if (RE.next.test(message) && !RE.policy.test(message)) {
    // Beside a lesson, "what's next" means the step after this one.
    const guidance = journeyGuidance(d.journey, d.plan, lang);
    if (guidance) return { text: guidance, sources: [] };
    const inPlan = d.lessonId && d.plan?.steps.some((s) => s.itemId === d.lessonId);
    const step = nextStep(d.plan, inPlan ? d.lessonId : undefined);
    const item = step && itemById(step.itemId);
    if (item && step) {
      const src = item.content ? retrieve(item.title.en, lang, { pinned: [item.id], k: 1 }) : [];
      const cite = src.length ? " [S1]" : "";
      const text = th
        ? `ขั้นต่อไปของคุณคือ "${item.title.th}" (${item.minutes} นาที)${cite}\nเหตุผล: ${step.rationale.th}${item.format === "video" ? timeNote(d.journey, item.minutes, lang) : ""}\nถ้าว่างช่วงพัก เริ่มได้เลยจากแท็บแผนการเรียนค่ะ`
        : `Your next step is "${item.title.en}" (${item.minutes} min)${cite}.\nWhy: ${step.rationale.en}${item.format === "video" ? timeNote(d.journey, item.minutes, lang) : ""}\nIf you have a break today, open it from the Learning plan tab.`;
      return { text, sources: src };
    }
    if (d.plan?.steps.length) return { text: progressNudge(d.plan, lang, inPlan ? d.lessonId : undefined).text, sources: [] };
    const text = th
      ? "คุณยังไม่มีแผนการเรียนรู้ที่อนุมัติแล้วค่ะ ไปที่แท็บแผนการเรียน แล้วกด 'สร้างแผนการเรียน' เพื่อให้ AI จัดแผนจากช่องว่างทักษะของคุณ จากนั้นส่งให้หัวหน้าอนุมัติ"
      : "You don't have an approved plan yet. Go to the Learning plan tab and tap 'Build my plan' so the AI can sequence learning for your gaps, then send it to your manager.";
    return { text, sources: [] };
  }

  const pinned = d.lessonId ? d.sources.find((x) => x.sourceId === d.lessonId) : undefined;
  if (pinned && !RE.policy.test(message) && !RE.explain.test(message) && !RE.next.test(message)) {
    const item = itemById(pinned.sourceId)!;
    const example = /(example|ตัวอย่าง)/i.test(message);
    const units = pinned.lang === "en" ? (pinned.body.match(/[^.!?]+[.!?]+/g) ?? [pinned.body]) : pinned.body.split(/\s+/);
    let first = "";
    for (const u of units) {
      if (first.length > (pinned.lang === "en" ? 160 : 140)) break;
      first += (first ? " " : "") + u.trim();
    }
    const site = emp.site[lang];
    // Both replies end with a quick check that the next turn compares with the lesson.
    const text = example
      ? th
        ? `ลองนึกภาพที่${site}นะคะ: ${first} [S1]\nลองเลือกสถานการณ์จริงหนึ่งเรื่องในสัปดาห์นี้ แล้วเล่าให้โค้ชฟังว่าคุณจะทำอย่างไรค่ะ${TEACHBACK_MARK}`
        : `Picture this at ${site}: ${first} [S1]\nPick one real situation this week and tell me how you'd handle it.${TEACHBACK_MARK}`
      : th
        ? `สรุป "${item.title.th}" [S1]:\n• ${item.summary.th}\n• ${first}\nเช็กความเข้าใจสั้นๆ ค่ะ: คุณจะนำเรื่องนี้ไปใช้ในกะถัดไปอย่างไร ลองตอบสัก 1-2 ประโยคนะคะ${TEACHBACK_MARK}`
        : `Summary of "${item.title.en}" [S1]:\n• ${item.summary.en}\n• ${first}\nQuick check: in one or two sentences, how would you use this on your next shift?${TEACHBACK_MARK}`;
    return { text, sources: [pinned] };
  }

  const top = d.sources[0];
  if (!top) {
    const text = th
      ? "ขออภัยค่ะ ยังไม่มีเนื้อหาที่ได้รับอนุมัติเกี่ยวกับเรื่องนี้ ลองถามหัวหน้าหรือ HR ได้นะคะ หรือถามโค้ชเรื่องผลประเมิน แผนการเรียน หรือบทเรียนของคุณ"
      : "Sorry, I don't have approved material on that yet. Your manager or HR can help, or ask me about your results, plan or lessons.";
    return { text, sources: [] };
  }
  const ex = excerpt(top.body, message, lang);
  const text = th
    ? `จาก "${top.title.th}" [S1]:\n${ex}\nอยากให้โค้ชยกตัวอย่างในงานของคุณ หรือชวนฝึกไหมคะ`
    : `From "${top.title.en}" [S1]:\n${ex}\nWant an example from your job, or a quick practice?`;
  return { text, sources: [top] };
}
