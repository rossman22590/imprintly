import { createElement, useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  BadgeDollarSign,
  Coins,
  History,
  Mail,
  Minus,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
  Users,
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

function UserDetailsModal({
  isOpen,
  onClose,
  user,
  transactions,
  editDraft,
  setEditDraft,
  creditForm,
  setCreditForm,
  creditPreview,
  canSaveUser,
  canApplyCredits,
  creditWarning,
  isDetailsLoading,
  isSavingUser,
  isAdjustingCredits,
  onSaveUser,
  onAdjustCredits,
}) {
  const currentBalance = Number(user?.credits?.balance || 0);

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
            </div>

            <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <header className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-slate-950 text-sm font-semibold flex items-center gap-2">
                  <History className="size-4 text-slate-500" />
                  Credit history
                </h3>
                <span className="text-xs text-slate-500">
                  Latest {transactions.length}
                </span>
              </header>

              {isDetailsLoading ? (
                <p className="px-4 py-10 text-sm text-slate-500">Loading...</p>
              ) : transactions.length === 0 ? (
                <p className="px-4 py-10 text-sm text-slate-500">
                  No credit history yet.
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
  const [usersList, setUsersList] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const [editDraft, setEditDraft] = useState({ name: "", role: "user" });
  const [creditForm, setCreditForm] = useState({
    action: "add",
    amount: "",
    note: "",
  });
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [isAdjustingCredits, setIsAdjustingCredits] = useState(false);

  const isAdmin = user?.role === "admin";

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
      setEditDraft({
        name: data.user?.name || "",
        role: data.user?.role || "user",
      });
      setCreditForm({ action: "add", amount: "", note: "" });
    } catch (error) {
      console.error("Error fetching admin user details:", error);
      toast.error(error.response?.data?.error || "Failed to load user details.");
    } finally {
      setIsDetailsLoading(false);
    }
  }, []);

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

  useEffect(() => {
    const timer = window.setTimeout(fetchUsers, 250);

    return () => window.clearTimeout(timer);
  }, [fetchUsers]);

  useEffect(() => {
    setPage(1);
  }, [roleFilter, search]);

  const selectedBalance = selectedUser?.credits?.balance || 0;
  const numericCreditAmount = Number(creditForm.amount || 0);
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

  const updateSelectedUserInList = (nextUser) => {
    setUsersList((current) =>
      current.map((item) => (item._id === nextUser._id ? nextUser : item))
    );
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
              Users and credits
            </h1>
          </div>

          <Button
            type="button"
            variant="secondary"
            icon={RefreshCw}
            onClick={fetchUsers}
            isLoading={isLoading}
          >
            Refresh
          </Button>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
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
                      colSpan="6"
                      className="px-4 py-10 text-center text-slate-500 text-sm"
                    >
                      Loading users...
                    </td>
                  </tr>
                ) : usersList.length === 0 ? (
                  <tr>
                    <td
                      colSpan="6"
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
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
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
        creditPreview={creditPreview}
        canSaveUser={canSaveUser}
        canApplyCredits={canApplyCredits}
        creditWarning={creditWarning}
        isDetailsLoading={isDetailsLoading}
        isSavingUser={isSavingUser}
        isAdjustingCredits={isAdjustingCredits}
        onSaveUser={handleSaveUser}
        onAdjustCredits={handleAdjustCredits}
      />
    </DashboardLayout>
  );
}

export default AdminPage;
