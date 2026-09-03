# 🏠 Hostel Grievance Management System

A full-stack web application that digitizes hostel complaint management — students file grievances with photos, an **AI classifier (Google Gemini) automatically triages each complaint as normal or critical**, and admins track, prioritize, and resolve issues from a dedicated dashboard, with email and SMS notifications along the way.

## ✨ Features

- **Student portal** — register/login, file complaints with image evidence, and track resolution status
- **AI-powered priority triage** — every complaint description is classified by Gemini (`gemini-2.5-flash`) into `normal` or `critical`, so emergencies (electrical faults, water leaks, safety issues) surface at the top of the admin queue automatically
- **Admin dashboard** — separate admin login, view all grievances sorted by priority, update statuses, and close resolved issues
- **Image uploads** — complaint photos stored on **Cloudinary** via `multer-storage-cloudinary`
- **Notifications** — email updates through **Nodemailer** and SMS alerts through **Twilio**
- **Secure auth** — JWT-based sessions stored in HTTP-only cookies, passwords hashed with bcrypt

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS, React Router, Axios |
| Backend | Node.js, Express, PostgreSQL (`pg`) |
| AI | Google Gemini API (complaint priority classification) |
| Media | Cloudinary + Multer |
| Notifications | Nodemailer (email), Twilio (SMS) |
| Auth | JWT + HTTP-only cookies, bcrypt |

## 🚀 Getting Started

### Prerequisites

- Node.js ≥ 18
- PostgreSQL running locally (or a hosted instance)
- API keys: Google Gemini, Cloudinary, Twilio (optional for SMS)

### 1. Backend

```bash
cd Backend
npm install
```

Create a `.env` file in `Backend/`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/hostel_grievance
JWT_SECRET=your-secret
GEMINI_API_KEY=your-gemini-key
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
EMAIL_USER=you@example.com
EMAIL_PASS=app-password
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
```

```bash
npm run dev   # starts Express on the configured port
```

### 2. Frontend

```bash
cd Frontend
npm install
npm run dev   # Vite dev server at http://localhost:5173
```

## 🧠 How the AI Triage Works

When a complaint is submitted, its description is sent to Gemini with a constrained prompt that must return exactly one word — `normal` or `critical`. The result is stored with the complaint and drives the admin dashboard's priority ordering. If the API call fails, the system fails safe and defaults to `normal`.

## 📁 Project Structure

```
├── Backend/
│   ├── server.js        # Express app: auth, complaints, AI triage, notifications
│   └── uploads/         # Temporary upload staging
└── Frontend/
    ├── src/pages/       # Login, Dashboard, AdminLogin, AdminDashboard
    ├── src/components/  # Shared UI components
    └── src/utils/       # API helpers
```
