// Demo mode: no model call. Deterministic, retrieval-backed answers so the
// prototype works without an API key. Guardrails behave exactly as in live mode.
import { itemById } from "../../data/catalog";
import { roleById, skillById } from "../../data/taxonomy";
import { profile } from "../skills";
import type { Employee, Lang, LearningPlan, Level } from "../types";
import { retrieve, tokenize, type Retrieved } from "./retrieval";

const RE = {
  practise: /(practi[cs]e|role ?play|ฝึก|ซ้อม|บทบาทสมมติ)/i,
  reflect: /(reflect|reflection|สะท้อนคิด|ทบทวนสิ่งที่ได้เรียน)/i,
  lesson: /(summar|this lesson|example|สรุป|บทเรียนนี้|ยกตัวอย่าง|ตัวอย่าง)/i,
  policy: /(affect|impact|used for|bonus|pay|salary|promot|มีผล|กระทบ|โบนัส|เงินเดือน|เลื่อนตำแหน่ง|นำไปใช้)/i,
  explain: /(result|gap|score|where do i stand|my level|explain my|ผลประเมิน|ผลของ|คะแนน|ช่องว่าง|ขาดอะไร|ระดับของ|จุดที่ต้องพัฒนา|อธิบายผล)/i,
  next: /(next step|what should i|where (do|should) i start|recommend|ขั้นต่อไป|ทำอะไรต่อ|เริ่มจาก|ควรทำอะไร|แนะนำ)/i,
};
export const ROLEPLAY_MARK = "⁣"; // invisible marker on the role-play opener

