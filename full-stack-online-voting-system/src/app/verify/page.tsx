import Link from "next/link";
import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { candidates, voters, votes } from "@/db/schema";
import { ELECTION_TITLE, ensureSeed, isAuthorized, phoneDigits } from "@/lib/election";
import { addVoter, deleteVoter, updateVoter } from "../actions";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, { text: string; error?: boolean }> = {
  added: { text: "Voter added to the list." },
  removed: { text: "Voter removed from the list." },
  duplicate: { text: "That student ID is already on the voter list.", error: true },
  invalid: { text: "Invalid details. Check name, phone and student ID.", error: true },
  locked: { text: "That voter has already voted and cannot be removed.", error: true },
  saved: { text: "Voter details updated." },
  idlocked: { text: "That voter already cast a ballot — the student ID is locked.", error: true },
};

function issueFor(
  vote: { voterName: string; voterPhone: string | null; studentId: string | null },
  byId: Map<string, typeof voters.$inferSelect>
) {
  if (!vote.studentId) return "No student ID recorded";
  const reg = byId.get(vote.studentId);
  if (!reg) return "Student ID not found in voter list";
  if (phoneDigits(reg.phone) !== phoneDigits(vote.voterPhone ?? "")) return "Phone does not match voter list";
  if (reg.fullName.trim().toLowerCase() !== vote.voterName.trim().toLowerCase()) return "Name does not match voter list";
  return null;
}

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; st?: string }>;
}) {
  const { msg, st } = await searchParams;
  if (!(await isAuthorized(st))) redirect("/results");
  await ensureSeed();

  const backHref = st ? `/results?st=${st}` : "/results";
  const [voterRows, voteRows, candRows] = await Promise.all([
    db.select().from(voters).orderBy(asc(voters.id)),
    db.select().from(votes).orderBy(asc(votes.id)),
    db.select().from(candidates).orderBy(asc(candidates.id)),
  ]);

  const byId = new Map(voterRows.map((v) => [v.studentId, v]));
  const candName = new Map(candRows.map((c) => [c.id, c.name]));
  const voteByStudent = new Map(voteRows.map((v) => [v.studentId, v]));

  const flagged = voteRows.filter((v) => issueFor(v, byId) !== null);
  const verified = voteRows.length - flagged.length;
  const pending = voterRows.filter((v) => !voteByStudent.has(v.studentId)).length;
  const turnout = voterRows.length ? Math.round((verified / voterRows.length) * 100) : 0;
  const banner = msg ? MESSAGES[msg] : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-blue-600">Admin · Cross-verification</p>
          <h1 className="text-2xl font-bold sm:text-3xl">Voter list & ballot checks</h1>
          <p className="mt-1 text-sm text-slate-500">
            Every cast ballot is matched against the registered voter list by student ID, name and phone.
          </p>
        </div>
        <Link href={backHref} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
          ← Results
        </Link>
      </div>

      {banner && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${banner.error ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"}`}>
          {banner.text}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Eligible voters</p>
          <p className="mt-1 text-3xl font-bold">{voterRows.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Verified ballots</p>
          <p className="mt-1 text-3xl font-bold text-emerald-600">{verified}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Not yet voted</p>
          <p className="mt-1 text-3xl font-bold text-amber-600">{pending}</p>
        </div>
        <div className={`rounded-2xl border p-4 shadow-sm ${flagged.length ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}`}>
          <p className="text-xs text-slate-500">Flagged ballots</p>
          <p className={`mt-1 text-3xl font-bold ${flagged.length ? "text-red-600" : "text-emerald-600"}`}>{flagged.length}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="font-medium">Voter turnout from eligible list</span>
          <span className="text-slate-500">{verified} / {voterRows.length} · {turnout}%</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-blue-600" style={{ width: `${turnout}%` }} />
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="mb-3 font-semibold">Flagged ballots (do not match the voter list)</h2>
        {flagged.length === 0 ? (
          <p className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
            All recorded ballots match the registered voter list. No suspicious entries.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Entered name</th>
                  <th className="py-2 pr-4">Student ID</th>
                  <th className="py-2 pr-4">Voted for</th>
                  <th className="py-2 pr-4">Time</th>
                  <th className="py-2 pr-4">Issue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {flagged.map((v) => (
                  <tr key={v.id}>
                    <td className="py-2.5 pr-4 font-medium">{v.voterName}</td>
                    <td className="py-2.5 pr-4 font-mono text-xs">{v.studentId ?? "—"}</td>
                    <td className="py-2.5 pr-4">{candName.get(v.candidateId) ?? "—"}</td>
                    <td className="py-2.5 pr-4 text-xs text-slate-500">{v.createdAt.toLocaleString("en-US")}</td>
                    <td className="py-2.5 pr-4">
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        {issueFor(v, byId)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="mb-3 font-semibold">Registered voter list</h2>
        <form action={addVoter} className="mb-4 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
          {st && <input type="hidden" name="st" value={st} />}
          <input name="studentId" required placeholder="Student ID" autoCapitalize="characters" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input name="fullName" required placeholder="Full name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input name="phone" required placeholder="Phone" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input name="department" placeholder="Department" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Add</button>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-2 pr-4">Student ID</th>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Phone</th>
                <th className="py-2 pr-4">Department</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {voterRows.map((v) => {
                const cast = voteByStudent.get(v.studentId);
                return (
                  <tr key={v.id}>
                    <td className="py-2.5 pr-4 font-mono text-xs font-medium">{v.studentId}</td>
                    <td className="py-2.5 pr-4 font-medium">{v.fullName}</td>
                    <td className="py-2.5 pr-4 text-slate-500">{v.phone}</td>
                    <td className="py-2.5 pr-4 text-slate-500">{v.department || "—"}</td>
                    <td className="py-2.5 pr-4">
                      {cast ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          Voted · <span className="font-mono">{cast.receiptCode.slice(0, 9)}</span>
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Pending</span>
                      )}
                    </td>
                    <td className="py-2.5 text-right align-top">
                      <div className="flex flex-col items-end gap-1">
                        {cast ? (
                          <span className="text-xs text-slate-300" title="Voters who already voted cannot be removed">
                            remove locked
                          </span>
                        ) : (
                          <form action={deleteVoter}>
                            <input type="hidden" name="id" value={v.id} />
                            {st && <input type="hidden" name="st" value={st} />}
                            <button className="text-xs text-red-500 hover:underline">Remove</button>
                          </form>
                        )}
                        <details className="w-full">
                          <summary className="cursor-pointer select-none text-xs font-medium text-blue-600 hover:underline">
                            Edit
                          </summary>
                          <form
                            action={updateVoter}
                            className="mt-1.5 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-left text-xs"
                          >
                            <input type="hidden" name="id" value={v.id} />
                            {st && <input type="hidden" name="st" value={st} />}
                            {cast ? (
                              <>
                                <input type="hidden" name="studentId" value={v.studentId} />
                                <p className="text-[11px] text-slate-400">
                                  Student ID {v.studentId} is locked after voting.
                                </p>
                              </>
                            ) : (
                              <label className="block">
                                <span className="mb-0.5 block font-medium text-slate-600">Student ID</span>
                                <input
                                  name="studentId"
                                  required
                                  defaultValue={v.studentId}
                                  autoCapitalize="characters"
                                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono"
                                />
                              </label>
                            )}
                            <label className="block">
                              <span className="mb-0.5 block font-medium text-slate-600">Full name</span>
                              <input name="fullName" required defaultValue={v.fullName} className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5" />
                            </label>
                            <label className="block">
                              <span className="mb-0.5 block font-medium text-slate-600">Phone</span>
                              <input name="phone" required defaultValue={v.phone} className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5" />
                            </label>
                            <label className="block">
                              <span className="mb-0.5 block font-medium text-slate-600">Department</span>
                              <input name="department" defaultValue={v.department} className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5" />
                            </label>
                            <button className="justify-self-end rounded-lg bg-blue-600 px-4 py-1.5 font-semibold text-white hover:bg-blue-700">
                              Save changes
                            </button>
                          </form>
                        </details>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
