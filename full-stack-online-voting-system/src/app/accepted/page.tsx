import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { candidates, votes } from "@/db/schema";
import { ELECTION_TITLE } from "@/lib/election";

export const dynamic = "force-dynamic";

export default async function AcceptedPage({
  searchParams,
}: {
  searchParams: Promise<{ receipt?: string }>;
}) {
  const { receipt } = await searchParams;

  const [row] = receipt
    ? await db
        .select({
          voterName: votes.voterName,
          studentId: votes.studentId,
          receiptCode: votes.receiptCode,
          hash: votes.hash,
          createdAt: votes.createdAt,
          candidateName: candidates.name,
          candidateParty: candidates.party,
        })
        .from(votes)
        .innerJoin(candidates, eq(votes.candidateId, candidates.id))
        .where(eq(votes.receiptCode, receipt))
        .limit(1)
    : [];

  if (!row) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <p className="text-4xl">🔍</p>
        <h1 className="mt-3 text-xl font-bold">Receipt not found</h1>
        <p className="mt-1 text-sm text-slate-500">We couldn&apos;t find a vote with that receipt code.</p>
        <Link href="/" className="mt-6 inline-block rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700">
          Go to voting page
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-10">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-4xl text-green-600">
        ✓
      </div>
      <h1 className="mt-5 text-2xl font-bold sm:text-3xl">Your vote has been accepted!</h1>
      <p className="mt-2 text-slate-500">
        Thank you, <span className="font-medium text-slate-700">{row.voterName}</span>. Your vote for{" "}
        {ELECTION_TITLE} was recorded securely.
      </p>

      <div className="mx-auto mt-8 max-w-md space-y-3 rounded-xl bg-slate-50 p-5 text-left text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-slate-500">You voted for</span>
          <span className="text-right font-semibold">
            {row.candidateName} <span className="font-normal text-slate-400">· {row.candidateParty}</span>
          </span>
        </div>
        {row.studentId && (
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Student ID</span>
            <span className="font-mono font-semibold">{row.studentId}</span>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <span className="text-slate-500">Submitted</span>
          <span className="font-medium">{row.createdAt.toLocaleString("en-US")}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-500">Receipt code</span>
          <span className="font-mono font-bold text-blue-600">{row.receiptCode}</span>
        </div>
        <div className="border-t border-slate-200 pt-3">
          <span className="block text-slate-500">Security seal</span>
          <span className="block break-all font-mono text-xs text-slate-400">{row.hash}</span>
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-400">Save your receipt code. Results are published by the election admin.</p>

      <Link href="/" className="mt-6 inline-block rounded-xl border border-slate-300 px-5 py-2.5 font-semibold text-slate-700 hover:bg-slate-50">
        Back to home
      </Link>
    </div>
  );
}
