const API_URL =
  typeof window === "undefined"
    ? (process.env.NEXT_PUBLIC_API_URL ?? "")
    : "";

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem("hcrm_token"); } catch { return null; }
}

async function resolveAuthToken(explicitToken?: string): Promise<string | null> {
  if (explicitToken) return explicitToken;

  const stored = getStoredToken();
  if (stored) return stored;
  if (typeof window === "undefined") return null;

  try {
    const res = await fetch("/api/auth/session-token");
    if (!res.ok) return null;
    const body = await res.json().catch(() => ({}));
    if (body?.token) {
      localStorage.setItem("hcrm_token", body.token);
      return body.token;
    }
  } catch {
    // Fall through and let the caller receive the API auth error.
  }

  return null;
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit & { token?: string }
): Promise<T> {
  const { token, ...init } = options ?? {};
  const authToken = await resolveAuthToken(token);
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `API error: ${res.status}`);
  }

  return res.json();
}

export async function apiPost<T>(path: string, data: unknown, token?: string): Promise<T> {
  return apiFetch<T>(path, {
    method: "POST",
    body: JSON.stringify(data),
    token,
  });
}

export async function apiPatch<T>(path: string, data: unknown, token?: string): Promise<T> {
  return apiFetch<T>(path, {
    method: "PATCH",
    body: JSON.stringify(data),
    token,
  });
}

export async function apiDelete<T>(path: string, token?: string): Promise<T> {
  return apiFetch<T>(path, {
    method: "DELETE",
    token,
  });
}

export async function apiFetchBlob(
  path: string,
  options?: { token?: string }
): Promise<Blob> {
  const authToken = await resolveAuthToken(options?.token);
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `API error: ${res.status}`);
  }
  return res.blob();
}

export async function apiFetchNoAuth<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `API error: ${res.status}`);
  }
  return res.json();
}

export async function adminPost<T>(path: string, data: unknown, adminKey: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Key": adminKey,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `API error: ${res.status}`);
  }

  return res.json();
}
