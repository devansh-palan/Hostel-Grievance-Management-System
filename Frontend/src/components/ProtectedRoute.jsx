import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../utils/api";

export default function ProtectedRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    async function checkAuth() {
      try {
        const data = await apiRequest("/me"); // verifies JWT cookie
        console.log("✅ Authenticated user:", data.user);
        setAuthenticated(true);
      } catch (err) {
        console.warn("❌ Not authenticated:", err.message);
        navigate("/login", { replace: true });
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, [navigate]);

  if (loading) return <p className="text-center mt-10">Checking authentication...</p>;
  return authenticated ? children : null;
}
