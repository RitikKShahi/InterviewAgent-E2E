// Client-side API helpers for Recruiter Portal

export function getRecruiterToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("recruiter_token");
}

export function setRecruiterToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("recruiter_token", token);
  }
}

export function clearRecruiterToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("recruiter_token");
    localStorage.removeItem("recruiter_user");
  }
}

export function getRecruiterUser(): any | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("recruiter_user");
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setRecruiterUser(user: any): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("recruiter_user", JSON.stringify(user));
  }
}

export async function recruiterFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getRecruiterToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errorDetail = `Request failed: ${res.status} ${res.statusText}`;
    try {
      const errJson = await res.json();
      if (errJson.detail) errorDetail = errJson.detail;
    } catch {
      // ignore
    }
    throw new Error(errorDetail);
  }

  return res.json();
}
