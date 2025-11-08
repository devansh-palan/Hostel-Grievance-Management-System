import React, { useEffect, useState } from "react";
import "../dashboard.css";

export default function AdminDashboard() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const username = localStorage.getItem("admin_username");
  const hostel = localStorage.getItem("admin_hostel");

  async function loadComplaints() {
    try {
      const res = await fetch(
        `http://localhost:5000/api/admin/complaints/pending?hostel=${hostel}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load complaints");
      setComplaints(data.complaints || []);
    } catch (err) {
      console.error("Error fetching complaints:", err);
      setMessage(err.message || "Error fetching complaints");
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id, newStatus) {
    try {
      await fetch(
        `http://localhost:5000/api/admin/complaints/${id}/status?hostel=${hostel}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        }
      );
      loadComplaints();
    } catch (err) {
      console.error("Update error:", err);
    }
  }

  function logout() {
    localStorage.removeItem("admin_username");
    localStorage.removeItem("admin_hostel");
    window.location.href = "/admin";
  }

  useEffect(() => {
    loadComplaints();
  }, []);

  return (
    <div className="adminPageWrap">
      <div className="adminTopbar">
        <div className="adminTopbar__left">
          <h1 className="adminGreeting">Welcome, {username || "Admin"}</h1>
          <p className="adminHostel">Hostel: {hostel || "N/A"}</p>
        </div>

        <div className="adminTopbar__right">
          <button className="adminLogoutBtn" onClick={logout}>
            Logout
          </button>
        </div>
      </div>

      {message && <div className="adminInlineAlert">{message}</div>}

      <section className="complaintsSection">
        <div className="sectionHead">
          <h2 className="sectionTitle">Pending & In-Progress Complaints</h2>
          <span className="countPill">{complaints.length}</span>
        </div>

        {loading ? (
          <div className="loadingRow">Loading complaints...</div>
        ) : complaints.length === 0 ? (
          <div className="emptyState">No complaints found.</div>
        ) : (
          <ul className="complaintList">
            {complaints.map((c) => (
              <li className="complaintItem" key={c.id}>
                <div className="complaintHead">
                  <div className="idType">
                    <span className="cid">#{c.id}</span>
                    <span className="ctype">{c.type}</span>
                  </div>

                  <span
                    className={`statusBadge ${
                      (c.status || "").toLowerCase().replace(/\s+/g, "-") ||
                      "pending"
                    }`}
                  >
                    {c.status}
                  </span>
                </div>

                <p className="cdesc">{c.description}</p>

                <div className="metaRow">
                  <div className="metaPair">
                    <span className="metaLabel">Room</span>
                    <span className="metaValue">{c.room_no}</span>
                  </div>

                  <div className="metaPair">
                    <span className="metaLabel">Student</span>
                    <span className="metaValue">{c.student_name}</span>
                  </div>

                  <div className="metaPair">
                    <span className="metaLabel">Proof</span>
                    <span className="metaValue">
                      {c.photo_url ? (
                        <a
                          className="proofLink"
                          href={c.photo_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <img
                            src={c.photo_url}
                            alt="proof"
                            className="proofThumb"
                          />
                          <span>View</span>
                        </a>
                      ) : (
                        "No proof"
                      )}
                    </span>
                  </div>
                </div>

                <div className="actionRow">
                  <label className="actionLabel">Update Status</label>
                  <select
                    className="statusSelect"
                    value={c.status}
                    onChange={(e) => updateStatus(c.id, e.target.value)}
                  >
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                  </select>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
