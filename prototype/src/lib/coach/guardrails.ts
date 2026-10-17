// Layer 1 guardrails: deterministic, bilingual, run before any model call.
// Layer 2 (live mode) is an LLM intent classifier; the stricter verdict wins.
import { EMPLOYEES } from "../skills";
import type { Lang } from "../types";

export type Category = "in_scope" | "other_person_data" | "hr_decision" | "wellbeing" | "crisis" | "off_topic" | "injection";

export interface Verdict {
  category: Category;
  rule?: string;
  redacted: string; // user text with PII masked; this is what reaches the model
  piiFound: string[];
}

const PII: [string, RegExp][] = [
  ["thai_national_id", /\b\d[- ]?\d{4}[- ]?\d{5}[- ]?\d{2}[- ]?\d\b/g],
  ["phone", /\b0\d{1,2}[- ]?\d{3}[- ]?\d{3,4}\b/g],
  ["email", /[\w.+-]+@[\w-]+\.[\w.]+/g],
];

const RULES: [Category, string, RegExp][] = [
  ["crisis", "self_harm", /(kill myself|suicid|end my life|hurt myself|self[- ]harm|(don'?t|do not) want to (live|be alive)|want to die|ฆ่าตัวตาย|ไม่อยากมีชีวิต|อยากตาย|ทำร้ายตัวเอง)/i],
  ["injection", "prompt_injection", /(ignore (all |any |the )?(previous|prior|above) (instructions|rules)|disregard (earlier|prior|previous) (rules|instructions)|system prompt|hidden (instructions|prompt)|developer mode|you are now|act as (an?|the|my) (?!customer)|reveal your (instructions|prompt)|ลืมคำสั่ง|ไม่ต้องสนใจคำสั่ง|เปิดเผยคำสั่งระบบ|ข้ามกฎเดิม|คำสั่งลับของระบบ)/i],
  ["other_person_data", "bulk_employee_data", /((every|all) (employee|staff|worker)s?.{0,40}(score|result|assessment|plan|record)|(score|result|assessment|plan|record)s?.{0,40}(every|all) (employee|staff|worker)|(ผลประเมิน|คะแนน|ข้อมูล|แผน).{0,30}(พนักงานทุกคน|พนักงานทั้งหมด))/i],
  ["other_person_data", "colleague_data", /((colleague|co-?worker|team ?mate|team member|friend|someone else|other (staff|employee|people))('?s'?)?\s.{0,30}(score|result|level|assessment|rating|gap)|(score|result|level|assessment|rating)s?\s.{0,20}(of|for)\s(my )?(colleague|co-?worker|team|everyone|others)|(คะแนน|ผลประเมิน|ผล|ระดับ).{0,20}(ของ)?(เพื่อน|เพื่อนร่วมงาน|คนอื่น|ลูกทีมคนอื่น|ทุกคนในทีม))/i],
  ["hr_decision", "pay_amount", /((how much|what).{0,30}(salary|pay|earn|wage)|salary (of|for|as)|pay rise|raise my (pay|salary)|bonus (amount|will i get)|เงินเดือน.{0,20}(เท่าไร|เท่าไหร่|เพิ่ม|ขึ้น)|ได้เงินเดือน|ขึ้นเงินเดือน|ค่าจ้าง.{0,10}(เท่าไร|เท่าไหร่)|โบนัส.{0,10}(เท่าไร|เท่าไหร่|กี่เดือน))/i],
  ["hr_decision", "promotion_decision", /(will i (get|be) promoted|promise.{0,20}promot|guarantee.{0,70}(promot|job|next role)|when (will|do) i get promoted|การันตี.{0,20}(เลื่อน|ตำแหน่ง)|จะได้เลื่อนตำแหน่ง(เมื่อไร|เมื่อไหร่|แน่)|รับประกัน.{0,30}(เลื่อน|ตำแหน่ง))/i],
  ["wellbeing", "stress", /(burn(ed|t)? ?out|depress|anxious|anxiety|can'?t cope|overwhelmed|panic attack|เครียดมาก|ซึมเศร้า|หมดไฟ|ไม่ไหวแล้ว|วิตกกังวล|นอนไม่หลับ)/i],
];

// Thai has no spaces between words, so a bare substring test misfires
// ("แผนภายใน" contains the name "นภา"). Match a Thai first name only after a
// boundary or a person marker (คุณ, ของ, น้อง, พี่, กับ).
const TH_MARKER = "(^|\\s|คุณ|ของ|น้อง|พี่|กับ|ให้)";
function otherEmployeeMentioned(text: string, selfId: string, managerId: string | null) {
  const t = text.toLowerCase();
  return EMPLOYEES.some((e) => {
    if (e.id === selfId || e.id === managerId) return false;
    const [fEn] = e.name.en.toLowerCase().split(" ");
    const [fTh] = e.name.th.split(" ");
    return (
      t.includes(e.name.en.toLowerCase()) ||
      t.includes(e.name.th) ||
      (fEn.length > 3 && new RegExp(`\\b${fEn}\\b`).test(t)) ||
      (fTh.length > 2 && new RegExp(`${TH_MARKER}${fTh}`).test(text))
    );
  });
}

const DATA_WORDS = /(score|result|level|assessment|rating|gap|plan|progress|คะแนน|ผลประเมิน|ผล|ระดับ|แผน|ความคืบหน้า)/i;

/** Policy clarification is answerable; asking the coach to promise a promotion is not. */
export function programmePolicySource(text: string): string | undefined {
  if (/(how much|what (is|will be) my (salary|pay|bonus)|can you guarantee|promise me|approve (my|the) promotion|เงินเดือน.*เท่า|โบนัส.*(เท่า|กี่)|รับประกันให้|ช่วยรับประกัน)/i.test(text)) return undefined;
  if (/(next role|development target|ตำแหน่งถัดไป|เป้าหมายการพัฒนา)/i.test(text)
    && /(is |does |mean|promise|guarantee|promotion|คือ|หมายถึง|สัญญา|รับประกัน|เลื่อนตำแหน่ง)/i.test(text)
    && !/(can you|will you|please|give me|คุณช่วย|ช่วยรับประกัน|รับประกันให้)/i.test(text)) return "KB-03";
  if (/(result|assessment|skill|ผลประเมิน|ทักษะ)/i.test(text)
    && /(used for|affect|impact|who can see|privacy|pay|bonus|performance|promotion|มีผล|กระทบ|นำไปใช้|ใคร.*เห็น|โบนัส|เงินเดือน|เลื่อนตำแหน่ง)/i.test(text)) return "KB-01";
  return undefined;
}

/** Own-record assessment summaries pin KB-01 without treating the question as pure policy Q&A. */
export function assessmentExplainPin(text: string): string | undefined {
  if (/(explain my|where do i stand|my (results?|scores?|gaps?|levels?)|ผลประเมินของฉัน|อธิบายผล|จุดที่ต้องพัฒนา)/i.test(text)) return "KB-01";
  return undefined;
}

/** Fixed reply when the user pasted PII. Stays in_scope; never reaches the model. */
export const PII_REPLIES: Record<Lang, string> = {
  en: "I've removed a personal ID or contact detail from your message. Please don't share national ID numbers, phone numbers or email addresses with the coach. Ask again about your results, plan or a lesson without including those details.",
  th: "โค้ชลบเลขบัตรหรือข้อมูลติดต่อส่วนตัวออกจากข้อความของคุณแล้วค่ะ กรุณาอย่าส่งเลขบัตรประชาชน เบอร์โทร หรืออีเมลให้โค้ชนะคะ ลองถามใหม่เกี่ยวกับผลประเมิน แผนการเรียน หรือบทเรียน โดยไม่ใส่ข้อมูลเหล่านั้นค่ะ",
};

export function precheck(text: string, selfId: string, managerId: string | null): Verdict {
  let redacted = text;
  const piiFound: string[] = [];
  for (const [label, re] of PII) {
    if (redacted.match(re)) {
      piiFound.push(label);
      redacted = redacted.replace(re, `[${label.toUpperCase()}]`);
    }
  }
  for (const [category, rule, re] of RULES) {
    if (!re.test(text)) continue;
    if (category === "hr_decision" && programmePolicySource(text) && (rule === "promotion_decision" || programmePolicySource(text) === "KB-01")) continue;
    return { category, rule, redacted, piiFound };
  }
  if (DATA_WORDS.test(text) && otherEmployeeMentioned(text, selfId, managerId))
    return { category: "other_person_data", rule: "named_colleague", redacted, piiFound };
  return { category: "in_scope", redacted, piiFound };
}

const ORDER: Category[] = ["crisis", "injection", "other_person_data", "hr_decision", "wellbeing", "off_topic", "in_scope"];
export const stricter = (a: Category, b: Category): Category => (ORDER.indexOf(a) <= ORDER.indexOf(b) ? a : b);

// Fixed, reviewed responses for blocked categories. These never go through
// the model, so they cannot be talked around.
export const SAFE_REPLIES: Record<Exclude<Category, "in_scope">, Record<Lang, string>> = {
  other_person_data: {
    en: "I can only see and talk about your own learning record, so I can't share anyone else's results. If you want to support a colleague, I can suggest how to coach them on the floor.",
    th: "โค้ชดูและพูดคุยได้เฉพาะข้อมูลการเรียนรู้ของคุณเองเท่านั้น จึงไม่สามารถเปิดเผยผลของคนอื่นได้ค่ะ ถ้าอยากช่วยเพื่อนร่วมงาน โค้ชแนะนำวิธีโค้ชเขาหน้างานได้นะคะ",
  },
  hr_decision: {
    en: "I can't advise on pay, bonus amounts or promotion decisions; your manager or HR business partner is the right person for that. What I can tell you: in this phase your skill results are used for development only, and a next role is a development target, not a promise. Want me to show what's left to be ready for your next role?",
    th: "โค้ชไม่สามารถให้คำแนะนำเรื่องเงินเดือน จำนวนโบนัส หรือการตัดสินใจเลื่อนตำแหน่งได้ค่ะ เรื่องนี้ควรคุยกับหัวหน้าหรือ HR Business Partner สิ่งที่บอกได้คือ ในระยะนี้ผลประเมินทักษะใช้เพื่อการพัฒนาเท่านั้น และตำแหน่งถัดไปคือเป้าหมายการพัฒนา ไม่ใช่คำสัญญา อยากให้โค้ชสรุปไหมคะว่ายังเหลืออะไรบ้างที่จะพร้อมสำหรับตำแหน่งถัดไป",
  },
  wellbeing: {
    en: "That sounds like a lot to carry. I'm a learning coach, so I'm not the right support for this, but you don't have to handle it alone: the Employee Assistance Programme in the HR app offers free, confidential counselling, and your HR business partner can help too. If it would help, we can also slow down your learning plan.",
    th: "ฟังดูเป็นเรื่องที่หนักใจมากเลยค่ะ โค้ชเป็นผู้ช่วยด้านการเรียนรู้ จึงไม่ใช่ผู้ช่วยที่เหมาะกับเรื่องนี้ แต่คุณไม่ต้องรับมือคนเดียวนะคะ โครงการช่วยเหลือพนักงาน (EAP) ในแอป HR มีบริการปรึกษาฟรีและเป็นความลับ และ HR Business Partner ก็ช่วยได้ ถ้าช่วยได้ เราปรับแผนการเรียนให้ช้าลงได้ค่ะ",
  },
  crisis: {
    en: "I'm really sorry you're feeling this way. Please reach out now: call the Department of Mental Health hotline 1323 (24 hours) or emergency services 1669, or contact the Employee Assistance Programme in the HR app. If you are in immediate danger, please tell someone near you.",
    th: "เสียใจมากที่คุณรู้สึกแบบนี้ค่ะ กรุณาติดต่อขอความช่วยเหลือตอนนี้เลย โทรสายด่วนสุขภาพจิต 1323 (ตลอด 24 ชั่วโมง) หรือ 1669 หรือติดต่อโครงการช่วยเหลือพนักงาน (EAP) ในแอป HR ถ้าอยู่ในอันตรายเร่งด่วน กรุณาบอกคนที่อยู่ใกล้คุณนะคะ",
  },
  off_topic: {
    en: "I'm your learning coach, so I stick to your skills, learning plan and course content. Try asking me to explain your results, suggest a next step, or quiz you on a lesson.",
    th: "โค้ชช่วยได้เฉพาะเรื่องทักษะ แผนการเรียนรู้ และเนื้อหาบทเรียนของคุณค่ะ ลองถามให้โค้ชอธิบายผลประเมิน แนะนำขั้นตอนต่อไป หรือทดสอบความรู้จากบทเรียนดูนะคะ",
  },
  injection: {
    en: "I can't change how I work, but I'm happy to help with your learning. What would you like to work on?",
    th: "โค้ชเปลี่ยนวิธีการทำงานของตัวเองไม่ได้ค่ะ แต่ยินดีช่วยเรื่องการเรียนรู้ของคุณ อยากเริ่มจากเรื่องไหนดีคะ",
  },
};
