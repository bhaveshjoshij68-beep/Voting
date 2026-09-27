# SimpleVote — Secure Offline Digital Voting System

A portable, offline-capable digital voting platform built with **Next.js (App Router)**, **PostgreSQL**, and **Drizzle ORM**. SimpleVote delivers tamper-evident voting with voter list cross-verification, live result tallying, candidate management, and printable official audit reports without requiring any external cloud services, analytics, or CDN dependencies.

---

## Key Features

- **100% Offline & Self-Contained**: Zero external scripts, CDN stylesheets, or third-party tracking. All fonts, icons (`lucide-react`), and styles (`tailwindcss`) are bundled locally.
- **Tamper-Evident Hash Chain**: Every submitted ballot contains a SHA-256 hash linking to the previous vote block. Any tampering or retroactive modification invalidates the cryptographic seal.
- **Voter List Pre-Registration & Cross-Verification**: Votes are matched in real-time against the registered voter database (`voters` table) by **Student ID**, **Full Name**, and **Phone Number**. Unregistered or mismatched submissions are rejected.
- **Unique Ballot Protection**: Database-level unique constraints and code-level validation ensure each Student ID can cast exactly one ballot.
- **Full Admin CRUD Operations**:
  - **Candidates**: Add, view vote counts, edit (name, party, slogan, palette color), and safely delete (locked once votes are cast).
  - **Voters**: Register new voters, update details, and view voting status (`Voted` / `Pending`).
- **Official Print-Ready Report**: Clean, professional audit report (`/report`) formatted with A4 print stylesheets for exporting or archiving as PDF.
- **Dual Session Authentication**: Admin access uses HttpOnly cookies with an inline session token fallback, ensuring functionality in restrictive sandboxes, embedded iframes, and standard browsers alike.

---

## System Architecture & Page Overview

```
SimpleVote
├── /                 → Voter Ballot (Select Candidate + Student ID & Phone)
├── /accepted         → Vote Acceptance Receipt (Receipt code + Security hash)
├── /results          → Admin Live Tally & Candidate Management
├── /verify           → Admin Voter List, Turnout & Cross-Verification
└── /report           → Official Printable Audit Report (PDF-ready)
```

| Route | Access | Description |
|---|---|---|
| `/` | Public | Candidate selection cards and voter identity input. |
| `/accepted` | Public | Digital receipt displaying voter name, timestamp, and SHA-256 seal. |
| `/results` | Admin | Live bar charts, vote counts, recent ballot feed, and candidate CRUD. |
| `/verify` | Admin | Registered voter roster, turnout statistics, flagged ballots, and voter CRUD. |
| `/report` | Admin | Formal election summary with candidate shares and chain integrity status. |

---

## Cryptographic Chain Verification

Every vote is hashed using SHA-256 with the following structure:

$$\text{VoteHash} = \text{SHA256}(\text{prevHash} \parallel \text{receiptCode} \parallel \text{studentId} \parallel \text{candidateId} \parallel \text{createdAt})$$

When the admin opens the **Results** or **Report** page, the system recalculates the entire chain from the genesis block (`0000...0000`) forward. If any row or timestamp was altered directly in the database, the seal check immediately reports:

```
⚠ Tampering detected
```

---

## Prerequisites

- **Node.js** v18.18.0 or later (v20+ recommended)
- **npm** or **pnpm** / **yarn**
- **PostgreSQL** 14+ (local instance or Docker container)

---

## Quick Start Guide

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/simplevote.git
cd simplevote
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start PostgreSQL

#### Option A: Using Docker Compose (Recommended for quick offline run)
```bash
docker compose up -d
```

#### Option B: Using a Local PostgreSQL Service
Create a local database named `app_db`:
```bash
createdb -U postgres app_db
```

### 4. Configure Environment Variables

Copy the example configuration:
```bash
cp .env.example .env
```

Edit `.env` if your database credentials or preferred port differ:
```env
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
ADMIN_PASSWORD=admin123
NODE_ENV=development
```

### 5. Apply Database Schema

Push the database tables:
```bash
npx drizzle-kit push
```

### 6. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Production Build & Run

To build an optimized production bundle:

```bash
npm run build
npm start
```

---

## Demo Credentials & Test Voters

On the first start, SimpleVote automatically seeds 4 candidates, 34 registered students, and 22 initial verified ballots so the system is fully populated out-of-the-box.

### Admin Access
- **Password**: `admin123` (configurable via `ADMIN_PASSWORD` in `.env`)
- Navigate to `/results` or click **Results (admin)** in the navigation bar.

### Testing a New Vote
Navigate to `/` and use any student currently marked as **Pending** in `/verify`:

| Field | Example Value |
|---|---|
| **Candidate** | Select any candidate card |
| **Full Name** | `Zoe Turner` |
| **Phone Number** | `+1 (555) 010-0023` |
| **Student ID** | `STU-2026-023` |

Submitting will verify the student, lock their status as **Voted**, seal the new ballot into the hash chain, and display their receipt.

---

## Database Schema Reference

```sql
-- Candidates Table
CREATE TABLE candidates (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  party TEXT NOT NULL DEFAULT 'Independent',
  slogan TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Registered Voters Roster
CREATE TABLE voters (
  id SERIAL PRIMARY KEY,
  student_id TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tamper-Evident Cast Ballots
CREATE TABLE votes (
  id SERIAL PRIMARY KEY,
  voter_name TEXT NOT NULL,
  voter_phone TEXT,
  student_id TEXT UNIQUE,
  candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  receipt_code TEXT NOT NULL UNIQUE,
  prev_hash TEXT NOT NULL,
  hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Project Structure

```
.
├── docker-compose.yml       # Local PostgreSQL container configuration
├── drizzle.config.json      # Drizzle ORM configuration
├── package.json             # Dependencies and build scripts
├── postcss.config.mjs       # Tailwind CSS PostCSS configuration
├── tsconfig.json            # TypeScript configuration
├── src
│   ├── db
│   │   ├── index.ts         # Database connection pool
│   │   └── schema.ts        # Drizzle schema definitions
│   ├── lib
│   │   └── election.ts      # Hashing, cryptographic verification, auth & seed data
│   └── app
│       ├── layout.tsx       # Root layout and navigation
│       ├── globals.css      # Local Tailwind styles & A4 print stylesheets
│       ├── actions.ts       # Server actions (Vote cast, candidate/voter CRUD)
│       ├── page.tsx         # Voter ballot submission page
│       ├── vote-form.tsx    # Client-side candidate picker & input form
│       ├── accepted/
│       │   └── page.tsx     # Vote acceptance receipt & seal breakdown
│       ├── results/
│       │   ├── page.tsx     # Live results dashboard & candidate CRUD
│       │   └── login-form.tsx # Admin password gateway
│       ├── verify/
│       │   └── page.tsx     # Voter roster management & ballot cross-checks
│       ├── report/
│       │   ├── page.tsx     # Formal printable audit report
│       │   └── print-button.tsx # Client-side print trigger
│       └── api
│           ├── admin/login/route.ts # Admin authentication endpoint
│           └── health/route.ts      # Server healthcheck endpoint
```

---

## Security Notes

1. **Production Admin Password**: Always change `ADMIN_PASSWORD` in production environments.
2. **Offline Local Area Network**: SimpleVote can be deployed on a local server or laptop hotspot during student or council elections without connecting to the public internet.
3. **Receipt Privacy**: Ballots are indexed by unique random receipt codes (`VOTE-XXXX-XXXX`), allowing voters to prove their vote was counted while protecting ballot confidentiality.

---

## License

This project is licensed under the [MIT License](LICENSE).
