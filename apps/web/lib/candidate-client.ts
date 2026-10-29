// Client-side API helpers for Candidate Portal

export function getCandidateToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("candidate_token");
}

export function setCandidateToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("candidate_token", token);
  }
}

export function clearCandidateToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("candidate_token");
    localStorage.removeItem("candidate_user");
  }
}

export function getCandidateUser(): any | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("candidate_user");
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setCandidateUser(user: any): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("candidate_user", JSON.stringify(user));
  }
}

export async function candidateFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getCandidateToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

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
