import { asc, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { candidates, votes } from "@/db/schema";
import { ELECTION_TITLE, ensureSeed, isAuthorized, verifyChain } from "@/lib/election";
import { addCandidate, adminLogout, deleteCandidate, updateCandidate } from "../actions";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

function maskEmail(email: string) {
  const [u, d] = email.split("@");
  return `${u.slice(0, 2)}***@${d}`;
}

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; st?: string; msg?: string }>;
}) {
  const { error, st, msg } = await searchParams;
  if (!(await isAuthorized(st))) {
    return <LoginForm invalid={error === "invalid"} />;
  }
  const stQs = st ? `?st=${st}` : "";

  await ensureSeed();
  const candList = await db.select().from(candidates).orderBy(asc(candidates.id));
  const allVotes = await db.select().from(votes).orderBy(asc(votes.id));
  const recent = await db
    .select({
      id: votes.id,
      voterName: votes.voterName,
      voterEmail: votes.voterEmail,
      studentId: votes.studentId,
      createdAt: votes.createdAt,
      candidateName: candidates.name,
    })
    .from(votes)
    .innerJoin(candidates, eq(votes.candidateId, candidates.id))
    .orderBy(desc(votes.id))
    .limit(10);

  const total = allVotes.length;
  const tally = candList
    .map((c) => ({ ...c, count: allVotes.filter((v) => v.candidateId === c.id).length }))
    .sort((a, b) => b.count - a.count);
  const leader = tally[0] && tally[0].count > 0 ? tally[0] : null;
  const chainOk = verifyChain(allVotes);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-blue-600">Admin · Live results</p>
          <h1 className="text-2xl font-bold sm:text-3xl">{ELECTION_TITLE}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/verify${stQs}`} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
            Cross-verify
          </Link>
          <Link href={`/report${stQs}`} className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700">
            Create report →
          </Link>
          <form action={adminLogout}>
            <button className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
              Sign out
            </button>
          </form>
        </div>
      </div>

      {msg === "saved" && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Candidate details saved.
        </div>
      )}
      {msg === "name" && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Candidate name is required (at least 2 characters).
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Total votes</p>
          <p className="mt-1 text-3xl font-bold">{total}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Leading</p>
          <p className="mt-1 truncate text-lg font-bold">{leader ? leader.name : "—"}</p>
        </div>
        <div className={`rounded-2xl border p-4 shadow-sm ${chainOk ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
          <p className="text-xs text-slate-500">Vote integrity</p>
          <p className={`mt-1 text-lg font-bold ${chainOk ? "text-green-700" : "text-red-700"}`}>
            {chainOk ? "✓ No tampering" : "Tampering detected"}
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="mb-4 font-semibold">Results by candidate</h2>
        {tally.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">No candidates yet. Add one below.</p>
        ) : (
          <div className="space-y-4">
            {tally.map((c, i) => {
              const pct = total ? Math.round((c.count / total) * 100) : 0;
              return (
                <div key={c.id}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2 font-medium">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: c.color }} />
                      {c.name}
                      <span className="text-xs text-slate-400">{c.party}</span>
                      {i === 0 && c.count > 0 && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">Leading</span>
                      )}
                    </span>
                    <span className="shrink-0 text-slate-600">
                      <b>{c.count}</b> · {pct}%
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: c.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="mb-3 font-semibold">Latest votes</h2>
        {recent.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">No votes yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {recent.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span>
                  <span className="font-medium">{v.voterName}</span>{" "}
                  <span className="text-xs text-slate-400">{v.studentId ?? (v.voterEmail ? maskEmail(v.voterEmail) : "—")}</span>
                </span>
                <span className="text-slate-500">
                  → {v.candidateName} ·{" "}
                  <span className="text-xs">{v.createdAt.toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="mb-3 font-semibold">Manage candidates</h2>
        <ul className="mb-4 divide-y divide-slate-100 text-sm">
          {candList.map((c) => {
            const count = allVotes.filter((v) => v.candidateId === c.id).length;
            return (
              <li key={c.id} className="py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                    <span className="font-medium">{c.name}</span>
                    <span className="text-xs text-slate-400">{c.party}</span>
                    {count > 0 && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                        {count} vote{count === 1 ? "" : "s"}
                      </span>
                    )}
                  </span>
                  {count > 0 ? (
                    <span className="text-xs text-slate-400" title="Candidates with votes cannot be removed">
                      cannot remove
                    </span>
                  ) : (
                    <form action={deleteCandidate}>
                      <input type="hidden" name="id" value={c.id} />
                      {st && <input type="hidden" name="st" value={st} />}
                      <button className="text-xs text-red-500 hover:underline">Remove</button>
                    </form>
                  )}
                </div>
                <details className="mt-1">
                  <summary className="w-fit cursor-pointer select-none text-xs font-medium text-blue-600 hover:underline">
                    Edit
                  </summary>
                  <form
                    action={updateCandidate}
                    className="mt-2 grid gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs sm:grid-cols-2"
                  >
                    <input type="hidden" name="id" value={c.id} />
                    {st && <input type="hidden" name="st" value={st} />}
                    <label className="block">
                      <span className="mb-0.5 block font-medium text-slate-600">Name</span>
                      <input name="name" required minLength={2} defaultValue={c.name} className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white" />
                    </label>
                    <label className="block">
                      <span className="mb-0.5 block font-medium text-slate-600">Party</span>
                      <input name="party" defaultValue={c.party} className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white" />
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="mb-0.5 block font-medium text-slate-600">Slogan</span>
                      <input name="slogan" defaultValue={c.slogan} className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white" />
                    </label>
                    <div className="flex items-center justify-between gap-3 pt-1 sm:col-span-2">
                      <label className="flex items-center gap-2">
                        <span className="font-medium text-slate-600">Color</span>
                        <input type="color" name="color" defaultValue={c.color} className="h-7 w-10 cursor-pointer rounded border border-slate-300 bg-white p-0.5" />
                      </label>
                      <button className="rounded-lg bg-blue-600 px-4 py-1.5 font-semibold text-white hover:bg-blue-700">
                        Save changes
                      </button>
                    </div>
                  </form>
                </details>
              </li>
            );
          })}
        </ul>
        <form action={addCandidate} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
          {st && <input type="hidden" name="st" value={st} />}
          <input name="name" required placeholder="Name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input name="party" placeholder="Party" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input name="slogan" placeholder="Slogan" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Add</button>
        </form>
        <p className="mt-2 text-xs text-slate-400">Candidates with existing votes cannot be removed, keeping the audit record intact.</p>
      </section>
    </div>
  );
}
