export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
function formatErrorDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((err) => {
        if (err && typeof err === "object") {
          const field = Array.isArray(err.loc) ? err.loc.filter((x: unknown) => x !== "body").join(".") : "";
          const msg = err.msg || JSON.stringify(err);
          return field ? `${field}: ${msg}` : msg;
        }
        return String(err);
      })
      .join("; ");
  }
  if (detail && typeof detail === "object" && "message" in detail && typeof (detail as { message: unknown }).message === "string") {
    return (detail as { message: string }).message;
  }
  return detail ? JSON.stringify(detail) : "";
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, { ...init, cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = formatErrorDetail(body.detail);
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return res.json();
}
export function jsonBody(body: unknown): RequestInit { return { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }; }
export function number(value: number | null | undefined, digits = 2): string { return value == null ? "—" : value.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits }); }
