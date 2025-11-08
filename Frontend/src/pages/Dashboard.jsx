import React, { useEffect, useRef, useState } from "react";
import "../style.css";

export default function Dashboard() {
  const [hostel, setHostel] = useState("");
  const [floor, setFloor] = useState("");
  const [room, setRoom] = useState("");
  const [problemType, setProblemType] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState([]); // previews (we'll send first image file as "photo")
  const [fileObjects, setFileObjects] = useState([]); // original File objects
  const [complaints, setComplaints] = useState([]);

  const fileInputRef = useRef(null);

  const name = localStorage.getItem("username") || "User";

  // ===== Load previous complaints from your backend (UNCHANGED endpoint) =====
  async function loadComplaints() {
    try {
      const res = await fetch("http://localhost:5000/api/complaints", {
        credentials: "include",
      });
      const data = await res.json();
      const rows = Array.isArray(data?.complaints) ? data.complaints : [];
      // Map to UI shape expected by abc.html-like component
      const mapped = rows.map((c) => ({
        id: c.id,
        title: c.description?.slice(0, 60) || c.type || "Complaint",
        type: c.type || "Other",
        createdAt: c.created_at || "",
        resolved: (c.status || "").toLowerCase() === "resolved",
      }));
      setComplaints(mapped);
    } catch (err) {
      console.error(err);
      setComplaints([]);
    }
  }

  useEffect(() => {
    loadComplaints();
  }, []);

  // ===== Drag/drop + picker =====
  const onFilesSelected = (files) => {
    if (!files?.length) return;
    const imgs = [];
    const blobs = [];
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        imgs.push(e.target.result);
        blobs.push(file);
        // batch update when last loads
        if (imgs.length === files.length) {
          setImages((prev) => [...prev, ...imgs]);
          setFileObjects((prev) => [...prev, ...blobs]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = (e) => onFilesSelected(e.target.files);

  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setFileObjects((prev) => prev.filter((_, i) => i !== index));
  };

  // ===== Submit complaint (UNCHANGED endpoint & field names) =====
  // Backend expects: type, description, hostel_name, room_no, photo (single file)
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!hostel || !floor || !room || !problemType || !description.trim()) {
      alert("Please fill all required fields.");
      return;
    }

    try {
      const fd = new FormData();
      fd.append("type", problemType);
      fd.append("description", `${description.trim()}`);
      fd.append("hostel_name", hostel);
      fd.append("room_no", room);

      // only first image as single "photo" (as per backend contract)
      if (fileObjects[0]) fd.append("photo", fileObjects[0]);

      const res = await fetch("http://localhost:5000/api/complaints", {
        method: "POST",
        credentials: "include",
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to submit complaint");

      alert("Complaint Submitted Successfully!");
      // reset
      setHostel("");
      setFloor("");
      setRoom("");
      setProblemType("");
      setDescription("");
      setImages([]);
      setFileObjects([]);

      // refresh list
      loadComplaints();
    } catch (err) {
      console.error(err);
      alert("There was an error submitting your complaint.");
    }
  };

  const logout = async () => {
    try {
      await fetch("http://localhost:5000/api/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {}
    localStorage.clear();
    window.location.href = "/login";
  };

  // helper
  const floors = Array.from({ length: 10 }, (_, i) => `${i + 1}`);
  const hostels = [
    "HB1","HB2","HB3","HB4","HB5","HB6","HB7","HB8","HB9","HB10","HB11","GH1","GH2",
  ];
  const problems = ["Electrical", "Plumbing", "Cleaning", "Furniture", "Internet", "Other"];

  return (
    <div className="page-wrap">
      <div className="container">
        {/* HEADER */}
        <div className="dashboard-header">
          <div className="welcome-text">
            <h1>Welcome, {name}!</h1>
            <p>Submit your hostel complaints here.</p>
          </div>
          <button className="logout-btn" onClick={logout}>Logout</button>
        </div>

        {/* MAIN: parallel columns */}
        <div
          className="dashboard-main"
          onDragEnter={(e) => e.preventDefault()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onFilesSelected(e.dataTransfer.files);
          }}
        >
          {/* LEFT: Complaint Form */}
          <div className="complaint-form">
            <div className="form-title">Submit a Complaint</div>
            <form onSubmit={handleSubmit} id="complaintFormReact">
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Hostel</label>
                  <select
                    className="form-select"
                    value={hostel}
                    onChange={(e) => setHostel(e.target.value)}
                    required
                  >
                    <option value="">Select Hostel</option>
                    {hostels.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Floor</label>
                  <select
                    className="form-select"
                    value={floor}
                    onChange={(e) => setFloor(e.target.value)}
                    required
                  >
                    <option value="">Select Floor</option>
                    {floors.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Room Number</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Enter Room No."
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Problem Type</label>
                  <select
                    className="form-select"
                    value={problemType}
                    onChange={(e) => setProblemType(e.target.value)}
                    required
                  >
                    <option value="">Select Problem</option>
                    {problems.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group full-width">
                  <label className="form-label">Problem Description</label>
                  <textarea
                    className="form-textarea"
                    placeholder="Describe the problem in detail..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group full-width">
                  <label className="form-label">Upload Photos (optional)</label>
                  <div
                    className="file-upload"
                    onClick={() => fileInputRef.current?.click()}
                    title="Click or drag & drop"
                  >
                    Click to upload images or drag & drop
                  </div>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    ref={fileInputRef}
                    style={{ display: "none" }}
                    onChange={handleFileChange}
                  />
                  <div className="preview-container">
                    {images.map((src, idx) => (
                      <div className="image-preview" key={idx}>
                        <img src={src} alt={`preview-${idx}`} />
                        <button
                          type="button"
                          className="remove-image"
                          onClick={() => removeImage(idx)}
                          title="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="muted-link" style={{ marginTop: 6 }}>
                    (Only the <strong>first</strong> image will be uploaded as the
                    complaint photo, matching the backend.)
                  </div>
                </div>

                <div className="form-group full-width">
                  <button type="submit" className="primary-btn">Submit Complaint</button>
                </div>
              </div>
            </form>
          </div>

          {/* RIGHT: Previous Complaints */}
          <aside className="records-card">
            <div className="records-title">Previous Complaints</div>
            <div className="complaints-list">
              {complaints.length === 0 && (
                <div className="complaint-item empty-state">No complaints yet.</div>
              )}

              {complaints.map((item) => (
                <div className="complaint-item" key={item.id}>
                  <div className="complaint-row">
                    <span
                      className={`status-dot ${item.resolved ? "green" : "red"}`}
                      title={item.resolved ? "Resolved" : "Not Resolved"}
                    />
                    <div className="complaint-info">
                      <span className="complaint-title">{item.title}</span>
                      <span className="complaint-meta">{item.type}</span>
                      <span className="complaint-time">{item.createdAt}</span>
                    </div>
                  </div>
                  <div
                    className={`status-text ${item.resolved ? "resolved" : "pending"}`}
                  >
                    {item.resolved ? "Resolved" : "Not resolved"}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
