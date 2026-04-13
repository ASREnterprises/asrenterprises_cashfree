const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export async function githubApi(endpoint: string, token: string, params?: Record<string, string | number>) {
  let url = `${BACKEND_URL}/api${endpoint}`;
  if (params) {
    const qs = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    url += `?${qs}`;
  }
  const res = await fetch(url, {
    headers: {
      Authorization: `token ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(body.detail || `API error ${res.status}`);
  }
  return res.json();
}

export async function loginWithToken(token: string) {
  const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: 'Login failed' }));
    throw new Error(body.detail || 'Invalid token');
  }
  return res.json();
}
