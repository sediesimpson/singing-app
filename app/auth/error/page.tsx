import Link from "next/link";

// Where a broken or expired confirmation link ends up
export default function AuthErrorPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center lowercase">
      <h1 className="text-2xl font-semibold tracking-tight">that link didn&apos;t work</h1>
      <p className="max-w-sm text-gray-500">It may have expired or already been used. Try logging in, or sign up again.</p>
      <Link href="/login" className="rounded-full bg-gray-900 px-6 py-3 font-medium text-white hover:bg-gray-700">
        go to log in
      </Link>
    </main>
  );
}
