import { createElement, useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Link } from "react-router";
import {
  Activity,
  Ban,
  BookOpen,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import DashboardLayout from "../layouts/DashboardLayout";
import axiosInstance from "../lib/axios";
import { API_ENDPOINTS } from "../utils/api-endpoints";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Modal from "../components/ui/Modal";
import Select from "../components/ui/Select";

const RUN_STATUS_OPTIONS = [
  { label: "All statuses", value: "" },
  { label: "Successes", value: "complete" },
  { label: "Failures", value: "failed" },
  { label: "Running", value: "generating" },
  { label: "Queued", value: "queued" },
  { label: "Cancelling", value: "cancelling" },
  { label: "Cancelled", value: "cancelled" },
];

const RUN_PROVIDER_OPTIONS = [
  { label: "All providers", value: "" },
  { label: "Gemini", value: "gemini" },
  { label: "Groq", value: "groq" },
];

const RUN_STATUS_META = {
  complete: {
    label: "Success",
    icon: CheckCircle2,
    className: "bg-emerald-100 text-emerald-700",
  },
  failed: {
    label: "Failed",
    icon: XCircle,
    className: "bg-rose-100 text-rose-700",
  },
  generating: {
    label: "Running",
    icon: RefreshCw,
    className: "bg-sky-100 text-sky-700",
  },
  queued: {
    label: "Queued",
    icon: Clock3,
    className: "bg-amber-100 text-amber-700",
  },
  cancelling: {
    label: "Cancelling",
    icon: RefreshCw,
    className: "bg-orange-100 text-orange-700",
  },
  cancelled: {
    label: "Cancelled",
    icon: Ban,
    className: "bg-slate-100 text-slate-600",
  },
};

const BOOK_GENERATION_STATUS_META = {
  complete: RUN_STATUS_META.complete,
  failed: RUN_STATUS_META.failed,
  generating: RUN_STATUS_META.generating,
  queued: RUN_STATUS_META.queued,
  cancelling: RUN_STATUS_META.cancelling,
  cancelled: RUN_STATUS_META.cancelled,
  manual: {
    label: "Manual",
    icon: BookOpen,
    className: "bg-slate-100 text-slate-600",
  },
  outline: {
    label: "Outline",
    icon: BookOpen,
    className: "bg-violet-100 text-violet-700",
  },
};

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "Never";
}

function formatRunId(id = "") {
  const value = String(id || "");

  return value.length > 13 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
}

function getProgressPercent(value, total) {
  const numericTotal = Number(total || 0);

  if (!numericTotal) return 0;

  return Math.min(100, Math.max(0, (Number(value || 0) / numericTotal) * 100));
}

function StatBlock({ icon, label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-slate-500 text-xs font-semibold uppercase tracking-wide">
          {label}
        </span>
        <span className="size-8 rounded-lg bg-slate-100 flex items-center justify-center">
          {createElement(icon, { className: "size-4 text-slate-600" })}
        </span>
      </div>
      <p className="text-slate-950 text-2xl font-bold mt-3 tabular-nums">
        {value}
      </p>
    </div>
  );
}

function DetailRow({ label, value, mono = false }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p
        className={`mt-1 text-sm text-slate-900 break-words ${
          mono ? "font-mono" : "font-medium"
        }`}
      >
        {value || "Not set"}
      </p>
    </div>
  );
}

