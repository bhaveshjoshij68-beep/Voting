import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { asc, count, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { candidates, voters, votes } from "@/db/schema";

export const ELECTION_TITLE = "Community Council Election 2026";
export const GENESIS_HASH = "0".repeat(64);
const ADMIN_COOKIE = "sv_admin";
const LEGACY_ADMIN_COOKIE = "admin_session";

export function sha256(data: string) {
  return createHash("sha256").update(data).digest("hex");
}

export function newReceiptCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const code = Array.from(randomBytes(8), (b) => chars[b % chars.length]).join("");
  return `VOTE-${code.slice(0, 4)}-${code.slice(4)}`;
}

export const phoneDigits = (p: string) => p.replace(/\D/g, "");

export function voteHash(v: {
  prevHash: string;
  receiptCode: string;
  voterEmail?: string | null;
  studentId?: string | null;
  candidateId: number;
  createdAt: Date;
}) {
  const identity = v.studentId || v.voterEmail || "";
  return sha256(
    `${v.prevHash}|${v.receiptCode}|${identity}|${v.candidateId}|${v.createdAt.toISOString()}`
  );
}

export function verifyChain(
  rows: Array<{
    prevHash: string;
    hash: string;
    receiptCode: string;
    voterEmail: string | null;
    studentId: string | null;
    candidateId: number;
    createdAt: Date;
  }>
) {
  let prev = GENESIS_HASH;
  for (const r of rows) {
    if (r.prevHash !== prev || voteHash(r) !== r.hash) return false;
    prev = r.hash;
  }
  return true;
}

function adminPassword() {
  return process.env.ADMIN_PASSWORD || "admin123";
}
function adminToken() {
  return sha256(`admin:${adminPassword()}:${process.env.DATABASE_URL ?? ""}`);
}
export function checkAdminPassword(pw: string) {
  return pw === adminPassword();
}
export async function setAdminCookie() {
  (await cookies()).set(ADMIN_COOKIE, adminToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}
export async function clearAdminCookie() {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
  jar.delete(LEGACY_ADMIN_COOKIE);
}
export async function isAdmin() {
  const jar = await cookies();
  const v = jar.get(ADMIN_COOKIE)?.value ?? jar.get(LEGACY_ADMIN_COOKIE)?.value;
  return v === adminToken();
}

// The ?st= URL token keeps the admin panel working when cookies are blocked
// (embedded previews). Never expose it outside authenticated pages.
export function adminSessionToken() {
  return adminToken();
}
export async function isAuthorized(st?: string | null) {
  if (st && st === adminToken()) return true;
  return isAdmin();
}

// ---- demo data ----

const CANDIDATE_SEED = [
  { name: "Amara Okafor", party: "Green Future", slogan: "Cleaner parks, safer streets", color: "#10b981" },
  { name: "Daniel Reyes", party: "Progress Together", slogan: "Better schools for every child", color: "#3b82f6" },
  { name: "Priya Sharma", party: "Community First", slogan: "Affordable housing for all", color: "#f59e0b" },
  { name: "Marcus Lee", party: "Independent", slogan: "Transparent, honest government", color: "#8b5cf6" },
];

const VOTER_NAMES = [
  "Olivia Brown", "Liam Johnson", "Emma Davis", "Noah Wilson", "Ava Martinez", "Ethan Clark",
  "Sophia Lewis", "Mason Walker", "Isabella Hall", "Lucas Allen", "Mia Young", "James King",
  "Charlotte Wright", "Benjamin Scott", "Amelia Green", "Henry Baker", "Harper Adams", "Jack Nelson",
  "Evelyn Hill", "Leo Campbell", "Grace Mitchell", "Owen Roberts",
  "Zoe Turner", "Ryan Cooper", "Lily Murphy", "Caleb Rivera", "Nora Bennett", "Ezra Hughes",
  "Aisha Khan", "Samuel Ortiz", "Priya Nair", "Tom Becker", "Imani Clarke", "Victor Chen",
];

const DEPARTMENTS = ["Computer Science", "Mechanical", "Electrical", "Civil", "Business"];

const CAST_PATTERN = [0, 1, 0, 2, 1, 0, 3, 0, 1, 2, 0, 1, 2, 0, 3, 1, 0, 2, 1, 0, 1, 2];
const CAST_COUNT = 22;

function voterRow(i: number, name: string) {
  return {
    studentId: `STU-2026-${String(i + 1).padStart(3, "0")}`,
    fullName: name,
    phone: `+1 (555) 010-${String(i + 1).padStart(4, "0")}`,
    department: DEPARTMENTS[i % DEPARTMENTS.length],
  };
}

async function insertVoterList() {
  return db.insert(voters).values(VOTER_NAMES.map((name, i) => voterRow(i, name))).returning();
}

// Backfills votes that predate the student-ID columns, then reseals the chain.
async function syncLegacyVotes() {
  const legacy = await db
    .select()
    .from(votes)
    .where(isNull(votes.studentId))
    .orderBy(asc(votes.id));
  if (legacy.length === 0) return;

  const list = await db.select().from(voters);
  const byName = new Map(list.map((v) => [v.fullName, v]));
  for (const row of legacy) {
    const reg = byName.get(row.voterName);
    if (!reg) continue;
    await db
      .update(votes)
      .set({ studentId: reg.studentId, voterPhone: reg.phone })
      .where(eq(votes.id, row.id));
  }

  const all = await db.select().from(votes).orderBy(asc(votes.id));
  let prev = GENESIS_HASH;
  for (const row of all) {
    const hash = voteHash({ ...row, prevHash: prev });
    if (hash !== row.hash || prev !== row.prevHash) {
      await db.update(votes).set({ prevHash: prev, hash }).where(eq(votes.id, row.id));
    }
    prev = hash;
  }
}

let seeded = false;
export async function ensureSeed() {
  if (seeded) return;
  seeded = true;
  try {
    const [{ n }] = await db.select({ n: count() }).from(candidates);
    if (n === 0) {
      const inserted = await db.insert(candidates).values(CANDIDATE_SEED).returning();
      const voterRows = await insertVoterList();
      let prevHash = GENESIS_HASH;
      const now = Date.now();
      const rows = CAST_PATTERN.map((candIdx, i) => {
        const voter = voterRows[i % voterRows.length];
        const receiptCode = newReceiptCode();
        const createdAt = new Date(now - (CAST_COUNT - i) * 47 * 60 * 1000);
        const candidateId = inserted[candIdx].id;
        const hash = voteHash({ prevHash, receiptCode, studentId: voter.studentId, candidateId, createdAt });
        prevHash = hash;
        return {
          voterName: voter.fullName,
          voterPhone: voter.phone,
          studentId: voter.studentId,
          candidateId,
          receiptCode,
          prevHash,
          hash,
          createdAt,
        };
      });
      await db.insert(votes).values(rows);
    } else {
      const [{ n: v }] = await db.select({ n: count() }).from(voters);
      if (v === 0) await insertVoterList();
      await syncLegacyVotes();
    }
  } catch (e) {
    seeded = false;
    throw e;
  }
}

export async function getCandidates() {
  await ensureSeed();
  return db.select().from(candidates).orderBy(asc(candidates.id));
}
