import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import {
  CalendarClock,
  Coins,
  CreditCard,
  Crown,
  Gem,
  Image,
  ReceiptText,
  Sparkles,
  Check,
  RefreshCw,
  XCircle,
  ShieldCheck,
  X,
  AlertTriangle,
} from "lucide-react";
import DashboardLayout from "../layouts/DashboardLayout";
import axiosInstance from "../lib/axios";
import { API_ENDPOINTS } from "../utils/api-endpoints";
import { useAuthContext } from "../contexts/AuthContext";

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
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : "Not scheduled";
}

const PLANS = [
  {
    id: "starter",
    name: "Starter Plan",
    credits: 100,
    price: 5.00,
    description: "Perfect for casual writers starting their journey.",
    features: [
      "100 monthly credits",
      "Full platform access",
      "All AI model engines unlocked",
      "Audiobook narration tools",
      "Unlimited PDF & DOCX exports",
      "Priority generation support",
    ],
  },
  {
    id: "premium",
    name: "Premium Plan",
    credits: 500,
    price: 25.00,
    description: "The sweet spot for active authors and creators.",
    features: [
      "500 monthly credits",
      "Full platform access",
      "All AI model engines unlocked",
      "Audiobook narration tools",
      "Unlimited PDF & DOCX exports",
      "Priority generation support",
    ],
    popular: true,
  },
  {
    id: "ultra",
    name: "Ultra Plan",
    credits: 1000,
    price: 50.00,
    description: "Designed for publishers and volume creators.",
    features: [
      "1,000 monthly credits",
      "Full platform access",
      "All AI model engines unlocked",
      "Audiobook narration tools",
      "Unlimited PDF & DOCX exports",
      "Priority generation support",
    ],
  },
];

const CREDIT_PACK_MIN = 100;
const CREDIT_PACK_MAX = 1500;
const CREDIT_PACK_MARKS = [100, 500, 1000, 1500];

function getCreditPackPercent(amount) {
  return ((amount - CREDIT_PACK_MIN) / (CREDIT_PACK_MAX - CREDIT_PACK_MIN)) * 100;
}

function getMonthlyPlanLabel(preset = "", allowance = 0) {
  const normalized = String(preset || "").toLowerCase();
  if (normalized === "starter") return "Starter";
  if (normalized === "premium") return "Premium";
  if (normalized === "ultra") return "Ultra";
  return Number(allowance || 0) > 0 ? "Custom" : "";
}

function getMonthlyPlanIcon(preset = "") {
  const normalized = String(preset || "").toLowerCase();
  if (normalized === "starter") return Coins;
  if (normalized === "premium") return Crown;
  if (normalized === "ultra") return Gem;
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

function renderTransactionRow(transaction) {
  const Icon = transactionIcon(transaction.type, transaction.reason);
  const isDebit = transactionIsNegative(transaction);

  return (
    <li
      key={transaction.id || transaction._id}
      className="px-4 sm:px-5 py-4 grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 items-start"
    >
      <span className="size-9 rounded-lg bg-slate-100 flex items-center justify-center">
        <Icon className="size-4 text-slate-600" />
      </span>

      <div className="min-w-0">
        <p className="text-slate-950 text-sm font-semibold">
          {transaction.description || formatReason(transaction.reason)}
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
}

function StripePaymentForm({
  checkoutSession,
  checkoutPrice,
  customerEmail,
  fetchCredits,
  onApplyCoupon,
  onClose,
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [message, setMessage] = useState("");
  const [couponCode, setCouponCode] = useState(checkoutSession?.couponCode || "");
  const [couponMessage, setCouponMessage] = useState("");
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [isPaying, setIsPaying] = useState(false);

  useEffect(() => {
    setCouponCode(checkoutSession?.couponCode || "");
    setCouponMessage("");
  }, [checkoutSession?.couponCode, checkoutSession?.clientSecret]);

  const handleApplyCoupon = async (nextCouponCode) => {
    const trimmedCode = String(nextCouponCode || "").trim();

    setCouponMessage("");
    setIsApplyingCoupon(true);
    try {
      await onApplyCoupon(trimmedCode);
      setCouponMessage(trimmedCode ? "Coupon applied." : "Coupon removed.");
    } catch (error) {
      setCouponMessage(error.response?.data?.error || "Coupon code could not be applied.");
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) return;

    setIsPaying(true);
    setMessage("");

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url:
          checkoutSession?.mode === "subscription"
            ? `${window.location.origin}/credits?subscription_updated=true`
            : `${window.location.origin}/credits?payment_return=true`,
      },
      redirect: "if_required",
    });

    if (error) {
      setMessage(error.message || "Payment could not be confirmed.");
      setIsPaying(false);
      return;
    }

    if (paymentIntent?.status === "succeeded" || paymentIntent?.status === "processing") {
      if (checkoutSession?.mode === "subscription") {
        toast.success("Subscription confirmed. Refreshing billing status...");
        window.location.assign(`${window.location.origin}/credits?subscription_updated=true`);
        return;
      }

      toast.success("Payment confirmed. Your credits will update shortly.");
      await fetchCredits(false);
      onClose();
      setIsPaying(false);
      return;
    }

    setMessage("Payment is not complete yet. Check Stripe for the latest status.");
    setIsPaying(false);
  };

  return (
    <form onSubmit={handleSubmit} className="flex min-h-[520px] flex-col">
      <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <label htmlFor="checkout-coupon" className="text-sm font-bold text-slate-900">
          Coupon code
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            id="checkout-coupon"
            type="text"
            value={couponCode}
            onChange={(event) => setCouponCode(event.target.value)}
            placeholder="Enter coupon code"
            disabled={isApplyingCoupon || isPaying}
            className="min-h-11 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => handleApplyCoupon(couponCode)}
            disabled={isApplyingCoupon || isPaying || !String(couponCode || "").trim()}
            className="min-h-11 rounded-xl bg-violet-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isApplyingCoupon ? "Applying..." : "Apply"}
          </button>
        </div>
        {checkoutSession?.couponCode && (
          <button
            type="button"
            onClick={() => handleApplyCoupon("")}
            disabled={isApplyingCoupon || isPaying}
            className="mt-3 text-sm font-bold text-slate-500 transition hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Remove {checkoutSession.couponCode}
          </button>
        )}
        {couponMessage && (
          <p
            className={`mt-3 text-sm font-semibold ${
              couponMessage.includes("could not") ? "text-rose-600" : "text-emerald-700"
            }`}
          >
            {couponMessage}
          </p>
        )}
      </div>

      <PaymentElement
        options={{
          layout: {
            type: "tabs",
            defaultCollapsed: false,
          },
          ...(customerEmail
            ? {
                defaultValues: {
                  billingDetails: {
                    email: customerEmail,
                  },
                },
              }
            : {}),
        }}
      />

      {message && (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {message}
        </p>
      )}

      <div className="mt-auto pt-6">
        <button
          type="submit"
          disabled={!stripe || !elements || isPaying}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-slate-950/15 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <CreditCard className="size-4" />
          {isPaying
            ? "Confirming..."
            : checkoutSession?.mode === "subscription" && checkoutSession?.overrideTier
            ? `Pay additional ${formatUsd(checkoutPrice)}`
            : `Pay ${formatUsd(checkoutPrice)}`}
          {checkoutSession?.mode === "subscription" ? " / month" : ""}
        </button>
      </div>
    </form>
  );
}

