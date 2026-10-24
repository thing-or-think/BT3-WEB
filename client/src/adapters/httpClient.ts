declare global {
  interface Window { ARENA_API_BASE_URL?: string; }
}

const TOKEN_KEY = 'rps_server_session';
export function setSessionToken(token: string | null): void {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}

export async function apiRequest<T>(route: string, body?: unknown): Promise<T> {
  const base = (window.ARENA_API_BASE_URL || '').replace(/\/$/, '');
  const token = sessionStorage.getItem(TOKEN_KEY);
  let response: Response;
  try {
    response = await fetch(`${base}/api${route}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store'
    });
  } catch {
    throw new Error('Không kết nối được máy chủ đấu trường. Vui lòng kiểm tra kết nối và địa chỉ máy chủ.');
  }
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Chưa kết nối với API đấu trường. Hãy mở web qua máy chủ hoặc cấu hình địa chỉ API cho bản GitHub Pages.');
  }
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401 && route !== '/auth/login') {
      setSessionToken(null);
      window.dispatchEvent(new Event('arena-session-expired'));
    }
    throw new Error(result.error || `Yêu cầu thất bại (${response.status}).`);
  }
  return result as T;
}
