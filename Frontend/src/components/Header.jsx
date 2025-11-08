import React from "react";
import "../style.css";   // already contains header styles + fonts

export default function Header() {
  return (
    <header className="loginHeader">
      <img src="/logo.png" alt="Hostel Resolve Logo" className="headerLogo" />
      <h2 className="headerTitle">HOSTEL RESOLVE</h2>
    </header>
  );
}