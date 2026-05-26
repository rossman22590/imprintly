import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Coins, Image, ReceiptText, Sparkles } from "lucide-react";
import DashboardLayout from "../layouts/DashboardLayout";
import axiosInstance from "../lib/axios";
import { API_ENDPOINTS } from "../utils/api-endpoints";

function formatCredits(value) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 4,
    minimumFractionDigits: Number(value) % 1 ? 2 : 0,
  }).format(Number(value || 0));
}

function formatUsd(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 6,
  }).format(Number(value || 0));
}

function formatReason(reason = "") {
  return reason
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function transactionIcon(type, reason) {
  if (type === "grant") return Coins;
  if (reason?.includes("image")) return Image;
  return Sparkles;
}

function transactionIsNegative(transaction) {
  return (
    transaction?.type === "debit" ||
    transaction?.metadata?.direction === "remove"
  );
}

function CreditsPage() {
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCredits = async () => {
      setIsLoading(true);

      try {
        const { data } = await axiosInstance.get(API_ENDPOINTS.CREDITS.GET);
        setSummary(data);
      } catch (error) {
        console.error("Error fetching credits:", error);
        toast.error("Failed to load credit history.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchCredits();
  }, []);

  const credits = summary?.credits;
  const transactions = summary?.transactions || [];

  return (
    <DashboardLayout>
      <main className="container max-w-6xl p-4 md:p-6 mx-auto">
        <header className="mb-6 flex flex-col gap-2">
          <p className="text-violet-600 text-xs font-semibold uppercase tracking-wide">
            Usage
          </p>
          <h1 className="text-slate-950 text-2xl font-bold">
            Credits and transactions
          </h1>
        </header>

        {isLoading ? (
          <div className="h-40 rounded-xl border border-slate-200 bg-white animate-pulse" />
        ) : (
          <>
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="size-10 rounded-lg bg-violet-50 flex items-center justify-center mb-4">
                  <Coins className="size-5 text-violet-600" />
                </div>
                <p className="text-slate-500 text-sm">Available balance</p>
                <p className="text-slate-950 text-3xl font-bold mt-1 tabular-nums">
                  {formatCredits(credits?.balance)}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="size-10 rounded-lg bg-emerald-50 flex items-center justify-center mb-4">
                  <ReceiptText className="size-5 text-emerald-600" />
                </div>
                <p className="text-slate-500 text-sm">Lifetime spent</p>
                <p className="text-slate-950 text-3xl font-bold mt-1 tabular-nums">
                  {formatCredits(credits?.lifetimeSpent)}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="size-10 rounded-lg bg-slate-100 flex items-center justify-center mb-4">
                  <Image className="size-5 text-slate-600" />
                </div>
                <p className="text-slate-500 text-sm">Rates</p>
                <p className="text-slate-950 text-sm font-semibold mt-2">
                  Image: {formatCredits(credits?.imageCredits)} credits
                </p>
                <p className="text-slate-500 text-xs mt-1">
                  Tokens: API cost plus {credits?.tokenMarkupMultiplier || 1}x
                  markup
                </p>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-4 sm:px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
                <h2 className="text-slate-950 font-semibold">
                  Transaction history
                </h2>
                <span className="text-slate-500 text-xs">
                  1 credit = {formatUsd(credits?.usdPerCredit)}
                </span>
              </div>

              {transactions.length === 0 ? (
                <p className="px-5 py-10 text-slate-500 text-sm">
                  No transactions yet.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {transactions.map((transaction) => {
                    const Icon = transactionIcon(
                      transaction.type,
                      transaction.reason
                    );
                    const isDebit = transactionIsNegative(transaction);

                    return (
                      <li
                        key={transaction.id}
                        className="px-4 sm:px-5 py-4 grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 items-start"
                      >
                        <span className="size-9 rounded-lg bg-slate-100 flex items-center justify-center">
                          <Icon className="size-4 text-slate-600" />
                        </span>

                        <div className="min-w-0">
                          <p className="text-slate-950 text-sm font-semibold">
                            {transaction.description ||
                              formatReason(transaction.reason)}
                          </p>
                          <p className="text-slate-500 text-xs mt-1">
                            {new Date(transaction.createdAt).toLocaleString()}
                            {transaction.model ? ` - ${transaction.model}` : ""}
                          </p>
                          {transaction.usage?.billedTotalTokens > 0 && (
                            <p className="text-slate-500 text-xs mt-1">
                              {transaction.usage.billedTotalTokens} tokens -{" "}
                              {formatUsd(transaction.usdCost)}
                            </p>
                          )}
                        </div>

                        <div className="text-right">
                          <p
                            className={`text-sm font-bold tabular-nums ${
                              isDebit ? "text-rose-600" : "text-emerald-600"
                            }`}
                          >
                            {isDebit ? "-" : "+"}
                            {formatCredits(transaction.amount)}
                          </p>
                          <p className="text-slate-400 text-xs mt-1 tabular-nums">
                            {formatCredits(transaction.balanceAfter)} left
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </DashboardLayout>
  );
}

export default CreditsPage;
