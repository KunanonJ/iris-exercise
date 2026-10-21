// Mock learning catalogue merged from the two (fictional) learning systems.
// LMS-A = Group Academy, LMS-B = Operations Training, NEW = built for the Suite.
// Items with `content` carry lesson text / transcripts that the coach can cite.
import type { KnowledgeDoc, LearningItem, Level } from "../lib/types";
import { SKILLS } from "./taxonomy";

const RICH: LearningItem[] = [
  {
    id: "LA-101", source: "LMS-A", format: "video", minutes: 8, language: "both",
    title: { en: "Coaching on the floor: Show, Try, Feedback", th: "โค้ชหน้างานด้วย 'สาธิต-ลองทำ-ฟีดแบ็ก'" },
    summary: { en: "A 3-step method to teach a task in under 10 minutes.", th: "วิธี 3 ขั้นตอนในการสอนงานภายใน 10 นาที" },
    skills: [{ skillId: "L-COACH", targetLevel: 2 }],
    content: {
      en: "Coaching on the floor works best in three steps. Step 1, Show: do the task once at normal speed, then again slowly while you explain why each step matters. Step 2, Try: let the colleague do it while you watch. Do not take over; ask questions like 'what comes next?'. Step 3, Feedback: say one thing they did well and one thing to improve, using specific examples. Keep each session under 10 minutes and repeat it over several shifts. Good moments to coach are quiet hours, after a mistake (privately, never in front of customers), and when a new process starts. Track who you coached and on what, so you can follow up within a week.",
      th: "การโค้ชหน้างานได้ผลดีที่สุดเมื่อทำ 3 ขั้นตอน ขั้นที่ 1 สาธิต: ทำงานให้ดูหนึ่งรอบด้วยความเร็วปกติ แล้วทำอีกครั้งช้าๆ พร้อมอธิบายว่าแต่ละขั้นตอนสำคัญอย่างไร ขั้นที่ 2 ลองทำ: ให้เพื่อนร่วมงานลองทำขณะที่คุณดู อย่าเข้าไปทำแทน ให้ถามคำถาม เช่น 'ขั้นต่อไปคืออะไร' ขั้นที่ 3 ฟีดแบ็ก: บอกสิ่งที่เขาทำได้ดีหนึ่งข้อและสิ่งที่ควรปรับปรุงหนึ่งข้อ โดยยกตัวอย่างให้เจาะจง แต่ละครั้งควรใช้เวลาไม่เกิน 10 นาที และทำซ้ำในหลายกะ ช่วงเวลาที่เหมาะกับการโค้ชคือช่วงที่ลูกค้าน้อย หลังเกิดความผิดพลาด (คุยเป็นการส่วนตัว ไม่ใช่ต่อหน้าลูกค้า) และเมื่อเริ่มใช้กระบวนการใหม่ จดไว้ว่าโค้ชใครเรื่องอะไร เพื่อติดตามผลภายในหนึ่งสัปดาห์",
    },
  },
  {
    id: "LA-102", source: "LMS-A", format: "video", minutes: 7, language: "both",
    title: { en: "Feedback that sticks: the SBI model", th: "ฟีดแบ็กที่ได้ผลด้วยโมเดล SBI" },
    summary: { en: "Give specific, fair feedback using Situation-Behaviour-Impact.", th: "ให้ฟีดแบ็กที่เจาะจงและเป็นธรรมด้วย สถานการณ์-พฤติกรรม-ผลกระทบ" },
    skills: [{ skillId: "L-PERF", targetLevel: 2 }],
    content: {
      en: "SBI stands for Situation, Behaviour, Impact. Situation: name when and where it happened, for example 'during the Saturday evening rush'. Behaviour: describe what the person did that you saw or heard, not your opinion of them. Say 'you left the till without logging out', not 'you are careless'. Impact: explain the effect on customers, the team or results. Then pause and ask for their view. Use SBI for positive feedback too; it makes praise believable. Give feedback within 48 hours, in private for anything corrective, and agree one next step together.",
      th: "SBI ย่อมาจาก Situation (สถานการณ์) Behaviour (พฤติกรรม) และ Impact (ผลกระทบ) สถานการณ์: ระบุว่าเกิดขึ้นเมื่อไหร่และที่ไหน เช่น 'ช่วงลูกค้าแน่นเย็นวันเสาร์' พฤติกรรม: อธิบายสิ่งที่คุณเห็นหรือได้ยินว่าเขาทำ ไม่ใช่ความเห็นของคุณต่อตัวเขา ให้พูดว่า 'คุณออกจากเครื่องคิดเงินโดยไม่ได้ล็อกเอาต์' ไม่ใช่ 'คุณสะเพร่า' ผลกระทบ: อธิบายผลที่เกิดกับลูกค้า ทีม หรือผลงาน จากนั้นหยุดและถามมุมมองของเขา ใช้ SBI กับคำชมด้วย จะทำให้คำชมน่าเชื่อถือ ควรให้ฟีดแบ็กภายใน 48 ชั่วโมง เรื่องที่ต้องแก้ไขให้คุยเป็นการส่วนตัว และตกลงขั้นตอนต่อไปร่วมกันหนึ่งข้อ",
    },
  },
  {
    id: "LA-103", source: "LMS-A", format: "workshop", minutes: 960, language: "th",
    title: { en: "New Supervisor Bootcamp (2 days)", th: "หลักสูตรหัวหน้างานมือใหม่ (2 วัน)" },
    summary: { en: "In-person: coaching, feedback and team briefings with role-play.", th: "อบรมในห้องเรียน: การโค้ช การให้ฟีดแบ็ก และการบรีฟทีม พร้อมฝึกบทบาทสมมติ" },
    skills: [{ skillId: "L-COACH", targetLevel: 2 }, { skillId: "L-PERF", targetLevel: 2 }, { skillId: "C-COMM", targetLevel: 3 }],
    sessions: [
      { date: "2026-11-12", location: { en: "Bangkok Learning Centre", th: "ศูนย์การเรียนรู้กรุงเทพฯ" } },
      { date: "2026-11-26", location: { en: "Chonburi Regional Office", th: "สำนักงานภาคชลบุรี" } },
    ],
    content: {
      en: "Day 1 covers the shift from doing to leading: what changes when you supervise former peers, the Show-Try-Feedback coaching method, and running a pre-shift huddle. Day 2 covers SBI feedback, handling pushback, and a role-play assessment with a facilitator. Attendance needs manager approval because it takes two shifts. Bring one real coaching situation from your store to practise on.",
      th: "วันที่ 1 เรียนเรื่องการเปลี่ยนจากผู้ปฏิบัติเป็นผู้นำ สิ่งที่เปลี่ยนไปเมื่อต้องดูแลเพื่อนร่วมงานเดิม วิธีโค้ช 'สาธิต-ลองทำ-ฟีดแบ็ก' และการนำประชุมก่อนเริ่มกะ วันที่ 2 เรียนการให้ฟีดแบ็กแบบ SBI การรับมือเมื่อทีมไม่เห็นด้วย และการประเมินด้วยบทบาทสมมติกับวิทยากร การเข้าอบรมต้องได้รับอนุมัติจากหัวหน้าเพราะใช้เวลาสองกะ ให้เตรียมสถานการณ์การโค้ชจริงจากสาขาของคุณมาหนึ่งเรื่องเพื่อใช้ฝึก",
    },
  },
  {
    id: "LB-201", source: "LMS-B", format: "video", minutes: 9, language: "th",
    title: { en: "Building a weekly roster that covers the peaks", th: "จัดตารางงานรายสัปดาห์ให้ครอบคลุมช่วงพีค" },
    summary: { en: "Use footfall data to match staff to busy hours.", th: "ใช้ข้อมูลจำนวนลูกค้าจัดคนให้ตรงกับช่วงเวลาที่ยุ่ง" },
    skills: [{ skillId: "L-PLAN", targetLevel: 2 }],
    content: {
      en: "A good roster starts from demand, not from last week's roster. First, pull hourly footfall or sales for the last four weeks from the store dashboard and find the peak hours, usually weekday 17:00-20:00 and weekend afternoons. Second, set minimum cover: at least one person who can handle complaints and one trained on the till in every hour. Third, place your strongest people on peaks and use quiet hours for replenishment and coaching. Fourth, check labour law limits on hours and rest days and approved leave before publishing. Publish the roster at least seven days ahead so staff can plan.",
      th: "ตารางงานที่ดีเริ่มจากความต้องการ ไม่ใช่ลอกตารางสัปดาห์ก่อน ขั้นแรก ดึงข้อมูลจำนวนลูกค้าหรือยอดขายรายชั่วโมงย้อนหลังสี่สัปดาห์จากแดชบอร์ดสาขา แล้วหาช่วงพีค ซึ่งมักเป็นวันธรรมดา 17:00-20:00 และบ่ายวันหยุด ขั้นที่สอง กำหนดจำนวนคนขั้นต่ำ ทุกชั่วโมงต้องมีคนที่รับมือข้อร้องเรียนได้อย่างน้อยหนึ่งคนและคนที่ใช้เครื่องคิดเงินเป็นอย่างน้อยหนึ่งคน ขั้นที่สาม วางคนที่เก่งที่สุดไว้ช่วงพีค และใช้ช่วงลูกค้าน้อยสำหรับเติมสินค้าและโค้ชทีม ขั้นที่สี่ ตรวจข้อจำกัดชั่วโมงทำงานและวันหยุดตามกฎหมายแรงงาน รวมถึงวันลาที่อนุมัติแล้วก่อนประกาศ ควรประกาศตารางล่วงหน้าอย่างน้อยเจ็ดวันเพื่อให้พนักงานวางแผนได้",
    },
  },
  {
    id: "NEW-301", source: "NEW", format: "project", minutes: 240, language: "both",
    title: { en: "Project: plan next month's roster with your manager", th: "โปรเจกต์: วางแผนตารางงานเดือนหน้าร่วมกับหัวหน้า" },
    summary: { en: "Draft a real roster, review it with your manager, then run it for a week.", th: "ร่างตารางงานจริง ทบทวนกับหัวหน้า แล้วใช้จริงหนึ่งสัปดาห์" },
    skills: [{ skillId: "L-PLAN", targetLevel: 2 }],
    content: {
      en: "Evidence needed for sign-off: (1) your draft roster, (2) the peak-hour data you used, (3) a short note on what you changed after your manager's review and what happened in the week you ran it. Your manager approves completion in the app.",
      th: "หลักฐานที่ต้องส่งเพื่อขออนุมัติ: (1) ร่างตารางงานของคุณ (2) ข้อมูลช่วงพีคที่ใช้ (3) บันทึกสั้นๆ ว่าปรับอะไรหลังหัวหน้าทบทวน และผลเป็นอย่างไรในสัปดาห์ที่ใช้จริง หัวหน้าจะอนุมัติการจบโปรเจกต์ในแอป",
    },
  },
  {
    id: "LB-202", source: "LMS-B", format: "video", minutes: 6, language: "th",
    title: { en: "Shrink 101: where stock goes missing", th: "พื้นฐานการสูญหายของสินค้า: สต็อกหายไปไหน" },
    summary: { en: "The four sources of shrink and quick checks for each.", th: "สี่แหล่งที่มาของการสูญหายและวิธีตรวจเช็กเบื้องต้น" },
    skills: [{ skillId: "T-INV", targetLevel: 2 }],
    content: {
      en: "Shrink is the gap between the stock the system expects and the stock you actually have. It has four main sources: admin errors (wrong receiving, wrong price or barcode), damage and expiry, supplier shortfalls, and theft by customers or staff. In most of our stores admin errors are the biggest and easiest to fix. Quick checks: count deliveries against the delivery note before signing, scan every item at receiving, and record damaged goods the same day.",
      th: "การสูญหาย (Shrink) คือส่วนต่างระหว่างสต็อกที่ระบบคาดว่าจะมีกับสต็อกที่มีอยู่จริง มีสี่แหล่งหลัก ได้แก่ ความผิดพลาดด้านเอกสาร (รับสินค้าผิด ราคาหรือบาร์โค้ดผิด) สินค้าเสียหายและหมดอายุ ผู้ขายส่งของไม่ครบ และการลักขโมยโดยลูกค้าหรือพนักงาน ในสาขาส่วนใหญ่ของเรา ความผิดพลาดด้านเอกสารเป็นสาเหตุใหญ่ที่สุดและแก้ง่ายที่สุด วิธีตรวจเช็กเบื้องต้น: นับสินค้าเทียบกับใบส่งของก่อนเซ็นรับ สแกนสินค้าทุกชิ้นตอนรับ และบันทึกสินค้าเสียหายภายในวันเดียวกัน",
    },
  },
  {
    id: "LB-203", source: "LMS-B", format: "video", minutes: 10, language: "th",
    title: { en: "Cycle counts and variance root cause", th: "การนับสต็อกแบบหมุนเวียนและการหาต้นเหตุส่วนต่าง" },
    summary: { en: "Count a few categories every day and investigate big variances.", th: "นับสินค้าบางหมวดทุกวันและสืบหาสาเหตุของส่วนต่างที่สูง" },
    skills: [{ skillId: "T-INV", targetLevel: 3 }],
    content: {
      en: "Cycle counting means counting a small set of categories every day instead of the whole store once a year. Prioritise high-value and high-shrink categories, such as electrical goods and personal care. When a variance is above 2% or 2,000 baht, investigate before adjusting: check recent receiving, transfers, returns and price changes for that item. Use the 5 Whys to reach a root cause. Record the cause in the variance log so patterns show up across weeks. Never adjust stock to hide a variance; adjustments above the store limit need manager approval.",
      th: "การนับแบบหมุนเวียน (Cycle count) คือการนับสินค้าบางหมวดทุกวัน แทนการนับทั้งสาขาปีละครั้ง ให้นับหมวดที่มีมูลค่าสูงและสูญหายบ่อยก่อน เช่น เครื่องใช้ไฟฟ้าและของใช้ส่วนตัว เมื่อส่วนต่างเกิน 2% หรือ 2,000 บาท ให้สืบหาสาเหตุก่อนปรับยอด โดยตรวจการรับสินค้า การโอนย้าย การคืนสินค้า และการเปลี่ยนราคาล่าสุดของสินค้านั้น ใช้เทคนิคถามว่าทำไม 5 ครั้ง (5 Whys) เพื่อหาต้นเหตุ บันทึกสาเหตุลงในบันทึกส่วนต่างเพื่อให้เห็นรูปแบบในแต่ละสัปดาห์ ห้ามปรับสต็อกเพื่อปิดบังส่วนต่าง การปรับยอดที่เกินวงเงินของสาขาต้องได้รับอนุมัติจากผู้จัดการ",
    },
  },
  {
    id: "NEW-302", source: "NEW", format: "project", minutes: 600, language: "both",
    title: { en: "Project: lead a 4-week shrink reduction in your store", th: "โปรเจกต์: นำการลดการสูญหายในสาขา 4 สัปดาห์" },
    summary: { en: "Pick one high-shrink category, find the root cause and fix it.", th: "เลือกหมวดสินค้าที่สูญหายสูงหนึ่งหมวด หาต้นเหตุ และแก้ไข" },
    skills: [{ skillId: "T-INV", targetLevel: 3 }, { skillId: "L-DEC", targetLevel: 2 }],
    content: {
      en: "Week 1: choose a category with your manager using the shrink report and set a baseline. Week 2: run daily cycle counts and log variances with causes. Week 3: agree and apply one or two fixes with the team. Week 4: compare against the baseline and present results to your manager in 10 minutes. Evidence: variance log, before/after numbers, and a one-page summary. Your manager approves completion and rates the project.",
      th: "สัปดาห์ที่ 1: เลือกหมวดสินค้าร่วมกับหัวหน้าโดยใช้รายงานการสูญหาย และกำหนดค่าตั้งต้น สัปดาห์ที่ 2: นับแบบหมุนเวียนทุกวันและบันทึกส่วนต่างพร้อมสาเหตุ สัปดาห์ที่ 3: ตกลงวิธีแก้หนึ่งหรือสองวิธีกับทีมและลงมือทำ สัปดาห์ที่ 4: เปรียบเทียบกับค่าตั้งต้นและนำเสนอผลต่อหัวหน้าภายใน 10 นาที หลักฐาน: บันทึกส่วนต่าง ตัวเลขก่อนและหลัง และสรุปหนึ่งหน้า หัวหน้าจะอนุมัติการจบโปรเจกต์และให้คะแนน",
    },
  },
  {
    id: "LA-104", source: "LMS-A", format: "video", minutes: 6, language: "both",
    title: { en: "The LAST method for complaints", th: "วิธี LAST ในการจัดการข้อร้องเรียน" },
    summary: { en: "Listen, Apologise, Solve, Thank.", th: "ฟัง ขอโทษ แก้ไข ขอบคุณ" },
    skills: [{ skillId: "T-CMPL", targetLevel: 2 }],
    content: {
      en: "LAST is a four-step way to handle a complaint. Listen: let the customer finish without interrupting, and repeat the main point back. Apologise: say sorry for the experience, even if it was not your fault. Solve: offer a fix within your authority, such as an exchange or refund under the returns policy, or call a supervisor if it is beyond it. Thank: thank the customer for telling you. Log every complaint in the store app so trends can be fixed at the source.",
      th: "LAST คือวิธีจัดการข้อร้องเรียน 4 ขั้นตอน Listen (ฟัง): ให้ลูกค้าพูดจนจบโดยไม่ขัดจังหวะ และทวนประเด็นหลักกลับไป Apologise (ขอโทษ): ขอโทษในประสบการณ์ที่เกิดขึ้น แม้จะไม่ใช่ความผิดของคุณ Solve (แก้ไข): เสนอทางแก้ภายในอำนาจของคุณ เช่น เปลี่ยนสินค้าหรือคืนเงินตามนโยบายการคืนสินค้า หรือเรียกหัวหน้าหากเกินอำนาจ Thank (ขอบคุณ): ขอบคุณลูกค้าที่บอกเรา บันทึกข้อร้องเรียนทุกครั้งในแอปสาขาเพื่อให้แก้ปัญหาที่ต้นเหตุได้",
    },
  },
  {
    id: "LA-105", source: "LMS-A", format: "workshop", minutes: 240, language: "th",
    title: { en: "Difficult customers: role-play clinic", th: "คลินิกฝึกรับมือลูกค้ายาก" },
    summary: { en: "Half-day practice on escalated and emotional complaints.", th: "ฝึกครึ่งวันกับข้อร้องเรียนที่รุนแรงและใช้อารมณ์" },
    skills: [{ skillId: "T-CMPL", targetLevel: 3 }, { skillId: "C-COMM", targetLevel: 3 }],
    sessions: [
      { date: "2026-11-05", location: { en: "Bangkok Learning Centre", th: "ศูนย์การเรียนรู้กรุงเทพฯ" } },
      { date: "2026-11-19", location: { en: "Khon Kaen Regional Office", th: "สำนักงานภาคขอนแก่น" } },
    ],
    content: {
      en: "The clinic practises escalated complaints: angry customers, refund requests outside policy, and complaints posted on social media. You learn to lower the temperature (calm voice, move to a quieter spot, use the customer's name), set limits politely, and hand over to a manager without the customer feeling passed around. Each participant does three recorded role-plays and receives feedback.",
      th: "คลินิกนี้ฝึกรับมือข้อร้องเรียนที่รุนแรง เช่น ลูกค้าโกรธ ขอคืนเงินนอกนโยบาย และข้อร้องเรียนที่โพสต์บนโซเชียลมีเดีย คุณจะได้เรียนวิธีลดความตึงเครียด (ใช้น้ำเสียงสงบ พาไปที่ที่เงียบกว่า เรียกชื่อลูกค้า) การบอกขอบเขตอย่างสุภาพ และการส่งต่อให้ผู้จัดการโดยลูกค้าไม่รู้สึกว่าถูกโยนไปมา ผู้เข้าอบรมแต่ละคนจะฝึกบทบาทสมมติสามครั้งพร้อมบันทึกวิดีโอและได้รับฟีดแบ็ก",
    },
  },
  {
    id: "LB-204", source: "LMS-B", format: "video", minutes: 4, language: "th",
    title: { en: "Reading your store dashboard in 3 minutes", th: "อ่านแดชบอร์ดสาขาใน 3 นาที" },
    summary: { en: "Which five numbers to check every morning and what to do about them.", th: "ตัวเลข 5 ตัวที่ต้องดูทุกเช้าและควรทำอะไรต่อ" },
    skills: [{ skillId: "L-DEC", targetLevel: 2 }],
    content: {
      en: "Check five numbers every morning: yesterday's sales against target, conversion rate, out-of-stocks on top-selling items, shrink month-to-date, and open customer complaints. Pick at most two to act on today and tell the team in the huddle. A number in red for three days in a row should go to your manager with a proposed action.",
      th: "ตรวจตัวเลข 5 ตัวทุกเช้า ได้แก่ ยอดขายเมื่อวานเทียบเป้า อัตราการซื้อของลูกค้า สินค้าขายดีที่ขาดสต็อก ยอดสูญหายสะสมของเดือน และข้อร้องเรียนที่ยังไม่ปิด เลือกไม่เกินสองเรื่องที่จะลงมือทำวันนี้และแจ้งทีมในการประชุมก่อนเริ่มงาน ตัวเลขที่เป็นสีแดงติดกันสามวันควรแจ้งหัวหน้าพร้อมเสนอแนวทางแก้ไข",
    },
  },
  {
    id: "LB-205", source: "LMS-B", format: "video", minutes: 7, language: "th",
    title: { en: "Safety walk for shift leaders", th: "การเดินตรวจความปลอดภัยสำหรับหัวหน้ากะ" },
    summary: { en: "A 15-minute walk that prevents most store incidents.", th: "การเดินตรวจ 15 นาทีที่ป้องกันอุบัติเหตุในสาขาได้ส่วนใหญ่" },
    skills: [{ skillId: "C-SAFE", targetLevel: 3 }],
    content: {
      en: "Do a 15-minute safety walk at the start of each shift. Check: blocked fire exits, wet floors, unsafe stacking above shoulder height, damaged ladders, and trailing cables. Fix what you can on the spot, tag and report the rest in the safety app. If you see unsafe work, stop it politely and explain why. Every near miss must be reported the same day; near misses are how we prevent real injuries.",
      th: "เดินตรวจความปลอดภัย 15 นาทีเมื่อเริ่มกะ ตรวจสอบทางหนีไฟที่ถูกกีดขวาง พื้นเปียก การวางของสูงเกินระดับไหล่อย่างไม่ปลอดภัย บันไดชำรุด และสายไฟที่พาดเกะกะ แก้ไขสิ่งที่ทำได้ทันที ส่วนที่เหลือให้ติดป้ายและรายงานในแอปความปลอดภัย หากเห็นการทำงานที่ไม่ปลอดภัย ให้หยุดอย่างสุภาพและอธิบายเหตุผล เหตุการณ์เกือบเกิดอุบัติเหตุทุกครั้งต้องรายงานภายในวันเดียวกัน เพราะเป็นวิธีที่เราป้องกันการบาดเจ็บจริง",
    },
  },
  {
    id: "LA-106", source: "LMS-A", format: "video", minutes: 5, language: "both",
    title: { en: "Running a 10-minute pre-shift huddle", th: "นำประชุมก่อนเริ่มกะใน 10 นาที" },
    summary: { en: "Results, focus, safety, shout-out: a simple huddle structure.", th: "ผลงาน เป้าหมายวันนี้ ความปลอดภัย และคำชม: โครงสร้างประชุมแบบง่าย" },
    skills: [{ skillId: "C-COMM", targetLevel: 3 }, { skillId: "L-COACH", targetLevel: 2 }],
    content: {
      en: "Keep the huddle to 10 minutes, standing, at the same time every shift. Use four parts: results (one number from yesterday), focus (one or two priorities for today), safety (one reminder or near miss), and a shout-out (thank one person by name for something specific). End by asking 'any questions or blockers?'. Rotate who leads the huddle so team members practise speaking up.",
      th: "ประชุมไม่เกิน 10 นาที ยืนประชุม และทำเวลาเดิมทุกกะ แบ่งเป็นสี่ส่วน: ผลงาน (ตัวเลขหนึ่งตัวจากเมื่อวาน) เป้าหมาย (งานสำคัญหนึ่งหรือสองเรื่องของวันนี้) ความปลอดภัย (ข้อเตือนใจหรือเหตุการณ์เกือบเกิดอุบัติเหตุหนึ่งเรื่อง) และคำชม (ขอบคุณใครสักคนโดยเอ่ยชื่อและบอกสิ่งที่เขาทำอย่างเจาะจง) ปิดท้ายด้วยการถามว่า 'มีคำถามหรือติดปัญหาอะไรไหม' และสลับให้ทีมงานเป็นผู้นำประชุมเพื่อฝึกการพูด",
    },
  },
  {
    id: "NEW-303", source: "NEW", format: "project", minutes: 300, language: "both",
    title: { en: "Project: coach a new starter through their first 2 weeks", th: "โปรเจกต์: โค้ชพนักงานใหม่ใน 2 สัปดาห์แรก" },
    summary: { en: "Use Show-Try-Feedback on five core tasks with a new colleague.", th: "ใช้วิธี 'สาธิต-ลองทำ-ฟีดแบ็ก' กับงานหลัก 5 อย่างร่วมกับพนักงานใหม่" },
    skills: [{ skillId: "L-COACH", targetLevel: 2 }],
    content: {
      en: "Agree five core tasks with your manager (for example receiving, till close, complaint first response, replenishment, safety walk). Coach each with Show-Try-Feedback and log the date and outcome. Evidence: the coaching log and a short reflection on what you would do differently. The new starter gives a one-line comment and your manager approves completion.",
      th: "ตกลงงานหลัก 5 อย่างกับหัวหน้า (เช่น การรับสินค้า การปิดเครื่องคิดเงิน การรับเรื่องร้องเรียนเบื้องต้น การเติมสินค้า การเดินตรวจความปลอดภัย) โค้ชแต่ละงานด้วยวิธี 'สาธิต-ลองทำ-ฟีดแบ็ก' และบันทึกวันที่และผลลัพธ์ หลักฐาน: บันทึกการโค้ชและข้อสะท้อนสั้นๆ ว่าครั้งหน้าจะทำอะไรต่างไป พนักงานใหม่ให้ความเห็นหนึ่งบรรทัด และหัวหน้าอนุมัติการจบโปรเจกต์",
    },
  },
  // Packaging
  {
    id: "LB-401", source: "LMS-B", format: "video", minutes: 9, language: "th",
    title: { en: "SMED changeover in 5 steps", th: "การเปลี่ยนรุ่นแบบ SMED ใน 5 ขั้นตอน" },
    summary: { en: "Separate internal and external tasks to cut changeover time.", th: "แยกงานภายในและงานภายนอกเพื่อลดเวลาเปลี่ยนรุ่น" },
    skills: [{ skillId: "T-CHGO", targetLevel: 2 }],
    content: {
      en: "SMED cuts changeover time in five steps: (1) film or time the current changeover, (2) list every task, (3) mark tasks that can be done while the machine is still running as external, (4) move external tasks before or after the stop, such as preparing the next roll and tools, (5) simplify the remaining internal tasks with quick clamps and standard settings. Most lines cut changeover time by 30-50% with steps 3 and 4 alone.",
      th: "SMED ลดเวลาเปลี่ยนรุ่นได้ใน 5 ขั้นตอน: (1) ถ่ายวิดีโอหรือจับเวลาการเปลี่ยนรุ่นปัจจุบัน (2) ระบุงานทุกอย่าง (3) ทำเครื่องหมายงานที่ทำได้ขณะเครื่องยังเดินอยู่ว่าเป็นงานภายนอก (4) ย้ายงานภายนอกไปทำก่อนหรือหลังหยุดเครื่อง เช่น เตรียมม้วนวัสดุและเครื่องมือชุดถัดไป (5) ทำให้งานภายในที่เหลือง่ายขึ้นด้วยตัวหนีบแบบเร็วและค่าตั้งมาตรฐาน ไลน์ผลิตส่วนใหญ่ลดเวลาเปลี่ยนรุ่นได้ 30-50% จากขั้นตอนที่ 3 และ 4 เพียงอย่างเดียว",
    },
  },
  {
    id: "LB-402", source: "LMS-B", format: "video", minutes: 8, language: "th",
    title: { en: "OEE explained with one line", th: "อธิบาย OEE ด้วยไลน์ผลิตเดียว" },
    summary: { en: "Availability x Performance x Quality, with a worked example.", th: "ความพร้อม x ประสิทธิภาพ x คุณภาพ พร้อมตัวอย่างการคำนวณ" },
    skills: [{ skillId: "T-OEE", targetLevel: 2 }],
    content: {
      en: "OEE = Availability x Performance x Quality. Availability is run time divided by planned time; stops and changeovers reduce it. Performance is actual speed against ideal speed; small stops and slow running reduce it. Quality is good units divided by total units; scrap and rework reduce it. Example: 90% availability x 85% performance x 98% quality = 75% OEE. Track the top three losses each shift and attack the biggest one first.",
      th: "OEE = ความพร้อมใช้งาน x ประสิทธิภาพ x คุณภาพ ความพร้อมใช้งานคือเวลาเดินเครื่องหารด้วยเวลาที่วางแผนไว้ การหยุดเครื่องและการเปลี่ยนรุ่นทำให้ค่านี้ลดลง ประสิทธิภาพคือความเร็วจริงเทียบกับความเร็วมาตรฐาน การหยุดสั้นๆ และการเดินเครื่องช้าทำให้ค่านี้ลดลง คุณภาพคือจำนวนชิ้นงานดีหารด้วยจำนวนทั้งหมด ของเสียและงานแก้ทำให้ค่านี้ลดลง ตัวอย่าง: ความพร้อม 90% x ประสิทธิภาพ 85% x คุณภาพ 98% = OEE 75% ติดตามความสูญเสียสามอันดับแรกทุกกะ และแก้ปัญหาที่ใหญ่ที่สุดก่อน",
    },
  },
  {
    id: "LB-403", source: "LMS-B", format: "video", minutes: 6, language: "th",
    title: { en: "Daily autonomous maintenance checks", th: "การตรวจเช็กบำรุงรักษาด้วยตนเองประจำวัน" },
    summary: { en: "Clean, inspect, lubricate, tighten: before every shift.", th: "ทำความสะอาด ตรวจสอบ หล่อลื่น ขันแน่น ก่อนทุกกะ" },
    skills: [{ skillId: "T-MAINT", targetLevel: 2 }],
    content: {
      en: "Operators do four checks before each shift: clean the machine to reveal leaks and cracks, inspect against the visual checklist, lubricate the marked points, and tighten loose bolts. Report anything abnormal with a red tag. Lock out and tag out the machine before touching moving parts. These checks prevent most unplanned stops.",
      th: "พนักงานเดินเครื่องตรวจเช็ก 4 อย่างก่อนทุกกะ: ทำความสะอาดเครื่องเพื่อให้เห็นรอยรั่วและรอยร้าว ตรวจสอบตามเช็กลิสต์ภาพ หล่อลื่นตามจุดที่ทำเครื่องหมายไว้ และขันน็อตที่หลวม รายงานสิ่งผิดปกติด้วยป้ายแดง ต้องล็อกและแขวนป้ายเครื่องก่อนสัมผัสชิ้นส่วนที่เคลื่อนไหว การตรวจเช็กเหล่านี้ป้องกันการหยุดเครื่องโดยไม่ได้วางแผนได้เกือบทั้งหมด",
    },
  },
  {
    id: "NEW-401", source: "NEW", format: "project", minutes: 600, language: "both",
    title: { en: "Project: cut changeover time on your line by 20%", th: "โปรเจกต์: ลดเวลาเปลี่ยนรุ่นในไลน์ของคุณ 20%" },
    summary: { en: "Apply SMED on one product change and prove the result.", th: "ใช้ SMED กับการเปลี่ยนรุ่นหนึ่งครั้งและพิสูจน์ผลลัพธ์" },
    skills: [{ skillId: "T-CHGO", targetLevel: 3 }, { skillId: "T-OEE", targetLevel: 2 }],
    content: {
      en: "Evidence: baseline changeover time, task list with internal/external split, the changes made, and five changeovers after the change. Your shift supervisor approves completion.",
      th: "หลักฐาน: เวลาเปลี่ยนรุ่นตั้งต้น รายการงานที่แยกงานภายในและภายนอก สิ่งที่เปลี่ยนแปลง และผลการเปลี่ยนรุ่นห้าครั้งหลังปรับปรุง หัวหน้ากะเป็นผู้อนุมัติการจบโปรเจกต์",
    },
  },
  {
    id: "LA-402", source: "LMS-A", format: "workshop", minutes: 480, language: "th",
    title: { en: "Line Leader Fundamentals", th: "พื้นฐานหัวหน้าไลน์ผลิต" },
    summary: { en: "One day: huddles, standard work and coaching operators.", th: "หนึ่งวัน: การประชุมทีม งานมาตรฐาน และการโค้ชพนักงานเดินเครื่อง" },
    skills: [{ skillId: "L-COACH", targetLevel: 2 }, { skillId: "C-COMM", targetLevel: 3 }, { skillId: "T-5S", targetLevel: 3 }],
    sessions: [{ date: "2026-11-18", location: { en: "Rayong Plant Training Room", th: "ห้องอบรมโรงงานระยอง" } }],
    content: {
      en: "A one-day plant workshop on leading a line: start-of-shift huddles, keeping standard work up to date, 5S audits, and coaching operators with Show-Try-Feedback at the machine.",
      th: "เวิร์กช็อปหนึ่งวันในโรงงานเรื่องการนำไลน์ผลิต: การประชุมก่อนเริ่มกะ การปรับปรุงงานมาตรฐานให้ทันสมัย การตรวจ 5ส และการโค้ชพนักงานเดินเครื่องด้วยวิธี 'สาธิต-ลองทำ-ฟีดแบ็ก' ที่หน้าเครื่อง",
    },
  },
  // Warehouse
  {
    id: "LB-501", source: "LMS-B", format: "video", minutes: 5, language: "th",
    title: { en: "Forklift pre-use check", th: "การตรวจรถยกก่อนใช้งาน" },
    summary: { en: "The 8-point check before every shift.", th: "การตรวจ 8 จุดก่อนทุกกะ" },
    skills: [{ skillId: "T-FORK", targetLevel: 2 }],
    content: {
      en: "Check eight points before driving: tyres, forks and chains, hydraulic leaks, brakes, horn and lights, seat belt, battery or fuel, and the load chart. Do not use a forklift that fails any check; tag it and tell your team lead.",
      th: "ตรวจ 8 จุดก่อนขับ: ยาง งาและโซ่ รอยรั่วของระบบไฮดรอลิก เบรก แตรและไฟ เข็มขัดนิรภัย แบตเตอรี่หรือเชื้อเพลิง และตารางน้ำหนักบรรทุก ห้ามใช้รถยกที่ไม่ผ่านการตรวจข้อใดข้อหนึ่ง ให้ติดป้ายและแจ้งหัวหน้าทีม",
    },
  },
  {
    id: "LB-502", source: "LMS-B", format: "video", minutes: 6, language: "th",
    title: { en: "Picking accuracy: 4 habits", th: "ความแม่นยำในการหยิบสินค้า: 4 นิสัย" },
    summary: { en: "Scan, confirm, separate, check.", th: "สแกน ยืนยัน แยก ตรวจ" },
    skills: [{ skillId: "T-PICK", targetLevel: 3 }],
    content: {
      en: "Four habits drive picking accuracy: scan the location and the item every time, confirm the quantity on screen before moving, keep orders physically separated on the cart, and do a final check of item count before sealing. Mis-picks cost far more to fix after dispatch than before.",
      th: "4 นิสัยที่ทำให้หยิบสินค้าแม่นยำ: สแกนตำแหน่งและสินค้าทุกครั้ง ยืนยันจำนวนบนหน้าจอก่อนเคลื่อนที่ แยกคำสั่งซื้อแต่ละรายการบนรถเข็นให้ชัดเจน และตรวจนับจำนวนครั้งสุดท้ายก่อนปิดกล่อง การหยิบผิดมีต้นทุนแก้ไขหลังจัดส่งสูงกว่าก่อนจัดส่งมาก",
    },
  },
];

