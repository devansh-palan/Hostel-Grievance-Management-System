import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import pg from "pg";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

dotenv.config();
const app = express();

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());
app.use(cookieParser());

// ===============================
// 🧠 DATABASE CONNECTION
// ===============================
const db = new pg.Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT,
});
db.connect()
  .then(() => console.log("✅ Connected to PostgreSQL"))
  .catch(console.error);

// ===============================
// 🔐 AUTH MIDDLEWARE
// ===============================
function authMiddleware(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = decoded;
    next();
  });
}

// ===============================
// ☁️ CLOUDINARY CONFIGURATION
// ===============================
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "hostel_complaints",
    allowed_formats: ["jpg", "jpeg", "png"],
    public_id: (req, file) =>
      `${Date.now()}-${file.originalname.split(".")[0]}`,
  },
});

const upload = multer({ storage });

// ===============================
// 📧 EMAIL (OTP) FUNCTION
// ===============================
async function sendOtpEmail(email, otp) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: `"Hostel Grievance System" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: "Your OTP for Hostel Grievance Portal",
    text: `Your OTP is ${otp}. It will expire in 10 minutes.`,
  });
}

// ===============================
// 👤 STUDENT LOGIN (OTP SEND/RESEND)
// ===============================
app.post("/api/login", async (req, res) => {
  const { email, name } = req.body;
  if (!email || !email.endsWith("@students.vnit.ac.in"))
    return res.status(400).json({ message: "Use your institute email only" });

  try {
    const userRes = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    if (userRes.rows.length > 0) {
      await db.query("UPDATE users SET otp = $1 WHERE email = $2", [otp, email]);
      await sendOtpEmail(email, otp);
      return res.json({ message: "OTP re-sent for verification" });
    }

    await db.query(
      `INSERT INTO users (email, name, otp, verified)
       VALUES ($1, $2, $3, FALSE)`,
      [email, name || null, otp]
    );
    await sendOtpEmail(email, otp);
    return res.json({ message: "OTP sent for registration" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error processing login" });
  }
});

// ===============================
// 🔍 OTP VERIFY ROUTE
// ===============================
app.post("/api/verify-otp", async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp)
    return res.status(400).json({ message: "Email and OTP required" });

  try {
    const result = await db.query("SELECT id, otp FROM users WHERE email = $1", [email]);
    if (result.rows.length === 0) return res.status(400).json({ message: "User not found" });

    if (result.rows[0].otp !== otp)
      return res.status(400).json({ message: "Invalid OTP" });

    await db.query("UPDATE users SET verified = TRUE, otp = NULL WHERE email = $1", [email]);

    const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ message: "Verification successful, logged in" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Verification failed" });
  }
});

// ===============================
// 📝 POST NEW COMPLAINT
// ===============================
app.post("/api/complaints", authMiddleware, upload.single("photo"), async (req, res) => {
  const { type, description, hostel_name, room_no } = req.body;
  if (!type || !description || !hostel_name || !room_no)
    return res.status(400).json({ message: "All fields are required" });

  try {
    const userRes = await db.query("SELECT id FROM users WHERE email = $1", [req.user.email]);
    if (userRes.rows.length === 0)
      return res.status(400).json({ message: "User not found" });
    const userId = userRes.rows[0].id;

    const photoUrl = req.file ? req.file.path : null;

    const result = await db.query(
      `INSERT INTO complaints (user_id, type, description, hostel_name, room_no, photo_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, type, description, hostel_name, room_no, photo_url, status`,
      [userId, type, description, hostel_name, room_no, photoUrl]
    );

    res.json({ message: "Complaint submitted successfully", complaint: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error creating complaint" });
  }
});

// ===============================
// 👨‍🏫 ADMIN LOGIN
// ===============================
app.post("/api/admin/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ message: "Username and password required" });

  try {
    const result = await db.query("SELECT * FROM admins WHERE username = $1", [username]);
    if (result.rows.length === 0)
      return res.status(404).json({ message: "Admin not found" });

    const admin = result.rows[0];
    if (admin.password !== password)
      return res.status(401).json({ message: "Invalid credentials" });

    res.json({
      message: "Admin login successful",
      username: admin.username,
      hostel: admin.hostel_assigned,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error logging in" });
  }
});

// ===============================
// 📋 ADMIN FETCH COMPLAINTS
// ===============================
app.get("/api/admin/complaints/pending", async (req, res) => {
  try {
    const { hostel } = req.query;
    if (!hostel) return res.status(400).json({ message: "Hostel required" });

    const complaints = await db.query(
      `SELECT 
         c.id, 
         c.type, 
         c.description, 
         c.hostel_name, 
         c.room_no, 
         c.status, 
         c.created_at, 
         c.photo_url,
         u.name AS student_name, 
         u.email AS student_email
       FROM complaints c
       JOIN users u ON c.user_id = u.id
       WHERE c.hostel_name = $1 
         AND c.status IN ('Pending', 'In Progress')   -- ✅ only pending + in progress
       ORDER BY 
         CASE 
           WHEN c.status = 'Pending' THEN 1
           WHEN c.status = 'In Progress' THEN 2
         END, 
         c.created_at DESC`,
      [hostel]
    );

    res.json({ complaints: complaints.rows });
  } catch (err) {
    console.error("Error fetching admin complaints:", err);
    res.status(500).json({ message: "Error fetching complaints" });
  }
});

// ===============================
// 🛠️ ADMIN UPDATE STATUS
// ===============================
app.put("/api/admin/complaints/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const { hostel } = req.query;

  console.log("🔧 Received:", { id, status, hostel }); // <--- add this

  if (!["Pending", "In Progress", "Resolved"].includes(status))
    return res.status(400).json({ message: "Invalid status" });
  if (!hostel)
    return res.status(400).json({ message: "Hostel name missing" });

  try {
    const result = await db.query(
      `UPDATE complaints 
       SET status = $1 
       WHERE id = $2 AND hostel_name = $3 
       RETURNING *`,
      [status, id, hostel]
    );

    console.log("🧩 Update result:", result.rows); // <--- add this

    if (result.rows.length === 0)
      return res.status(404).json({ message: "Not found or not authorized" });

    res.json({ message: "Status updated", complaint: result.rows[0] });
  } catch (err) {
    console.error("🔥 Error updating status:", err);
    res.status(500).json({ message: "Error updating status" });
  }
});

// ===============================
// 👤 GET CURRENT LOGGED-IN USER
// ===============================
app.get("/api/me", authMiddleware, async (req, res) => {
  try {
    const userRes = await db.query(
      "SELECT name, email FROM users WHERE email = $1",
      [req.user.email]
    );
    if (userRes.rows.length === 0)
      return res.status(404).json({ message: "User not found" });

    res.json({ user: userRes.rows[0] });
  } catch (err) {
    console.error("Error in /api/me:", err);
    res.status(500).json({ message: "Error fetching user info" });
  }
});



app.listen(5000, () => console.log("✅ Hostel Grievance backend running on port 5000"));
