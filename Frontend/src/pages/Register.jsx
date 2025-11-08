import { useState } from "react";
import { apiRequest } from "../utils/api";
import { useNavigate } from "react-router-dom";

export default function Register() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [msg, setMsg] = useState("");
  const navigate = useNavigate();

  async function handleRegister(e) {
    e.preventDefault();
    try {
      const res = await apiRequest("/register", "POST", { email, name });
      setMsg(res.message);
      setOtpSent(true);
    } catch (err) {
      setMsg(err.message);
    }
  }

  async function handleVerify(e) {
    e.preventDefault();
    try {
      const res = await apiRequest("/verify-otp", "POST", { email, otp });
      setMsg(res.message);
      navigate("/dashboard");
    } catch (err) {
      setMsg(err.message);
    }
  }

  return (
    <div className="flex flex-col items-center mt-10">
      <h1 className="text-2xl font-bold mb-4">Register</h1>
      {!otpSent ? (
        <form onSubmit={handleRegister} className="flex flex-col gap-3 w-80">
          <input
            type="text"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="border p-2 rounded"
          />
          <input
            type="email"
            placeholder="Institute Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="border p-2 rounded"
          />
          <button className="bg-blue-600 text-white py-2 rounded">Send OTP</button>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="flex flex-col gap-3 w-80">
          <input
            type="text"
            placeholder="Enter OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            required
            className="border p-2 rounded"
          />
          <button className="bg-green-600 text-white py-2 rounded">Verify OTP</button>
        </form>
      )}
      {msg && <p className="mt-3 text-sm text-gray-700">{msg}</p>}
    </div>
  );
}
