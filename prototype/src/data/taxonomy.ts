// Fictional skills taxonomy for the mock client. Hand-authored; all names and
// numbers are invented for the case exercise.
import type { Bilingual, BusinessUnit, Level, Role, RoleRequirement, Skill, SkillCategory } from "../lib/types";

export const BUSINESS_UNITS: BusinessUnit[] = [
  { id: "RD", name: { th: "ค้าปลีกและกระจายสินค้า", en: "Retail & Distribution" }, headcount: 11000, frontlineShare: 0.85, pilot: true },
  { id: "PK", name: { th: "บรรจุภัณฑ์", en: "Packaging" }, headcount: 6500, frontlineShare: 0.75, pilot: true },
  { id: "BM", name: { th: "วัสดุก่อสร้าง", en: "Building Materials" }, headcount: 13000, frontlineShare: 0.65, pilot: false },
  { id: "CH", name: { th: "เคมีภัณฑ์", en: "Chemicals" }, headcount: 7500, frontlineShare: 0.45, pilot: false },
  { id: "CS", name: { th: "บริการองค์กร", en: "Corporate Services" }, headcount: 7000, frontlineShare: 0.05, pilot: false },
];

// Wave 1 = Thailand staff of RD and PK, including their people managers.
export const PILOT = { headcount: 12000, rd: 8500, pk: 3500, roles: 18 };

const generic = (en: string, th: string): Skill["levels"] => [
  { en: `Knows the basics of ${en.toLowerCase()}; needs guidance on most tasks`, th: `รู้หลักพื้นฐานด้าน${th} ยังต้องมีคนแนะนำในงานส่วนใหญ่` },
  { en: `Applies ${en.toLowerCase()} independently in routine situations`, th: `ใช้ทักษะ${th}ได้ด้วยตนเองในสถานการณ์ปกติ` },
  { en: `Handles complex or unusual ${en.toLowerCase()} situations and helps others`, th: `รับมือสถานการณ์ด้าน${th}ที่ซับซ้อนได้ และช่วยสอนผู้อื่น` },
  { en: `Sets the standard for ${en.toLowerCase()} and improves it across the site`, th: `กำหนดมาตรฐานด้าน${th} และปรับปรุงให้ดีขึ้นทั้งหน่วยงาน` },
];

function skill(id: string, category: SkillCategory, name: Bilingual, description: Bilingual, levels?: Skill["levels"]): Skill {
  return { id, category, name, description, levels: levels ?? generic(name.en, name.th) };
}

