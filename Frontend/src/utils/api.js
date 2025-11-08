export async function apiRequest(endpoint, options = {}) {
  const res = await fetch(`http://localhost:5000/api${endpoint}`, {
    ...options,
    credentials: "include", // ✅ send cookies
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Request failed");
  }

  return res.json();
}