function StatusBadge({ status = "", metaMap = RUN_STATUS_META }) {
  const meta = metaMap[status] || {
    label: status || "Unknown",
    icon: Clock3,
    className: "bg-slate-100 text-slate-600",
  };
  const StatusIcon = meta.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.className}`}
    >
      <StatusIcon className="size-3" />
      {meta.label}
    </span>
  );
}

function RunProgressCell({ progress = {} }) {
  const total = Number(progress.total || 0);
  const completed = Number(progress.completed || 0);
  const failed = Number(progress.failed || 0);
  const completedPercent = getProgressPercent(completed, total);
  const failedPercent = getProgressPercent(failed, total);

  if (!total) {
    return (
      <div className="ml-auto w-44 max-w-full text-right">
        <p className="text-slate-500 text-xs">No progress yet</p>
        {progress.message && (
          <p className="mt-1 text-slate-400 text-xs truncate">
            {progress.message}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="ml-auto w-44 max-w-full text-right">
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden relative">
        <span
          className="absolute inset-y-0 left-0 bg-emerald-500"
          style={{ width: `${completedPercent}%` }}
        />
        <span
          className="absolute inset-y-0 bg-rose-500"
          style={{
            left: `${completedPercent}%`,
            width: `${Math.min(failedPercent, 100 - completedPercent)}%`,
          }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold text-slate-700 tabular-nums">
          {completed + failed}/{total}
        </span>
        <span className="text-slate-500 tabular-nums">
          {completed} ok - {failed} fail
        </span>
      </div>
      {progress.message && (
        <p className="mt-1 text-slate-400 text-xs truncate">
          {progress.message}
        </p>
      )}
    </div>
  );
}

function BookResultSummary({ book }) {
  const counts = book?.chapterStatusCounts;

  if (!book?._id) {
    return <p className="text-xs text-slate-400">No book linked</p>;
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
      <StatusBadge
        status={book.generationStatus || "manual"}
        metaMap={BOOK_GENERATION_STATUS_META}
      />
      <span className="text-emerald-700 font-semibold tabular-nums">
        {counts?.complete || 0} chapter ok
      </span>
      <span className="text-rose-700 font-semibold tabular-nums">
        {counts?.failed || 0} failed
      </span>
      <span className="text-slate-400 tabular-nums">
        {counts?.total || 0} total
      </span>
    </div>
  );
}

function RunFailureSummary({ run }) {
  const failures = Array.isArray(run.failedChapters) ? run.failedChapters : [];
  const firstFailure = failures[0];
  const failureCount = failures.length || (run.error ? 1 : 0);

  if (!run.error && failures.length === 0) {
    return (
      <p className="text-xs font-semibold text-emerald-700">
        No failures logged
      </p>
    );
  }

  return (
    <div className="w-full max-w-full min-w-0 space-y-1">
      <p className="text-xs font-semibold text-rose-700">
        {failureCount} failure{failureCount === 1 ? "" : "s"}
      </p>
      {run.error && (
        <p className="max-w-full overflow-hidden truncate text-xs text-slate-600">
          {run.error}
        </p>
      )}
      {firstFailure && (
        <div className="min-w-0">
          <p className="max-w-full overflow-hidden truncate text-xs font-semibold text-rose-700">
            {firstFailure.title ||
              `Step ${Number(firstFailure.index || 0) + 1}`}
          </p>
          <p className="max-w-full overflow-hidden truncate text-xs text-slate-600">
            {firstFailure.error || "Generation failed."}
          </p>
        </div>
      )}
      {failures.length > 1 && (
        <p className="text-xs text-slate-400">+{failures.length - 1} more</p>
      )}
    </div>
  );
}

function RunDetailsModal({ isOpen, onClose, run }) {
  const failures = Array.isArray(run?.failedChapters)
    ? run.failedChapters
    : [];
  const progress = run?.progress || {};
  const chapterCounts = run?.book?.chapterStatusCounts || {};

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={run ? `Run ${formatRunId(run.id)}` : "Run details"}
      sizeClassName="max-w-[min(72rem,calc(100vw-1rem))]"
    >
      {!run ? (
        <div className="py-16 text-center text-slate-500">Run not found.</div>
      ) : (
        <div className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={run.status} />
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 uppercase">
                    {run.provider}
                  </span>
                  {run.retryFailedOnly && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                      Retry
                    </span>
                  )}
                </div>
                <h2 className="mt-3 text-xl font-bold text-slate-950">
                  {run.book?.title || run.payloadTitle || "Untitled run"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {run.book?.author || "Unknown author"}
                  {run.book?.genre ? ` - ${run.book.genre}` : ""}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-emerald-50 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase text-emerald-700">
                    Ok
                  </p>
                  <p className="text-xl font-bold text-emerald-950 tabular-nums">
                    {progress.completed || 0}
                  </p>
                </div>
                <div className="rounded-lg bg-rose-50 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase text-rose-700">
                    Fail
                  </p>
                  <p className="text-xl font-bold text-rose-950 tabular-nums">
                    {progress.failed || 0}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase text-slate-500">
                    Total
                  </p>
                  <p className="text-xl font-bold text-slate-950 tabular-nums">
                    {progress.total || 0}
                  </p>
                </div>
              </div>
            </div>

            {run.book?._id && (
              <Link
                to={`/books/${run.book._id}/edit`}
                className="mt-4 inline-flex h-9 items-center justify-center rounded-lg bg-slate-950 px-3 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
              >
                Open book
              </Link>
            )}
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <DetailRow label="Full run ID" value={run.id} mono />
            <DetailRow label="Book ID" value={run.book?._id || "No book linked"} mono />
            <DetailRow label="Created" value={formatDate(run.createdAt)} />
            <DetailRow label="Completed" value={formatDate(run.completedAt)} />
            <DetailRow label="Chapters ok" value={chapterCounts.complete || 0} />
            <DetailRow label="Chapters failed" value={chapterCounts.failed || 0} />
            <DetailRow label="Chapters total" value={chapterCounts.total || 0} />
            <DetailRow
              label="Progress message"
              value={progress.message || "No message"}
            />
          </section>

          <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <header className="px-4 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-950">
                Failure reasons
              </h3>
              <span className="text-xs text-slate-500">
                {failures.length} logged
              </span>
            </header>

            {run.error || failures.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase text-slate-500">
                        Step
                      </th>
                      <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase text-slate-500">
                        Reason
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {run.error && (
                      <tr>
                        <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                          Job
                        </td>
                        <td className="px-4 py-3 text-sm text-rose-700 break-words">
                          {run.error}
                        </td>
                      </tr>
                    )}
                    {failures.map((failure, index) => (
                      <tr key={`${failure.title || "failure"}-${index}`}>
                        <td className="px-4 py-3 min-w-64">
                          <p className="text-sm font-semibold text-slate-900">
                            {failure.title ||
                              `Step ${Number(failure.index || 0) + 1}`}
                          </p>
                          <p className="mt-1 text-xs text-slate-400 tabular-nums">
                            Index {failure.index ?? "n/a"}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-sm text-rose-700 break-words">
                          {failure.error || "Generation failed."}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-4 py-10 text-sm text-slate-500">
                No failure reasons were logged for this run.
              </p>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}

function RunsPage() {
  const [runsList, setRunsList] = useState([]);
  const [runsSummary, setRunsSummary] = useState(null);
  const [runsPagination, setRunsPagination] = useState(null);
  const [selectedRun, setSelectedRun] = useState(null);
  const [runSearch, setRunSearch] = useState("");
  const [runStatusFilter, setRunStatusFilter] = useState("failed");
  const [runProviderFilter, setRunProviderFilter] = useState("");
  const [runsPage, setRunsPage] = useState(1);
  const [isRunsLoading, setIsRunsLoading] = useState(true);
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);
  const [showNonSuccessRuns, setShowNonSuccessRuns] = useState(false);

  const effectiveStatusFilter = showNonSuccessRuns
    ? runStatusFilter
    : "complete";

  const fetchRuns = useCallback(async () => {
    setIsRunsLoading(true);

    try {
      const { data } = await axiosInstance.get(API_ENDPOINTS.AI.RUNS, {
        params: {
          search: runSearch,
          status: effectiveStatusFilter,
          provider: runProviderFilter,
          page: runsPage,
          limit: 25,
        },
      });

      setRunsList(data.runs || []);
      setRunsSummary(data.summary || null);
      setRunsPagination(data.pagination || null);
    } catch (error) {
      console.error("Error fetching generation runs:", error);
      toast.error(error.response?.data?.error || "Failed to load runs.");
    } finally {
      setIsRunsLoading(false);
    }
  }, [effectiveStatusFilter, runProviderFilter, runSearch, runsPage]);

  useEffect(() => {
    const timer = window.setTimeout(fetchRuns, 250);

    return () => window.clearTimeout(timer);
  }, [fetchRuns]);

  useEffect(() => {
    setRunsPage(1);
  }, [effectiveStatusFilter, runProviderFilter, runSearch]);

  const handleOpenRunDetails = (run) => {
    setSelectedRun(run);
    setIsRunModalOpen(true);
  };

  return (
    <DashboardLayout>
      <main className="container max-w-7xl p-4 md:p-6 mx-auto">
        <header className="mb-6 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <p className="text-violet-600 text-xs font-semibold uppercase tracking-wide">
              Generation History
            </p>
            <h1 className="text-slate-950 text-2xl md:text-3xl font-bold mt-1">
              Runs
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Review your full-book generation runs, progress, and failure
              details.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              type="button"
              variant={showNonSuccessRuns ? "secondary" : "outline"}
              icon={showNonSuccessRuns ? CheckCircle2 : XCircle}
              onClick={() => {
                if (showNonSuccessRuns) {
                  setShowNonSuccessRuns(false);
                } else {
                  setRunStatusFilter("failed");
                  setShowNonSuccessRuns(true);
                }
              }}
              className="w-full sm:w-auto"
            >
              {showNonSuccessRuns ? "Show successes only" : "Show failed runs"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              icon={RefreshCw}
              onClick={fetchRuns}
              isLoading={isRunsLoading}
              className="w-full sm:w-auto"
            >
              Refresh
            </Button>
          </div>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          <StatBlock
            icon={Activity}
            label="Runs"
            value={runsSummary?.totalRuns || 0}
          />
          <StatBlock
            icon={CheckCircle2}
            label="Successes"
            value={runsSummary?.successfulRuns || 0}
          />
          <StatBlock
            icon={XCircle}
            label="Failures"
            value={runsSummary?.failedRuns || 0}
          />
          <StatBlock
            icon={Clock3}
            label="Active"
            value={runsSummary?.activeRuns || 0}
          />
          <StatBlock
            icon={BookOpen}
            label="Books"
            value={runsSummary?.totalBooks || 0}
          />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr),12rem,12rem] gap-3">
            <Input
              icon={Search}
              label="Search runs"
              name="user-run-search"
              value={runSearch}
              onChange={(event) => setRunSearch(event.target.value)}
              placeholder="Run ID, book, author, or error"
            />
            <Select
              label="Result"
              name="user-run-status-filter"
              value={showNonSuccessRuns ? runStatusFilter : "complete"}
              onChange={(event) => setRunStatusFilter(event.target.value)}
              options={RUN_STATUS_OPTIONS}
              disabled={!showNonSuccessRuns}
            />
            <Select
              label="Provider"
              name="user-run-provider-filter"
              value={runProviderFilter}
              onChange={(event) => setRunProviderFilter(event.target.value)}
              options={RUN_PROVIDER_OPTIONS}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full table-fixed divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <th className="w-[8.5rem] px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Run
                  </th>
                  <th className="w-[30%] px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Book
                  </th>
                  <th className="w-[7.5rem] px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Result
                  </th>
                  <th className="w-[13rem] px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                    Progress
                  </th>
                  <th className="w-[17rem] px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Failures
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isRunsLoading ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="px-4 py-10 text-center text-slate-500 text-sm"
                    >
                      Loading runs...
                    </td>
                  </tr>
                ) : runsList.length === 0 ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="px-4 py-10 text-center text-slate-500 text-sm"
                    >
                      {showNonSuccessRuns
                        ? "No generation runs found."
                        : "No successful generation runs found."}
                    </td>
                  </tr>
                ) : (
                  runsList.map((run) => (
                    <tr key={run.id} className="align-top hover:bg-slate-50/70">
                      <td className="px-4 py-4 overflow-hidden">
                        <p className="font-mono text-xs font-semibold text-slate-900">
                          {formatRunId(run.id)}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 uppercase">
                            {run.provider}
                          </span>
                          {run.retryFailedOnly && (
                            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                              Retry
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 overflow-hidden">
                        <p className="truncate text-sm font-semibold text-slate-950">
                          {run.book?.title || run.payloadTitle || "Untitled run"}
                        </p>
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {run.book?.author || "Unknown author"}
                          {run.book?.genre ? ` - ${run.book.genre}` : ""}
                        </p>
                        <BookResultSummary book={run.book} />
                      </td>
                      <td className="px-4 py-4 overflow-hidden">
                        <StatusBadge status={run.status} />
                      </td>
                      <td className="px-4 py-4 overflow-hidden text-right">
                        <RunProgressCell progress={run.progress} />
                      </td>
                      <td className="px-4 py-4 overflow-hidden">
                        <RunFailureSummary run={run} />
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="mt-3"
                          onClick={() => handleOpenRunDetails(run)}
                        >
                          Details
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {runsPagination && runsPagination.pages > 1 && (
            <div className="p-4 border-t border-slate-200 flex items-center justify-between gap-3">
              <p className="text-slate-500 text-xs">
                Page {runsPagination.page} of {runsPagination.pages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={runsPage <= 1}
                  onClick={() =>
                    setRunsPage((current) => Math.max(1, current - 1))
                  }
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={runsPage >= runsPagination.pages}
                  onClick={() => setRunsPage((current) => current + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </section>
      </main>

      <RunDetailsModal
        isOpen={isRunModalOpen}
        onClose={() => setIsRunModalOpen(false)}
        run={selectedRun}
      />
    </DashboardLayout>
  );
}

export default RunsPage;
