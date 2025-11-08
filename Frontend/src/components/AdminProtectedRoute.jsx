import React from "react";
import { Navigate } from "react-router-dom";

export default function AdminProtectedRoute({ children }) {
  const username = localStorage.getItem("admin_username");
  const hostel = localStorage.getItem("admin_hostel");

  if (!username || !hostel) {
    return <Navigate to="/admin" replace />;
  }

  return children;
}
