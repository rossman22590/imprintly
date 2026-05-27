import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import toast from "react-hot-toast";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  RotateCcw,
  Square,
  TriangleAlert,
} from "lucide-react";
import DashboardLayout from "../layouts/DashboardLayout";
import axiosInstance from "../lib/axios";
import { API_ENDPOINTS } from "../utils/api-endpoints";
import { Button } from "../components";

const STATUS_META = {
  queued: {
    label: "Queued",
    icon: Clock3,
    className: "bg-amber-50 text-amber-700 border-amber-200",
    barClassName: "bg-amber-500",
  },
  generating: {
    label: "Generating",
    icon: Loader2,
    className: "bg-sky-50 text-sky-700 border-sky-200",
    barClassName: "bg-sky-500",
  },
  cancelling: {
    label: "Cancelling",
    icon: Loader2,
    className: "bg-slate-50 text-slate-700 border-slate-200",
    barClassName: "bg-slate-500",
  },
  cancelled: {
    label: "Cancelled",
    icon: Square,
    className: "bg-gray-50 text-gray-700 border-gray-200",
    barClassName: "bg-gray-400",
  },
  complete: {
    label: "Complete",
    icon: CheckCircle2,
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    barClassName: "bg-emerald-500",
  },
  failed: {
    label: "Failed",
    icon: TriangleAlert,
    className: "bg-rose-50 text-rose-700 border-rose-200",
    barClassName: "bg-rose-500",
  },
};

function formatDate(value) {
  if (!value) return "Not started";

  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "Unknown";
  }
}

function getProgressPercent(job) {
  const total = Number(job?.progress?.total) || 0;
  const completed =
    (Number(job?.progress?.completed) || 0) +
    (Number(job?.progress?.failed) || 0);

  if (job?.status === "complete") return 100;
  if (job?.status === "queued") return 0;
  if (!total) return job?.status === "generating" ? 8 : 0;

  return Math.min(100, Math.max(0, Math.round((completed / total) * 100)));
}