// Catalogue breadth: one generic course per skill and level, alternating LMS.
// These mimic catalogue entries that have metadata but no transcript yet.
const LEVEL_NAMES: Record<Level, { en: string; th: string }> = {
  1: { en: "Essentials", th: "พื้นฐาน" },
  2: { en: "Practitioner", th: "ระดับปฏิบัติ" },
  3: { en: "Advanced", th: "ระดับสูง" },
  4: { en: "Expert", th: "ระดับผู้เชี่ยวชาญ" },
};

const GENERIC: LearningItem[] = SKILLS.flatMap((s, i) =>
  ([1, 2, 3] as Level[]).map((lvl) => ({
    id: `${i % 2 ? "LA" : "LB"}-G${String(i * 3 + lvl).padStart(3, "0")}`,
    source: (i % 2 ? "LMS-A" : "LMS-B") as LearningItem["source"],
    format: "video" as const,
    title: { en: `${s.name.en}: ${LEVEL_NAMES[lvl].en}`, th: `${s.name.th}: ${LEVEL_NAMES[lvl].th}` },
    summary: { en: `Catalogue course for ${s.name.en.toLowerCase()} at level ${lvl}.`, th: `หลักสูตร${s.name.th} ระดับ ${lvl}` },
    skills: [{ skillId: s.id, targetLevel: lvl }],
    minutes: 20 + lvl * 10,
    language: "th" as const,
  })),
);

