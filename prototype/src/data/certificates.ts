// Certificates an employee can declare in the skill check. Each one proves a skill up to a
// level, so the plan skips catalogue items that only teach what the certificate already covers.
// Self-declared: the manager checks them when approving the skill check.
import type { Bilingual, Level } from "../lib/types";

export interface Certificate {
  id: string;
  name: Bilingual;
  skillId: string;
  level: Level;
}

export const CERTIFICATES: Certificate[] = [
  { id: "CERT-SAFE", name: { en: "Workplace safety certificate", th: "ใบรับรองความปลอดภัยในการทำงาน" }, skillId: "C-SAFE", level: 2 },
  { id: "CERT-FORKLIFT", name: { en: "Forklift licence", th: "ใบอนุญาตขับรถยก (โฟล์คลิฟท์)" }, skillId: "T-FORK", level: 2 },
  { id: "CERT-CASH", name: { en: "Cash handling certificate", th: "ใบรับรองการรับชำระเงินและเครื่อง POS" }, skillId: "T-POS", level: 2 },
  { id: "CERT-PSM", name: { en: "Process safety certificate", th: "ใบรับรองความปลอดภัยในกระบวนการผลิต" }, skillId: "T-PSM", level: 2 },
];

// Monthly time for self-paced lessons. Workshops are scheduled with the manager; projects happen on the job.
export const LEARNING_MINUTES = [60, 120, 240, 360] as const;
export type LearningMinutes = (typeof LEARNING_MINUTES)[number];
export const DEFAULT_LEARNING_MINUTES: LearningMinutes = 120;

export const certificateById = (id: string) => CERTIFICATES.find((c) => c.id === id);

/** The highest level each skill is already proven at by the given certificates. */
export function certifiedLevels(ids: string[] = []): Record<string, Level> {
  const levels: Record<string, Level> = {};
  for (const cert of ids.map(certificateById)) {
    if (cert && (levels[cert.skillId] ?? 0) < cert.level) levels[cert.skillId] = cert.level;
  }
  return levels;
}
