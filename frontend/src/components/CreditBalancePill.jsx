import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { Coins } from "lucide-react";
import axiosInstance from "../lib/axios";
import { API_ENDPOINTS } from "../utils/api-endpoints";

function formatCredits(value) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number(value) % 1 ? 2 : 0,
  }).format(Number(value || 0));
}

function CreditBalancePill({ compact = false }) {
  const [credits, setCredits] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchCredits = useCallback(async () => {
    const token = localStorage.getItem("token");

    if (!token) return;

    setIsLoading(true);

    try {
      const { data } = await axiosInstance.get(API_ENDPOINTS.CREDITS.GET, {
        params: { summaryOnly: true },
      });
      setCredits(data.credits);
    } catch (error) {
      console.error("Error loading credits:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCredits();

    const handleRefresh = () => fetchCredits();
    const interval = window.setInterval(fetchCredits, 30000);

    window.addEventListener("credits:refresh", handleRefresh);
    window.addEventListener("focus", handleRefresh);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("credits:refresh", handleRefresh);
      window.removeEventListener("focus", handleRefresh);
    };
  }, [fetchCredits]);

  return (
    <Link
      to="/credits"
      className="inline-flex items-center gap-2 rounded-lg border border-violet-100 bg-violet-50 px-2.5 py-2 text-violet-950 shadow-sm transition-colors hover:bg-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
      aria-label="View credits and transactions"
    >
      <Coins className="size-4 text-violet-600" />
      <span className="text-sm font-semibold tabular-nums">
        {isLoading && credits === null ? "..." : formatCredits(credits?.balance)}
      </span>
      {!compact && (
        <span className="hidden sm:inline text-xs font-medium text-violet-600">
          credits
        </span>
      )}
    </Link>
  );
}

export default CreditBalancePill;
