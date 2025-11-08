import { useEffect, useState } from "react";
import { apiRequest } from "../utils/api";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await apiRequest("/me");
        setUser(res.user);
      } catch (err) {
        console.error("Failed to fetch user:", err.message);
        navigate("/login");
      }
    }
    fetchUser();
  }, [navigate]);

  async function handleLogout() {
    try {
      await apiRequest("/logout", "POST");
      navigate("/login");
    } catch (err) {
      console.error(err);
    }
  }

  if (!user) return <p className="text-center mt-10">Loading your data...</p>;

  return (
    <div className="flex flex-col items-center mt-10">
      <h1 className="text-3xl font-semibold mb-4">Welcome, {user.name || "Student"} 👋</h1>
      <p className="text-gray-700 mb-6">{user.email}</p>

      <button
        onClick={handleLogout}
        className="bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700"
      >
        Logout
      </button>
    </div>
  );
}