interface DemoIn {
  emp: Employee;
  lessonId?: string;
  lang: Lang;
  message: string;
  prevAssistant?: string;
  sources: Retrieved[];
  plan?: LearningPlan;
  overrides?: Record<string, Level>;
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

export function demoAnswer(d: DemoIn): { text: string; sources: Retrieved[] } {
  const { emp, lang, message } = d;
  const th = lang === "th";

  // Second turn of a role-play: SBI-style feedback on the learner's reply.
  if (d.prevAssistant?.includes(ROLEPLAY_MARK)) {
    const src = retrieve("LAST listen apologise solve thank", lang, { pinned: ["LA-104"], k: 1 });
    const apologised = /(sorry|apolog|ขอโทษ|ขออภัย)/i.test(message);
    const solved = /(exchange|refund|replace|check|เปลี่ยน|คืนเงิน|ตรวจ|ดูให้)/i.test(message);
    const text = th
      ? `ดีมากค่ะ ลองดูฟีดแบ็กแบบ SBI นะคะ\n• สถานการณ์: ลูกค้าโกรธเรื่องพัดลมเสีย\n• พฤติกรรม: ${apologised ? "คุณขอโทษลูกค้าก่อน ซึ่งช่วยลดความตึงเครียด" : "คุณยังไม่ได้ขอโทษลูกค้า ลองเริ่มด้วยคำขอโทษสั้นๆ"}${solved ? " และเสนอทางแก้ที่ชัดเจน" : " ลองเสนอทางแก้ที่ทำได้ทันที เช่น เปลี่ยนสินค้าตามนโยบาย"}\n• ผลกระทบ: ลูกค้ารู้สึกว่าได้รับการดูแล และมีโอกาสกลับมาซื้ออีก\nอย่าลืมขั้นสุดท้ายของ LAST คือขอบคุณลูกค้าที่บอกเรา [S1] อยากลองอีกรอบกับลูกค้าที่โกรธกว่านี้ไหมคะ`
      : `Nice work. Here's SBI feedback:\n• Situation: an angry customer with a broken fan\n• Behaviour: ${apologised ? "you apologised first, which lowers the temperature" : "you didn't apologise yet; start with a short sorry"}${solved ? " and offered a clear fix" : "; offer a fix you can do now, like an exchange under the returns policy"}\n• Impact: the customer feels looked after and is more likely to come back\nDon't forget the last LAST step: thank them for telling you [S1]. Want to try a harder customer?`;
    return { text, sources: src };
  }

  if (RE.practise.test(message)) {
    const src = retrieve("LAST complaint", lang, { pinned: ["LA-104"], k: 1 });
    const text = th
      ? `มาฝึกกันค่ะ โค้ชจะเล่นเป็นลูกค้านะคะ\nสถานการณ์: ลูกค้าถือพัดลมที่ซื้อเมื่อวานมาที่เคาน์เตอร์ แล้วพูดเสียงดังว่า\n"พัดลมที่ซื้อไปเมื่อวานเปิดไม่ติดเลย เสียเวลามาก ร้านนี้ขายของแบบนี้ได้ยังไง!"\nคุณจะตอบลูกค้าว่าอย่างไรคะ ลองใช้ขั้นตอน LAST [S1]${ROLEPLAY_MARK}`
      : `Let's practise. I'll play the customer.\nScene: a customer walks up holding a fan bought yesterday and says loudly:\n"This fan I bought yesterday won't even turn on. What a waste of my time!"\nHow do you respond? Try the LAST steps [S1].${ROLEPLAY_MARK}`;
    return { text, sources: src };
  }

  if (RE.reflect.test(message)) {
    const pinnedId = d.lessonId ?? "LA-201";
    const src = retrieve("SBI situation behaviour impact feedback", lang, { pinned: [pinnedId], k: 1 });
    const site = emp.site[lang];
    const text = th
      ? `มาสะท้อนคิด (Reflection) จากการปฎิบัติงานที่${site}กันค่ะ [S1]:\n1. ในสัปดาห์ที่ผ่านมา มีสถานการณ์ไหนที่คุณได้ลองให้ฟีดแบ็กหรือรับมือปัญหาหน้างานบ้างคะ\n2. ตอนนั้นคุณพูดหรือทำอย่างไร (Behaviour) และผลลัพธ์เป็นอย่างไร (Impact)\n3. ถ้ากลับไปทำอีกครั้ง คุณอยากปรับจุดไหนให้ดีขึ้นคะ ลองพิมพ์เล่าให้โค้ชฟังได้เลยค่ะ`
      : `Let's reflect on your recent shift at ${site} [S1]:\n1. Think of one moment this week where you gave feedback or handled a store issue.\n2. What did you say or do (Behaviour), and how did the other person react (Impact)?\n3. What is one thing you would do differently next time? Share your thoughts below.`;
    return { text, sources: src };
  }

  if (RE.explain.test(message) && !RE.policy.test(message)) {
    const p = profile(emp, d.overrides);
    const src = retrieve("results development only manager approves", lang, { pinned: ["KB-01"], k: 1 });
    const gaps = p.nextGaps.filter((g) => g.gap > 0).sort((a, b) => Number(b.critical) - Number(a.critical)).slice(0, 3);
    const met = p.nextGaps.filter((g) => g.gap === 0).length;
    const lines = gaps.map((g) => {
      const s = skillById(g.skillId);
      return th
        ? `• ${s.name.th}: ระดับ ${g.current} → ${g.required}${g.critical ? " (ทักษะสำคัญ)" : ""} ระดับถัดไปคือ "${s.levels[Math.min(3, g.current) as 0 | 1 | 2 | 3].th}"`
        : `• ${s.name.en}: L${g.current} → L${g.required}${g.critical ? " (critical)" : ""}. Next level means: "${s.levels[Math.min(3, g.current) as 0 | 1 | 2 | 3].en}"`;
    });
    const next = roleById(emp.nextRoleId!);
    const text = th
      ? `สำหรับตำแหน่ง${next.title.th} คุณผ่านเกณฑ์แล้ว ${met} จาก ${p.nextGaps.length} ทักษะค่ะ\nควรพัฒนาก่อน:\n${lines.join("\n")}\nผลนี้มาจากการประเมินตนเอง แบบทดสอบ และการอนุมัติของหัวหน้า และใช้เพื่อการพัฒนาเท่านั้น [S1] อยากให้โค้ชแนะนำขั้นตอนแรกไหมคะ`
      : `For ${next.title.en} you already meet ${met} of ${p.nextGaps.length} skills.\nFocus first on:\n${lines.join("\n")}\nResults combine your self-assessment, a knowledge check and your manager's approval, and are used for development only [S1]. Want me to suggest a first step?`;
    return { text, sources: src };
  }

  if (RE.next.test(message) && !RE.policy.test(message)) {
    const step = d.plan?.steps.find((s) => s.status !== "done");
    const item = step && itemById(step.itemId);
    if (item && step) {
      const src = item.content ? retrieve(item.title.en, lang, { pinned: [item.id], k: 1 }) : [];
      const cite = src.length ? " [S1]" : "";
      const text = th
        ? `ขั้นต่อไปของคุณคือ "${item.title.th}" (${item.minutes} นาที)${cite}\nเหตุผล: ${step.rationale.th}\nถ้าว่างช่วงพัก เริ่มได้เลยจากแท็บเส้นทางการเรียนรู้ค่ะ`
        : `Your next step is "${item.title.en}" (${item.minutes} min)${cite}.\nWhy: ${step.rationale.en}\nIf you have a break today, open it from the Path tab.`;
      return { text, sources: src };
    }
    const text = th
      ? "คุณยังไม่มีแผนการเรียนรู้ที่อนุมัติแล้วค่ะ ไปที่แท็บเส้นทางการเรียนรู้ แล้วกด 'สร้างเส้นทางของฉัน' เพื่อให้ AI จัดแผนจากช่องว่างทักษะของคุณ จากนั้นส่งให้หัวหน้าอนุมัติ"
      : "You don't have an approved plan yet. Go to the Path tab and tap 'Build my path' so the AI can sequence learning for your gaps, then send it to your manager.";
    return { text, sources: [] };
  }

  const pinned = d.lessonId ? d.sources.find((x) => x.sourceId === d.lessonId) : undefined;
  if (pinned && RE.lesson.test(message)) {
    const item = itemById(pinned.sourceId)!;
    const example = /(example|ตัวอย่าง)/i.test(message);
    const units = pinned.lang === "en" ? (pinned.body.match(/[^.!?]+[.!?]+/g) ?? [pinned.body]) : pinned.body.split(/\s+/);
    let first = "";
    for (const u of units) {
      if (first.length > (pinned.lang === "en" ? 160 : 140)) break;
      first += (first ? " " : "") + u.trim();
    }
    const site = emp.site[lang];
    const text = example
      ? th
        ? `ลองนึกภาพที่${site}นะคะ: ${first} [S1]\nลองเลือกสถานการณ์จริงหนึ่งเรื่องในสัปดาห์นี้ แล้วเล่าให้โค้ชฟังว่าคุณจะทำอย่างไรค่ะ`
        : `Picture this at ${site}: ${first} [S1]\nPick one real situation this week and tell me how you'd handle it.`
      : th
        ? `สรุป "${item.title.th}" [S1]:\n• ${item.summary.th}\n• ${first}\nอยากให้โค้ชทดสอบความเข้าใจด้วยคำถามสั้นๆ ไหมคะ`
        : `Summary of "${item.title.en}" [S1]:\n• ${item.summary.en}\n• ${first}\nWant a quick question to check your understanding?`;
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
