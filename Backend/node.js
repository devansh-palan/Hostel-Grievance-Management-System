import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import pg from "pg";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";

dotenv.config();

const app = express();
app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());
app.use(cookieParser());

const db = new pg.Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT,
});
db.connect();

// Simple auth middleware using JWT cookie
function authMiddleware(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = decoded;
    next();
  });
}

// Email helper (uses Gmail credentials from env)
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
    subject: "Your OTP for Hostel Grievance Portal (Registration)",
    text: `Your OTP is ${otp}. It will expire in 10 minutes.`,
  });
}

/*
  REGISTER
  - If email NOT in DB -> create user with otp & verified = FALSE, send OTP
  - If email already in DB -> respond "Already registered, please login" (no OTP)
*/
app.post("/api/register", async (req, res) => {
  const { email, name } = req.body;
  if (!email || !email.endsWith("@students.vnit.ac.in"))
    return res.status(400).json({ message: "Use your institute email only" });

  try {
    const existing = await db.query("SELECT id FROM users WHERE email = $1", [email]);

    if (existing.rows.length > 0) {
      // User already exists — do NOT send OTP
      return res.status(400).json({ message: "Email already registered. Please login." });
    }

    // New user -> generate OTP and save
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await db.query(
      `INSERT INTO users (email, name, otp, verified)
       VALUES ($1, $2, $3, FALSE)`,
      [email, name || null, otp]
    );

    await sendOtpEmail(email, otp);
    return res.json({ message: "OTP sent for registration" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error during registration" });
  }
});

/*
  VERIFY OTP (for registration)
  - Checks OTP saved in DB for that email
  - Marks verified = TRUE, clears otp, issues JWT cookie
*/
app.post("/api/verify-otp", async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ message: "Email and OTP required" });

  try {
    const result = await db.query("SELECT id, otp FROM users WHERE email = $1", [email]);
    if (result.rows.length === 0) return res.status(400).json({ message: "User not found" });

    if (result.rows[0].otp !== otp)
      return res.status(400).json({ message: "Invalid OTP" });

    await db.query("UPDATE users SET verified = TRUE, otp = NULL WHERE email = $1", [email]);

    const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.cookie("token", token, {
      httpOnly: true,
      secure: false, // set to true in production with HTTPS
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({ message: "Registration verified and logged in" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Verification failed" });
  }
});

/*
  LOGIN
  - User types email
  - If email exists in DB -> directly issue JWT cookie and log them in (no OTP)
  - If email doesn't exist -> respond "Email not registered"
*/
app.post("/api/login", async (req, res) => {
  const { email } = req.body;
  if (!email || !email.endsWith("@students.vnit.ac.in"))
    return res.status(400).json({ message: "Use your institute email only" });

  try {
    const result = await db.query("SELECT id, name FROM users WHERE email = $1", [email]);
    if (result.rows.length === 0) {
      return res.status(400).json({ message: "Email not registered. Please register first." });
    }

    // Email exists -> directly create token (per your requirement)
    const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.cookie("token", token, {
      httpOnly: true,
      secure: false, // set true in prod
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({ message: "Login successful" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Login failed" });
  }
});

// other routes unchanged (me, logout, complaints)
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

app.post("/api/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ message: "Logged out successfully" });
});

app.get("/api/complaints", authMiddleware, async (req, res) => {
  try {
    const complaints = await db.query(
      "SELECT id, title, description, status FROM complaints WHERE user_id = (SELECT id FROM users WHERE email = $1)",
      [req.user.email]
    );
    res.json({ complaints: complaints.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching complaints" });
  }
});

app.post("/api/complaints", authMiddleware, async (req, res) => {
  const { title, description } = req.body;
  if (!title || !description)
    return res.status(400).json({ message: "Title and description required" });

  try {
    const userRes = await db.query("SELECT id FROM users WHERE email = $1", [req.user.email]);
    const userId = userRes.rows[0].id;

    const result = await db.query(
      "INSERT INTO complaints (user_id, title, description) VALUES ($1, $2, $3) RETURNING id, title, description, status",
      [userId, title, description]
    );

    res.json({ complaint: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error creating complaint" });
  }
});

app.listen(5000, () => console.log("✅ Hostel Grievance backend running on port 5000"));