export const SKILLS: Skill[] = [
  // Core
  skill("C-SAFE", "core", { en: "Workplace Safety", th: "ความปลอดภัยในการทำงาน" }, { en: "Works safely and keeps others safe", th: "ทำงานอย่างปลอดภัยและดูแลความปลอดภัยของผู้อื่น" }, [
    { en: "Follows safety rules and wears the right PPE", th: "ปฏิบัติตามกฎความปลอดภัยและสวมอุปกรณ์ป้องกันถูกต้อง" },
    { en: "Spots and reports hazards before they cause harm", th: "มองเห็นและรายงานจุดเสี่ยงก่อนเกิดอันตราย" },
    { en: "Runs safety walks and stops unsafe work in the team", th: "นำเดินตรวจความปลอดภัยและหยุดงานที่ไม่ปลอดภัยในทีมได้" },
    { en: "Builds a safety culture and leads incident investigations", th: "สร้างวัฒนธรรมความปลอดภัยและนำการสอบสวนอุบัติเหตุ" },
  ]),
  skill("C-QUAL", "core", { en: "Quality Mindset", th: "การคำนึงถึงคุณภาพ" }, { en: "Gets it right first time", th: "ทำงานถูกต้องตั้งแต่ครั้งแรก" }),
  skill("C-DIGI", "core", { en: "Digital Tools", th: "การใช้เครื่องมือดิจิทัล" }, { en: "Uses apps and dashboards in daily work", th: "ใช้แอปและแดชบอร์ดในงานประจำวัน" }),
  skill("C-COMM", "core", { en: "Communication", th: "การสื่อสาร" }, { en: "Shares information clearly with the team and customers", th: "สื่อสารข้อมูลกับทีมและลูกค้าได้ชัดเจน" }, [
    { en: "Passes on information accurately", th: "ส่งต่อข้อมูลได้ถูกต้อง" },
    { en: "Explains tasks clearly and checks understanding", th: "อธิบายงานได้ชัดเจนและตรวจสอบความเข้าใจ" },
    { en: "Runs short team briefings and handles disagreement calmly", th: "นำการประชุมทีมสั้นๆ และจัดการความเห็นต่างได้อย่างใจเย็น" },
    { en: "Communicates change across teams and influences without authority", th: "สื่อสารการเปลี่ยนแปลงข้ามทีมและโน้มน้าวผู้อื่นได้" },
  ]),
  skill("C-PROB", "core", { en: "Problem Solving", th: "การแก้ปัญหา" }, { en: "Finds root causes and fixes them", th: "หาต้นเหตุของปัญหาและแก้ไข" }),
  skill("C-CUST", "core", { en: "Customer Focus", th: "การมุ่งเน้นลูกค้า" }, { en: "Puts the customer at the centre of decisions", th: "ให้ลูกค้าเป็นศูนย์กลางในการตัดสินใจ" }),

  // Leadership
  skill("L-COACH", "leadership", { en: "Coaching Others", th: "การโค้ชทีมงาน" }, { en: "Helps team members build skills on the job", th: "ช่วยให้ทีมงานพัฒนาทักษะระหว่างการทำงาน" }, [
    { en: "Shows a colleague how to do a task when asked", th: "สาธิตงานให้เพื่อนร่วมงานเมื่อได้รับการขอ" },
    { en: "Uses show-try-feedback to coach new staff on the floor", th: "ใช้วิธี 'สาธิต-ลองทำ-ให้ฟีดแบ็ก' โค้ชพนักงานใหม่หน้างาน" },
    { en: "Plans coaching for each team member and tracks progress", th: "วางแผนการโค้ชรายบุคคลและติดตามความก้าวหน้า" },
    { en: "Builds coaching capability in other leaders", th: "พัฒนาความสามารถการโค้ชให้หัวหน้าคนอื่นๆ" },
  ]),
  skill("L-PLAN", "leadership", { en: "Shift & Workforce Planning", th: "การวางแผนกะและกำลังคน" }, { en: "Matches people to workload", th: "จัดคนให้เหมาะกับปริมาณงาน" }, [
    { en: "Understands how the roster works", th: "เข้าใจการจัดตารางงาน" },
    { en: "Builds a weekly roster that covers peak hours", th: "จัดตารางงานรายสัปดาห์ให้ครอบคลุมช่วงเวลาเร่งด่วน" },
    { en: "Balances cost, skills mix and leave across a month", th: "บริหารต้นทุน ทักษะ และวันลาตลอดทั้งเดือน" },
    { en: "Designs staffing models for several sites", th: "ออกแบบโมเดลกำลังคนสำหรับหลายสาขา" },
  ]),
  skill("L-PERF", "leadership", { en: "Goals & Feedback", th: "การตั้งเป้าหมายและให้ฟีดแบ็ก" }, { en: "Sets clear goals and gives useful feedback", th: "ตั้งเป้าหมายชัดเจนและให้ฟีดแบ็กที่เป็นประโยชน์" }, [
    { en: "Accepts feedback and acts on it", th: "รับฟีดแบ็กและนำไปปรับปรุง" },
    { en: "Gives specific feedback using the SBI model", th: "ให้ฟีดแบ็กที่เจาะจงด้วยโมเดล SBI" },
    { en: "Sets team goals and holds regular check-ins", th: "ตั้งเป้าหมายทีมและติดตามผลอย่างสม่ำเสมอ" },
    { en: "Handles under-performance fairly and consistently", th: "จัดการผลงานที่ต่ำกว่าเป้าอย่างเป็นธรรมและสม่ำเสมอ" },
  ]),
  skill("L-CHG", "leadership", { en: "Leading Change", th: "การนำการเปลี่ยนแปลง" }, { en: "Brings the team along through change", th: "พาทีมผ่านการเปลี่ยนแปลง" }),
  skill("L-DEC", "leadership", { en: "Decisions with Data", th: "การตัดสินใจด้วยข้อมูล" }, { en: "Uses numbers to decide and act", th: "ใช้ตัวเลขในการตัดสินใจและลงมือทำ" }, [
    { en: "Reads basic numbers on a report", th: "อ่านตัวเลขพื้นฐานในรายงานได้" },
    { en: "Uses the store or line dashboard to pick the day's priorities", th: "ใช้แดชบอร์ดของสาขาหรือไลน์ผลิตเลือกงานสำคัญประจำวัน" },
    { en: "Finds trends and tests ideas with data", th: "หาแนวโน้มและทดสอบแนวคิดด้วยข้อมูล" },
    { en: "Builds measures that others use to decide", th: "สร้างตัวชี้วัดที่ผู้อื่นใช้ตัดสินใจ" },
  ]),
  skill("L-STK", "leadership", { en: "Stakeholder Management", th: "การบริหารผู้มีส่วนได้ส่วนเสีย" }, { en: "Works across teams to get things done", th: "ทำงานข้ามทีมเพื่อให้งานสำเร็จ" }),

  // Technical: Retail & Distribution
  skill("T-INV", "technical", { en: "Inventory & Shrink Control", th: "การควบคุมสต็อกและการสูญหาย" }, { en: "Keeps stock accurate and losses low", th: "รักษาสต็อกให้ถูกต้องและลดการสูญหาย" }, [
    { en: "Counts stock accurately and follows receiving steps", th: "นับสต็อกได้ถูกต้องและทำตามขั้นตอนรับสินค้า" },
    { en: "Runs cycle counts and spots unusual variances", th: "ทำการนับสต็อกแบบหมุนเวียนและสังเกตส่วนต่างที่ผิดปกติ" },
    { en: "Finds root causes of shrink and leads fixes in the store", th: "หาต้นเหตุของการสูญหายและนำการแก้ไขในสาขา" },
    { en: "Designs loss-prevention programmes across stores", th: "ออกแบบโครงการป้องกันการสูญหายหลายสาขา" },
  ]),
  skill("T-MERCH", "technical", { en: "Visual Merchandising", th: "การจัดวางสินค้า" }, { en: "Displays products to sell", th: "จัดวางสินค้าเพื่อกระตุ้นยอดขาย" }),
  skill("T-POS", "technical", { en: "POS & Cash Handling", th: "ระบบ POS และการจัดการเงินสด" }, { en: "Handles payments accurately", th: "รับชำระเงินได้ถูกต้อง" }),
  skill("T-CMPL", "technical", { en: "Complaint Handling", th: "การจัดการข้อร้องเรียน" }, { en: "Turns unhappy customers around", th: "เปลี่ยนลูกค้าที่ไม่พอใจให้กลับมาพอใจ" }, [
    { en: "Listens politely and passes complaints to a supervisor", th: "รับฟังอย่างสุภาพและส่งต่อข้อร้องเรียนให้หัวหน้า" },
    { en: "Resolves common complaints using the LAST steps", th: "แก้ไขข้อร้องเรียนทั่วไปด้วยขั้นตอน LAST" },
    { en: "Handles escalated or emotional complaints and coaches staff", th: "จัดการข้อร้องเรียนที่รุนแรงหรือใช้อารมณ์ และโค้ชพนักงานได้" },
    { en: "Uses complaint data to fix root causes across stores", th: "ใช้ข้อมูลข้อร้องเรียนแก้ต้นเหตุทั่วทุกสาขา" },
  ]),
  skill("T-WMS", "technical", { en: "Warehouse Management System", th: "ระบบบริหารคลังสินค้า" }, { en: "Uses the WMS for receiving, putaway and picking", th: "ใช้ระบบ WMS ในการรับ จัดเก็บ และหยิบสินค้า" }),
  skill("T-PICK", "technical", { en: "Picking & Dispatch Accuracy", th: "ความแม่นยำในการหยิบและจัดส่ง" }, { en: "Ships the right items on time", th: "จัดส่งสินค้าถูกต้องและตรงเวลา" }),
  skill("T-FORK", "technical", { en: "Material Handling Equipment", th: "การใช้อุปกรณ์ยกขนวัสดุ" }, { en: "Operates forklifts and pallet trucks safely", th: "ใช้รถยกและรถลากพาเลทอย่างปลอดภัย" }),
  skill("T-LOGP", "technical", { en: "Logistics Planning", th: "การวางแผนโลจิสติกส์" }, { en: "Plans routes and loads", th: "วางแผนเส้นทางและการบรรทุก" }),

  // Technical: Packaging
  skill("T-MACH", "technical", { en: "Machine Operation", th: "การควบคุมเครื่องจักร" }, { en: "Runs the line to standard", th: "เดินเครื่องได้ตามมาตรฐาน" }),
  skill("T-CHGO", "technical", { en: "Changeover (SMED)", th: "การเปลี่ยนรุ่นการผลิต (SMED)" }, { en: "Switches products quickly and safely", th: "เปลี่ยนรุ่นสินค้าได้รวดเร็วและปลอดภัย" }),
  skill("T-OEE", "technical", { en: "OEE & Loss Analysis", th: "OEE และการวิเคราะห์ความสูญเสีย" }, { en: "Measures and reduces line losses", th: "วัดและลดความสูญเสียของไลน์ผลิต" }),
  skill("T-5S", "technical", { en: "5S & Standard Work", th: "5ส และงานมาตรฐาน" }, { en: "Keeps the workplace organised and standard", th: "จัดพื้นที่ทำงานให้เป็นระเบียบและเป็นมาตรฐาน" }),
  skill("T-QC", "technical", { en: "Quality Inspection", th: "การตรวจสอบคุณภาพ" }, { en: "Checks product against spec", th: "ตรวจสินค้าเทียบกับสเปก" }),
  skill("T-MAINT", "technical", { en: "Autonomous Maintenance", th: "การบำรุงรักษาด้วยตนเอง" }, { en: "Does daily checks to prevent breakdowns", th: "ตรวจเช็กประจำวันเพื่อป้องกันเครื่องเสีย" }),
  skill("T-PPLAN", "technical", { en: "Production Scheduling", th: "การจัดตารางการผลิต" }, { en: "Sequences orders to hit delivery dates", th: "จัดลำดับคำสั่งผลิตให้ส่งมอบทันกำหนด" }),

  // Technical: other BUs (later waves)
  skill("T-KILN", "technical", { en: "Kiln & Process Control", th: "การควบคุมเตาเผาและกระบวนการ" }, { en: "Keeps the process stable", th: "รักษากระบวนการผลิตให้คงที่" }),
  skill("T-PSM", "technical", { en: "Process Safety Management", th: "การจัดการความปลอดภัยในกระบวนการ" }, { en: "Prevents major process incidents", th: "ป้องกันอุบัติเหตุร้ายแรงในกระบวนการ" }),
  skill("T-LAB", "technical", { en: "Lab & Sampling", th: "ห้องปฏิบัติการและการสุ่มตัวอย่าง" }, { en: "Samples and tests correctly", th: "สุ่มและทดสอบตัวอย่างได้ถูกต้อง" }),
  skill("T-HRBP", "technical", { en: "HR Advisory", th: "การให้คำปรึกษาด้าน HR" }, { en: "Advises leaders on people matters", th: "ให้คำปรึกษาผู้บริหารเรื่องคน" }),
  skill("T-FIN", "technical", { en: "Financial Analysis", th: "การวิเคราะห์การเงิน" }, { en: "Turns numbers into insight", th: "เปลี่ยนตัวเลขเป็นข้อมูลเชิงลึก" }),
  skill("T-PROC", "technical", { en: "Procurement & Sourcing", th: "การจัดซื้อและการจัดหา" }, { en: "Buys well and manages suppliers", th: "จัดซื้ออย่างคุ้มค่าและบริหารผู้ขาย" }),
];

