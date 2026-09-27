import { ELECTION_TITLE, getCandidates } from "@/lib/election";
import { VoteForm } from "./vote-form";

export const dynamic = "force-dynamic";

export default async function VotePage() {
  const list = await getCandidates();

  return (
    <div className="space-y-8">
      <div className="text-center">
        <p className="text-sm font-medium text-blue-600">Voting is open</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{ELECTION_TITLE}</h1>
        <p className="mt-2 text-slate-500">Pick one candidate, enter your details, and submit. It takes 30 seconds.</p>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="font-semibold">No candidates yet</p>
          <p className="text-sm text-slate-500">The admin hasn&apos;t added any candidates. Please check back soon.</p>
        </div>
      ) : (
        <VoteForm
          candidates={list.map((c) => ({ id: c.id, name: c.name, party: c.party, slogan: c.slogan, color: c.color }))}
        />
      )}
    </div>
  );
}
