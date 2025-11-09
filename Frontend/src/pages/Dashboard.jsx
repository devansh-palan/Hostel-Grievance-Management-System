import React, { useEffect, useRef, useState } from "react";
import "../style.css";

export default function Dashboard() {
  const [hostel, setHostel] = useState("");
  const [floor, setFloor] = useState("");
  const [room, setRoom] = useState("");
  const [phone, setPhone] = useState("");
  const [problemType, setProblemType] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState([]);
  const [fileObjects, setFileObjects] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef(null);
  const name = localStorage.getItem("username") || "User";

  // Load complaints
  async function loadComplaints() {
    try {
      const res = await fetch("http://localhost:5000/api/complaints", {
        credentials: "include",
      });
      const data = await res.json();
      const rows = Array.isArray(data?.complaints) ? data.complaints : [];

      const mapped = rows.map((c) => ({
        id: c.id,
        description: c.description || "",
        type: c.type || "Other",
        createdAt: new Date(c.created_at).toLocaleString(),
        status: c.status || "Pending",
        photoUrl: c.photo_url || null,
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

  // File selection
  const onFilesSelected = (files) => {
    if (!files?.length) return;
    const imgs = [];
    const blobs = [];
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        imgs.push(e.target.result);
        blobs.push(file);
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

  // Submit complaint
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!hostel || !floor || !room || !phone || !problemType || !description.trim()) {
      alert("Please fill all required fields.");
      return;
    }

    if (submitting) return;
    try {
      setSubmitting(true);
      const fd = new FormData();
      fd.append("type", problemType);
      fd.append("description", description.trim());
      fd.append("hostel_name", hostel);
      fd.append("room_no", room);
      fd.append("floor_no", floor);
      fd.append("phone_number", phone);

      if (fileObjects[0]) fd.append("photo", fileObjects[0]);

      const res = await fetch("http://localhost:5000/api/complaints", {
        method: "POST",
        credentials: "include",
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to submit complaint");

      alert("Complaint Submitted Successfully!");
      setHostel("");
      setFloor("");
      setRoom("");
      setPhone("");
      setProblemType("");
      setDescription("");
      setImages([]);
      setFileObjects([]);
      await loadComplaints();
    } catch (err) {
      console.error(err);
      alert("There was an error submitting your complaint.");
    } finally {
      setSubmitting(false);
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

        {/* MAIN */}
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
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                {/* Hostel */}
                <div className="form-group">
                  <label className="form-label">Hostel</label>
                  <select className="form-select" value={hostel} onChange={(e) => setHostel(e.target.value)} required>
                    <option value="">Select Hostel</option>
                    {hostels.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                {/* Floor */}
                <div className="form-group">
                  <label className="form-label">Floor</label>
                  <select className="form-select" value={floor} onChange={(e) => setFloor(e.target.value)} required>
                    <option value="">Select Floor</option>
                    {floors.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>

                {/* Room */}
                <div className="form-group">
                  <label className="form-label">Room Number</label>
                  <input type="text" className="form-input" placeholder="Enter Room No." value={room} onChange={(e) => setRoom(e.target.value)} required />
                </div>

                {/* Phone */}
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="Enter Phone No."
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    pattern="[0-9]{10}"
                    maxLength="10"
                  />
                </div>

                {/* Problem Type */}
                <div className="form-group">
                  <label className="form-label">Problem Type</label>
                  <select className="form-select" value={problemType} onChange={(e) => setProblemType(e.target.value)} required>
                    <option value="">Select Problem</option>
                    {problems.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                {/* Description */}
                <div className="form-group full-width">
                  <label className="form-label">Problem Description</label>
                  <textarea className="form-textarea" placeholder="Describe the problem in detail..." value={description} onChange={(e) => setDescription(e.target.value)} required />
                </div>

                {/* Upload */}
                <div className="form-group full-width">
                  <label className="form-label">Upload Photos (optional)</label>
                  <div className="file-upload" onClick={() => fileInputRef.current?.click()} title="Click or drag & drop">
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
                        <button type="button" className="remove-image" onClick={() => removeImage(idx)} title="Remove">✕</button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Submit */}
                <div className="form-group full-width">
                  <button type="submit" className="primary-btn" disabled={submitting}>
                    {submitting ? "Submitting..." : "Submit Complaint"}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* RIGHT: Previous Complaints */}
          <aside className="records-card">
            <div className="records-title">Previous Complaints</div>
            <div className="complaints-list">
              {complaints.length === 0 ? (
                <div className="complaint-item empty-state">No complaints yet.</div>
              ) : (
                complaints.map((item) => (
                  <div className="complaint-item" key={item.id}>
                    <div className="complaint-row">
                      <span className={`status-dot ${
                        item.status.toLowerCase() === "resolved" ? "green" :
                        item.status.toLowerCase() === "in progress" ? "orange" :
                        "red"
                      }`} title={item.status} />
                      <div className="complaint-info">
                        <span className="complaint-title">{item.type}</span>
                        <span className="complaint-meta">{item.description}</span>
                        <span className="complaint-time">{item.createdAt}</span>
                      </div>
                    </div>

                    {item.photoUrl && (
                      <div className="complaint-photo">
                        <a href={item.photoUrl} target="_blank" rel="noopener noreferrer">
                          <img src={item.photoUrl} alt="complaint" className="proofThumb" />
                        </a>
                      </div>
                    )}

                    <div className={`status-text ${item.status.toLowerCase()}`}>
                      {item.status}
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
