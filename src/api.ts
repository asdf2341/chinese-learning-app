let token = localStorage.getItem('token') || '';

export const setToken = (t: string) => {
  token = t;
  t ? localStorage.setItem('token', t) : localStorage.removeItem('token');
};

export async function api<T = any>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const r = await fetch('/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Что-то пошло не так');
  return data;
}

/** Показывает ошибку API пользователю */
export const safe = (fn: () => Promise<unknown>) => fn().catch((e: Error) => alert(e.message));
