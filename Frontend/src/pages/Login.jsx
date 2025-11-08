import React, { useState, useEffect } from "react";
import "../login.css";

export default function Login() {
  const [step, setStep] = useState("email"); // "email" → "otp"
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  // countdown timer for resend button
  useEffect(() => {
    if (!cooldown) return;
    const timer = setInterval(() => {
      setCooldown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // helper: send OTP
  async function sendOtp() {
    const res = await fetch("http://localhost:5000/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, name: fullName }),
    });

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }

    if (!res.ok) throw new Error(data.message || "Failed to send OTP");
    return data;
  }

  // helper: verify OTP
  async function verifyOtp() {
    const res = await fetch("http://localhost:5000/api/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, otp }),
    });

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }

    if (!res.ok) throw new Error(data.message || "Verification failed");
    return data;
  }

  // send OTP button
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError("");
    setMsg("");

    if (!email.endsWith("@students.vnit.ac.in"))
      return setError("Use your institute email only.");

    try {
      setLoading(true);
      const data = await sendOtp();
      setMsg(data.message || "OTP sent successfully");
      setStep("otp");
      setCooldown(30);
    } catch (err) {
      console.error(err);
      setError(err.message || "Error sending OTP");
    } finally {
      setLoading(false);
    }
  };

  // verify OTP button
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError("");
    setMsg("");

    if (!otp.trim()) return setError("Please enter the OTP");

    try {
      setLoading(true);
      const data = await verifyOtp();
      console.log("OTP verify response:", data);

      if (
        data.message?.toLowerCase().includes("verification") ||
        data.message?.toLowerCase().includes("logged in")
      ) {
        // ✅ save name/email locally
        localStorage.setItem("username", fullName.trim() || "User");
        localStorage.setItem("email", email.trim());

        // ✅ redirect
        window.location.replace("/dashboard");
      } else {
        setError(data.message || "Invalid OTP");
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "OTP verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mainLoginContainer">
      <div className="pageShell">
        {/* Header */}
        <header className="loginHeader">
          <div className="headerBrand">
            <img src="/logo.png" alt="Hostel Resolve Logo" className="headerLogo" />
            <h2 className="headerTitle">HOSTEL RESOLVE</h2>
          </div>
          <nav className="headerActions">
            <a className="headerTab active" href="/login">
              Student Login
            </a>
            <a className="headerTab" href="/admin">
              Admin Login
            </a>
          </nav>
        </header>

        {/* Two cards */}
        <div className="loginCardsWrapper">
          <div className="cardBox leftImageCard" />
          <div className="cardBox rightLoginCard">
            <h1 className="loginTitle">
              STUDENT <span>LOGIN</span>
            </h1>
            <p className="loginSubTitle">Sign in to Hostel Resolve!</p>

            {/* Step 1: Email */}
            {step === "email" && (
              <form className="loginForm" onSubmit={handleSendOtp}>
                <label>Full Name</label>
                <input
                  type="text"
                  placeholder="Your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
                <label>Institute Email ID</label>
                <input
                  type="email"
                  placeholder="example@students.vnit.ac.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                {error && <p className="error-text">{error}</p>}
                {msg && <p className="success-text">{msg}</p>}
                <button type="submit" className="loginBtn" disabled={loading}>
                  {loading ? "Sending OTP..." : "Send OTP"}
                </button>
              </form>
            )}

            {/* Step 2: OTP */}
            {step === "otp" && (
              <form className="loginForm" onSubmit={handleVerifyOtp}>
                <label>Enter OTP</label>
                <input
                  type="text"
                  placeholder="Enter the 6-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                />
                <div className="muted-link" style={{ marginTop: 6 }}>
                  Didn’t receive OTP?{" "}
                  <button
                    type="button"
                    disabled={cooldown > 0 || loading}
                    onClick={handleSendOtp}
                    className="link-btn"
                  >
                    {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend OTP"}
                  </button>
                </div>
                {error && <p className="error-text">{error}</p>}
                {msg && <p className="success-text">{msg}</p>}
                <button type="submit" className="loginBtn" disabled={loading}>
                  {loading ? "Verifying..." : "Verify & Continue"}
                </button>
                <div className="muted-link" style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setStep("email");
                      setOtp("");
                      setMsg("");
                      setError("");
                    }}
                    className="link-btn"
                  >
                    Change Email
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
