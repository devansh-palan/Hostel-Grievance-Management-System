export const API_BASE = "http://localhost:5000/api";

export async function apiRequest(endpoint, method = "GET", body = null) {
  const options = {
    method,
    credentials: "include", // crucial for JWT cookie
    headers: { "Content-Type": "application/json" },
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${endpoint}`, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Something went wrong");
  return data;
}