function JobStatusPill({ job }) {
  const meta = STATUS_META[job.status] || STATUS_META.queued;
  const Icon = meta.icon;

  return (
    <span
      className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold ${meta.className}`}
    >
      <Icon
        className={`size-3.5 ${
          ["generating", "cancelling"].includes(job.status) ? "animate-spin" : ""
        }`}
      />
      {meta.label}
    </span>
  );
}

function JobRow({ job, queuePosition, isMutating, onCancel, onRetry }) {
  const meta = STATUS_META[job.status] || STATUS_META.queued;
  const percent = getProgressPercent(job);
  const hasFailedSteps = Number(job?.progress?.failed || 0) > 0;
  const canCancel = ["queued", "generating"].includes(job.status);
  const canRetry = job.status === "failed" && job.bookId;
  const jobDetail =
    job.status === "queued" && queuePosition
      ? `Queue position ${queuePosition}`
      : job.progress?.currentChapterTitle ||
        job.progress?.message ||
        "Waiting for the queue";

  return (
    <li className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <JobStatusPill job={job} />
            <span className="text-xs font-medium text-gray-500">
              {formatDate(job.createdAt)}
            </span>
            {job.retryFailedOnly ? (
              <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
                Retry
              </span>
            ) : null}
          </div>

          <h2 className="truncate text-base font-semibold text-gray-950">
            {job.bookTitle || "Untitled book"}
          </h2>
          <p className="mt-1 truncate text-sm text-gray-500">
            {jobDetail}
          </p>
          {job.error ? (
            <p className="mt-2 text-sm text-rose-600">{job.error}</p>
          ) : null}

          <div className="mt-4">
            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full transition-all duration-500 ${meta.barClassName} ${
                  job.status === "generating" && percent < 10 ? "animate-pulse" : ""
                }`}
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
              <span>{percent}%</span>
              <span>
                {(job.progress?.completed || 0) + (job.progress?.failed || 0)} /{" "}
                {job.progress?.total || 0} steps
              </span>
              {hasFailedSteps ? (
                <span className="font-semibold text-rose-600">
                  {job.progress.failed} failed
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:items-center">
          {job.bookId ? (
            <Link
              to={`/books/${job.bookId}/edit`}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-gray-300 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
            >
              Book
              <ArrowRight className="size-4" />
            </Link>
          ) : null}

          {canCancel ? (
            <Button
              type="button"
              variant="secondary"
              icon={Square}
              isLoading={isMutating}
              onClick={() => onCancel(job)}
            >
              Cancel
            </Button>
          ) : null}

          {canRetry ? (
            <Button
              type="button"
              variant="secondary"
              icon={RotateCcw}
              isLoading={isMutating}
              onClick={() => onRetry(job)}
            >
              Retry
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function JobsPage() {
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mutatingJobId, setMutatingJobId] = useState("");
  const [showFailed, setShowFailed] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState(null);

  const fetchJobs = useCallback(async ({ silent = false } = {}) => {
    if (silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const { data } = await axiosInstance.get(API_ENDPOINTS.AI.FULL_BOOK_JOBS);
      setJobs(Array.isArray(data?.jobs) ? data.jobs : []);
      setLastLoadedAt(new Date());
    } catch (error) {
      console.error("Error fetching generation jobs:", error);
      toast.error("Failed to load jobs.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const hasLiveJobs = jobs.some((job) =>
    ["queued", "generating", "cancelling"].includes(job.status)
  );

  useEffect(() => {
    if (!hasLiveJobs) return undefined;

    const intervalId = window.setInterval(() => {
      fetchJobs({ silent: true });
    }, 3500);

    return () => window.clearInterval(intervalId);
  }, [fetchJobs, hasLiveJobs]);

  const counts = useMemo(
    () =>
      jobs.reduce(
        (result, job) => {
          if (job.status === "generating") result.generating += 1;
          else if (job.status === "queued") result.queued += 1;
          else if (job.status === "complete") result.complete += 1;
          else if (job.status === "failed") result.failed += 1;
          else if (job.status === "cancelled") result.cancelled += 1;
          return result;
        },
        { generating: 0, queued: 0, complete: 0, failed: 0, cancelled: 0 }
      ),
    [jobs]
  );
  const hiddenFailedCount = counts.failed + counts.cancelled;
  const sortedJobs = useMemo(() => {
    const statusRank = {
      generating: 0,
      cancelling: 0,
      queued: 1,
      complete: 2,
      failed: 3,
      cancelled: 4,
    };

    return [...jobs].sort((a, b) => {
      const aRank = statusRank[a.status] ?? 5;
      const bRank = statusRank[b.status] ?? 5;

      if (aRank !== bRank) return aRank - bRank;

      if (["queued", "generating", "cancelling"].includes(a.status)) {
        return new Date(a.createdAt) - new Date(b.createdAt);
      }

      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }, [jobs]);
  const visibleJobs = useMemo(
    () => {
      if (showFailed) {
        return sortedJobs.filter((job) =>
          ["failed", "cancelled"].includes(job.status)
        );
      }

      return sortedJobs.filter(
        (job) => !["failed", "cancelled"].includes(job.status)
      );
    },
    [showFailed, sortedJobs]
  );
  const queuedPositions = useMemo(() => {
    const entries = jobs
      .filter((job) => job.status === "queued")
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .map((job, index) => [job.id, index + 1]);

    return new Map(entries);
  }, [jobs]);

  const handleCancel = async (job) => {
    setMutatingJobId(job.id);

    try {
      await axiosInstance.delete(`${API_ENDPOINTS.AI.FULL_BOOK_JOBS}/${job.id}`);
      toast.success(
        job.status === "queued"
          ? "Queued job cancelled."
          : "Generation will cancel after the current chapter."
      );
      await fetchJobs({ silent: true });
    } catch (error) {
      console.error("Error cancelling generation job:", error);
      toast.error("Failed to cancel job.");
    } finally {
      setMutatingJobId("");
    }
  };

  const handleRetry = async (job) => {
    setMutatingJobId(job.id);

    try {
      await axiosInstance.post(
        `${API_ENDPOINTS.AI.FULL_BOOK_JOBS}/${job.id}/retry`
      );
      toast.success("Retry queued.");
      await fetchJobs({ silent: true });
    } catch (error) {
      console.error("Error retrying generation job:", error);
      toast.error("Failed to retry job.");
    } finally {
      setMutatingJobId("");
    }
  };

  return (
    <DashboardLayout>
      <main className="min-h-full bg-gray-50">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
          <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">
                Generation queue
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-950">
                Jobs
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                One full-book generation runs at a time. New books wait here until
                the current job finishes.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              {hiddenFailedCount > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  icon={TriangleAlert}
                  onClick={() => setShowFailed((value) => !value)}
                >
                  {showFailed
                    ? "Show active"
                    : `Show failed (${hiddenFailedCount})`}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                icon={RefreshCw}
                isLoading={isRefreshing}
                onClick={() => fetchJobs({ silent: true })}
              >
                Refresh
              </Button>
            </div>
          </header>

          <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ["Generating", counts.generating],
              ["Queued", counts.queued],
              ["Complete", counts.complete],
              ["Hidden failed", hiddenFailedCount],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
              >
                <p className="text-xs font-semibold uppercase text-gray-500">
                  {label}
                </p>
                <p className="mt-1 text-2xl font-bold text-gray-950">{value}</p>
              </div>
            ))}
          </section>

          {lastLoadedAt ? (
            <p className="mb-3 text-xs text-gray-500">
              Updated {formatDate(lastLoadedAt)}
            </p>
          ) : null}

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="h-36 animate-pulse rounded-xl border border-gray-200 bg-white shadow-sm"
                />
              ))}
            </div>
          ) : visibleJobs.length ? (
            <ul className="space-y-3">
              {visibleJobs.map((job) => (
                <JobRow
                  key={job.id}
                  job={job}
                  queuePosition={queuedPositions.get(job.id)}
                  isMutating={mutatingJobId === job.id}
                  onCancel={handleCancel}
                  onRetry={handleRetry}
                />
              ))}
            </ul>
          ) : jobs.length ? (
            <section className="rounded-xl border-2 border-dashed border-gray-200 bg-white px-6 py-16 text-center">
              <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                <TriangleAlert className="size-7" />
              </div>
              <h2 className="text-lg font-semibold text-gray-950">
                {showFailed ? "No failed jobs" : "Only hidden failed jobs"}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
                {showFailed
                  ? "There are no failed or cancelled jobs in the current history."
                  : "Failed and cancelled jobs are hidden by default. Use Show failed to review them."}
              </p>
            </section>
          ) : (
            <section className="rounded-xl border-2 border-dashed border-gray-200 bg-white px-6 py-16 text-center">
              <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                <Clock3 className="size-7" />
              </div>
              <h2 className="text-lg font-semibold text-gray-950">
                No generation jobs yet
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
                Full-book AI jobs appear here as queued, generating, complete, or
                failed.
              </p>
            </section>
          )}
        </div>
      </main>
    </DashboardLayout>
  );
}

export default JobsPage;
