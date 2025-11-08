// /src/pages/AdminLogin.jsx
import React, { useState } from "react";
import "../style.css";

export default function AdminLogin() {
  // ===== state =====
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ===== API: keep exactly as your current implementation =====
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("http://localhost:5000/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Login failed");

      // store & redirect (unchanged)
      localStorage.setItem("admin_username", data.username);
      localStorage.setItem("admin_hostel", data.hostel);
      window.location.href = "/admin/dashboard";
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ===== UI: mirrored from Login.jsx (header, two cards, form classes) =====
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
            <a className="headerTab" href="/login">Student Login</a>
            <a className="headerTab active" href="/admin">Admin Login</a>
          </nav>
        </header>

        {/* Two cards (3:2) */}
        <div className="loginCardsWrapper">
          {/* Left image/pattern card */}
          <div className="cardBox leftImageCard" />

          {/* Right admin form card */}
          <div className="cardBox rightLoginCard">
            <h1 className="loginTitle">
              ADMIN <span>LOGIN</span>
            </h1>
            <p className="loginSubTitle">Supervisor access</p>

            <form className="loginForm" onSubmit={handleSubmit}>
              <label>Username</label>
              <input
                type="text"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
              />

              <label>Password</label>
              <input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />

              {error && <p className="error-text">{error}</p>}

              <button type="submit" className="loginBtn" disabled={loading}>
                {loading ? "Signing in..." : "Login"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}