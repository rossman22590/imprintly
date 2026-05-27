import { createElement, useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  Activity,
  BadgeDollarSign,
  Ban,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Coins,
  Crown,
  Gem,
  History,
  Mail,
  Minus,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserCog,
  Users,
  XCircle,
} from "lucide-react";
import DashboardLayout from "../layouts/DashboardLayout";
import { useAuthContext } from "../contexts/AuthContext";
import axiosInstance from "../lib/axios";
import { API_ENDPOINTS } from "../utils/api-endpoints";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Modal from "../components/ui/Modal";
import Select from "../components/ui/Select";

function formatCredits(value) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 4,
    minimumFractionDigits: Number(value) % 1 ? 2 : 0,
  }).format(Number(value || 0));
}

const DEFAULT_MONTHLY_CREDIT_PRESETS = [
  { id: "premium", label: "Premium", amount: 500, icon: Crown },
  { id: "ultra", label: "Ultra", amount: 1000, icon: Gem },
];

function normalizeMonthlyCreditPresets(plans = []) {
  return DEFAULT_MONTHLY_CREDIT_PRESETS.map((defaultPlan) => {
    const savedPlan = Array.isArray(plans)
      ? plans.find((plan) => plan.id === defaultPlan.id)
      : plans?.[defaultPlan.id];
    const amount = Number(savedPlan?.amount ?? savedPlan?.monthlyCredits);

    return {
      ...defaultPlan,
      amount:
        Number.isFinite(amount) && amount > 0 ? amount : defaultPlan.amount,
    };
  });
}

function buildPlanForm(plans) {
  return plans.reduce(
    (form, plan) => ({
      ...form,
      [plan.id]: String(plan.amount),
    }),
    {}
  );
}

function getMonthlyPresetForAmount(
  amount,
  presets = DEFAULT_MONTHLY_CREDIT_PRESETS
) {
  const numericAmount = Number(amount || 0);
  const preset = presets.find(
    (option) => option.amount === numericAmount
  );

  return numericAmount > 0 ? preset?.id || "custom" : "";
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "Never";
}

function transactionIsNegative(transaction) {
  return (
    transaction?.type === "debit" ||
    transaction?.metadata?.direction === "remove"
  );
}

function getInitials(name = "", email = "") {
  const label = name || email || "?";

  return label
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const ADMIN_TABS = [
  { id: "users", label: "Users", icon: Users },
  { id: "jobs", label: "Jobs", icon: Activity },
];

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

function CreditActionButton({ active, icon, children, ...props }) {
  return (
    <button
      type="button"
      className={`h-10 rounded-lg border px-3 text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors ${
        active
          ? "border-violet-300 bg-violet-50 text-violet-800"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
      {...props}
    >
      {createElement(icon, { className: "size-4" })}
      {children}
    </button>
  );
}

function AccountStatusBadge({ status = "active" }) {
  const isBanned = status === "banned";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
        isBanned
          ? "bg-rose-100 text-rose-700"
          : "bg-emerald-100 text-emerald-700"
      }`}
    >
      {isBanned ? (
        <Ban className="size-3" />
      ) : (
        <ShieldCheck className="size-3" />
      )}
      {isBanned ? "Banned" : "Active"}
    </span>
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

function AdminTabs({ activeView, onChange }) {
  return (
    <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
      {ADMIN_TABS.map((tab) => {
        const TabIcon = tab.icon;
        const isActive = activeView === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`h-10 rounded-lg px-3 text-sm font-semibold inline-flex items-center gap-2 transition-colors ${
              isActive
                ? "bg-slate-950 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
            }`}
          >
            <TabIcon className="size-4" />
            {tab.label}
          </button>
        );
      })}
    </div>
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
  const failures = Array.isArray(run.failedChapters)
    ? run.failedChapters
    : [];
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
        <p className="text-xs text-slate-400">
          +{failures.length - 1} more
        </p>
      )}
    </div>
  );
}