function OneTimeCreditsSection({
  sliderCredits,
  oneTimePrice,
  sliderPercent,
  setSliderCredits,
  isSubmitting,
  isCheckoutOpen,
  onBuy,
}) {
  return (
    <section
      id="one-time-credits"
      className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shrink-0"
    >
      <div className="grid gap-0 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="border-b border-slate-200 bg-slate-950 p-6 text-white lg:border-b-0 lg:border-r lg:border-slate-800">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300">
            One-time credits
          </p>
          <h3 className="mt-2 text-2xl font-black">Build a credit pack</h3>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Top up without changing your monthly plan. These credits stay separate from recurring credits.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            {CREDIT_PACK_MARKS.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => setSliderCredits(amount)}
                className={`rounded-xl border px-3 py-3 text-left transition ${
                  sliderCredits === amount
                    ? "border-violet-300 bg-violet-500/20 text-white"
                    : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                }`}
              >
                <span className="block text-sm font-black tabular-nums">
                  {formatCredits(amount)}
                </span>
                <span className="mt-1 block text-xs tabular-nums text-slate-400">
                  {formatUsd(amount * 0.1)}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-6 md:p-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Credits</p>
              <p className="mt-2 text-4xl font-black text-violet-600 tabular-nums">
                {formatCredits(sliderCredits)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total</p>
              <p className="mt-2 text-4xl font-black text-slate-950 tabular-nums">
                {formatUsd(oneTimePrice)}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <div className="px-3">
              <div className="relative mb-3 h-5 text-xs font-bold text-slate-500">
                {CREDIT_PACK_MARKS.map((amount, index) => (
                  <span
                    key={amount}
                    className={`absolute top-0 whitespace-nowrap ${
                      index === 0
                        ? "translate-x-0 text-left"
                        : index === CREDIT_PACK_MARKS.length - 1
                        ? "-translate-x-full text-right"
                        : "-translate-x-1/2 text-center"
                    }`}
                    style={{ left: `${getCreditPackPercent(amount)}%` }}
                  >
                    {formatCredits(amount)}
                  </span>
                ))}
              </div>
              <div className="relative h-9">
                <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full border border-slate-300 bg-slate-200" />
                <div
                  className="absolute top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-violet-600 shadow-[0_0_0_1px_rgba(124,58,237,0.45),0_8px_18px_rgba(15,23,42,0.22)]"
                  style={{ left: `${sliderPercent}%` }}
                />
                <input
                  type="range"
                  min={CREDIT_PACK_MIN}
                  max={CREDIT_PACK_MAX}
                  step="100"
                  value={sliderCredits}
                  onChange={(e) => setSliderCredits(Number(e.target.value))}
                  className="credit-pack-slider-hitbox absolute -inset-x-3 inset-y-0 z-10 w-[calc(100%+1.5rem)] cursor-pointer"
                  aria-label="One-time credit amount"
                />
              </div>
              <div className="relative mt-3 h-5 text-[11px] font-semibold text-slate-400">
                {CREDIT_PACK_MARKS.map((amount, index) => (
                  <span
                    key={amount}
                    className={`absolute top-0 whitespace-nowrap ${
                      index === 0
                        ? "translate-x-0 text-left"
                        : index === CREDIT_PACK_MARKS.length - 1
                        ? "-translate-x-full text-right"
                        : "-translate-x-1/2 text-center"
                    }`}
                    style={{ left: `${getCreditPackPercent(amount)}%` }}
                  >
                    {formatUsd(amount * 0.1)}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-7 flex justify-center">
            <button
              onClick={onBuy}
              disabled={isSubmitting || isCheckoutOpen}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-slate-950/15 transition hover:bg-slate-900 disabled:opacity-50 sm:w-auto"
            >
              <CreditCard className="size-4" />
              Buy Credits
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function CreditsPage() {
  const { user } = useAuthContext();
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sliderCredits, setSliderCredits] = useState(500);
  const [checkoutSession, setCheckoutSession] = useState(null);
  const [planChangeTier, setPlanChangeTier] = useState(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelAcknowledged, setCancelAcknowledged] = useState(false);

  const fetchCredits = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const { data } = await axiosInstance.get(API_ENDPOINTS.CREDITS.GET);
      setSummary(data);
    } catch (error) {
      console.error("Error fetching credits:", error);
      toast.error("Failed to load credit history.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const subscriptionUpdated = params.get("subscription_updated");

    if (!subscriptionUpdated) return undefined;

    toast.success("Subscription confirmed. Updating billing status...");
    fetchCredits(false);

    const refreshTimer = window.setTimeout(() => {
      fetchCredits(false);
    }, 1500);

    params.delete("subscription_updated");
    const nextSearch = params.toString();
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`
    );

    return () => {
      window.clearTimeout(refreshTimer);
    };
  }, [fetchCredits]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("checkout_session_id");

    if (!sessionId) return;

    const syncReturnedCheckout = async () => {
      try {
        const { data } = await axiosInstance.get("/api/stripe/checkout-session-status", {
          params: { sessionId },
        });

        if (data?.status === "complete") {
          toast.success("Payment completed. Your credits will update shortly.");
        } else {
          toast("Checkout was not completed.");
        }

        await fetchCredits(false);
      } catch (error) {
        console.error("Stripe Checkout Return Error:", error);
        toast.error(error.response?.data?.error || "Failed to verify checkout status.");
      } finally {
        params.delete("checkout_session_id");
        const nextSearch = params.toString();
        window.history.replaceState(
          {},
          "",
          `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`
        );
      }
    };

    syncReturnedCheckout();
  }, [fetchCredits]);

  const credits = summary?.credits;
  const transactions = summary?.transactions || [];
  const historyDays = summary?.historyDays || 40;

  const activeTier = credits?.subscriptionTier || "";
  const subscriptionStatus = credits?.subscriptionStatus || "";
  const isSubscribed = !!activeTier && subscriptionStatus !== "canceled";
  const isCanceling = credits?.subscriptionCancelAtPeriodEnd || false;
  const hasPaidSubscription = Boolean(credits?.stripeSubscriptionId);
  const overrideTier =
    credits?.subscriptionOverrideTier ||
    (!hasPaidSubscription && isSubscribed ? activeTier : "");

  const activePlanIndex = PLANS.findIndex(p => p.id === activeTier);
  const overridePlanIndex = PLANS.findIndex(p => p.id === overrideTier);
  const currentPlan = PLANS.find((plan) => plan.id === activeTier);
  const overridePlan = PLANS.find((plan) => plan.id === overrideTier);
  const planChangeTarget = PLANS.find((plan) => plan.id === planChangeTier);
  const planChangeIndex = PLANS.findIndex((plan) => plan.id === planChangeTier);
  const isPlanChangeUpgrade = planChangeIndex > activePlanIndex;
  const MonthlyPlanIcon = getMonthlyPlanIcon(activeTier);
  const checkoutPlan = checkoutSession?.tier
    ? PLANS.find((plan) => plan.id === checkoutSession.tier)
    : null;
  const checkoutCredits =
    checkoutSession?.mode === "subscription"
      ? Number(checkoutSession?.paidAllowance || 0) || checkoutPlan?.credits
      : checkoutSession?.creditAmount;
  const checkoutPrice =
    Number.isFinite(Number(checkoutSession?.amountCents))
      ? Number(checkoutSession.amountCents) / 100
      :
    checkoutSession?.mode === "subscription"
      ? checkoutPlan?.price
      : Number(checkoutSession?.creditAmount || 0) * 0.1;
  const checkoutSubtotalPrice =
    Number.isFinite(Number(checkoutSession?.subtotalCents))
      ? Number(checkoutSession.subtotalCents) / 100
      : checkoutPrice;
  const checkoutDiscountPrice =
    Number.isFinite(Number(checkoutSession?.discountCents))
      ? Number(checkoutSession.discountCents) / 100
      : 0;
  const checkoutMonthlyTotal =
    checkoutSession?.mode === "subscription" && Number.isFinite(Number(checkoutSession?.totalAmountCents))
      ? Number(checkoutSession.totalAmountCents) / 100
      : checkoutPlan?.price;
  const checkoutOverridePlan = checkoutSession?.overrideTier
    ? PLANS.find((plan) => plan.id === checkoutSession.overrideTier)
    : null;
  const oneTimePrice = sliderCredits * 0.1;
  const sliderPercent = getCreditPackPercent(sliderCredits);

  const checkoutOptions = useMemo(() => {
    if (!checkoutSession?.clientSecret) return null;

    return {
      clientSecret: checkoutSession.clientSecret,
      appearance: {
        theme: "stripe",
        labels: "above",
        variables: {
          colorPrimary: "#7c3aed",
          colorBackground: "#ffffff",
          colorText: "#0f172a",
          colorDanger: "#e11d48",
          borderRadius: "12px",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
          spacingUnit: "4px",
        },
        rules: {
          ".Tab": {
            border: "1px solid #e2e8f0",
            boxShadow: "none",
          },
          ".Tab--selected": {
            borderColor: "#7c3aed",
            boxShadow: "0 0 0 1px #7c3aed",
          },
          ".Input": {
            border: "1px solid #cbd5e1",
            boxShadow: "none",
          },
          ".Input:focus": {
            borderColor: "#7c3aed",
            boxShadow: "0 0 0 1px #7c3aed",
          },
        },
      },
    };
  }, [checkoutSession?.clientSecret]);
  const isCheckoutOpen = Boolean(checkoutSession?.clientSecret && checkoutSession?.stripePromise);
  const hasBlockingOverlay = isCheckoutOpen || !!planChangeTier || showCancelDialog;

  const closeCheckout = useCallback(async () => {
    setCheckoutSession(null);
    await fetchCredits(false);
  }, [fetchCredits]);

  useEffect(() => {
    if (!hasBlockingOverlay) return;

    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        closeCheckout();
        setPlanChangeTier(null);
        setShowCancelDialog(false);
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [closeCheckout, hasBlockingOverlay]);

  useEffect(() => {
    const refreshCredits = () => {
      fetchCredits(false);
    };
    const refreshVisibleCredits = () => {
      if (!document.hidden) {
        fetchCredits(false);
      }
    };

    window.addEventListener("focus", refreshCredits);
    document.addEventListener("visibilitychange", refreshVisibleCredits);

    return () => {
      window.removeEventListener("focus", refreshCredits);
      document.removeEventListener("visibilitychange", refreshVisibleCredits);
    };
  }, [fetchCredits]);

  const handleCheckout = async (mode, tier = null, creditAmount = null) => {
    setIsSubmitting(true);
    try {
      const body = { mode };
      if (mode === "subscription") {
        body.tier = tier;
      } else {
        body.credits = creditAmount;
      }

      const { data } = await axiosInstance.post("/api/stripe/create-checkout-session", body);
      if (data?.clientSecret && data?.publishableKey) {
        setCheckoutSession({
          clientSecret: data.clientSecret,
          stripePromise: loadStripe(data.publishableKey),
          mode,
          tier,
          creditAmount,
          subscriptionId: data.subscriptionId,
          paymentIntentId: data.paymentIntentId,
          amountCents: data.amountCents,
          subtotalCents: data.subtotalCents,
          discountCents: data.discountCents,
          couponCode: data.couponCode,
          totalAmountCents: data.totalAmountCents,
          paidAllowance: data.paidAllowance,
          overrideTier: data.overrideTier,
          title:
            mode === "subscription"
              ? data.overrideTier
                ? `Upgrade to ${PLANS.find((plan) => plan.id === tier)?.name || "plan"}`
                : `Subscribe to ${PLANS.find((plan) => plan.id === tier)?.name || "plan"}`
              : `Buy ${formatCredits(creditAmount)} credits`,
        });
        setIsSubmitting(false);
      } else {
        throw new Error("No embedded checkout data returned from session initialization.");
      }
    } catch (error) {
      console.error("Stripe Checkout Error:", error);
      toast.error(error.response?.data?.error || "Failed to start payment process.");
      setIsSubmitting(false);
    }
  };

  const handleApplyCheckoutCoupon = async (couponCode) => {
    if (!checkoutSession?.mode) {
      throw new Error("No active checkout session.");
    }

    const body = {
      mode: checkoutSession.mode,
      couponCode,
      previousSubscriptionId: checkoutSession.subscriptionId,
      previousPaymentIntentId: checkoutSession.paymentIntentId,
    };

    if (checkoutSession.mode === "subscription") {
      body.tier = checkoutSession.tier;
    } else {
      body.credits = checkoutSession.creditAmount;
    }

    const { data } = await axiosInstance.post("/api/stripe/create-checkout-session", body);

    if (!data?.clientSecret || !data?.publishableKey) {
      throw new Error("No embedded checkout data returned from session initialization.");
    }

    setCheckoutSession((currentSession) => ({
      ...currentSession,
      clientSecret: data.clientSecret,
      stripePromise: loadStripe(data.publishableKey),
      subscriptionId: data.subscriptionId,
      paymentIntentId: data.paymentIntentId,
      amountCents: data.amountCents,
      subtotalCents: data.subtotalCents,
      discountCents: data.discountCents,
      couponCode: data.couponCode,
      totalAmountCents: data.totalAmountCents,
      paidAllowance: data.paidAllowance,
      overrideTier: data.overrideTier,
    }));
  };

  const handleCancelSubscription = async () => {
    if (!cancelAcknowledged) {
      return;
    }

    setIsSubmitting(true);
    try {
      await axiosInstance.post("/api/stripe/cancel-subscription");
      toast.success("Subscription scheduled for cancellation.");
      setShowCancelDialog(false);
      setCancelAcknowledged(false);
      await fetchCredits(false);
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      toast.error(error.response?.data?.error || "Failed to cancel subscription.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReactivateSubscription = async () => {
    setIsSubmitting(true);
    try {
      await axiosInstance.post("/api/stripe/reactivate-subscription");
      toast.success("Subscription successfully reactivated!");
      await fetchCredits(false);
    } catch (error) {
      console.error("Error reactivating subscription:", error);
      toast.error(error.response?.data?.error || "Failed to reactivate subscription.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangePlan = async () => {
    if (!planChangeTarget) return;
    setIsSubmitting(true);
    try {
      const { data } = await axiosInstance.post("/api/stripe/change-subscription", { tier: planChangeTarget.id });
      toast.success(data.message || `Plan updated to ${planChangeTarget.name}!`);
      setPlanChangeTier(null);
      await fetchCredits(false);
    } catch (error) {
      console.error("Error changing subscription plan:", error);
      toast.error(error.response?.data?.error || "Failed to update subscription plan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <main className="container max-w-6xl p-4 md:p-6 mx-auto flex flex-col pb-12">
        <header className="mb-6 flex shrink-0 flex-col gap-2">
          <div>
            <p className="text-violet-600 text-xs font-semibold uppercase tracking-wide">
              Billing & Usage
            </p>
            <h1 className="text-slate-950 text-2xl font-bold">
              Credits and Subscriptions
            </h1>
          </div>
        </header>

        {isLoading ? (
          <div className="h-60 rounded-xl border border-slate-200 bg-white animate-pulse" />
        ) : (
          <div className="flex flex-col">
            {isSubscribed && (
              <OneTimeCreditsSection
                sliderCredits={sliderCredits}
                oneTimePrice={oneTimePrice}
                sliderPercent={sliderPercent}
                setSliderCredits={setSliderCredits}
                isSubmitting={isSubmitting}
                isCheckoutOpen={isCheckoutOpen}
                onBuy={() => handleCheckout("payment", null, sliderCredits)}
              />
            )}

            {/* Active Subscription Status Banner */}
            {isSubscribed && (
              <section className="mb-6 shrink-0 overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-sm">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] gap-4 p-5 bg-[radial-gradient(circle_at_15%_0%,rgba(139,92,246,0.12),transparent_22rem),linear-gradient(135deg,#ffffff,#f9f8ff)]">
                  <div className="flex items-start gap-4">
                    <div className="size-12 shrink-0 rounded-2xl bg-violet-600 text-white flex items-center justify-center shadow-lg shadow-violet-500/25">
                      <MonthlyPlanIcon className="size-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-600">
                          Active Subscription
                        </p>
                        {isCanceling && (
                          <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Pending Cancellation
                          </span>
                        )}
                        {overrideTier && (
                          <span className="bg-violet-100 text-violet-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Admin Override
                          </span>
                        )}
                      </div>
                      <h2 className="text-2xl font-black text-slate-950 mt-1">
                        {getMonthlyPlanLabel(activeTier, credits?.monthlyAllowance)}
                      </h2>
                      <p className="text-sm text-slate-500 mt-1">
                        {!hasPaidSubscription && overrideTier
                          ? "Included by admin. Paid upgrades only charge the difference above this plan."
                          : isCanceling
                          ? `Your subscription will cancel at the end of the billing period on ${formatDate(credits?.subscriptionCurrentPeriodEnd)}.`
                          : `Next renewal date: ${formatDate(credits?.subscriptionCurrentPeriodEnd)}.`}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 rounded-xl border border-violet-100 bg-white px-4 py-3 min-w-[140px]">
                    <span className="text-xs font-semibold text-slate-500">Monthly Allowance</span>
                    <span className="text-xl font-black text-slate-950 tabular-nums">
                      {formatCredits(credits?.monthlyAllowance)}
                    </span>
                  </div>

                  <div className="flex items-center justify-center">
                    {isCanceling ? (
                      <button
                        onClick={handleReactivateSubscription}
                        disabled={isSubmitting}
                        className="w-full lg:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-4 py-3 text-sm font-bold shadow-md transition disabled:opacity-50"
                      >
                        <RefreshCw className="size-4 animate-spin-reverse" />
                        Reactivate Subscription
                      </button>
                    ) : (
                      <div className="w-full lg:w-auto rounded-xl border border-violet-100 bg-white px-4 py-3 text-sm text-slate-600">
                        {overrideTier && !hasPaidSubscription
                          ? "Upgrade to a higher paid plan below."
                          : "Manage plan changes below."}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}

            <section className="mb-6 grid grid-cols-1 gap-6 shrink-0 md:grid-cols-3">
              {PLANS.map((plan, index) => {
                const isCurrent = activeTier === plan.id;
                const isBelowOverride = overridePlanIndex >= 0 && index < overridePlanIndex;
                const overrideUpgradePrice =
                  overridePlan && index > overridePlanIndex
                    ? Math.max(0, plan.price - overridePlan.price)
                    : plan.price;
                const canUpgrade = isSubscribed && index > activePlanIndex;
                const canDowngrade =
                  isSubscribed &&
                  hasPaidSubscription &&
                  index < activePlanIndex &&
                  !isBelowOverride;

                return (
                  <div
                    key={plan.id}
                    className={`relative flex flex-col justify-between rounded-2xl border bg-white p-6 transition-all ${
                      isCurrent
                        ? "border-violet-500 shadow-md ring-2 ring-violet-500/25"
                        : plan.popular
                        ? "border-slate-300 shadow-lg scale-102"
                        : "border-slate-200 shadow-sm"
                    }`}
                  >
                    {plan.popular && !isCurrent && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-violet-600 text-white text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider shadow-md">
                        Most Popular
                      </span>
                    )}

                    <div>
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-black text-slate-900">{plan.name}</h3>
                        {plan.id === "premium" && <Crown className="size-5 text-amber-500" />}
                        {plan.id === "ultra" && <Gem className="size-5 text-violet-500" />}
                      </div>
                      <p className="text-slate-500 text-xs mt-1 min-h-[32px]">{plan.description}</p>

                      <div className="mt-4 flex items-baseline gap-1">
                        <span className="text-4xl font-extrabold text-slate-900">
                          {formatUsd(overrideTier && !hasPaidSubscription && index > overridePlanIndex
                            ? overrideUpgradePrice
                            : plan.price)}
                        </span>
                        <span className="text-slate-400 text-sm">
                          /month{overrideTier && !hasPaidSubscription && index > overridePlanIndex ? " upgrade" : ""}
                        </span>
                      </div>

                      <div className="mt-2 p-2 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-600">Monthly Credits:</span>
                        <span className="font-bold text-violet-600 tabular-nums">{formatCredits(plan.credits)}</span>
                      </div>

                      <ul className="mt-6 space-y-3">
                        {plan.features.map((feature, i) => (
                          <li key={i} className="flex items-start gap-2.5 text-xs text-slate-600">
                            <Check className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-8">
                      {isCurrent ? (
                        <button
                          disabled
                          className="w-full py-3 rounded-xl border border-slate-200 bg-slate-100 text-slate-400 text-sm font-bold flex items-center justify-center gap-1 cursor-default"
                        >
                          Current Plan
                        </button>
                      ) : canUpgrade ? (
                        <button
                          onClick={() => {
                            if (hasPaidSubscription) {
                              setPlanChangeTier(plan.id);
                              return;
                            }

                            handleCheckout("subscription", plan.id);
                          }}
                          disabled={isSubmitting}
                          className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold transition-all shadow-md shadow-violet-500/10 hover:shadow-violet-500/25 active:scale-98 disabled:opacity-50"
                        >
                          Upgrade
                        </button>
                      ) : canDowngrade ? (
                        <button
                          onClick={() => setPlanChangeTier(plan.id)}
                          disabled={isSubmitting}
                          className="w-full py-3 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-bold transition-all active:scale-98 disabled:opacity-50"
                        >
                          Downgrade
                        </button>
                      ) : isBelowOverride ? (
                        <button
                          disabled
                          className="w-full py-3 rounded-xl border border-slate-200 bg-slate-100 text-slate-400 text-sm font-bold flex items-center justify-center gap-1 cursor-default"
                        >
                          Included Floor
                        </button>
                      ) : (
                        <button
                          onClick={() => handleCheckout("subscription", plan.id)}
                          disabled={isSubmitting || isCheckoutOpen}
                          className={`w-full py-3 rounded-xl text-sm font-bold transition-all active:scale-98 disabled:opacity-50 ${
                            plan.popular
                              ? "bg-slate-900 hover:bg-slate-800 text-white shadow-md shadow-slate-950/15"
                              : "border border-slate-300 hover:bg-slate-50 text-slate-700"
                          }`}
                        >
                          Subscribe
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </section>

            {!isSubscribed && (
              <OneTimeCreditsSection
                sliderCredits={sliderCredits}
                oneTimePrice={oneTimePrice}
                sliderPercent={sliderPercent}
                setSliderCredits={setSliderCredits}
                isSubmitting={isSubmitting}
                isCheckoutOpen={isCheckoutOpen}
                onBuy={() => handleCheckout("payment", null, sliderCredits)}
              />
            )}

            {/* Split Balances Section */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 shrink-0">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="size-10 rounded-lg bg-violet-50 flex items-center justify-center mb-4">
                  <Coins className="size-5 text-violet-600" />
                </div>
                <p className="text-slate-500 text-sm">Available balance</p>
                <p className="text-slate-950 text-3xl font-bold mt-1 tabular-nums">
                  {formatCredits(credits?.balance)}
                </p>
                <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between text-xs text-slate-500 font-medium">
                  <span>Recurring: {formatCredits(credits?.recurringBalance || 0)}</span>
                  <span>One-Time: {formatCredits(credits?.oneTimeBalance || 0)}</span>
                </div>
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
            </section>

            {/* Transaction History Section */}
            <section className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col">
              <div className="px-4 sm:px-5 py-4 border-b border-slate-200 flex shrink-0 items-center justify-between gap-3">
                <div>
                  <h2 className="text-slate-950 font-semibold">
                    Transaction history
                  </h2>
                  <p className="text-slate-500 text-xs mt-1">
                    Last {historyDays} days - all {transactions.length}{" "}
                    transactions
                  </p>
                </div>
                <span className="text-slate-500 text-xs text-right">
                  1 Bookify credit = {formatUsd(credits?.usdPerCredit || 0.10)}
                </span>
              </div>

              {transactions.length === 0 ? (
                <p className="px-5 py-10 text-slate-500 text-sm">
                  No transactions in the last {historyDays} days.
                </p>
              ) : (
                <div className="max-h-[385px] overflow-y-auto">
                  <ul className="divide-y divide-slate-100">
                    {transactions.map(renderTransactionRow)}
                  </ul>
                </div>
              )}
            </section>

            {isSubscribed && hasPaidSubscription && !isCanceling && (
              <section className="mt-6 rounded-xl border border-rose-200 bg-white p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-rose-700">
                      <AlertTriangle className="size-4" />
                      <h2 className="text-sm font-black uppercase tracking-[0.18em]">
                        Subscription danger zone
                      </h2>
                    </div>
                    <p className="mt-2 max-w-2xl text-sm text-slate-600">
                      Canceling stops future monthly credit renewals. Before canceling, consider switching to a lower plan or buying one-time credits so generation does not get interrupted.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCancelAcknowledged(false);
                      setShowCancelDialog(true);
                    }}
                    disabled={isSubmitting}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose-300 px-4 py-3 text-sm font-bold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50 lg:w-auto"
                  >
                    <XCircle className="size-4" />
                    Cancel Subscription
                  </button>
                </div>
              </section>
            )}
          </div>
        )}
        {planChangeTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
            <button
              type="button"
              className="absolute inset-0 cursor-default"
              aria-label="Close plan change dialog"
              onClick={() => setPlanChangeTier(null)}
            />

            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="plan-change-title"
              className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-950/10"
            >
              <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">
                    {isPlanChangeUpgrade ? "Upgrade plan" : "Downgrade plan"}
                  </p>
                  <h2 id="plan-change-title" className="mt-1 text-lg font-black text-slate-950">
                    Switch to {planChangeTarget.name}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setPlanChangeTier(null)}
                  aria-label="Close dialog"
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="size-5" />
                </button>
              </header>

              <div className="px-5 py-5">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        {currentPlan?.name || "Current plan"} {"->"} {planChangeTarget.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatCredits(currentPlan?.credits || 0)} credits/month {"->"} {formatCredits(planChangeTarget.credits)} credits/month
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-slate-950">
                        {formatUsd(Math.abs(planChangeTarget.price - (currentPlan?.price || 0)))}
                      </p>
                      <p className="text-xs text-slate-500">
                        {isPlanChangeUpgrade ? "more per month" : "less per month"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 border-t border-slate-200 pt-4 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">Current monthly total</span>
                      <span className="font-bold text-slate-950">{formatUsd(currentPlan?.price || 0)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">New monthly total</span>
                      <span className="font-black text-slate-950">{formatUsd(planChangeTarget.price)}</span>
                    </div>
                  </div>
                </div>

                <p className="mt-4 text-sm leading-6 text-slate-600">
                  {isPlanChangeUpgrade
                    ? `This upgrade invoices the prorated amount immediately and grants prorated credits for the rest of this billing period.`
                    : "This downgrade applies immediately. Stripe prorates the bill, and prorated subscription credits are removed now to prevent extra-credit abuse."}
                </p>
              </div>

              <footer className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setPlanChangeTier(null)}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-white"
                >
                  Keep Current Plan
                </button>
                <button
                  type="button"
                  onClick={handleChangePlan}
                  disabled={isSubmitting}
                  className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-violet-700 disabled:opacity-50"
                >
                  {isSubmitting ? "Updating..." : `Confirm ${isPlanChangeUpgrade ? "Upgrade" : "Downgrade"}`}
                </button>
              </footer>
            </section>
          </div>
        )}

        {showCancelDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-sm">
            <button
              type="button"
              className="absolute inset-0 cursor-default"
              aria-label="Close cancellation dialog"
              onClick={() => {
                setShowCancelDialog(false);
                setCancelAcknowledged(false);
              }}
            />

            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="cancel-subscription-title"
              className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-rose-950/10"
            >
              <header className="flex items-start justify-between gap-4 border-b border-rose-100 bg-rose-50 px-5 py-4">
                <div className="flex gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
                    <AlertTriangle className="size-5" />
                  </span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-700">
                      Final cancellation check
                    </p>
                    <h2 id="cancel-subscription-title" className="mt-1 text-lg font-black text-slate-950">
                      Canceling will stop monthly credit renewals
                    </h2>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowCancelDialog(false);
                    setCancelAcknowledged(false);
                  }}
                  aria-label="Close dialog"
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-white hover:text-slate-700"
                >
                  <X className="size-5" />
                </button>
              </header>

              <div className="space-y-5 px-5 py-5">
                <div className="rounded-xl border border-rose-200 bg-white p-4 text-sm leading-6 text-slate-700">
                  Your subscription remains usable until the end of the billing period, but future recurring credits will stop. Any unused recurring credits expire when the subscription ends.
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {activePlanIndex > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowCancelDialog(false);
                        setCancelAcknowledged(false);
                        setPlanChangeTier(PLANS[activePlanIndex - 1].id);
                      }}
                      className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-left transition hover:bg-violet-100"
                    >
                      <p className="text-sm font-black text-violet-900">
                        Downgrade instead
                      </p>
                      <p className="mt-1 text-xs leading-5 text-violet-700">
                        Keep monthly credits with a lower recurring cost.
                      </p>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setShowCancelDialog(false);
                      setCancelAcknowledged(false);
                      window.setTimeout(() => {
                        document
                          .getElementById("one-time-credits")
                          ?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }, 0);
                    }}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:bg-slate-100"
                  >
                    <p className="text-sm font-black text-slate-950">
                      Buy credits instead
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      One-time credits never expire and can cover lighter usage.
                    </p>
                  </button>
                </div>

                <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={cancelAcknowledged}
                    onChange={(event) => setCancelAcknowledged(event.target.checked)}
                    className="mt-1 size-4 accent-rose-600"
                  />
                  <span>
                    I understand that canceling stops future subscription renewals and monthly credit grants.
                  </span>
                </label>
              </div>

              <footer className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowCancelDialog(false);
                    setCancelAcknowledged(false);
                  }}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-white"
                >
                  Keep Subscription
                </button>
                <button
                  type="button"
                  onClick={handleCancelSubscription}
                  disabled={isSubmitting || !cancelAcknowledged}
                  className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? "Scheduling..." : "Yes, Cancel Subscription"}
                </button>
              </footer>
            </section>
          </div>
        )}

        {isCheckoutOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-3 py-4 backdrop-blur-sm sm:px-6"
            role="presentation"
          >
            <button
              type="button"
              className="absolute inset-0 cursor-default"
              aria-label="Close checkout"
              onClick={closeCheckout}
            />

            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="checkout-title"
              className="relative z-10 grid w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-950/10 lg:max-h-[calc(100dvh-3rem)] lg:grid-cols-[0.8fr_1.2fr]"
            >
              <aside className="bg-slate-950 px-6 py-6 text-white sm:px-8 lg:flex lg:min-h-[680px] lg:flex-col">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-violet-300">
                      Secure checkout
                    </p>
                    <h2 id="checkout-title" className="mt-2 text-2xl font-black">
                      {checkoutSession?.title || "Checkout"}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={closeCheckout}
                    aria-label="Close checkout"
                    className="rounded-lg p-2 text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 lg:hidden"
                  >
                    <X className="size-5" />
                  </button>
                </div>

                <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.06] p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {checkoutSession?.mode === "subscription"
                          ? checkoutPlan?.name || "Subscription"
                          : "One-time credits"}
                      </p>
                      <p className="mt-1 text-xs text-slate-300">
                        {formatCredits(checkoutCredits)} credits
                        {checkoutSession?.mode === "subscription"
                          ? checkoutOverridePlan
                            ? " additional credits every month"
                            : " added every month"
                          : " added to your account"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black tabular-nums">
                        {formatUsd(checkoutPrice)}
                      </p>
                      {checkoutSession?.mode === "subscription" && (
                        <p className="text-xs text-slate-400">
                          {checkoutSession?.overrideTier ? "additional per month" : "per month"}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 border-t border-white/10 pt-5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-300">Subtotal</span>
                      <span className="font-semibold">
                        {formatUsd(checkoutSubtotalPrice)}
                        {checkoutSession?.mode === "subscription" ? "/month" : ""}
                      </span>
                    </div>
                    {checkoutDiscountPrice > 0 && (
                      <div className="mt-3 flex items-center justify-between text-sm">
                        <span className="text-slate-300">
                          Coupon{checkoutSession?.couponCode ? ` (${checkoutSession.couponCode})` : ""}
                        </span>
                        <span className="font-semibold text-emerald-300">
                          -{formatUsd(checkoutDiscountPrice)}
                        </span>
                      </div>
                    )}
                    <div className="mt-3 flex items-center justify-between rounded-xl bg-white/10 px-3 py-2 text-sm">
                      <span className="text-slate-200">
                        {checkoutSession?.mode === "subscription"
                          ? checkoutOverridePlan
                            ? "Due now, then additional monthly"
                            : "Due now, then monthly"
                          : "Due now"}
                      </span>
                      <span className="font-black">
                        {formatUsd(checkoutPrice)}
                        {checkoutSession?.mode === "subscription" ? "/month" : ""}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 border-t border-white/10 pt-5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-300">Available now</span>
                      <span className="font-semibold">{formatCredits(credits?.balance)} credits</span>
                    </div>
                    {checkoutSession?.mode === "subscription" && checkoutOverridePlan && (
                      <>
                        <div className="mt-3 flex items-center justify-between text-sm">
                          <span className="text-slate-300">Included admin plan</span>
                          <span className="font-semibold">
                            {checkoutOverridePlan.name.replace(" Plan", "")} ({formatUsd(checkoutOverridePlan.price)}/month value)
                          </span>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-sm">
                          <span className="text-slate-300">Additional monthly charge</span>
                          <span className="font-semibold">{formatUsd(checkoutPrice)}/month</span>
                        </div>
                        <div className="mt-3 flex items-center justify-between rounded-xl bg-white/10 px-3 py-2 text-sm">
                          <span className="text-slate-200">New monthly total</span>
                          <span className="font-black">{formatUsd(checkoutMonthlyTotal)}/month</span>
                        </div>
                      </>
                    )}
                    {checkoutSession?.mode === "subscription" && !checkoutOverridePlan && (
                      <div className="mt-3 flex items-center justify-between rounded-xl bg-white/10 px-3 py-2 text-sm">
                        <span className="text-slate-200">Monthly total</span>
                        <span className="font-black">{formatUsd(checkoutMonthlyTotal)}/month</span>
                      </div>
                    )}
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="text-slate-300">
                        {checkoutSession?.mode === "subscription"
                          ? checkoutOverridePlan
                            ? "Additional allowance"
                            : "Monthly allowance"
                          : "Top-up amount"}
                      </span>
                      <span className="font-semibold">{formatCredits(checkoutCredits)} credits</span>
                    </div>
                  </div>
                </div>

                <ul className="mt-6 space-y-3 text-sm text-slate-200">
                  <li className="flex gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-300" />
                    <span>Credits are applied after Stripe confirms payment.</span>
                  </li>
                  <li className="flex gap-2.5">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-violet-300" />
                    <span>Payment details are handled securely by Stripe.</span>
                  </li>
                </ul>

                <div className="mt-auto hidden pt-8 text-xs leading-5 text-slate-400 lg:block">
                  Bookify never stores full card details. Close this checkout any time to return to your plan selection.
                </div>
              </aside>

              <div className="relative max-h-[calc(100dvh-3rem)] overflow-y-auto bg-slate-50 px-4 py-4 sm:px-6 sm:py-6 lg:bg-white">
                <button
                  type="button"
                  onClick={closeCheckout}
                  aria-label="Close checkout"
                  className="absolute right-4 top-4 z-10 hidden rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 lg:inline-flex"
                >
                  <X className="size-5" />
                </button>

                <div className="mx-auto max-w-[560px] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="mb-5">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">
                      Payment details
                    </p>
                    <h3 className="mt-1 text-xl font-black text-slate-950">
                      Complete your purchase
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Stripe will show saved payment options first when available.
                    </p>
                  </div>

                  {checkoutSession?.stripePromise && checkoutOptions ? (
                    <Elements
                      stripe={checkoutSession.stripePromise}
                      options={checkoutOptions}
                      key={checkoutSession.clientSecret}
                    >
                      <StripePaymentForm
                        checkoutSession={checkoutSession}
                        checkoutPrice={checkoutPrice}
                        customerEmail={user?.email || ""}
                        fetchCredits={fetchCredits}
                        onApplyCoupon={handleApplyCheckoutCoupon}
                        onClose={closeCheckout}
                      />
                    </Elements>
                  ) : (
                    <div className="h-96 animate-pulse rounded-xl bg-slate-100" />
                  )}
                </div>
              </div>
            </section>
          </div>
        )}
      </main>
    </DashboardLayout>
  );
}

export default CreditsPage;
