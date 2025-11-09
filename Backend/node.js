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
import twilio from "twilio";
import axios from "axios";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

// ✅ Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 🤖 Gemini AI Classifier — outputs strictly "normal" or "critical"
async function classifyComplaintPriority(description) {
  const prompt = `
You are an intelligent hostel maintenance assistant.
Your task is to classify the student's complaint into one of two categories:
- "normal" for regular maintenance issues
- "critical" for emergencies or urgent issues.

Respond with ONLY one word: "normal" or "critical". 
Do not include any explanation or extra text.

Complaint:
"""${description}"""
`;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);

    const output = result.response.text().trim().toLowerCase();
    if (output.includes("critical")) return "critical";
    return "normal";
  } catch (err) {
    console.error("❌ Gemini classification failed:", err.message);
    return "normal";
  }
}

export { classifyComplaintPriority };







const app = express();
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

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

async function sendWhatsAppMessage(phone, messageText) {
  try {
    await twilioClient.messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM,
      to: `whatsapp:+91${phone}`, // assuming Indian numbers
      body: messageText,
    });
    console.log(`📲 WhatsApp message sent to ${phone}`);
  } catch (err) {
    console.error("❌ WhatsApp send error:", err.message);
  }
}

async function sendWorkAssignedEmail(studentEmail, studentName, complaintId, workerName, workerPhone, room_no, hostel_name) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });

  const html = `
    <div style="font-family: Arial; line-height: 1.5;">
      <h2>Work Assigned for Your Complaint</h2>
      <p>Hello ${studentName || "Student"},</p>
      <p>Your complaint <b>#${complaintId}</b> has been assigned to a worker.</p>

      <p><b>Worker Details:</b><br/>
      👷 <b>${workerName}</b><br/>
      📞 <b>${workerPhone}</b> (They may call you, please keep your phone available)
      </p>

      <p><b>Hostel:</b> ${hostel_name}<br/>
      <b>Room No:</b> ${room_no}</p>

      <p>Please stay available and ensure someone is present inside your room when the worker arrives.</p>

      <br/>
      <p>– Hostel Administration</p>
    </div>
  `;

  await transporter.sendMail({
    from: `"Hostel Grievance System" <${process.env.GMAIL_USER}>`,
    to: studentEmail,
    subject: "🛠️ Worker Assigned – Please Be Available",
    html,
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

async function getAdminPhone(hostel_name) {
  const adminRes = await db.query(
    "SELECT phone FROM admins WHERE hostel_assigned = $1 LIMIT 1",
    [hostel_name]
  );
  return adminRes.rows.length ? adminRes.rows[0].phone : null;
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
// ===============================
// 📝 POST NEW COMPLAINT (AI Priority Classification)
// ===============================
app.post("/api/complaints", authMiddleware, upload.single("photo"), async (req, res) => {
  const { type, description, hostel_name, room_no, floor_no, phone_number } = req.body;

  if (!type || !description || !hostel_name || !room_no || !phone_number)
    return res.status(400).json({ message: "All fields are required" });

  try {
    // 🧍 Get user info
    const userRes = await db.query("SELECT id FROM users WHERE email = $1", [req.user.email]);
    if (userRes.rows.length === 0)
      return res.status(400).json({ message: "User not found" });

    const userId = userRes.rows[0].id;
    const photoUrl = req.file ? req.file.path : null;

    // 🧠 Classify priority using Gemini AI
    const priority = await classifyComplaintPriority(description);
    console.log(`🔍 Complaint classified as: ${priority}`);

    if (priority === "critical") {
      const adminPhone = await getAdminPhone(hostel_name);
      if (adminPhone) {
        const adminMsg = `🚨 *CRITICAL COMPLAINT ALERT*
Hostel: ${hostel_name}
Floor: ${floor_no || "N/A"}
Room: ${room_no}
Phone: ${phone_number}
Description: ${description}`;
        await sendWhatsAppMessage(adminPhone, adminMsg);
      }
    }

    // 💾 Save complaint
    const result = await db.query(
      `INSERT INTO complaints 
       (user_id, type, description, hostel_name, room_no, floor_no, phone_number, photo_url, priority)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [userId, type, description, hostel_name, room_no, floor_no, phone_number, photoUrl, priority]
    );

    const complaint = result.rows[0];

    // ✅ AUTO-ASSIGN WORKER (types are already same)
    console.log("🔍 Checking for auto-assignment...");

    const autoWorker = await db.query(
      `SELECT id, name, phone FROM workers
       WHERE hostel_name = $1 AND work_type = $2 AND current_status = 'Available'
       LIMIT 1`,
      [hostel_name, type] // ✅ direct match
    );

    if (autoWorker.rows.length > 0) {
      const w = autoWorker.rows[0];

      console.log(`✅ Auto-assigning worker: ${w.name}`);

      // Assign worker
      await db.query(
        `UPDATE complaints SET assigned_worker = $1, status = 'In Progress' WHERE id = $2`,
        [w.name, complaint.id]
      );

      // Mark worker busy
      await db.query(
        `UPDATE workers SET current_status = 'Busy' WHERE id = $1`,
        [w.id]
      );

      // Email student
      const studentRes = await db.query(
        `SELECT email, name FROM users WHERE id = $1`,
        [complaint.user_id]
      );

      if (studentRes.rows.length > 0) {
        const { email, name } = studentRes.rows[0];
        await sendWorkAssignedEmail(
          email, name, complaint.id, w.name, w.phone, room_no, hostel_name
        );
      }

      // WhatsApp the worker
      const msg = `🛠️ *New Work Assignment*
🏠 Hostel: ${hostel_name}
🏢 Floor: ${floor_no}
🚪 Room: ${room_no}
📞 Student Phone: ${phone_number}
🧾 Complaint: ${description}`;
      await sendWhatsAppMessage(w.phone, msg);
    }

    // ✅ FINALLY SEND RESPONSE (after everything)
    res.json({
      message: "Complaint submitted successfully",
      complaint,
    });

  } catch (err) {
    console.error("❌ Error creating complaint:", err);
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
     c.id, c.type, c.description, c.hostel_name, c.room_no, c.floor_no,
     c.phone_number, c.status, c.priority,
     c.created_at, c.photo_url, c.worker_proof_url, c.assigned_worker,
     u.name AS student_name, u.email AS student_email
   FROM complaints c
   JOIN users u ON c.user_id = u.id
   WHERE c.hostel_name = $1
     AND (c.status = 'Pending' OR c.status = 'In Progress')
   ORDER BY 
     CASE WHEN c.priority = 'critical' THEN 1 ELSE 2 END,
     c.created_at DESC`,
  [hostel]
);


    res.json({ complaints: complaints.rows });
  } catch (err) {
    console.error("Error fetching complaints:", err);
    res.status(500).json({ message: "Error fetching complaints" });
  }
});


app.get("/api/complaints", authMiddleware, async (req, res) => {
  try {
    const complaints = await db.query(
      `SELECT id, type, description, hostel_name, room_no, photo_url, status, created_at
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


// ===============================
// 🛠️ ADMIN UPDATE STATUS
// ===============================
app.put("/api/admin/complaints/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const { hostel } = req.query;

  if (!["Pending", "In Progress", "Resolved"].includes(status))
    return res.status(400).json({ message: "Invalid status" });
  if (!hostel)
    return res.status(400).json({ message: "Hostel name missing" });

  try {
    // 🧠 1️⃣ Update the complaint status
    const result = await db.query(
      `UPDATE complaints 
       SET status = $1 
       WHERE id = $2 AND hostel_name = $3 
       RETURNING *`,
      [status, id, hostel]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ message: "Not found or not authorized" });

    const complaint = result.rows[0];

    // 📧 2️⃣ If status changed to "Resolved", send an email to the student
    if (status === "Resolved") {
      

      const userRes = await db.query(
        `SELECT email, name FROM users WHERE id = $1`,
        [complaint.user_id]
      );

      if (userRes.rows.length > 0) {
        const { email, name } = userRes.rows[0];

        // Send resolution email
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_PASS,
          },
        });

        const mailOptions = {
          from: `"Hostel Grievance System" <${process.env.GMAIL_USER}>`,
          to: email,
          subject: "✅ Your Hostel Complaint Has Been Resolved",
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.5;">
              <h2>Hi ${name || "Student"},</h2>
              <p>We’re happy to inform you that your complaint has been <b>resolved</b>.</p>
              <p><b>Complaint Details:</b></p>
              <ul>
                <li><b>Complaint ID:</b> #${complaint.id}</li>
                <li><b>Type:</b> ${complaint.type}</li>
                <li><b>Description:</b> ${complaint.description}</li>
                <li><b>Hostel:</b> ${complaint.hostel_name}</li>
                <li><b>Room No:</b> ${complaint.room_no}</li>
              </ul>
              <p>If you still face any issue, you can raise a new complaint anytime from your dashboard.</p>
              <br/>
              <p>Thank you for using the Hostel Grievance Portal.</p>
              <p>– Hostel Administration</p>
            </div>
          `,
        };

        await transporter.sendMail(mailOptions);
        console.log(`📧 Resolution email sent to ${email}`);
      }
    }

    res.json({ message: "Status updated", complaint });
  } catch (err) {
    console.error("🔥 Error updating status:", err);
    res.status(500).json({ message: "Error updating status" });
  }
});

app.get("/api/admin/workers", async (req, res) => {
  try {
    const { hostel, work_type } = req.query;

    if (!hostel)
      return res.status(400).json({ message: "Hostel is required" });
    if (!work_type)
      return res.status(400).json({ message: "Work type is required" });

    const workers = await db.query(
      `SELECT id, name, phone, work_type, current_status
       FROM workers
       WHERE hostel_name = $1 
         AND work_type = $2 
         AND current_status = 'Available'
       ORDER BY name ASC`,
      [hostel, work_type]
    );

    res.json({ workers: workers.rows });
  } catch (err) {
    console.error("Error fetching workers:", err);
    res.status(500).json({ message: "Error fetching workers" });
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

app.put("/api/admin/complaints/:id/assign", async (req, res) => {
  const { id } = req.params;
  const { worker } = req.body;
  const { hostel } = req.query;

  if (!worker) return res.status(400).json({ message: "Worker name required" });
  if (!hostel) return res.status(400).json({ message: "Hostel required" });

  try {
    // 1️⃣ Get complaint details (include phone + user_id)
    const complaintRes = await db.query(
      `SELECT description, hostel_name, room_no, floor_no, phone_number, user_id
       FROM complaints 
       WHERE id = $1`,
      [id]
    );

    if (complaintRes.rows.length === 0)
      return res.status(404).json({ message: "Complaint not found" });

    const complaint = complaintRes.rows[0];

    // 2️⃣ Get worker details
    const workerRes = await db.query(
      `SELECT id, name, phone, work_type FROM workers 
       WHERE name = $1 AND hostel_name = $2`,
      [worker, hostel]
    );

    if (workerRes.rows.length === 0)
      return res.status(404).json({ message: "Worker not found" });

    const workerData = workerRes.rows[0];

    // 3️⃣ Update complaint with assigned worker
    await db.query(
      `UPDATE complaints SET assigned_worker = $1, status = 'In Progress' WHERE id = $2`,
      [workerData.name, id]
    );

    // 4️⃣ Mark worker as Busy
    await db.query(
      `UPDATE workers SET current_status = 'Busy' WHERE id = $1`,
      [workerData.id]
    );

    // 5️⃣ Get student email + name
    const studentRes = await db.query(
      `SELECT email, name FROM users WHERE id = $1`,
      [complaint.user_id]
    );

    if (studentRes.rows.length > 0) {
      const { email, name } = studentRes.rows[0];

      // 6️⃣ Send email notifying the student
      await sendWorkAssignedEmail(
  email,
  name,
  id,
  workerData.name,
  workerData.phone,          // ✅ Added worker phone
  complaint.room_no,
  complaint.hostel_name
);


      console.log(`📧 Work assignment email sent to ${email}`);
    }

    // 7️⃣ Send WhatsApp message including floor number (existing)
    const msg = `🛠️ *New Work Assignment*\n🏠 Hostel: ${complaint.hostel_name}\n🏢 Floor: ${complaint.floor_no || "N/A"}\n🚪 Room No: ${complaint.room_no}\n📞 Student Phone: ${complaint.phone_number || "Not provided"} (Call before visiting)\n🧾 Complaint: ${complaint.description}\n\nPlease attend to this issue as soon as possible.`;

    await sendWhatsAppMessage(workerData.phone, msg);

    res.json({
      message: `Worker ${workerData.name} assigned. Student notified by email & worker notified on WhatsApp.`,
    });
  } catch (err) {
    console.error("Assignment + Notification Error:", err);
    res.status(500).json({ message: "Error assigning worker" });
  }
});


app.post("/api/whatsapp/webhook", express.urlencoded({ extended: false }), async (req, res) => {
  try {
    console.log("📩 Incoming WhatsApp message:", req.body);

    const from = req.body.From; // e.g. 'whatsapp:+919876543210'
    const mediaUrl = req.body.MediaUrl0; // first media file
    const numMedia = parseInt(req.body.NumMedia || "0");
    const caption = req.body.Body?.trim(); // optional caption with complaint ID

    if (!from || numMedia === 0 || !mediaUrl) {
      console.log("No media or invalid message");
      return res.sendStatus(200);
    }

    // 1️⃣ Find which worker sent the image
    const workerPhone = from.replace("whatsapp:+91", "");
    const workerRes = await db.query(
      "SELECT * FROM workers WHERE phone = $1",
      [workerPhone]
    );

    if (workerRes.rows.length === 0) {
      console.log("Unknown worker:", workerPhone);
      return res.sendStatus(200);
    }

    const worker = workerRes.rows[0];

    // 2️⃣ Determine which complaint to update
    let complaintId = null;

    // If the worker included complaint ID in caption (e.g. "#12 Fixed")
    const match = caption?.match(/#?(\d+)/);
    if (match) {
      complaintId = parseInt(match[1]);
    } else {
      // Otherwise, use most recent assigned complaint
      const complaintRes = await db.query(
        `SELECT id FROM complaints
         WHERE assigned_worker = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [worker.name]
      );
      if (complaintRes.rows.length > 0)
        complaintId = complaintRes.rows[0].id;
    }

    if (!complaintId) {
      console.log("⚠️ No matching complaint found for worker:", worker.name);
      return res.sendStatus(200);
    }

    // 3️⃣ Securely download the Twilio image using authentication
    const mediaResponse = await axios.get(mediaUrl, {
      responseType: "arraybuffer",
      auth: {
        username: process.env.TWILIO_ACCOUNT_SID,
        password: process.env.TWILIO_AUTH_TOKEN,
      },
    });

    // 4️⃣ Convert to base64 for Cloudinary upload
    const base64Image = Buffer.from(mediaResponse.data, "binary").toString("base64");
    const contentType = req.body.MediaContentType0 || "image/jpeg";
    const dataUri = `data:${contentType};base64,${base64Image}`;

    // 5️⃣ Upload directly to Cloudinary
    const uploadRes = await cloudinary.uploader.upload(dataUri, {
      folder: "worker_proofs",
      resource_type: "image",
    });

    console.log("✅ Uploaded to Cloudinary:", uploadRes.secure_url);

    // 6️⃣ Update the complaint in DB
    // 6️⃣ Save proof URL
await db.query(
  `UPDATE complaints 
   SET worker_proof_url = $1
   WHERE id = $2`,
  [uploadRes.secure_url, complaintId]
);

console.log(`✅ Worker proof saved for complaint #${complaintId}`);

// ✅ 7️⃣ Get assigned worker from complaint
const assignedRes = await db.query(
  `SELECT assigned_worker, hostel_name 
   FROM complaints
   WHERE id = $1`,
  [complaintId]
);

if (assignedRes.rows.length === 0) {
  console.log("⚠️ No assigned worker found for complaint");
  return res.sendStatus(200);
}

const assignedWorkerName = assignedRes.rows[0].assigned_worker;
const assignedWorkerHostel = assignedRes.rows[0].hostel_name;

// ✅ 8️⃣ Free the correct worker
await db.query(
  `UPDATE workers 
   SET current_status = 'Available'
   WHERE name = $1 AND hostel_name = $2`,
  [assignedWorkerName, assignedWorkerHostel]
);

console.log(`✅ Worker ${assignedWorkerName} marked AVAILABLE after proof`);


// 7️⃣ (Optional) Notify admin via console or email
// You could also integrate a WhatsApp or email notification here if you want.
res.sendStatus(200);
  } catch (err) {
    console.error("❌ WhatsApp webhook error:", err);
    res.sendStatus(500);
  }
});


// ===============================
// ⏳ AUTO-ASSIGN WORKER EVERY 15 MINUTES
// ===============================

async function autoAssignPendingComplaints() {
  try {
    console.log("⏳ Auto-checking pending complaints...");

    // 1️⃣ Fetch all pending complaints with NO assigned worker
    const pending = await db.query(
      `SELECT id, type, hostel_name, room_no, floor_no, phone_number, description, user_id 
       FROM complaints 
       WHERE status = 'Pending' AND assigned_worker IS NULL
       ORDER BY created_at ASC`
    );

    if (pending.rows.length === 0) {
      console.log("✅ No pending complaints requiring auto-assignment.");
      return;
    }

    for (const c of pending.rows) {
      console.log(`🔍 Checking complaint #${c.id} (${c.type}) for auto-assign...`);

      // 2️⃣ Find available worker of same type & hostel
      const workerRes = await db.query(
        `SELECT id, name, phone 
         FROM workers 
         WHERE hostel_name = $1 
           AND work_type = $2 
           AND current_status = 'Available'
         LIMIT 1`,
        [c.hostel_name, c.type]
      );

      if (workerRes.rows.length === 0) {
        console.log(`⛔ No free worker available for ${c.type} in ${c.hostel_name}`);
        continue;
      }

      const w = workerRes.rows[0];

      console.log(`✅ Auto-assigning worker ${w.name} to complaint #${c.id}`);

      // 3️⃣ Assign worker
      await db.query(
        `UPDATE complaints 
         SET assigned_worker = $1, status = 'In Progress'
         WHERE id = $2`,
        [w.name, c.id]
      );

      // 4️⃣ Mark worker Busy
      await db.query(
        `UPDATE workers SET current_status = 'Busy' WHERE id = $1`,
        [w.id]
      );

      // 5️⃣ Notify worker on WhatsApp
      const msg = `🛠️ *Automatic Work Assignment*\n🏠 Hostel: ${c.hostel_name}\n🏢 Floor: ${c.floor_no}\n🚪 Room: ${c.room_no}\n📞 Student Phone: ${c.phone_number}\n🧾 Complaint: ${c.description}`;
      await sendWhatsAppMessage(w.phone, msg);

      // 6️⃣ Notify student via email
      const studentRes = await db.query(
        `SELECT email, name FROM users WHERE id = $1`,
        [c.user_id]
      );

      if (studentRes.rows.length > 0) {
        const { email, name } = studentRes.rows[0];
        await sendWorkAssignedEmail(
          email, name, c.id, w.name, w.phone, c.room_no, c.hostel_name
        );
      }

      console.log(`📌 Complaint #${c.id} auto-assigned to ${w.name}`);
    }

  } catch (err) {
    console.error("🔥 Auto-assignment error:", err);
  }
}

// Run every 15 minutes
setInterval(autoAssignPendingComplaints, 60 * 1000);


app.listen(5000, () => console.log("✅ Hostel Grievance backend running on port 5000"));
