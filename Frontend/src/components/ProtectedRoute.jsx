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
        await apiRequest("/me"); // verifies token cookie
        setAuthenticated(true);
      } catch (err) {
        navigate("/login");
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, [navigate]);

  if (loading) return <p className="text-center mt-10">Checking authentication...</p>;
  return authenticated ? children : null;
}
