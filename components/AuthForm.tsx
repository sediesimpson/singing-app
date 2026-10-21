"use client";

import { useActionState } from "react";
import Link from "next/link";
import { logIn, signUp } from "@/app/auth/actions";

const MODES = {
  login: {
    title: "log in",
    action: logIn,
    button: "log in",
    switchText: "new here?",
    switchLink: { href: "/signup", label: "create an account" },
  },
  signup: {
    title: "create an account",
    action: signUp,
    button: "sign up",
    switchText: "already have an account?",
    switchLink: { href: "/login", label: "log in" },
  },
} as const;

const inputClass =
  "w-full rounded-xl bg-gray-50 px-4 py-3 ring-1 ring-gray-200 outline-none transition focus:bg-white focus:ring-2 focus:ring-gray-900";

export function AuthForm({ mode }: { mode: keyof typeof MODES }) {
  const m = MODES[mode];
  // useActionState runs the Server Action and keeps whatever it returns (an error or a message)
  const [state, formAction, pending] = useActionState(m.action, undefined);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-6 lowercase [&_button]:lowercase">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <span role="img" aria-label="Singing Trainer" className="text-2xl leading-none text-gray-800 text-center">
          ♫♫♫
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-center">{m.title}</h1>

        <form action={formAction} className="flex flex-col gap-3">
          {/* Inputs stay normal case: emails and passwords are case-sensitive */}
          <input name="email" type="email" required autoComplete="email" placeholder="email" className={`${inputClass} normal-case`} />
          <input
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder="password"
            className={`${inputClass} normal-case`}
          />
          <button
            disabled={pending}
            className="mt-2 h-12 rounded-full bg-gray-900 font-medium text-white transition hover:bg-gray-700 disabled:opacity-60"
          >
            {pending ? "one moment…" : m.button}
          </button>
        </form>

        {state?.error && <p className="text-center text-sm text-red-600">{state.error}</p>}
        {state?.message && <p className="text-center text-sm text-green-700">{state.message}</p>}

        <p className="text-center text-sm text-gray-500">
          {m.switchText}{" "}
          <Link href={m.switchLink.href} className="font-medium text-gray-900 hover:underline">
            {m.switchLink.label}
          </Link>
        </p>
        <Link href="/" className="text-center text-sm text-gray-400 hover:text-gray-700">
          or just practise without an account
        </Link>
      </div>
    </main>
  );
}
