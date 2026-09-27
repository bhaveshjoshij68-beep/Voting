"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { candidates, voters, votes } from "@/db/schema";
import {
  GENESIS_HASH,
  isAdmin,
  adminSessionToken,
  clearAdminCookie,
  newReceiptCode,
  phoneDigits,
  voteHash,
} from "@/lib/election";

export type FormState = { error?: string; receipt?: string } | undefined;

function isUniqueViolation(e: unknown) {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === "23505" || err?.cause?.code === "23505";
}

// Admin actions accept either the cookie or the ?st= URL token (hidden field).
async function authorized(formData?: FormData) {
  const st = formData?.get("st");
  if (typeof st === "string" && st === adminSessionToken()) return true;
  return isAdmin();
}

export async function castVote(_prev: FormState, formData: FormData): Promise<FormState> {
  const voterName = String(formData.get("name") ?? "").trim();
  const voterPhone = String(formData.get("phone") ?? "").trim();
  const studentId = String(formData.get("studentId") ?? "").trim().toUpperCase();
  const candidateId = Number(formData.get("candidateId"));

  if (voterName.length < 2) return { error: "Please enter your full name." };
  if (!/^[+\d()\-\s]{7,20}$/.test(voterPhone) || phoneDigits(voterPhone).length < 7)
    return { error: "Please enter a valid phone number." };
  if (!/^[A-Z0-9-]{3,30}$/.test(studentId))
    return { error: "Please enter a valid student ID (3–30 letters, numbers or hyphens)." };
  if (!candidateId) return { error: "Please choose a candidate." };

  const [cand] = await db.select().from(candidates).where(eq(candidates.id, candidateId));
  if (!cand) return { error: "That candidate no longer exists. Please pick again." };

  // Cross-verify against the registered voter list.
  const [registered] = await db.select().from(voters).where(eq(voters.studentId, studentId));
  if (!registered) {
    return { error: "This student ID was not found in the registered voter list. Contact the election admin." };
  }
  if (phoneDigits(registered.phone) !== phoneDigits(voterPhone)) {
    return { error: "The phone number does not match this student ID in the voter list." };
  }
  if (registered.fullName.trim().toLowerCase() !== voterName.toLowerCase()) {
    return { error: "The name does not match this student ID. Enter it exactly as registered." };
  }

  const [existing] = await db.select().from(votes).where(eq(votes.studentId, studentId));
  if (existing) {
    return { error: "This student ID has already voted. Each student can vote only once.", receipt: existing.receiptCode };
  }

  let receiptCode = "";
  try {
    const [last] = await db.select().from(votes).orderBy(desc(votes.id)).limit(1);
    const prevHash = last?.hash ?? GENESIS_HASH;
    receiptCode = newReceiptCode();
    const createdAt = new Date();
    const hash = voteHash({ prevHash, receiptCode, studentId, candidateId, createdAt });
    await db.insert(votes).values({ voterName, voterPhone, studentId, candidateId, receiptCode, prevHash, hash, createdAt });
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "This student ID has already voted. Each student can vote only once." };
    console.error(e);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/results");
  revalidatePath("/report");
  revalidatePath("/verify");
  redirect(`/accepted?receipt=${encodeURIComponent(receiptCode)}`);
}

export async function adminLogout(formData: FormData) {
  await clearAdminCookie();
  void formData;
  redirect("/results");
}

export async function addCandidate(formData: FormData) {
  if (!(await authorized(formData))) return;
  const name = String(formData.get("name") ?? "").trim();
  const party = String(formData.get("party") ?? "").trim() || "Independent";
  const slogan = String(formData.get("slogan") ?? "").trim();
  const palette = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#ec4899", "#14b8a6"];
  if (!name) return;
  await db.insert(candidates).values({ name, party, slogan, color: palette[Math.floor(Math.random() * palette.length)] });
  revalidatePath("/results");
  revalidatePath("/report");
  revalidatePath("/");
}

function withSt(path: string, st: string) {
  if (!st) return path;
  return `${path}${path.includes("?") ? "&" : "?"}st=${encodeURIComponent(st)}`;
}

