import React, { useEffect, useMemo, useState } from "react";
import "../dashboard.css";

export default function AdminDashboard() {
  const [complaints, setComplaints] = useState([]);
  const [workerMap, setWorkerMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [message, setMessage] = useState("");

  const [selectedCat, setSelectedCat] = useState("All");

  const username = localStorage.getItem("admin_username");
  const hostel = localStorage.getItem("admin_hostel");

  const CATEGORIES = [
    "All",
    "Electrical",
    "Plumbing",
    "Cleaning",
    "Furniture",
    "Internet",
    "Others",
  ];

  function getCategoryFromType(type = "") {
    const t = String(type).trim().toLowerCase();
    if (["electrical", "electric", "power"].includes(t)) return "Electrical";
    if (["plumbing", "water", "leak"].includes(t)) return "Plumbing";
    if (["cleaning", "housekeeping"].includes(t)) return "Cleaning";
    if (["furniture", "carpentry", "woodwork"].includes(t)) return "Furniture";
    if (["internet", "wifi", "network"].includes(t)) return "Internet";
    return "Others";
  }

  // Fetch complaints
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
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Workers fetch
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

  // Assign worker
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
      if (!res.ok) throw new Error(data.message);

      alert(`✅ ${data.message}`);
      loadComplaints();
    } catch (err) {
      console.error("Error assigning worker:", err);
      alert("❌ Failed to assign worker. Please try again.");
    } finally {
      setAssigning(false);
    }
  }

  // Update status
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

  useEffect(() => {
    complaints.forEach((c) => {
      if (c.type) loadWorkersForType(c.type, c.id);
    });
  }, [complaints]);

  const categoryCounts = useMemo(() => {
    const counts = {
      All: complaints.length,
      Electrical: 0,
      Plumbing: 0,
      Cleaning: 0,
      Furniture: 0,
      Internet: 0,
      Others: 0,
    };
    complaints.forEach((c) => {
      const cat = getCategoryFromType(c.type);
      counts[cat]++;
    });
    return counts;
  }, [complaints]);

  const displayComplaints = useMemo(() => {
    let list = [...complaints];

    if (selectedCat !== "All") {
      list = list.filter((c) => getCategoryFromType(c.type) === selectedCat);
    }

    list.sort((a, b) => {
      const aCrit =
        String(a.priority).toLowerCase() === "critical" ? 1 : 0;
      const bCrit =
        String(b.priority).toLowerCase() === "critical" ? 1 : 0;
      return bCrit - aCrit;
    });

    return list;
  }, [complaints, selectedCat]);

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

      {/* Sorter Pills */}
      <div className="filterBar">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`filterChip ${selectedCat === cat ? "active" : ""}`}
            onClick={() => setSelectedCat(cat)}
          >
            <span className="chipLabel">{cat}</span>
            <span className="chipCount">{categoryCounts[cat]}</span>
          </button>
        ))}
      </div>

      {message && <div className="adminInlineAlert">{message}</div>}

      <section className="complaintsSection">
        <div className="sectionHead">
          <h2 className="sectionTitle">
            {selectedCat === "All"
              ? "Pending & In-Progress Complaints"
              : `${selectedCat} Complaints`}
          </h2>
          <span className="countPill">{displayComplaints.length}</span>
        </div>

        {loading ? (
          <div className="loadingRow">Loading complaints...</div>
        ) : displayComplaints.length === 0 ? (
          <div className="emptyState">No complaints found.</div>
        ) : (
          <ul className="complaintList">
            {displayComplaints.map((c) => (
              <li className="complaintItem" key={c.id}>
                <div className="complaintHead">
                  <div className="idType">
                    <span className="cid">#{c.id}</span>
                    <span className="ctype">{getCategoryFromType(c.type)}</span>
                      {String(c.priority || "").toLowerCase() === "critical" && (
                    <span className="criticalBadge">🚨 Critical</span>
                  )}
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
                    <span className="metaLabel">Floor</span>
                    <span className="metaValue">{c.floor_no || "N/A"}</span>
                  </div>

                  <div className="metaPair">
                    <span className="metaLabel">Room</span>
                    <span className="metaValue">{c.room_no}</span>
                  </div>

                  <div className="metaPair">
                    <span className="metaLabel">Student</span>
                    <span className="metaValue">{c.student_name}</span>
                  </div>

                  <div className="metaPair">
                    <span className="metaLabel">Phone</span>
                    <span className="metaValue">{c.phone_number}</span>
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
                            className="proofThumb"
                            alt="proof"
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
                            className="proofThumb"
                            alt="worker-proof"
                          />
                          <span>View</span>
                        </a>
                      </span>
                    </div>
                  </div>
                )}

                <div className="actionRowSpace">
                  <div className="actionBlock">
                    <label className="actionLabel">Assign Worker</label>

                    {c.assigned_worker ? (
                      <div className="assignedWorkerBox">
                        <span className="assignedWorkerName">
                          👷 {c.assigned_worker}
                        </span>
                        <span className="assignedWorkerNote">
                          (Already Assigned)
                        </span>
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
                      onChange={(e) =>
                        updateStatus(c.id, e.target.value)
                      }
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
                        const worker = document.querySelector(
                          `#worker-${c.id}`
                        )?.value;
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