function RunsPanel({
  runsList,
  runsSummary,
  runsPagination,
  runSearch,
  setRunSearch,
  runStatusFilter,
  setRunStatusFilter,
  runProviderFilter,
  setRunProviderFilter,
  isRunsLoading,
  runsPage,
  setRunsPage,
  onOpenRun,
}) {
  return (
    <>
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <StatBlock
          icon={Activity}
          label="Jobs"
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
          label="Books in DB"
          value={runsSummary?.totalBooks || 0}
        />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr),12rem,12rem] gap-3">
          <Input
            icon={Search}
            label="Search jobs"
            name="admin-run-search"
            value={runSearch}
            onChange={(event) => setRunSearch(event.target.value)}
            placeholder="Job ID, book, author, user, or error"
          />
          <Select
            label="Result"
            name="admin-run-status-filter"
            value={runStatusFilter}
            onChange={(event) => setRunStatusFilter(event.target.value)}
            options={RUN_STATUS_OPTIONS}
          />
          <Select
            label="Provider"
            name="admin-run-provider-filter"
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
                  Job
                </th>
                <th className="w-[24%] px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                  Book
                </th>
                <th className="w-[17%] px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                  Owner
                </th>
                <th className="w-[7.5rem] px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                  Result
                </th>
                <th className="w-[13rem] px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                  Progress
                </th>
                <th className="w-[14rem] px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                  Failures
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isRunsLoading ? (
                <tr>
                  <td
                    colSpan="6"
                    className="px-4 py-10 text-center text-slate-500 text-sm"
                  >
                    Loading jobs...
                  </td>
                </tr>
              ) : runsList.length === 0 ? (
                <tr>
                  <td
                    colSpan="6"
                    className="px-4 py-10 text-center text-slate-500 text-sm"
                  >
                    No generation jobs found.
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
                        {run.book?.title || run.payloadTitle || "Untitled job"}
                      </p>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {run.book?.author || "Unknown author"}
                        {run.book?.genre ? ` - ${run.book.genre}` : ""}
                      </p>
                      <BookResultSummary book={run.book} />
                    </td>
                    <td className="px-4 py-4 overflow-hidden">
                      <p className="text-sm font-semibold text-slate-950 truncate">
                        {run.user?.name || "Unknown user"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 truncate">
                        {run.user?.email || "No email"}
                      </p>
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
                        onClick={() => onOpenRun(run)}
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
                onClick={() => setRunsPage((current) => Math.max(1, current - 1))}
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
    </>
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
      title={run ? `Job ${formatRunId(run.id)}` : "Job details"}
      sizeClassName="max-w-[min(72rem,calc(100vw-1rem))]"
    >
      {!run ? (
        <div className="py-16 text-center text-slate-500">Job not found.</div>
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
                  {run.book?.title || run.payloadTitle || "Untitled job"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {run.user?.name || "Unknown user"} -{" "}
                  {run.user?.email || "No email"}
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
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <DetailRow label="Full job ID" value={run.id} mono />
            <DetailRow label="Book ID" value={run.book?._id || "No book linked"} mono />
            <DetailRow label="Created" value={formatDate(run.createdAt)} />
            <DetailRow label="Completed" value={formatDate(run.completedAt)} />
            <DetailRow
              label="Chapters ok"
              value={chapterCounts.complete || 0}
            />
            <DetailRow
              label="Chapters failed"
              value={chapterCounts.failed || 0}
            />
            <DetailRow
              label="Chapters total"
              value={chapterCounts.total || 0}
            />
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
                No failure reasons were logged for this job.
              </p>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}

function PlanSettingsPanel({
  plans,
  planForm,
  setPlanForm,
  canSavePlans,
  isPlansLoading,
  isSavingPlans,
  onSavePlans,
}) {
  return (
    <form
      onSubmit={onSavePlans}
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm mb-6"
    >
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
        <div>
          <p className="text-violet-600 text-xs font-semibold uppercase tracking-wide">
            Plans
          </p>
          <h2 className="text-slate-950 text-xl font-bold mt-1">
            Recurring monthly credits
          </h2>
        </div>
        <Button
          type="submit"
          icon={Save}
          isLoading={isSavingPlans}
          disabled={!canSavePlans}
          size="sm"
          className="w-full sm:w-auto"
        >
          Save plans
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {plans.map((plan) => {
          const PlanIcon = plan.icon;

          return (
            <section
              key={plan.id}
              className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="size-10 rounded-lg bg-slate-950 text-white flex items-center justify-center shrink-0">
                  <PlanIcon className="size-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-slate-950 text-sm font-bold">
                    {plan.label}
                  </h3>
                  <p className="text-slate-500 text-xs">
                    {formatCredits(plan.amount)} credits now
                  </p>
                </div>
              </div>

              <Input
                label={`${plan.label} recurring amount`}
                name={`admin-plan-${plan.id}`}
                type="number"
                min="1"
                step="1"
                value={planForm[plan.id] || ""}
                onChange={(event) =>
                  setPlanForm((current) => ({
                    ...current,
                    [plan.id]: event.target.value,
                  }))
                }
                disabled={isPlansLoading}
                required
              />
            </section>
          );
        })}
      </div>
    </form>
  );
}

function UserDetailsModal({
  isOpen,
  onClose,
  user,
  transactions,
  editDraft,
  setEditDraft,
  creditForm,
  setCreditForm,
  monthlyCreditForm,
  setMonthlyCreditForm,
  monthlyCreditPresets,
  creditPreview,
  canSaveUser,
  canApplyCredits,
  canSaveMonthlyCredits,
  creditWarning,
  isDetailsLoading,
  isSavingUser,
  isAdjustingCredits,
  isSavingMonthlyCredits,
  isUpdatingStatus,
  isDeletingUser,
  transactionHistoryDays,
  onSaveUser,
  onAdjustCredits,
  onSaveMonthlyCredits,
  onToggleUserBan,
  onDeleteUser,
}) {
  const currentBalance = Number(user?.credits?.balance || 0);
  const monthlyAllowance = Number(user?.credits?.monthlyAllowance || 0);
  const monthlyDraftAmount = Number(monthlyCreditForm.amount || 0);
  const monthlyRenewalDate =
    monthlyDraftAmount > 0
      ? formatDate(user?.credits?.nextMonthlyResetAt)
      : "Not scheduled";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={user ? `Manage ${user.name}` : "Manage user"}
      sizeClassName="max-w-[min(72rem,calc(100vw-1rem))]"
    >
      {!user && isDetailsLoading ? (
        <div className="py-16 text-center text-slate-500">Loading user...</div>
      ) : !user ? (
        <div className="py-16 text-center text-slate-500">User not found.</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr),24rem] gap-5">
          <section className="min-w-0 space-y-5">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <span className="size-16 rounded-2xl bg-slate-950 text-white text-lg font-bold flex items-center justify-center shrink-0">
                  {getInitials(user.name, user.email)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-slate-950 text-xl font-bold truncate">
                      {user.name}
                    </h2>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        user.role === "admin"
                          ? "bg-violet-100 text-violet-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {user.role}
                    </span>
                    <AccountStatusBadge status={user.status} />
                  </div>
                  <p className="mt-1 text-slate-500 text-sm flex items-center gap-2">
                    <Mail className="size-4" />
                    <span className="truncate">{user.email}</span>
                  </p>
                </div>
                <div className="rounded-xl bg-violet-50 border border-violet-100 px-4 py-3 text-right">
                  <p className="text-violet-600 text-xs font-semibold uppercase">
                    Credits
                  </p>
                  <p className="text-violet-950 text-2xl font-bold tabular-nums">
                    {formatCredits(currentBalance)}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <DetailRow label="User ID" value={user._id} mono />
              <DetailRow label="Email" value={user.email} />
              <DetailRow label="Books" value={user.bookCount} />
              <DetailRow label="Joined" value={formatDate(user.createdAt)} />
              <DetailRow label="Last updated" value={formatDate(user.updatedAt)} />
              <DetailRow label="Account status" value={user.status || "active"} />
              <DetailRow
                label="Banned at"
                value={user.status === "banned" ? formatDate(user.bannedAt) : "Not banned"}
              />
              <DetailRow
                label="Ban reason"
                value={user.status === "banned" ? user.bannedReason || "No reason saved" : "Not banned"}
              />
              <DetailRow
                label="Lifetime spent"
                value={formatCredits(user.credits?.lifetimeSpent)}
              />
              <DetailRow
                label="Lifetime granted"
                value={formatCredits(user.credits?.lifetimeGranted)}
              />
              <DetailRow
                label="Starting credits"
                value={formatCredits(user.credits?.startingCredits)}
              />
              <DetailRow
                label="Monthly reset"
                value={
                  monthlyAllowance > 0
                    ? `${formatCredits(monthlyAllowance)} credits on the 1st`
                    : "Disabled"
                }
              />
              <DetailRow
                label="Next monthly reset"
                value={
                  monthlyAllowance > 0
                    ? formatDate(user.credits?.nextMonthlyResetAt)
                    : "Not scheduled"
                }
              />
            </div>

            <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <header className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-slate-950 text-sm font-semibold flex items-center gap-2">
                  <History className="size-4 text-slate-500" />
                  Credit history
                </h3>
                <span className="text-xs text-slate-500">
                  Last {transactionHistoryDays} days · all {transactions.length}
                </span>
              </header>

              {isDetailsLoading ? (
                <p className="px-4 py-10 text-sm text-slate-500">Loading...</p>
              ) : transactions.length === 0 ? (
                <p className="px-4 py-10 text-sm text-slate-500">
                  No credit transactions in the last {transactionHistoryDays} days.
                </p>
              ) : (
                <div className="max-h-80 overflow-auto">
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase text-slate-500">
                          Event
                        </th>
                        <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase text-slate-500">
                          Amount
                        </th>
                        <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase text-slate-500">
                          Balance
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {transactions.map((transaction) => {
                        const negative = transactionIsNegative(transaction);

                        return (
                          <tr key={transaction.id}>
                            <td className="px-4 py-3">
                              <p className="text-slate-900 text-sm font-medium">
                                {transaction.description || transaction.reason}
                              </p>
                              <p className="text-slate-500 text-xs">
                                {formatDate(transaction.createdAt)}
                              </p>
                            </td>
                            <td
                              className={`px-4 py-3 text-right text-sm font-bold tabular-nums ${
                                negative ? "text-rose-600" : "text-emerald-600"
                              }`}
                            >
                              {negative ? "-" : "+"}
                              {formatCredits(transaction.amount)}
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-slate-600 tabular-nums">
                              {formatCredits(transaction.balanceAfter)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </section>

          <aside className="space-y-4">
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-slate-950 text-sm font-semibold mb-3 flex items-center gap-2">
                <UserCog className="size-4 text-slate-500" />
                Identity and role
              </h3>
              <div className="grid grid-cols-1 gap-3">
                <Input
                  label="Display name"
                  name="admin-user-name"
                  value={editDraft.name}
                  onChange={(event) =>
                    setEditDraft((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
                <Select
                  label="Role"
                  name="admin-user-role"
                  value={editDraft.role}
                  onChange={(event) =>
                    setEditDraft((current) => ({
                      ...current,
                      role: event.target.value,
                    }))
                  }
                  options={[
                    { label: "User", value: "user" },
                    { label: "Admin", value: "admin" },
                  ]}
                />
                <Button
                  type="button"
                  onClick={onSaveUser}
                  isLoading={isSavingUser}
                  disabled={!canSaveUser}
                  size="sm"
                  className="w-full"
                >
                  Save identity
                </Button>
              </div>
            </section>

            <section className="rounded-xl border border-rose-200 bg-rose-50/40 p-4">
              <h3 className="text-slate-950 text-sm font-semibold mb-2 flex items-center gap-2">
                <ShieldAlert className="size-4 text-rose-600" />
                Account access
              </h3>
              <p className="text-xs text-slate-600 mb-3">
                Banned users cannot sign in or use existing sessions.
              </p>
              <div className="grid grid-cols-1 gap-2">
                <Button
                  type="button"
                  variant={user.status === "banned" ? "secondary" : "destructive"}
                  icon={user.status === "banned" ? ShieldCheck : Ban}
                  onClick={onToggleUserBan}
                  isLoading={isUpdatingStatus}
                  size="sm"
                  className="w-full"
                >
                  {user.status === "banned" ? "Unban user" : "Ban user"}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  icon={Trash2}
                  onClick={onDeleteUser}
                  isLoading={isDeletingUser}
                  size="sm"
                  className="w-full"
                >
                  Delete user
                </Button>
              </div>
            </section>

            <form
              onSubmit={onSaveMonthlyCredits}
              className="rounded-xl border border-violet-200 bg-violet-50/40 p-4"
            >
              <h3 className="text-slate-950 text-sm font-semibold mb-1 flex items-center gap-2">
                <CalendarClock className="size-4 text-violet-600" />
                Monthly credit reset
              </h3>
              <p className="text-xs text-slate-500 mb-3">
                Resets this user&apos;s balance to the saved amount on the 1st.
              </p>

              <div className="grid grid-cols-2 gap-2 mb-3">
                {monthlyCreditPresets.map((preset) => (
                  <CreditActionButton
                    key={preset.id}
                    active={monthlyCreditForm.preset === preset.id}
                    icon={preset.icon}
                    onClick={() =>
                      setMonthlyCreditForm({
                        amount: String(preset.amount),
                        preset: preset.id,
                      })
                    }
                  >
                    {preset.label}
                  </CreditActionButton>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-3">
                <Input
                  label="Monthly amount"
                  name="monthly-credit-amount"
                  type="number"
                  min="0"
                  step="1"
                  value={monthlyCreditForm.amount}
                  onChange={(event) => {
                    const amount = event.target.value;

                    setMonthlyCreditForm({
                      amount,
                      preset: getMonthlyPresetForAmount(
                        amount,
                        monthlyCreditPresets
                      ),
                    });
                  }}
                  helperText="Set to 0 to disable monthly resets."
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="rounded-lg border border-violet-100 bg-white px-3 py-2">
                    <p className="text-xs font-semibold text-violet-700">
                      Plan preview
                    </p>
                    <p className="text-lg font-bold text-violet-950 tabular-nums">
                      {monthlyDraftAmount > 0
                        ? `${formatCredits(monthlyDraftAmount)} monthly`
                        : "Disabled"}
                    </p>
                  </div>

                  <div className="rounded-lg border border-violet-100 bg-white px-3 py-2">
                    <p className="text-xs font-semibold text-violet-700">
                      Renewal date
                    </p>
                    <p className="text-sm font-bold text-violet-950 leading-6">
                      {monthlyRenewalDate}
                    </p>
                  </div>
                </div>

                <Button
                  type="submit"
                  isLoading={isSavingMonthlyCredits}
                  disabled={!canSaveMonthlyCredits}
                  size="sm"
                  className="w-full"
                >
                  Save monthly reset
                </Button>
              </div>
            </form>

            <form
              onSubmit={onAdjustCredits}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <h3 className="text-slate-950 text-sm font-semibold mb-3 flex items-center gap-2">
                <Coins className="size-4 text-slate-500" />
                Credits
              </h3>

              <div className="grid grid-cols-3 gap-2 mb-3">
                <CreditActionButton
                  active={creditForm.action === "add"}
                  icon={Plus}
                  onClick={() =>
                    setCreditForm((current) => ({ ...current, action: "add" }))
                  }
                >
                  Add
                </CreditActionButton>
                <CreditActionButton
                  active={creditForm.action === "remove"}
                  icon={Minus}
                  onClick={() =>
                    setCreditForm((current) => ({
                      ...current,
                      action: "remove",
                    }))
                  }
                >
                  Remove
                </CreditActionButton>
                <CreditActionButton
                  active={creditForm.action === "set"}
                  icon={SlidersHorizontal}
                  onClick={() =>
                    setCreditForm((current) => ({ ...current, action: "set" }))
                  }
                >
                  Set
                </CreditActionButton>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <Input
                  label={
                    creditForm.action === "set"
                      ? "New balance"
                      : "Credit amount"
                  }
                  name="credit-amount"
                  type="number"
                  min="0"
                  step="0.0001"
                  value={creditForm.amount}
                  onChange={(event) =>
                    setCreditForm((current) => ({
                      ...current,
                      amount: event.target.value,
                    }))
                  }
                  required
                />
                <label className="grid grid-cols-1 gap-2">
                  <span className="text-gray-700 text-sm font-medium">Note</span>
                  <textarea
                    value={creditForm.note}
                    onChange={(event) =>
                      setCreditForm((current) => ({
                        ...current,
                        note: event.target.value,
                      }))
                    }
                    placeholder="Reason for this adjustment"
                    className="w-full min-h-20 bg-white text-gray-900 text-sm placeholder-gray-400 px-3 py-2 border border-gray-200 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 resize-none"
                  />
                </label>

                <div
                  className={`rounded-lg border px-3 py-2 ${
                    creditWarning
                      ? "bg-rose-50 border-rose-100"
                      : "bg-violet-50 border-violet-100"
                  }`}
                >
                  <p
                    className={`text-xs font-semibold ${
                      creditWarning ? "text-rose-700" : "text-violet-700"
                    }`}
                  >
                    {creditWarning || "New balance preview"}
                  </p>
                  <p
                    className={`text-lg font-bold tabular-nums ${
                      creditWarning ? "text-rose-950" : "text-violet-950"
                    }`}
                  >
                    {formatCredits(creditPreview)}
                  </p>
                </div>

                <Button
                  type="submit"
                  isLoading={isAdjustingCredits}
                  disabled={!canApplyCredits}
                  size="sm"
                  className="w-full"
                >
                  Apply credits
                </Button>
              </div>
            </form>
          </aside>
        </div>
      )}
    </Modal>
  );
}

function AdminPage() {
  const { user } = useAuthContext();
  const [activeAdminView, setActiveAdminView] = useState("users");
  const [usersList, setUsersList] = useState([]);
  const [runsList, setRunsList] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRun, setSelectedRun] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [transactionHistoryDays, setTransactionHistoryDays] = useState(40);
  const [summary, setSummary] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [runsSummary, setRunsSummary] = useState(null);
  const [runsPagination, setRunsPagination] = useState(null);
  const [monthlyCreditPresets, setMonthlyCreditPresets] = useState(
    DEFAULT_MONTHLY_CREDIT_PRESETS
  );
  const [planForm, setPlanForm] = useState(
    buildPlanForm(DEFAULT_MONTHLY_CREDIT_PRESETS)
  );
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const [runSearch, setRunSearch] = useState("");
  const [runStatusFilter, setRunStatusFilter] = useState("");
  const [runProviderFilter, setRunProviderFilter] = useState("");
  const [runsPage, setRunsPage] = useState(1);
  const [editDraft, setEditDraft] = useState({ name: "", role: "user" });
  const [creditForm, setCreditForm] = useState({
    action: "add",
    amount: "",
    note: "",
  });
  const [monthlyCreditForm, setMonthlyCreditForm] = useState({
    amount: "",
    preset: "",
  });
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunsLoading, setIsRunsLoading] = useState(true);
  const [isPlansLoading, setIsPlansLoading] = useState(true);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [isAdjustingCredits, setIsAdjustingCredits] = useState(false);
  const [isSavingMonthlyCredits, setIsSavingMonthlyCredits] = useState(false);
  const [isSavingPlans, setIsSavingPlans] = useState(false);

  const isAdmin = user?.role === "admin";

  const fetchPlans = useCallback(async () => {
    if (!isAdmin) return;

    setIsPlansLoading(true);

    try {
      const { data } = await axiosInstance.get(API_ENDPOINTS.ADMIN.PLANS);
      const nextPresets = normalizeMonthlyCreditPresets(
        data.settings?.plans || data.plans || []
      );

      setMonthlyCreditPresets(nextPresets);
      setPlanForm(buildPlanForm(nextPresets));
    } catch (error) {
      console.error("Error fetching admin plans:", error);
      toast.error(error.response?.data?.error || "Failed to load plans.");
    } finally {
      setIsPlansLoading(false);
    }
  }, [isAdmin]);

  const fetchUserDetails = useCallback(async (userId, shouldOpen = true) => {
    if (!userId) return;

    if (shouldOpen) {
      setIsUserModalOpen(true);
    }

    setIsDetailsLoading(true);

    try {
      const { data } = await axiosInstance.get(
        `${API_ENDPOINTS.ADMIN.USERS}/${userId}`
      );

      setSelectedUser(data.user);
      setTransactions(data.transactions || []);
      setTransactionHistoryDays(data.historyDays || 40);
      setEditDraft({
        name: data.user?.name || "",
        role: data.user?.role || "user",
      });
      setMonthlyCreditForm({
        amount: data.user?.credits?.monthlyAllowance
          ? String(data.user.credits.monthlyAllowance)
          : "",
        preset:
          data.user?.credits?.monthlyPreset ||
          getMonthlyPresetForAmount(
            data.user?.credits?.monthlyAllowance || 0,
            monthlyCreditPresets
          ),
      });
      setCreditForm({ action: "add", amount: "", note: "" });
    } catch (error) {
      console.error("Error fetching admin user details:", error);
      toast.error(error.response?.data?.error || "Failed to load user details.");
    } finally {
      setIsDetailsLoading(false);
    }
  }, [monthlyCreditPresets]);

  const fetchUsers = useCallback(async () => {
    if (!isAdmin) return;

    setIsLoading(true);

    try {
      const { data } = await axiosInstance.get(API_ENDPOINTS.ADMIN.USERS, {
        params: {
          search,
          role: roleFilter,
          page,
          limit: 25,
        },
      });

      setUsersList(data.users || []);
      setSummary(data.summary || null);
      setPagination(data.pagination || null);
    } catch (error) {
      console.error("Error fetching admin users:", error);
      toast.error(error.response?.data?.error || "Failed to load admin users.");
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, page, roleFilter, search]);

  const fetchRuns = useCallback(async () => {
    if (!isAdmin) return;

    setIsRunsLoading(true);

    try {
      const { data } = await axiosInstance.get(API_ENDPOINTS.ADMIN.JOBS, {
        params: {
          search: runSearch,
          status: runStatusFilter,
          provider: runProviderFilter,
          page: runsPage,
          limit: 25,
        },
      });

      setRunsList(data.jobs || data.runs || []);
      setRunsSummary(data.summary || null);
      setRunsPagination(data.pagination || null);
    } catch (error) {
      console.error("Error fetching admin jobs:", error);
      toast.error(error.response?.data?.error || "Failed to load admin jobs.");
    } finally {
      setIsRunsLoading(false);
    }
  }, [isAdmin, runProviderFilter, runSearch, runStatusFilter, runsPage]);

  const handleRefreshAdmin = useCallback(() => {
    fetchPlans();
    fetchRuns();
    fetchUsers();
  }, [fetchPlans, fetchRuns, fetchUsers]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  useEffect(() => {
    const timer = window.setTimeout(fetchUsers, 250);

    return () => window.clearTimeout(timer);
  }, [fetchUsers]);

  useEffect(() => {
    const timer = window.setTimeout(fetchRuns, 250);

    return () => window.clearTimeout(timer);
  }, [fetchRuns]);

  useEffect(() => {
    setPage(1);
  }, [roleFilter, search]);

  useEffect(() => {
    setRunsPage(1);
  }, [runProviderFilter, runSearch, runStatusFilter]);

  const selectedBalance = selectedUser?.credits?.balance || 0;
  const numericCreditAmount = Number(creditForm.amount || 0);
  const numericMonthlyCreditAmount = Number(monthlyCreditForm.amount || 0);
  const creditPreview = useMemo(() => {
    if (!Number.isFinite(numericCreditAmount) || numericCreditAmount < 0) {
      return selectedBalance;
    }

    if (creditForm.action === "add") {
      return selectedBalance + numericCreditAmount;
    }

    if (creditForm.action === "remove") {
      return selectedBalance - numericCreditAmount;
    }

    return numericCreditAmount;
  }, [creditForm.action, numericCreditAmount, selectedBalance]);
  const wouldOverdraw = creditForm.action === "remove" && creditPreview < 0;
  const hasValidCreditAmount =
    Number.isFinite(numericCreditAmount) &&
    (creditForm.action === "set" ? numericCreditAmount >= 0 : numericCreditAmount > 0);
  const canApplyCredits =
    selectedUser &&
    hasValidCreditAmount &&
    creditForm.amount !== "" &&
    !wouldOverdraw;
  const creditWarning = wouldOverdraw
    ? "Cannot remove more credits than the user has"
    : "";
  const canSaveUser =
    selectedUser &&
    (editDraft.name.trim() !== selectedUser.name ||
      editDraft.role !== selectedUser.role);
  const hasValidMonthlyCreditAmount =
    Number.isFinite(numericMonthlyCreditAmount) && numericMonthlyCreditAmount >= 0;
  const normalizedMonthlyPreset = getMonthlyPresetForAmount(
    numericMonthlyCreditAmount,
    monthlyCreditPresets
  );
  const canSaveMonthlyCredits =
    selectedUser &&
    hasValidMonthlyCreditAmount &&
    (numericMonthlyCreditAmount !==
      Number(selectedUser.credits?.monthlyAllowance || 0) ||
      normalizedMonthlyPreset !== (selectedUser.credits?.monthlyPreset || ""));
  const hasValidPlanAmounts = monthlyCreditPresets.every((plan) => {
    const value = planForm[plan.id];
    const numericValue = Number(value);

    return value !== "" && Number.isFinite(numericValue) && numericValue > 0;
  });
  const plansChanged = monthlyCreditPresets.some(
    (plan) => Number(planForm[plan.id]) !== Number(plan.amount)
  );
  const canSavePlans = hasValidPlanAmounts && plansChanged && !isPlansLoading;

  const updateSelectedUserInList = (nextUser) => {
    setUsersList((current) =>
      current.map((item) => (item._id === nextUser._id ? nextUser : item))
    );
  };

  const removeSelectedUserFromList = (deletedUserId) => {
    setUsersList((current) =>
      current.filter((item) => item._id !== deletedUserId)
    );
  };

  const handleOpenRunDetails = (run) => {
    setSelectedRun(run);
    setIsRunModalOpen(true);
  };

  const handleSavePlans = async (event) => {
    event.preventDefault();

    if (!canSavePlans) return;

    setIsSavingPlans(true);

    try {
      const { data } = await axiosInstance.put(API_ENDPOINTS.ADMIN.PLANS, {
        plans: monthlyCreditPresets.reduce(
          (plans, plan) => ({
            ...plans,
            [plan.id]: {
              amount: Number(planForm[plan.id]),
            },
          }),
          {}
        ),
      });
      const nextPresets = normalizeMonthlyCreditPresets(
        data.settings?.plans || data.plans || []
      );

      setMonthlyCreditPresets(nextPresets);
      setPlanForm(buildPlanForm(nextPresets));
      setMonthlyCreditForm((current) => ({
        ...current,
        preset: getMonthlyPresetForAmount(current.amount, nextPresets),
      }));

      if (selectedUser) {
        fetchUserDetails(selectedUser._id, false);
      }

      fetchUsers();
      toast.success("Plan amounts updated.");
    } catch (error) {
      console.error("Error saving admin plans:", error);
      toast.error(error.response?.data?.error || "Failed to save plans.");
    } finally {
      setIsSavingPlans(false);
    }
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;

    setIsSavingUser(true);

    try {
      const { data } = await axiosInstance.patch(
        `${API_ENDPOINTS.ADMIN.USERS}/${selectedUser._id}`,
        editDraft
      );

      setSelectedUser(data.user);
      updateSelectedUserInList(data.user);
      toast.success("User updated.");
    } catch (error) {
      console.error("Error saving admin user:", error);
      toast.error(error.response?.data?.error || "Failed to update user.");
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleToggleUserBan = async () => {
    if (!selectedUser) return;

    const shouldBan = selectedUser.status !== "banned";
    const reason = shouldBan
      ? window.prompt("Ban reason (optional)", "")
      : "";

    if (shouldBan && reason === null) return;

    if (!window.confirm(
      shouldBan
        ? `Ban ${selectedUser.email}? They will be signed out and blocked from public shares.`
        : `Unban ${selectedUser.email}? They will be able to sign in again.`
    )) {
      return;
    }

    setIsUpdatingStatus(true);

    try {
      const { data } = await axiosInstance.patch(
        `${API_ENDPOINTS.ADMIN.USERS}/${selectedUser._id}/status`,
        {
          status: shouldBan ? "banned" : "active",
          reason: reason || "",
        }
      );

      setSelectedUser(data.user);
      updateSelectedUserInList(data.user);
      fetchUsers();
      toast.success(shouldBan ? "User banned." : "User unbanned.");
    } catch (error) {
      console.error("Error updating user status:", error);
      toast.error(error.response?.data?.error || "Failed to update status.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    const typedEmail = window.prompt(
      `Type ${selectedUser.email} to permanently delete this user.`
    );

    if (typedEmail !== selectedUser.email) {
      if (typedEmail !== null) {
        toast.error("Email did not match. User was not deleted.");
      }

      return;
    }

    if (!window.confirm(
      `Permanently delete ${selectedUser.email}, their books, generation jobs, and credit history?`
    )) {
      return;
    }

    setIsDeletingUser(true);

    try {
      const { data } = await axiosInstance.delete(
        `${API_ENDPOINTS.ADMIN.USERS}/${selectedUser._id}`
      );

      removeSelectedUserFromList(data.deletedUserId || selectedUser._id);
      setSelectedUser(null);
      setTransactions([]);
      setIsUserModalOpen(false);
      fetchUsers();
      toast.success("User deleted.");
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error(error.response?.data?.error || "Failed to delete user.");
    } finally {
      setIsDeletingUser(false);
    }
  };

  const handleAdjustCredits = async (event) => {
    event.preventDefault();

    if (!selectedUser) return;

    setIsAdjustingCredits(true);

    try {
      const { data } = await axiosInstance.post(
        `${API_ENDPOINTS.ADMIN.USERS}/${selectedUser._id}/credits`,
        {
          action: creditForm.action,
          amount: Number(creditForm.amount),
          note: creditForm.note,
        }
      );

      setSelectedUser(data.user);
      updateSelectedUserInList(data.user);
      setTransactions((current) =>
        data.transaction ? [data.transaction, ...current] : current
      );
      setCreditForm({ action: "add", amount: "", note: "" });
      toast.success("Credits updated.");
      window.dispatchEvent(new Event("credits:refresh"));
    } catch (error) {
      console.error("Error adjusting credits:", error);
      toast.error(error.response?.data?.error || "Failed to adjust credits.");
    } finally {
      setIsAdjustingCredits(false);
    }
  };

  const handleSaveMonthlyCredits = async (event) => {
    event.preventDefault();

    if (!selectedUser) return;

    setIsSavingMonthlyCredits(true);

    try {
      const { data } = await axiosInstance.put(
        `${API_ENDPOINTS.ADMIN.USERS}/${selectedUser._id}/credits/monthly`,
        {
          amount: numericMonthlyCreditAmount,
          preset: normalizedMonthlyPreset,
        }
      );

      setSelectedUser(data.user);
      updateSelectedUserInList(data.user);
      setMonthlyCreditForm({
        amount: data.user?.credits?.monthlyAllowance
          ? String(data.user.credits.monthlyAllowance)
          : "",
        preset: data.user?.credits?.monthlyPreset || "",
      });
      setTransactions((current) =>
        data.transaction ? [data.transaction, ...current] : current
      );
      toast.success("Monthly credits updated.");
      window.dispatchEvent(new Event("credits:refresh"));
    } catch (error) {
      console.error("Error saving monthly credits:", error);
      toast.error(
        error.response?.data?.error || "Failed to save monthly credits."
      );
    } finally {
      setIsSavingMonthlyCredits(false);
    }
  };

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <main className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6">
          <section className="max-w-md rounded-xl border border-rose-100 bg-white p-6 text-center shadow-sm">
            <div className="size-12 rounded-lg bg-rose-50 flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="size-6 text-rose-600" />
            </div>
            <h1 className="text-slate-950 text-xl font-bold">
              Admin access required
            </h1>
            <p className="text-slate-500 text-sm mt-2">
              Your account is signed in, but it does not have admin privileges.
            </p>
          </section>
        </main>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <main className="container max-w-7xl p-4 md:p-6 mx-auto">
        <header className="mb-6 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <p className="text-violet-600 text-xs font-semibold uppercase tracking-wide">
              Admin Console
            </p>
            <h1 className="text-slate-950 text-2xl md:text-3xl font-bold mt-1">
              Users, credits, and jobs
            </h1>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <AdminTabs
              activeView={activeAdminView}
              onChange={setActiveAdminView}
            />
            <Button
              type="button"
              variant="secondary"
              icon={RefreshCw}
              onClick={handleRefreshAdmin}
              isLoading={isLoading || isRunsLoading || isPlansLoading}
            >
              Refresh
            </Button>
          </div>
        </header>

        {activeAdminView === "users" ? (
          <>
            <PlanSettingsPanel
              plans={monthlyCreditPresets}
              planForm={planForm}
              setPlanForm={setPlanForm}
              canSavePlans={canSavePlans}
              isPlansLoading={isPlansLoading}
              isSavingPlans={isSavingPlans}
              onSavePlans={handleSavePlans}
            />

            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
              <StatBlock
                icon={Users}
                label="Users"
                value={summary?.totalUsers || 0}
              />
              <StatBlock
                icon={ShieldCheck}
                label="Admins"
                value={summary?.adminUsers || 0}
              />
              <StatBlock
                icon={Ban}
                label="Banned"
                value={summary?.bannedUsers || 0}
              />
              <StatBlock
                icon={Coins}
                label="Outstanding"
                value={formatCredits(summary?.outstandingCredits)}
              />
              <StatBlock
                icon={BadgeDollarSign}
                label="Lifetime spent"
                value={formatCredits(summary?.lifetimeSpent)}
              />
            </section>

            <section className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-200 grid grid-cols-1 md:grid-cols-[minmax(0,1fr),12rem] gap-3">
                <Input
                  icon={Search}
                  label="Search users"
                  name="admin-user-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Name or email"
                />
                <Select
                  label="Role"
                  name="admin-role-filter"
                  value={roleFilter}
                  onChange={(event) => setRoleFilter(event.target.value)}
                  options={[
                    { label: "All roles", value: "" },
                    { label: "Admins", value: "admin" },
                    { label: "Users", value: "user" },
                  ]}
                />
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                        User
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                        Role
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                        Credits
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                        Spent
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                        Books
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                        Joined
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isLoading ? (
                      <tr>
                        <td
                          colSpan="7"
                          className="px-4 py-10 text-center text-slate-500 text-sm"
                        >
                          Loading users...
                        </td>
                      </tr>
                    ) : usersList.length === 0 ? (
                      <tr>
                        <td
                          colSpan="7"
                          className="px-4 py-10 text-center text-slate-500 text-sm"
                        >
                          No users found.
                        </td>
                      </tr>
                    ) : (
                      usersList.map((item) => (
                        <tr
                          key={item._id}
                          onClick={() => fetchUserDetails(item._id)}
                          className="cursor-pointer transition-colors hover:bg-violet-50/70 focus-within:bg-violet-50/70"
                        >
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                fetchUserDetails(item._id);
                              }}
                              className="flex items-center gap-3 min-w-56 text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                            >
                              <span className="size-9 rounded-lg bg-slate-900 text-white text-xs font-bold flex items-center justify-center">
                                {getInitials(item.name, item.email)}
                              </span>
                              <span className="min-w-0">
                                <span className="block text-slate-950 text-sm font-semibold truncate">
                                  {item.name}
                                </span>
                                <span className="block text-slate-500 text-xs truncate">
                                  {item.email}
                                </span>
                              </span>
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                item.role === "admin"
                                  ? "bg-violet-100 text-violet-700"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {item.role}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <AccountStatusBadge status={item.status} />
                          </td>
                          <td className="px-4 py-3 text-right text-slate-950 text-sm font-semibold tabular-nums">
                            {formatCredits(item.credits?.balance)}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600 text-sm tabular-nums">
                            {formatCredits(item.credits?.lifetimeSpent)}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600 text-sm tabular-nums">
                            {item.bookCount}
                          </td>
                          <td className="px-4 py-3 text-slate-500 text-xs">
                            {formatDate(item.createdAt)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {pagination && pagination.pages > 1 && (
                <div className="p-4 border-t border-slate-200 flex items-center justify-between gap-3">
                  <p className="text-slate-500 text-xs">
                    Page {pagination.page} of {pagination.pages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() =>
                        setPage((current) => Math.max(1, current - 1))
                      }
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={page >= pagination.pages}
                      onClick={() => setPage((current) => current + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </section>
          </>
        ) : (
          <RunsPanel
            runsList={runsList}
            runsSummary={runsSummary}
            runsPagination={runsPagination}
            runSearch={runSearch}
            setRunSearch={setRunSearch}
            runStatusFilter={runStatusFilter}
            setRunStatusFilter={setRunStatusFilter}
            runProviderFilter={runProviderFilter}
            setRunProviderFilter={setRunProviderFilter}
            isRunsLoading={isRunsLoading}
            runsPage={runsPage}
            setRunsPage={setRunsPage}
            onOpenRun={handleOpenRunDetails}
          />
        )}
      </main>

      <UserDetailsModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        user={selectedUser}
        transactions={transactions}
        editDraft={editDraft}
        setEditDraft={setEditDraft}
        creditForm={creditForm}
        setCreditForm={setCreditForm}
        monthlyCreditForm={monthlyCreditForm}
        setMonthlyCreditForm={setMonthlyCreditForm}
        monthlyCreditPresets={monthlyCreditPresets}
        creditPreview={creditPreview}
        canSaveUser={canSaveUser}
        canApplyCredits={canApplyCredits}
        canSaveMonthlyCredits={canSaveMonthlyCredits}
        creditWarning={creditWarning}
        isDetailsLoading={isDetailsLoading}
        isSavingUser={isSavingUser}
        isAdjustingCredits={isAdjustingCredits}
        isSavingMonthlyCredits={isSavingMonthlyCredits}
        isUpdatingStatus={isUpdatingStatus}
        isDeletingUser={isDeletingUser}
        transactionHistoryDays={transactionHistoryDays}
        onSaveUser={handleSaveUser}
        onAdjustCredits={handleAdjustCredits}
        onSaveMonthlyCredits={handleSaveMonthlyCredits}
        onToggleUserBan={handleToggleUserBan}
        onDeleteUser={handleDeleteUser}
      />

      <RunDetailsModal
        isOpen={isRunModalOpen}
        onClose={() => setIsRunModalOpen(false)}
        run={selectedRun}
      />
    </DashboardLayout>
  );
}

export default AdminPage;