export async function updateCandidate(formData: FormData) {
  const st = String(formData.get("st") ?? "");
  if (!(await authorized(formData))) redirect("/results");
  const id = Number(formData.get("id"));
  if (!id) redirect("/results");
  const name = String(formData.get("name") ?? "").trim();
  const party = String(formData.get("party") ?? "").trim() || "Independent";
  const slogan = String(formData.get("slogan") ?? "").trim();
  let color = String(formData.get("color") ?? "").trim().toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(color)) color = "#3b82f6";
  if (name.length < 2) redirect(withSt("/results?msg=name", st));

  await db.update(candidates).set({ name, party, slogan, color }).where(eq(candidates.id, id));
  revalidatePath("/results");
  revalidatePath("/report");
  revalidatePath("/");
  redirect(withSt("/results?msg=saved", st));
}

export async function deleteCandidate(formData: FormData) {
  if (!(await authorized(formData))) return;
  const id = Number(formData.get("id"));
  if (!id) return;
  const [used] = await db.select({ id: votes.id }).from(votes).where(eq(votes.candidateId, id)).limit(1);
  if (used) return;
  await db.delete(candidates).where(eq(candidates.id, id));
  revalidatePath("/results");
  revalidatePath("/report");
  revalidatePath("/");
}

export async function addVoter(formData: FormData) {
  const st = String(formData.get("st") ?? "");
  if (!(await authorized(formData))) redirect("/results");
  const studentId = String(formData.get("studentId") ?? "").trim().toUpperCase();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const department = String(formData.get("department") ?? "").trim();

  if (!/^[A-Z0-9-]{3,30}$/.test(studentId) || fullName.length < 2 || phoneDigits(phone).length < 7) {
    redirect(`/verify?msg=invalid${st ? `&st=${st}` : ""}`);
  }
  const [dupe] = await db.select({ id: voters.id }).from(voters).where(eq(voters.studentId, studentId)).limit(1);
  if (dupe) redirect(`/verify?msg=duplicate${st ? `&st=${st}` : ""}`);

  await db.insert(voters).values({ studentId, fullName, phone, department });
  revalidatePath("/verify");
  redirect(`/verify?msg=added${st ? `&st=${st}` : ""}`);
}

export async function updateVoter(formData: FormData) {
  const st = String(formData.get("st") ?? "");
  if (!(await authorized(formData))) redirect("/results");
  const id = Number(formData.get("id"));
  if (!id) redirect(withSt("/verify", st));

  const studentId = String(formData.get("studentId") ?? "").trim().toUpperCase();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const department = String(formData.get("department") ?? "").trim();

  if (
    !/^[A-Z0-9-]{3,30}$/.test(studentId) ||
    fullName.length < 2 ||
    phoneDigits(phone).length < 7
  ) {
    redirect(withSt("/verify?msg=invalid", st));
  }

  const [reg] = await db.select().from(voters).where(eq(voters.id, id));
  if (!reg) redirect(withSt("/verify", st));

  const [used] = await db.select({ id: votes.id }).from(votes).where(eq(votes.studentId, reg.studentId)).limit(1);
  if (used && studentId !== reg.studentId) redirect(withSt("/verify?msg=idlocked", st));

  if (studentId !== reg.studentId) {
    const [dupe] = await db.select({ id: voters.id }).from(voters).where(eq(voters.studentId, studentId)).limit(1);
    if (dupe) redirect(withSt("/verify?msg=duplicate", st));
  }

  await db
    .update(voters)
    .set({ studentId, fullName, phone, department })
    .where(eq(voters.id, id));

  // Keep already-cast ballots in sync so cross-verification stays accurate.
  // Name and phone are not part of the vote hash, so the chain remains valid.
  if (used) {
    await db
      .update(votes)
      .set({ voterName: fullName, voterPhone: phone })
      .where(eq(votes.studentId, studentId));
  }

  revalidatePath("/verify");
  revalidatePath("/results");
  redirect(withSt("/verify?msg=saved", st));
}

export async function deleteVoter(formData: FormData) {
  const st = String(formData.get("st") ?? "");
  if (!(await authorized(formData))) redirect("/results");
  const id = Number(formData.get("id"));
  if (!id) redirect(`/verify${st ? `?st=${st}` : ""}`);
  const [reg] = await db.select().from(voters).where(eq(voters.id, id));
  if (!reg) redirect(`/verify${st ? `?st=${st}` : ""}`);
  const [used] = await db.select({ id: votes.id }).from(votes).where(eq(votes.studentId, reg.studentId)).limit(1);
  if (used) redirect(`/verify?msg=locked${st ? `&st=${st}` : ""}`);
  await db.delete(voters).where(eq(voters.id, id));
  revalidatePath("/verify");
  redirect(`/verify?msg=removed${st ? `&st=${st}` : ""}`);
}
