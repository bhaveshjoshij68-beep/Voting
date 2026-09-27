import Link from "next/link";
import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { candidates, votes } from "@/db/schema";
import { ELECTION_TITLE, ensureSeed, isAuthorized, verifyChain } from "@/lib/election";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ st?: string }> }) {
  const { st } = await searchParams;
  if (!(await isAuthorized(st))) redirect("/results");
  await ensureSeed();
  const backHref = st ? `/results?st=${st}` : "/results";

  const [candidateRows, voteRows] = await Promise.all([
    db.select().from(candidates).orderBy(asc(candidates.id)),
    db.select().from(votes).orderBy(asc(votes.id)),
  ]);

  const total = voteRows.length;
  const tallies = candidateRows.map((c) => ({
    ...c,
    count: voteRows.filter((v) => v.candidateId === c.id).length,
  })).sort((a, b) => b.count - a.count);
  const highest = tallies[0]?.count ?? 0;
  const leaders = highest > 0 ? tallies.filter((c) => c.count === highest) : [];
  const integrityOk = verifyChain(voteRows);
  const generatedAt = new Date();
  const firstVote = voteRows[0]?.createdAt;
  const lastVote = voteRows.at(-1)?.createdAt;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={backHref} className="text-sm font-medium text-blue-600 hover:underline">← Back to results</Link>
        <PrintButton />
      </div>

      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
        <div className="border-b border-slate-200 bg-slate-900 px-6 py-8 text-white sm:px-10 print:bg-white print:px-0 print:pb-6 print:text-slate-900">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.2em] text-blue-300 print:text-blue-700">SimpleVote · Election administration</p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight">Election results report</h1>
              <p className="mt-2 text-slate-300 print:text-slate-600">{ELECTION_TITLE}</p>
            </div>
            <span className="rounded-full border border-slate-500 px-3 py-1 text-xs font-semibold uppercase tracking-widest print:border-slate-300">Live snapshot</span>
          </div>
        </div>

        <div className="space-y-9 p-6 sm:p-10 print:px-0">
          <section className="grid gap-4 border-b border-slate-200 pb-8 sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total ballots cast</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{total.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Candidates</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{candidateRows.length}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Current leader</p>
              <p className="mt-2 text-lg font-bold text-slate-900">{leaders.length === 0 ? "No votes yet" : leaders.map((c) => c.name).join(" / ")}</p>
              {leaders.length > 1 && <p className="text-xs text-amber-700">Tie for first place</p>}
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-baseline justify-between gap-4">
              <h2 className="text-lg font-bold text-slate-900">Candidate breakdown</h2>
              <span className="text-xs text-slate-500">Percent of ballots cast</span>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Rank</th>
                    <th className="px-4 py-3 font-semibold">Candidate</th>
                    <th className="px-4 py-3 font-semibold">Group</th>
                    <th className="px-4 py-3 text-right font-semibold">Votes</th>
                    <th className="px-4 py-3 text-right font-semibold">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tallies.map((c, index) => (
                    <tr key={c.id}>
                      <td className="px-4 py-4 text-slate-500">{index + 1}</td>
                      <td className="px-4 py-4 font-semibold text-slate-900">{c.name}</td>
                      <td className="px-4 py-4 text-slate-500">{c.party}</td>
                      <td className="px-4 py-4 text-right font-semibold tabular-nums">{c.count}</td>
                      <td className="px-4 py-4 text-right font-semibold tabular-nums">{total ? ((c.count / total) * 100).toFixed(1) : "0.0"}%</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-bold">
                    <td className="px-4 py-3" colSpan={3}>Total</td>
                    <td className="px-4 py-3 text-right tabular-nums">{total}</td>
                    <td className="px-4 py-3 text-right">{total ? "100%" : "0%"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {tallies.length === 0 && <p className="mt-3 text-sm text-slate-500">No candidates have been registered.</p>}
          </section>

          <section className="grid gap-6 rounded-xl border border-slate-200 bg-slate-50 p-5 sm:grid-cols-2 print:break-inside-avoid">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Record integrity</h2>
              <p className={`mt-2 text-sm font-semibold ${integrityOk ? "text-emerald-700" : "text-red-700"}`}>
                {integrityOk ? "✓ Hash chain verified" : "⚠ Hash chain verification failed"}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                Vote records are checked in order against their stored SHA-256 hashes and previous-record links. This detects changes to recorded ballot data; it does not verify student identity.
              </p>
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Report details</h2>
              <dl className="mt-2 space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between gap-3"><dt>Generated</dt><dd className="font-medium text-slate-900">{generatedAt.toLocaleString("en-US")}</dd></div>
                <div className="flex justify-between gap-3"><dt>First ballot</dt><dd>{firstVote ? firstVote.toLocaleDateString("en-US") : "—"}</dd></div>
                <div className="flex justify-between gap-3"><dt>Most recent ballot</dt><dd>{lastVote ? lastVote.toLocaleString("en-US") : "—"}</dd></div>
                <div className="flex justify-between gap-3"><dt>Report status</dt><dd>Provisional / live</dd></div>
              </dl>
            </div>
          </section>

          <div className="border-t border-slate-200 pt-5 text-xs leading-relaxed text-slate-500">
            <p className="font-semibold text-slate-700">About this report</p>
            <p className="mt-1">This is a live snapshot of votes recorded at the time shown above. Rankings may change as new ballots arrive. Percentages are rounded independently to one decimal place. This report is for the election administrator and does not constitute final certification.</p>
          </div>
        </div>
      </article>
    </div>
  );
}
