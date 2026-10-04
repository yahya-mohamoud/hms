const API = import.meta.env.VITE_API_URL ?? '/api';
export type User = { id: string; name: string; email: string; role: string };
export function token() { return localStorage.getItem('hms_token'); }
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (token()) headers.set('Authorization', `Bearer ${token()}`);
  const response = await fetch(`${API}${path}`, { ...init, headers });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) { localStorage.removeItem('hms_token'); localStorage.removeItem('hms_user'); window.dispatchEvent(new Event('hms:logout')); }
  if (!response.ok) {
    const details = body.details as { formErrors?: string[]; fieldErrors?: Record<string, string[]> } | undefined;
    const validation = [
      ...(details?.formErrors ?? []),
      ...Object.entries(details?.fieldErrors ?? {}).flatMap(([field, errors]) => errors.map(message => `${field}: ${message}`)),
    ].join('; ');
    throw new Error(validation ? `${body.error ?? 'Request failed'}: ${validation}` : body.error ?? 'Request failed');
  }
  return body as T;
}
export const post = <T = unknown>(path: string, data: unknown) => api<T>(path, { method: 'POST', body: JSON.stringify(data) });
export const patch = (path: string, data: unknown) => api(path, { method: 'PATCH', body: JSON.stringify(data) });
