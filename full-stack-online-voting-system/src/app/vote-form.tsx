"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { castVote, type FormState } from "./actions";

type Candidate = { id: number; name: string; party: string; slogan: string; color: string };

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function VoteForm({ candidates }: { candidates: Candidate[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(castVote, undefined);
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <form action={formAction} className="space-y-6">
      {/* Step 1 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="mb-4 flex items-center gap-2 font-semibold">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs text-white">1</span>
          Choose your candidate
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {candidates.map((c) => {
            const active = selected === c.id;
            return (
              <label
                key={c.id}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-4 transition ${
                  active ? "border-blue-600 bg-blue-50" : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="candidateId"
                  value={c.id}
                  checked={active}
                  onChange={() => setSelected(c.id)}
                  className="sr-only"
                />
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: c.color }}
                >
                  {initials(c.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{c.name}</span>
                  <span className="block text-xs text-slate-500">{c.party}</span>
                  {c.slogan && <span className="mt-1 block truncate text-xs italic text-slate-400">“{c.slogan}”</span>}
                </span>
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[10px] text-white ${
                    active ? "border-blue-600 bg-blue-600" : "border-slate-300"
                  }`}
                >
                  {active && "✓"}
                </span>
              </label>
            );
          })}
        </div>
      </section>

      {/* Step 2 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="mb-4 flex items-center gap-2 font-semibold">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs text-white">2</span>
          Your details
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Full name</span>
            <input
              name="name"
              required
              minLength={2}
              placeholder="Jane Doe"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Phone number</span>
            <input
              name="phone"
              type="tel"
              autoComplete="tel"
              required
              minLength={7}
              placeholder="e.g. 9876543210"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-slate-700">Student ID</span>
            <input
              name="studentId"
              required
              minLength={3}
              maxLength={30}
              placeholder="e.g. STU-2026-001"
              autoCapitalize="characters"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-slate-400">Your student ID is used to prevent duplicate votes. Each student ID can vote only once.</p>
      </section>

      {state?.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {state.error}
          {state.receipt && (
            <Link href={`/accepted?receipt=${state.receipt}`} className="ml-1 font-semibold underline">
              View your receipt
            </Link>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={pending || selected === null}
        className="w-full rounded-xl bg-blue-600 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {pending ? "Submitting your vote…" : selected === null ? "Select a candidate to continue" : "Submit my vote"}
      </button>
    </form>
  );
}