// Video lessons with a transcript get a sample clip per language, rendered by `pnpm videos`.
const clip = (id: string, ext: "mp4" | "jpg") => ({ th: `/lessons/${id}.th.${ext}`, en: `/lessons/${id}.en.${ext}` });
const withClip = (item: LearningItem): LearningItem =>
  item.format === "video" && item.content ? { ...item, video: { src: clip(item.id, "mp4"), poster: clip(item.id, "jpg") } } : item;

export const CATALOG: LearningItem[] = [...RICH.map(withClip), ...GENERIC];
export const itemById = (id: string) => CATALOG.find((c) => c.id === id);

export const KNOWLEDGE: KnowledgeDoc[] = [
  {
    id: "KB-01",
    title: { en: "How your skill results are used", th: "ผลประเมินทักษะของคุณถูกนำไปใช้อย่างไร" },
    content: {
      en: "In this first phase, skill results are used for your development only. They are not used for pay, bonus, performance ratings or promotion decisions. Your result combines your self-assessment, a short knowledge check and your manager's review; your manager approves the final result. If you disagree, you can ask for a review conversation with your manager, and then with your HR business partner. You can see your own results; your manager sees results for their direct reports; HR and leaders see only group totals of 10 people or more.",
      th: "ในระยะแรกนี้ ผลประเมินทักษะใช้เพื่อการพัฒนาตัวคุณเท่านั้น ไม่นำไปใช้กำหนดเงินเดือน โบนัส ผลการประเมินการปฏิบัติงาน หรือการเลื่อนตำแหน่ง ผลของคุณมาจากการประเมินตนเอง แบบทดสอบความรู้สั้นๆ และการทบทวนโดยหัวหน้า โดยหัวหน้าเป็นผู้อนุมัติผลสุดท้าย หากไม่เห็นด้วย คุณขอคุยทบทวนกับหัวหน้าได้ และต่อด้วย HR Business Partner คุณเห็นผลของตัวเอง หัวหน้าเห็นผลของลูกทีมโดยตรง ส่วน HR และผู้บริหารเห็นเฉพาะภาพรวมของกลุ่มที่มี 10 คนขึ้นไป",
    },
  },
  {
    id: "KB-02",
    title: { en: "Learning time and approvals", th: "เวลาเรียนรู้และการอนุมัติ" },
    content: {
      en: "Every employee in the programme has up to 2 hours of paid learning time per month during working hours; agree the slot with your supervisor. Videos can be watched any time. Workshops need manager approval because they take you off shift. Projects need your manager's sign-off on the evidence when you finish. Your manager has 5 working days to approve your assessment, plan or project; after that the request is escalated to your HR business partner.",
      th: "พนักงานทุกคนในโครงการมีเวลาเรียนรู้แบบได้รับค่าจ้างสูงสุด 2 ชั่วโมงต่อเดือนในเวลางาน โดยตกลงช่วงเวลากับหัวหน้างาน วิดีโอดูได้ทุกเวลา เวิร์กช็อปต้องได้รับอนุมัติจากหัวหน้าเพราะต้องออกจากกะ โปรเจกต์ต้องให้หัวหน้าอนุมัติหลักฐานเมื่อทำเสร็จ หัวหน้ามีเวลา 5 วันทำการในการอนุมัติผลประเมิน แผนการเรียนรู้ หรือโปรเจกต์ หากเกินกำหนด คำขอจะถูกส่งต่อไปยัง HR Business Partner",
    },
  },
  {
    id: "KB-03",
    title: { en: "Next roles and career moves", th: "ตำแหน่งถัดไปและการเติบโตในสายอาชีพ" },
    content: {
      en: "Your 'next role' is a development target that you choose with your manager. It is not a promise of promotion. You are considered ready when you meet the required level on all critical skills for that role. Open positions are advertised on the internal job board, and readiness in the Learning Suite can support your application.",
      th: "'ตำแหน่งถัดไป' คือเป้าหมายการพัฒนาที่คุณเลือกร่วมกับหัวหน้า ไม่ใช่คำสัญญาว่าจะได้เลื่อนตำแหน่ง คุณจะถือว่าพร้อมเมื่อมีระดับทักษะถึงเกณฑ์ในทุกทักษะสำคัญของตำแหน่งนั้น ตำแหน่งที่เปิดรับจะประกาศบนบอร์ดงานภายใน และความพร้อมใน Learning Suite ใช้ประกอบการสมัครได้",
    },
  },
  {
    id: "KB-04",
    title: { en: "About the AI coach", th: "เกี่ยวกับโค้ช AI" },
    content: {
      en: "The AI coach can explain your results, suggest next steps, answer questions about your learning content, and help you practise and reflect. It only uses approved learning content and your own learning record. It cannot see other employees' data and cannot answer questions about pay, bonus or promotion decisions. For wellbeing or personal concerns, contact the Employee Assistance Programme in the HR app. Conversations are kept for 90 days to improve quality and are not used for performance decisions.",
      th: "โค้ช AI ช่วยอธิบายผลประเมิน แนะนำขั้นตอนต่อไป ตอบคำถามเกี่ยวกับเนื้อหาการเรียน และช่วยฝึกฝนและทบทวนตัวเอง โค้ชใช้เฉพาะเนื้อหาการเรียนที่ได้รับอนุมัติและข้อมูลการเรียนของคุณเอง ไม่สามารถเห็นข้อมูลของพนักงานคนอื่น และไม่ตอบคำถามเรื่องเงินเดือน โบนัส หรือการตัดสินใจเลื่อนตำแหน่ง หากมีเรื่องความเป็นอยู่หรือเรื่องส่วนตัว ติดต่อโครงการช่วยเหลือพนักงาน (EAP) ในแอป HR บทสนทนาจะถูกเก็บไว้ 90 วันเพื่อปรับปรุงคุณภาพ และไม่นำไปใช้ประเมินผลงาน",
    },
  },
];
