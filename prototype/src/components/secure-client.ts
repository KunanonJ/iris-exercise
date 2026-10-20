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
    0: ["Connection lost. Your last action may already be saved. Try again (it won't be saved twice) or refresh to check.", "การเชื่อมต่อขาดหาย รายการล่าสุดอาจบันทึกแล้ว กดลองอีกครั้งได้เลย ระบบจะไม่บันทึกซ้ำ หรืออัปเดตข้อมูลเพื่อตรวจสอบค่ะ"],
    400: ["Something in this form isn't right. Check the required fields and try again.", "ข้อมูลในฟอร์มยังไม่ถูกต้อง โปรดตรวจช่องที่จำเป็นแล้วลองอีกครั้งค่ะ"],
    401: ["Your session has expired. Please sign in again.", "เซสชันหมดอายุแล้ว โปรดเข้าสู่ระบบอีกครั้งค่ะ"],
    403: ["Your account doesn't have access to this. Ask your programme admin to check your role.", "บัญชีของคุณยังไม่มีสิทธิ์ใช้ส่วนนี้ โปรดให้ผู้ดูแลโปรแกรมตรวจสอบบทบาทของคุณค่ะ"],
    404: ["This item is no longer available. Refresh to see the latest.", "ไม่พบรายการนี้แล้ว โปรดอัปเดตข้อมูลค่ะ"],
    409: ["This was updated while you were working. Refresh, check the latest version, then send it again.", "ข้อมูลนี้ถูกอัปเดตระหว่างที่คุณทำรายการ โปรดอัปเดตข้อมูล ตรวจสอบอีกครั้ง แล้วส่งใหม่ค่ะ"],
    422: ["Some required fields are empty or too long. Fix them and send again.", "บางช่องยังว่างหรือยาวเกินไป โปรดตรวจข้อมูลแล้วส่งอีกครั้งค่ะ"],
    429: ["You've reached the usage limit. Please wait a moment, then try again.", "ใช้งานถึงขีดจำกัดแล้ว โปรดรอสักครู่แล้วลองอีกครั้งค่ะ"],
    503: ["Something went wrong on our side. Try again (it won't be saved twice) or refresh.", "ระบบขัดข้องชั่วคราว กดลองอีกครั้งได้เลย ระบบจะไม่บันทึกซ้ำ หรืออัปเดตข้อมูลค่ะ"],
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
