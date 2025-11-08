import React, { useEffect, useState } from "react";
import "../dashboard.css";

export default function AdminDashboard() {
  const [complaints, setComplaints] = useState([]);
  const [workerMap, setWorkerMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [message, setMessage] = useState("");

  const username = localStorage.getItem("admin_username");
  const hostel = localStorage.getItem("admin_hostel");

  // ==========================
  // Fetch all pending + in-progress complaints
  // ==========================
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

  // ==========================
  // Load workers dynamically based on work type and hostel
  // ==========================
  async function loadWorkersForType(workType, complaintId) {
    try {
      const res = await fetch(
        `http://localhost:5000/api/admin/workers?hostel=${hostel}&work_type=${workType}`
      );
      const data = await res.json();
      setWorkerMap((prev) => ({
        ...prev,
        [complaintId]: data.workers || [],
      }));
    } catch (err) {
      console.error("Workers fetch failed:", err);
    }
  }

  // ==========================
  // Assign worker and send WhatsApp automatically
  // ==========================
  async function assignWorker(complaintId, workerName) {
    if (!workerName) return alert("Please select a worker first.");
    setAssigning(true);
    setMessage("");

    try {
      const res = await fetch(
        `http://localhost:5000/api/admin/complaints/${complaintId}/assign?hostel=${hostel}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ worker: workerName }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to assign worker");

      alert(`✅ ${data.message}`);
      loadComplaints();
    } catch (err) {
      console.error("Error assigning worker:", err);
      alert("❌ Failed to assign worker. Please try again.");
    } finally {
      setAssigning(false);
    }
  }

  // ==========================
  // Update complaint status (Pending / In Progress / Resolved)
  // ==========================
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

  // ==========================
  // Logout
  // ==========================
  function logout() {
    localStorage.removeItem("admin_username");
    localStorage.removeItem("admin_hostel");
    window.location.href = "/admin";
  }

  // ==========================
  // Lifecycle Hooks
  // ==========================
  useEffect(() => {
    loadComplaints();
  }, []);

  useEffect(() => {
    complaints.forEach((c) => {
      if (c.type) loadWorkersForType(c.type, c.id);
    });
  }, [complaints]);

  // ==========================
  // UI
  // ==========================
  return (
    <div className="adminPageWrap">
      {/* Topbar */}
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

      {/* Complaints Section */}
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
                {/* Header */}
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

                {/* Meta info */}
                <div className="metaRow">
                  <div className="metaPair">
                    <span className="metaLabel">Room</span>
                    <span className="metaValue">{c.room_no}</span>
                  </div>
                  <div className="metaPair">
                    <span className="metaLabel">Student</span>
                    <span className="metaValue">{c.student_name}</span>
                  </div>
                </div>

                {/* Student Proof */}
                <div className="metaRow">
                  <div className="metaPair" style={{ gridColumn: "span 3" }}>
                    <span className="metaLabel">Student Proof</span>
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

                {/* Worker Proof */}
                {c.worker_proof_url && (
                  <div className="metaRow">
                    <div className="metaPair" style={{ gridColumn: "span 3" }}>
                      <span className="metaLabel">Worker Proof</span>
                      <span className="metaValue">
                        <a
                          className="proofLink"
                          href={c.worker_proof_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <img
                            src={c.worker_proof_url}
                            alt="worker-proof"
                            className="proofThumb"
                          />
                          <span>View</span>
                        </a>
                      </span>
                    </div>
                  </div>
                )}

                {/* Worker assignment + Status */}
<div className="actionRowSpace">
  <div className="actionBlock">
    <label className="actionLabel">Assign Worker</label>
    {c.assigned_worker ? (
      <div className="assignedWorkerBox">
        <span className="assignedWorkerName">
          👷 {c.assigned_worker}
        </span>
        <span className="assignedWorkerNote">(Already Assigned)</span>
      </div>
    ) : (
      <select
        id={`worker-${c.id}`}
        className="workerSelect"
        defaultValue=""
      >
        <option value="">Select Worker</option>
        {workerMap[c.id]?.length > 0 ? (
          workerMap[c.id].map((w) => (
            <option key={w.id} value={w.name}>
              {w.name} ({w.work_type})
            </option>
          ))
        ) : (
          <option disabled>No available workers</option>
        )}
      </select>
    )}
  </div>

  <div className="actionBlock">
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

  {!c.assigned_worker && (
    <button
      className="assignBtn"
      disabled={assigning}
      onClick={() => {
        const worker = document.querySelector(`#worker-${c.id}`)?.value;
        assignWorker(c.id, worker);
      }}
    >
      {assigning ? "Assigning..." : "Assign Task"}
    </button>
  )}
</div>

              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
