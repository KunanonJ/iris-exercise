import type { Principal } from "../lib/suite-contracts";

export class SuiteApiError extends Error {
  constructor(public readonly status: number, message = "Request failed") { super(message); this.name = "SuiteApiError"; }
}

export function assertPrincipal(expected: Principal, received: Principal) {
  if (!received || ["userId", "tenantId", "employeeId", "role"].some(key => expected[key as keyof Principal] !== received[key as keyof Principal])) {
    throw new SuiteApiError(401, "The session changed. Reload your learning record.");
  }
}

export function apiErrorMessage(error: unknown, th: boolean): string {
  const status = error instanceof SuiteApiError ? error.status : 0;
  const messages: Record<number, [string, string]> = {
    0: ["Connection interrupted. Your last action may have reached the server. Retry the same request or refresh before taking another action.", "การเชื่อมต่อขัดข้อง คำสั่งล่าสุดอาจถึงเซิร์ฟเวอร์แล้ว ลองคำสั่งเดิมอีกครั้งหรือโหลดข้อมูลก่อนทำรายการใหม่"],
    400: ["The request was not accepted. Check the required fields and refresh your record.", "คำขอไม่ผ่านการตรวจสอบ โปรดตรวจช่องข้อมูลที่จำเป็นและโหลดข้อมูลใหม่"],
    401: ["Your session is unavailable or expired. Sign in again, then refresh.", "เซสชันไม่พร้อมใช้งานหรือหมดอายุ โปรดเข้าสู่ระบบใหม่แล้วโหลดข้อมูล"],
    403: ["This account has no permission for this action. Ask your programme administrator to check your membership.", "บัญชีนี้ไม่มีสิทธิ์ทำรายการ โปรดให้ผู้ดูแลโปรแกรมตรวจสอบสิทธิ์"],
    404: ["This record is no longer available. Refresh the latest data.", "ไม่พบรายการนี้แล้ว โปรดโหลดข้อมูลล่าสุด"],
    409: ["The record changed while you were working. Refresh and review the latest version before submitting again.", "ข้อมูลเปลี่ยนระหว่างทำรายการ โปรดโหลดและตรวจข้อมูลล่าสุดก่อนส่งใหม่"],
    422: ["Check the required fields and their length limits, then submit the corrected information.", "โปรดตรวจข้อมูลที่จำเป็นและความยาวข้อความ แล้วส่งข้อมูลที่แก้ไขแล้วอีกครั้ง"],
    429: ["The usage limit has been reached. Wait before retrying; no paid provider is started from this screen.", "ถึงขีดจำกัดการใช้งานแล้ว โปรดรอก่อนลองใหม่ หน้าจอนี้ไม่เรียกใช้ผู้ให้บริการแบบเสียเงิน"],
    503: ["The service could not finish this action. Your last action may have reached the server. Retry the same request or refresh.", "บริการทำรายการไม่สำเร็จ คำสั่งอาจถึงเซิร์ฟเวอร์แล้ว ลองคำสั่งเดิมอีกครั้งหรือโหลดข้อมูลใหม่"],
  };
  return (messages[status] ?? messages[503])[th ? 1 : 0];
}

/** Parse the final wire provenance rather than guessing from an initial header. */
export async function consumeCoachStream(stream: ReadableStream<Uint8Array>, onText: (text: string) => void): Promise<Record<string, unknown>> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let length = 0;
  let finalMeta: Record<string, unknown> | undefined;
  function frame(raw: string) {
    const rows = raw.split("\n");
    const event = rows.find(row => row.startsWith("event:"))?.slice(6).trim() ?? "message";
    const data = rows.filter(row => row.startsWith("data:")).map(row => row.slice(5).trimStart()).join("\n");
    if (!data) return;
    let value: Record<string, unknown>;
    try { const parsed: unknown = JSON.parse(data); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(); value = parsed as Record<string, unknown>; }
    catch { throw new SuiteApiError(503, "Invalid coach response"); }
    if (event === "error") throw new SuiteApiError(503, "The coach could not finish this response");
    if (event === "text") {
      if (finalMeta || typeof value.text !== "string") throw new SuiteApiError(503, "Invalid coach response");
      length += value.text.length;
      if (length > 120_000) throw new SuiteApiError(503, "Invalid coach response length");
      onText(value.text);
    }
    if (event === "final") {
      if (finalMeta || !value.meta || typeof value.meta !== "object" || Array.isArray(value.meta)) throw new SuiteApiError(503, "Invalid coach response");
      finalMeta = value.meta as Record<string, unknown>;
    }
  }
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer = (buffer + decoder.decode(value, { stream: !done })).replace(/\r\n/g, "\n");
      if (buffer.length > 1_000_000) throw new SuiteApiError(503, "Invalid coach response length");
      let end: number;
      while ((end = buffer.indexOf("\n\n")) >= 0) { frame(buffer.slice(0, end)); buffer = buffer.slice(end + 2); }
      if (done) break;
    }
    if (buffer.trim()) frame(buffer);
    if (!finalMeta) throw new SuiteApiError(503, "Incomplete coach response");
    return finalMeta;
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  finally { reader.releaseLock(); }
}
