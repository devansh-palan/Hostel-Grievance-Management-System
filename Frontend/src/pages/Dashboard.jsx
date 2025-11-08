import React, { useState, useRef } from "react";
import "../style.css";     // ✅ updated filename (was styles.css)

export default function Dashboard() {

  const [hostel, setHostel] = useState("");
  const [room, setRoom] = useState("");
  const [problemType, setProblemType] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState([]);

  const fileInputRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();

    // ✅ YOUR existing API logic here (unchanged)
    console.log({
      hostel,
      room,
      problemType,
      description,
      imagesCount: images.length,
    });

    alert("Complaint Submitted Successfully!");

    setHostel("");
    setRoom("");
    setProblemType("");
    setDescription("");
    setImages([]);
  };

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files);

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImages((prev) => [...prev, e.target.result]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const logout = () => {
    localStorage.clear();
    window.location.href = "/login";
  };

  const name = localStorage.getItem("username") || "User";
  const email = localStorage.getItem("email") || "user@mail.com";
  const initials = name.split(" ").map(n => n[0]).join("").toUpperCase();

  return (
    <div className="page-wrap" style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}>
      <div className="container dashboard-container">

        <div className="dashboard-header">
          <div className="welcome-text">
            <h1>Welcome back, {name}!</h1>
            <p>Submit your hostel complaints here.</p>
          </div>

          <div className="user-info">
            <div className="user-avatar">{initials}</div>
            <div>
              <div>{name}</div>
              <div style={{ fontSize: "12px", opacity: "0.8" }}>{email}</div>
            </div>
            <button className="logout-btn" onClick={logout}>Logout</button>
          </div>
        </div>

        <div className="complaint-form">
          <div className="form-title">Submit a Complaint</div>

          <form onSubmit={handleSubmit}>
            <div className="form-grid">

              <div className="form-group flexcol">
                <label className="form-label">Hostel</label>
                <select
                  className="form-select"
                  value={hostel}
                  onChange={(e) => setHostel(e.target.value)}
                >
                  <option value="">Select Hostel</option>
                  <option value="A">A-Block</option>
                  <option value="B">B-Block</option>
                  <option value="C">C-Block</option>
                  <option value="D">D-Block</option>
                  <option value="E">E-Block</option>
                </select>
              </div>

              <div className="form-group flexcol">
                <label className="form-label">Room Number</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter Room No."
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                />
              </div>

              <div className="form-group flexcol">
                <label className="form-label">Problem Type</label>
                <select
                  className="form-select"
                  value={problemType}
                  onChange={(e) => setProblemType(e.target.value)}
                >
                  <option value="">Select Problem</option>
                  <option value="Electrical">Electrical</option>
                  <option value="Plumbing">Plumbing</option>
                  <option value="Cleaning">Cleaning</option>
                  <option value="Furniture">Furniture</option>
                  <option value="Internet">Internet</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group full-width flexcol">
                <label className="form-label">Problem Description</label>
                <textarea
                  className="form-textarea"
                  placeholder="Describe the problem in detail..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="form-group full-width flexcol">
                <label className="form-label">Upload Photos (optional)</label>

                <div className="file-upload" onClick={() => fileInputRef.current.click()}>
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
                  {images.map((img, index) => (
                    <div className="image-preview" key={index}>
                      <img src={img} alt="preview" />
                      <button type="button" className="remove-image" onClick={() => removeImage(index)}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-group full-width">
                <button type="submit" className="primary-btn">Submit Complaint</button>
              </div>

            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
