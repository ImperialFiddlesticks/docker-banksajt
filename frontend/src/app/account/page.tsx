"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Account() {
  const [amount, setAmount] = useState<number | null>(null);
  const [deposit, setDeposit] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    fetch("http://127.0.0.1:3001/me/accounts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch account balance");
        return res.json();
      })
      .then((data) => setAmount(data.amount))
      .catch(() => {
        localStorage.removeItem("token");
        router.push("/login");
      });
  }, [router]);

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const token = localStorage.getItem("token");
    const res = await fetch("http://127.0.0.1:3001/me/accounts/transactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token, amount: Number(deposit) }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to deposit");
      return;
    }

    const data = await res.json();
    setAmount(data.amount);
    setDeposit("");
  }

  if (amount === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
        <p className="text-lg font-medium text-gray-900">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center bg-gray-50 px-6 py-16">
      <div className="bg-white p-8 rounded-lg shadow-sm w-full max-w-sm text-center mb-8">
        <p className="text-sm text-gray-500 mb-2">Current Balance</p>
        <p className="text-3xl font-bold text-gray-900">
          {amount.toFixed(2)} kr
        </p>
      </div>

      <form
        onSubmit={handleDeposit}
        className="bg-white p-8 rounded-lg shadow-sm w-full max-w-sm"
      >
        <h2 className="text-lg font-bold text-gray-900 mb-4">Make a Deposit</h2>
        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
        <label
          htmlFor="deposit"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Amount
        </label>
        <input
          id="deposit"
          type="number"
          value={deposit}
          onChange={(e) => setDeposit(e.target.value)}
          required
          min="1"
          className="w-full border border-gray-300 rounded-md px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <button
          type="submit"
          className="w-full bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          Deposit
        </button>
      </form>
    </div>
  );
}
