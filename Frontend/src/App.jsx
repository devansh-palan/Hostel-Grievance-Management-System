import React, { useState, useEffect } from "react";
import api from "./api";

export default function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [complaints, setComplaints] = useState([]);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [message, setMessage] = useState("");

  // Check if already logged in
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/me");
        if (res.data.user) {
          setUser(res.data.user);
          loadComplaints();
        }
      } catch {
        setUser(null);
      }
    })();
  }, []);

  async function sendOtp(e) {
    e.preventDefault();
    try {
      await api.post("/send-otp", { email });
      setOtpSent(true);
      setMessage("OTP sent! Check your institute email.");
    } catch (err) {
      setMessage(err.response?.data?.message || "Failed to send OTP");
    }
  }

  async function verifyOtp(e) {
    e.preventDefault();
    try {
      await api.post("/verify-otp", { email, otp });
      setOtpSent(false);
      setOtp("");
      setMessage("Login successful!");
      const res = await api.get("/me");
      setUser(res.data.user);
      loadComplaints();
    } catch (err) {
      setMessage(err.response?.data?.message || "Invalid OTP");
    }
  }

  async function loadComplaints() {
    try {
      const res = await api.get("/complaints");
      setComplaints(res.data.complaints || []);
    } catch (err) {
      console.error(err);
    }
  }

  async function addComplaint(e) {
    e.preventDefault();
    try {
      const res = await api.post("/complaints", { title, description: desc });
      setComplaints([res.data.complaint, ...complaints]);
      setTitle("");
      setDesc("");
      setMessage("Complaint added!");
    } catch (err) {
      setMessage("Failed to add complaint");
    }
  }

  async function logout() {
    await api.post("/logout");
    setUser(null);
    setComplaints([]);
    setMessage("Logged out.");
  }

  // ---------------- UI SECTIONS ----------------
  if (!user && !otpSent) {
    // Step 1: Register/Login via email
    return (
      <div className="container">
        <h2>Hostel Grievance System</h2>
        <form onSubmit={sendOtp}>
          <input
            type="email"
            placeholder="Enter your institute email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button type="submit">Send OTP</button>
        </form>
        <p>{message}</p>
      </div>
    );
  }

  if (!user && otpSent) {
    // Step 2: OTP verification
    return (
      <div className="container">
        <h2>Enter OTP</h2>
        <form onSubmit={verifyOtp}>
          <input
            type="text"
            placeholder="6-digit OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            required
          />
          <button type="submit">Verify</button>
        </form>
        <button onClick={() => setOtpSent(false)}>Back</button>
        <p>{message}</p>
      </div>
    );
  }

  // Step 3: Dashboard (after login)
  return (
    <div className="container">
      <h2>Welcome, {user.email}</h2>
      <button onClick={logout}>Logout</button>

      <h3>Submit Complaint</h3>
      <form onSubmit={addComplaint}>
        <input
          type="text"
          placeholder="Complaint title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <textarea
          placeholder="Describe your issue"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          required
        />
        <button type="submit">Submit</button>
      </form>

      <h3>Your Complaints</h3>
      {complaints.length === 0 ? (
        <p>No complaints yet</p>
      ) : (
        complaints.map((c) => (
          <div key={c.id} className="complaint">
            <strong>{c.title}</strong>
            <p>{c.description}</p>
            <small>Status: {c.status}</small>
          </div>
        ))
      )}

      <p>{message}</p>
    </div>
  );
}