const r = (skillId: string, level: Level, critical = false): RoleRequirement => ({ skillId, level, critical });

function role(id: string, bu: Role["bu"], family: string, title: Bilingual, grade: number, frontline: boolean, requirements: RoleRequirement[], nextRoles: string[] = []): Role {
  return { id, bu, family, title, grade, frontline, requirements, nextRoles };
}

export const ROLES: Role[] = [
  // Retail & Distribution: store operations
  role("RD-SA", "RD", "Store Operations", { en: "Store Associate", th: "พนักงานขาย" }, 1, true,
    [r("C-SAFE", 2, true), r("C-CUST", 2, true), r("T-POS", 2), r("T-MERCH", 1), r("T-INV", 1), r("T-CMPL", 1), r("C-COMM", 1)], ["RD-SSA"]),
  role("RD-SSA", "RD", "Store Operations", { en: "Senior Store Associate", th: "พนักงานขายอาวุโส" }, 2, true,
    [r("C-SAFE", 2, true), r("C-CUST", 3, true), r("T-POS", 3), r("T-MERCH", 2), r("T-INV", 2), r("T-CMPL", 2), r("C-COMM", 2), r("L-COACH", 1)], ["RD-SS"]),
  role("RD-SS", "RD", "Store Operations", { en: "Store Supervisor", th: "หัวหน้างานสาขา" }, 3, true,
    [r("C-SAFE", 3, true), r("C-CUST", 3), r("T-INV", 3, true), r("T-CMPL", 3, true), r("C-COMM", 3), r("L-COACH", 2, true), r("L-PLAN", 2), r("L-PERF", 2), r("L-DEC", 2)], ["RD-SM"]),
  role("RD-SM", "RD", "Store Operations", { en: "Store Manager", th: "ผู้จัดการสาขา" }, 4, true,
    [r("C-SAFE", 3, true), r("C-CUST", 4), r("T-INV", 3, true), r("C-COMM", 3), r("L-COACH", 3, true), r("L-PLAN", 3), r("L-PERF", 3, true), r("L-DEC", 3), r("L-CHG", 2)], ["RD-AM"]),
  role("RD-AM", "RD", "Store Operations", { en: "Area Manager", th: "ผู้จัดการเขต" }, 5, false,
    [r("C-CUST", 4), r("T-INV", 4), r("L-COACH", 4, true), r("L-PLAN", 4), r("L-PERF", 3, true), r("L-DEC", 3, true), r("L-CHG", 3), r("L-STK", 3)]),
  // Retail & Distribution: warehouse and logistics
  role("RD-WO", "RD", "Warehouse", { en: "Warehouse Operator", th: "พนักงานคลังสินค้า" }, 1, true,
    [r("C-SAFE", 2, true), r("T-FORK", 2, true), r("T-WMS", 1), r("T-PICK", 2), r("T-5S", 1), r("C-QUAL", 1)], ["RD-WTL"]),
  role("RD-WTL", "RD", "Warehouse", { en: "Warehouse Team Lead", th: "หัวหน้าทีมคลังสินค้า" }, 3, true,
    [r("C-SAFE", 3, true), r("T-FORK", 2), r("T-WMS", 3, true), r("T-PICK", 3, true), r("T-INV", 2), r("L-COACH", 2, true), r("L-PLAN", 2), r("L-DEC", 2), r("C-COMM", 2)], ["RD-WM", "RD-LP"]),
  role("RD-WM", "RD", "Warehouse", { en: "Warehouse Manager", th: "ผู้จัดการคลังสินค้า" }, 4, false,
    [r("C-SAFE", 4, true), r("T-WMS", 3), r("T-INV", 3, true), r("L-COACH", 3), r("L-PLAN", 3, true), r("L-PERF", 3), r("L-DEC", 3), r("L-CHG", 2)]),
  role("RD-LP", "RD", "Warehouse", { en: "Logistics Planner", th: "นักวางแผนโลจิสติกส์" }, 3, false,
    [r("T-LOGP", 3, true), r("T-WMS", 2), r("L-DEC", 3, true), r("C-DIGI", 3), r("L-STK", 2), r("C-PROB", 3)]),
  // Packaging: production
  role("PK-MO", "PK", "Production", { en: "Machine Operator", th: "พนักงานควบคุมเครื่องจักร" }, 1, true,
    [r("C-SAFE", 2, true), r("T-MACH", 2, true), r("T-5S", 2), r("T-QC", 1), r("T-MAINT", 1), r("C-QUAL", 2)], ["PK-SMO"]),
  role("PK-SMO", "PK", "Production", { en: "Senior Machine Operator", th: "พนักงานควบคุมเครื่องจักรอาวุโส" }, 2, true,
    [r("C-SAFE", 2, true), r("T-MACH", 3, true), r("T-CHGO", 2), r("T-5S", 2), r("T-QC", 2), r("T-MAINT", 2), r("C-QUAL", 2), r("L-COACH", 1)], ["PK-LL"]),
  role("PK-LL", "PK", "Production", { en: "Line Leader", th: "หัวหน้าไลน์ผลิต" }, 3, true,
    [r("C-SAFE", 3, true), r("T-MACH", 3), r("T-CHGO", 3, true), r("T-OEE", 2, true), r("T-5S", 3), r("L-COACH", 2, true), r("L-PLAN", 2), r("C-COMM", 3), r("C-PROB", 2)], ["PK-SHS"]),
  role("PK-SHS", "PK", "Production", { en: "Shift Supervisor", th: "หัวหน้ากะ" }, 4, true,
    [r("C-SAFE", 3, true), r("T-OEE", 3, true), r("T-CHGO", 3), r("L-COACH", 3, true), r("L-PLAN", 3), r("L-PERF", 3), r("L-DEC", 3), r("C-PROB", 3)], ["PK-PM"]),
  role("PK-PM", "PK", "Production", { en: "Production Manager", th: "ผู้จัดการฝ่ายผลิต" }, 5, false,
    [r("C-SAFE", 4, true), r("T-OEE", 4, true), r("L-COACH", 3), r("L-PERF", 4), r("L-DEC", 4, true), r("L-CHG", 3), r("L-STK", 3)]),
  role("PK-QI", "PK", "Quality", { en: "Quality Inspector", th: "พนักงานตรวจสอบคุณภาพ" }, 2, true,
    [r("C-SAFE", 2), r("T-QC", 3, true), r("C-QUAL", 3, true), r("C-DIGI", 2), r("C-PROB", 2)], ["PK-QL"]),
  role("PK-QL", "PK", "Quality", { en: "QA Lead", th: "หัวหน้าฝ่ายประกันคุณภาพ" }, 3, false,
    [r("T-QC", 4, true), r("C-QUAL", 4, true), r("C-PROB", 3), r("L-COACH", 2), r("L-DEC", 3), r("L-STK", 2)]),
  role("PK-MT", "PK", "Maintenance", { en: "Maintenance Technician", th: "ช่างซ่อมบำรุง" }, 2, true,
    [r("C-SAFE", 3, true), r("T-MAINT", 3, true), r("T-MACH", 2), r("C-PROB", 3), r("T-5S", 2)], ["PK-LL"]),
  role("PK-PP", "PK", "Planning", { en: "Production Planner", th: "นักวางแผนการผลิต" }, 3, false,
    [r("T-PPLAN", 3, true), r("L-DEC", 3, true), r("C-DIGI", 3), r("L-STK", 2), r("T-OEE", 2)]),
  // Later waves
  role("BM-PO", "BM", "Plant Operations", { en: "Plant Operator", th: "พนักงานเดินเครื่องโรงงาน" }, 1, true,
    [r("C-SAFE", 3, true), r("T-KILN", 2, true), r("T-5S", 2), r("T-MAINT", 1), r("C-QUAL", 2)], ["BM-PSS"]),
  role("BM-PSS", "BM", "Plant Operations", { en: "Plant Shift Supervisor", th: "หัวหน้ากะโรงงาน" }, 4, true,
    [r("C-SAFE", 4, true), r("T-KILN", 3, true), r("L-COACH", 3), r("L-PLAN", 3), r("L-DEC", 3), r("C-PROB", 3)]),
  role("CH-PT", "CH", "Process", { en: "Process Technician", th: "ช่างเทคนิคกระบวนการ" }, 2, true,
    [r("C-SAFE", 3, true), r("T-PSM", 2, true), r("T-LAB", 2), r("C-QUAL", 3), r("C-PROB", 2)], ["CH-PE"]),
  role("CH-PE", "CH", "Process", { en: "Process Engineer", th: "วิศวกรกระบวนการ" }, 3, false,
    [r("T-PSM", 3, true), r("T-LAB", 3), r("C-PROB", 4, true), r("L-DEC", 3), r("L-STK", 2)]),
  role("CS-HR", "CS", "HR", { en: "HR Business Partner", th: "HR Business Partner" }, 3, false,
    [r("T-HRBP", 3, true), r("L-STK", 3, true), r("C-COMM", 3), r("L-DEC", 2), r("L-CHG", 2)]),
  role("CS-FA", "CS", "Finance", { en: "Finance Analyst", th: "นักวิเคราะห์การเงิน" }, 2, false,
    [r("T-FIN", 3, true), r("C-DIGI", 3), r("L-DEC", 3, true), r("C-COMM", 2)], ["CS-FBP"]),
  role("CS-FBP", "CS", "Finance", { en: "Finance Business Partner", th: "Finance Business Partner" }, 3, false,
    [r("T-FIN", 4, true), r("L-DEC", 3), r("L-STK", 3, true), r("C-COMM", 3)]),
  role("CS-PO", "CS", "Procurement", { en: "Procurement Officer", th: "เจ้าหน้าที่จัดซื้อ" }, 2, false,
    [r("T-PROC", 3, true), r("L-STK", 2), r("C-DIGI", 2), r("L-DEC", 2)]),
];

export const skillById = (id: string) => SKILLS.find((s) => s.id === id)!;
export const roleById = (id: string) => ROLES.find((r) => r.id === id)!;
