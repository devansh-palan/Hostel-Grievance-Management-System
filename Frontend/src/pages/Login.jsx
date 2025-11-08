import { useState } from "react";
import { apiRequest } from "../utils/api";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();
    try {
      const res = await apiRequest("/login", "POST", { email });
      setMsg(res.message);
      navigate("/dashboard");
    } catch (err) {
      setMsg(err.message);
    }
  }

  return (
    <div className="flex flex-col items-center mt-10">
      <h1 className="text-2xl font-bold mb-4">Login</h1>
      <form onSubmit={handleLogin} className="flex flex-col gap-3 w-80">
        <input
          type="email"
          placeholder="Institute Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="border p-2 rounded"
        />
        <button className="bg-blue-600 text-white py-2 rounded">Login</button>
      </form>
      {msg && <p className="mt-3 text-sm text-gray-700">{msg}</p>}
    </div>
  );
}
