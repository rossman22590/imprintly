import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  ArrowUpRight,
  CalendarClock,
  Coins,
  CreditCard,
  Crown,
  Gem,
  Image,
  ReceiptText,
  Sparkles,
} from "lucide-react";
import DashboardLayout from "../layouts/DashboardLayout";
import axiosInstance from "../lib/axios";
import { API_ENDPOINTS } from "../utils/api-endpoints";

const BUY_CREDITS_URL = "https://buy.stripe.com/aFadR2aO0gRt3lU7YUgjC0w";

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

function formatMargin(value) {
  const multiplier = Number(value || 1);
  const margin = multiplier > 0 ? (1 - 1 / multiplier) * 100 : 0;

  return `${Math.max(0, margin).toFixed(0)}%`;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "Not scheduled";
}

function getMonthlyPlanLabel(credits = {}) {
  const preset = String(credits?.monthlyPreset || "").toLowerCase();

  if (preset === "premium") return "Premium";
  if (preset === "ultra") return "Ultra";

  return Number(credits?.monthlyAllowance || 0) > 0 ? "Custom" : "";
}

function getMonthlyPlanIcon(credits = {}) {
  const preset = String(credits?.monthlyPreset || "").toLowerCase();

  if (preset === "premium") return Crown;
  if (preset === "ultra") return Gem;

  return CalendarClock;
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
  const historyDays = summary?.historyDays || 40;
  const monthlyAllowance = Number(credits?.monthlyAllowance || 0);
  const hasMonthlyPlan = monthlyAllowance > 0;
  const MonthlyPlanIcon = getMonthlyPlanIcon(credits);

  return (
    <DashboardLayout>
      <main className="container max-w-6xl h-full min-h-0 p-4 md:p-6 mx-auto flex flex-col">
        <header className="mb-6 flex shrink-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-violet-600 text-xs font-semibold uppercase tracking-wide">
              Usage
            </p>
            <h1 className="text-slate-950 text-2xl font-bold">
              Credits and transactions
            </h1>
          </div>

          <a
            href={BUY_CREDITS_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="Buy credits with Stripe"
            className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-slate-950/15 transition hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-slate-950/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 sm:w-auto"
          >
            <CreditCard className="size-4" />
            <span>Buy Credits</span>
            <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
        </header>

        {isLoading ? (
          <div className="h-40 rounded-xl border border-slate-200 bg-white animate-pulse" />
        ) : (
          <div className="min-h-0 flex-1 flex flex-col">
            {hasMonthlyPlan && (
              <section className="mb-6 shrink-0 overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-sm">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] gap-4 p-5 bg-[radial-gradient(circle_at_15%_0%,rgba(139,92,246,0.16),transparent_18rem),linear-gradient(135deg,#ffffff,#f8f5ff)]">
                  <div className="flex items-start gap-4">
                    <div className="size-12 shrink-0 rounded-2xl bg-violet-600 text-white flex items-center justify-center shadow-lg shadow-violet-500/25">
                      <MonthlyPlanIcon className="size-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-600">
                        Monthly recurring plan
                      </p>
                      <h2 className="text-2xl font-black text-slate-950 mt-1">
                        {getMonthlyPlanLabel(credits)}
                      </h2>
                      <p className="text-sm text-slate-500 mt-1">
                        Your credits renew on the 1st of each month.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-violet-100 bg-white px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Monthly credits
                    </p>
                    <p className="text-xl font-black text-slate-950 tabular-nums mt-1">
                      {formatCredits(monthlyAllowance)}
                    </p>
                  </div>

                  <div className="rounded-xl border border-violet-100 bg-white px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Renewal date
                    </p>
                    <p className="text-sm font-black text-slate-950 mt-1">
                      {formatDate(credits?.nextMonthlyResetAt)}
                    </p>
                  </div>
                </div>
              </section>
            )}

            <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 shrink-0">
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
                  Tokens: provider/model cost,{" "}
                  {formatMargin(credits?.tokenMarkupMultiplier)} margin
                </p>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white overflow-hidden min-h-0 flex flex-1 flex-col">
              <div className="px-4 sm:px-5 py-4 border-b border-slate-200 flex shrink-0 items-center justify-between gap-3">
                <div>
                  <h2 className="text-slate-950 font-semibold">
                    Transaction history
                  </h2>
                  <p className="text-slate-500 text-xs mt-1">
                    Last {historyDays} days · all {transactions.length}{" "}
                    transactions
                  </p>
                </div>
                <span className="text-slate-500 text-xs text-right">
                  1 Bookify credit = {formatUsd(credits?.usdPerCredit)}
                </span>
              </div>

              {transactions.length === 0 ? (
                <p className="px-5 py-10 text-slate-500 text-sm">
                  No transactions in the last {historyDays} days.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100 overflow-y-auto min-h-0 flex-1 overscroll-contain">
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
          </div>
        )}
      </main>
    </DashboardLayout>
  );
}

export default CreditsPage;
