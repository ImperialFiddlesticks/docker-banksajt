import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="flex items-center gap-6 px-6 py-4 border-b border-gray-200 bg-white">
        <span className="font-bold text-lg text-green-700">Banken</span>
        <div className="flex gap-6 ml-auto text-sm font-medium text-gray-600">
          <Link href="/" className="hover:text-green-700 transition-colors">
            Home
          </Link>
          <Link
            href="/login"
            className="hover:text-green-700 transition-colors"
          >
            Log In
          </Link>
          <Link
            href="/register"
            className="hover:text-green-700 transition-colors"
          >
            Register
          </Link>
        </div>
      </nav>

      <section className="flex flex-col items-center justify-center text-center px-6 py-24">
        <h1 className="text-4xl sm:text-5xl font-bold text-green-900">
          Welcome to the Bank
        </h1>
        <p className="text-lg text-gray-600 mb-8 max-w-md">
          Open an account in less than a minute.
        </p>
        <Link
          href="/register"
          className="bg-green-700 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-900 transition-colors"
        >
          Register
        </Link>
        {process.env.NEXT_PUBLIC_FEATURE_PROMO === "true" && (
          <button className="mt-4 bg-yellow-400 text-green-900 px-6 py-3 rounded-lg font-medium hover:bg-yellow-300 transition-colors">
            New: Refer a friend, get 100kr
          </button>
        )}
      </section>
    </div>
  );
}
