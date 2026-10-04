export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, { ...init, cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = body.detail;
    throw new Error(typeof detail === "string" ? detail : detail?.message || JSON.stringify(detail) || `Request failed (${res.status})`);
  }
  return res.json();
}
export function jsonBody(body: unknown): RequestInit { return { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }; }
export function number(value: number | null | undefined, digits = 2): string { return value == null ? "—" : value.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits }); }
