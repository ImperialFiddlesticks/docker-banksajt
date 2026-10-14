"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Transaction = {
  id: number;
  amount: number;
  createdAt: string;
};

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/me/accounts/transactions`, {
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch transactions");
        return res.json();
      })
      .then((data) => setTransactions(data))
      .catch(() => {
        router.push("/login");
      });
  }, [router]);

  if (transactions === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
        <p className="text-lg font-medium text-gray-900">Loading...</p>
      </div>
    );
  }
  return (
    <div className="min-h-screen flex flex-col items-center bg-gray-50 px-6 py-16">
      <div className="bg-white p-8 rounded-lg shadow-sm w-full max-w-sm">
        <h1 className="text-lg font-bold text-gray-900 mb-4">Transactions</h1>

        {transactions.length === 0 ? (
          <p className="text-sm text-gray-500">
            You have no transactions yet. Make a deposit on your account page
            and it will show up here.
          </p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {transactions.map((t) => {
              const isWithdrawal = t.amount < 0;
              return (
                <li key={t.id} className="flex justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {isWithdrawal ? "Withdrawal" : "Deposit"}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(t.createdAt).toLocaleString("sv-SE")}
                    </p>
                  </div>
                  <span
                    className={`font-medium ${isWithdrawal ? "text-red-600" : "text-green-600"}`}
                  >
                    {isWithdrawal ? "-" : "+"}
                    {Math.abs(t.amount).toFixed(2)} kr
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Link
        href="/account"
        className="mt-6 text-sm text-green-600 hover:underline"
      >
        ← Back to account
      </Link>
    </div>
  );
}
