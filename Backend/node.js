import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import pg from "pg";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import multer from "multer";
import path from "path";
import fs from "fs";

dotenv.config();
const app = express();

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Serve uploaded images
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// =====================
// DATABASE CONNECTION
// =====================
const db = new pg.Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT,
});
db.connect();

// =====================
// AUTH MIDDLEWARE
// =====================
function authMiddleware(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = decoded;
    next();
  });
}

// =====================
// MULTER CONFIGURATION
// =====================
const uploadDir = "./uploads";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// =====================
// EMAIL OTP SENDER
// =====================
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

// =====================
// UNIFIED LOGIN + REGISTER ENDPOINT
// =====================
app.post("/api/login", async (req, res) => {
  const { email, name } = req.body;
  if (!email || !email.endsWith("@students.vnit.ac.in"))
    return res.status(400).json({ message: "Use your institute email only" });

  try {
    const userRes = await db.query("SELECT * FROM users WHERE email = $1", [email]);

    // Case 1️⃣: Existing user and verified → Login
    if (userRes.rows.length > 0 && userRes.rows[0].verified) {
      const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "7d" });
      res.cookie("token", token, {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      return res.json({ message: "Login successful" });
    }

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Case 2️⃣: User exists but not verified → Resend OTP
    if (userRes.rows.length > 0) {
      await db.query("UPDATE users SET otp = $1 WHERE email = $2", [otp, email]);
      await sendOtpEmail(email, otp);
      return res.json({ message: "OTP re-sent for verification" });
    }

    // Case 3️⃣: New user → Register + Send OTP
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

// =====================
// VERIFY OTP
// =====================
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

// =====================
// GET USER INFO
// =====================
app.get("/api/me", authMiddleware, async (req, res) => {
  try {
    const userRes = await db.query("SELECT email, name FROM users WHERE email = $1", [
      req.user.email,
    ]);
    res.json({ user: userRes.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch user" });
  }
});

// =====================
// LOGOUT
// =====================
app.post("/api/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ message: "Logged out successfully" });
});

// =====================
// GET COMPLAINTS (per user)
// =====================
app.get("/api/complaints", authMiddleware, async (req, res) => {
  try {
    const complaints = await db.query(
      `SELECT id, type, description, hostel_name, room_no, photo_url, status
       FROM complaints
       WHERE user_id = (SELECT id FROM users WHERE email = $1)
       ORDER BY created_at DESC`,
      [req.user.email]
    );
    res.json({ complaints: complaints.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching complaints" });
  }
});

// =====================
// SUBMIT COMPLAINT
// =====================
app.post("/api/complaints", authMiddleware, upload.single("photo"), async (req, res) => {
  const { type, description, hostel_name, room_no } = req.body;
  if (!type || !description || !hostel_name || !room_no)
    return res.status(400).json({ message: "All fields are required" });

  try {
    const userRes = await db.query("SELECT id FROM users WHERE email = $1", [req.user.email]);
    const userId = userRes.rows[0].id;
    const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;

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

// =====================
// START SERVER
// =====================
app.listen(5000, () => console.log("✅ Hostel Grievance backend running on port 5000"));
