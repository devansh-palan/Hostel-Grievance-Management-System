import React, { useState, useEffect } from "react";
import "../style.css"; // ✅ correct path

export default function Login() {
  const [step, setStep] = useState("email"); // email → otp
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  // ========================
  // ✅ Correct API calls
  // ========================

  async function loginOrRegister(emailId, nameVal) {
    const res = await fetch("http://localhost:5000/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailId, name: nameVal }),
      credentials: "include",
    });
    return res.json();
  }

  async function verifyOtp(payload) {
    const res = await fetch("http://localhost:5000/api/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    });
    return res.json();
  }

  // Cooldown for resend OTP
  useEffect(() => {
    if (!cooldown) return;
    const timer = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // STEP 1: Send OTP / Login
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError("");
    setMsg("");

    if (!email.trim()) return setError("Please enter a valid email");

    try {
      setLoading(true);
      const res = await loginOrRegister(email.trim(), name.trim());

      setMsg(res.message || "");
      if (res.message?.includes("OTP")) {
        setStep("otp");
        setCooldown(30);
      } else if (res.message?.includes("Login successful")) {
        window.location.href = "/dashboard";
      } else if (res.message?.includes("Verification")) {
        setStep("otp");
      } else if (res.error || res.message?.includes("Error")) {
        setError(res.message || "Something went wrong");
      }
    } catch (err) {
      console.error(err);
      setError("Error sending OTP. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // STEP 2: Verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError("");
    setMsg("");

    if (!otp.trim()) return setError("Please enter the OTP");

    try {
      setLoading(true);
      const res = await verifyOtp({ email, otp });

      setMsg(res.message || "");
      if (res.message?.includes("Verification successful")) {
        window.location.href = "/dashboard";
      } else {
        setError(res.message || "Invalid OTP");
      }
    } catch (err) {
      console.error(err);
      setError("OTP verification failed.");
    } finally {
      setLoading(false);
    }
  };

  // ========================
  // UI
  // ========================
  return (
    <div
      className="page-wrap"
      style={{
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      }}
    >
      <div className="container auth-container">
        <div className="glass-card">
          <h1
            style={{
              textAlign: "center",
              color: "white",
              fontSize: "28px",
              fontWeight: "700",
              marginBottom: "10px",
            }}
          >
            Hostel Resolve
          </h1>

          <h2 className="auth-title">
            {step === "email" ? "Login / Register" : "Enter OTP"}
          </h2>

          {/* ============= EMAIL FORM ============= */}
          {step === "email" && (
            <form onSubmit={handleSendOtp}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Institute Email</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="example@students.vnit.ac.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>

              {error && <p style={{ color: "#ffb2b2" }}>{error}</p>}
              {msg && <p style={{ color: "#b2ffcf" }}>{msg}</p>}

              <button type="submit" className="primary-btn" disabled={loading}>
                {loading ? "Processing..." : "Continue"}
              </button>
            </form>
          )}

          {/* ============= OTP FORM ============= */}
          {step === "otp" && (
            <form onSubmit={handleVerifyOtp}>
              <div className="form-group">
                <label className="form-label">Enter OTP</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter the 6-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                />
              </div>

              <div className="muted-link" style={{ marginTop: 6 }}>
                Didn’t receive OTP?{" "}
                <button
                  type="button"
                  disabled={cooldown > 0}
                  onClick={handleSendOtp}
                  style={{
                    background: "transparent",
                    color: "white",
                    textDecoration: "underline",
                    border: "none",
                    cursor: cooldown > 0 ? "not-allowed" : "pointer",
                  }}
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend OTP"}
                </button>
              </div>

              {error && <p style={{ color: "#ffb2b2" }}>{error}</p>}
              {msg && <p style={{ color: "#b2ffcf" }}>{msg}</p>}

              <button type="submit" className="primary-btn" disabled={loading}>
                {loading ? "Verifying..." : "Verify OTP & Continue"}
              </button>

              <div className="muted-link" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setStep("email")}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "white",
                    textDecoration: "underline",
                    cursor: "pointer",
                  }}
                >
                  Change Email
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
