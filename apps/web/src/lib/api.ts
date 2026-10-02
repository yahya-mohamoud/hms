const API = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';
export type User = { id: string; name: string; email: string; role: string };
export function token() { return localStorage.getItem('hms_token'); }
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (token()) headers.set('Authorization', `Bearer ${token()}`);
  const response = await fetch(`${API}${path}`, { ...init, headers });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) { localStorage.removeItem('hms_token'); localStorage.removeItem('hms_user'); window.dispatchEvent(new Event('hms:logout')); }
  if (!response.ok) throw new Error(body.error ?? 'Request failed');
  return body as T;
}
export const post = <T = unknown>(path: string, data: unknown) => api<T>(path, { method: 'POST', body: JSON.stringify(data) });
export const patch = (path: string, data: unknown) => api(path, { method: 'PATCH', body: JSON.stringify(data) });
