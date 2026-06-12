import { useEffect, useState } from "react";
import { useAuthContext } from "../contexts/AuthContext";
import { Link, useNavigate } from "react-router";
import { CreditBalancePill, LogoIcon, ProfileMenu } from "../components";
import axiosInstance from "../lib/axios";
import { API_ENDPOINTS } from "../utils/api-endpoints";
import { Clock3, FileText, KeyRound, Library, AlertTriangle, X } from "lucide-react";

function DashboardLayout({ children }) {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [showInsufficientModal, setShowInsufficientModal] = useState(false);
  const [insufficientDetails, setInsufficientDetails] = useState(null);

  const { user, unauthenticateUser, updateUser } = useAuthContext();
  const navigate = useNavigate();

  useEffect(() => {
    const handleInsufficient = (event) => {
      setInsufficientDetails(event.detail || null);
      setShowInsufficientModal(true);
    };

    window.addEventListener("credits:insufficient", handleInsufficient);
    return () => {
      window.removeEventListener("credits:insufficient", handleInsufficient);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const refreshProfile = async () => {
      try {
        const { data } = await axiosInstance.get(API_ENDPOINTS.PROFILE.GET);

        if (isMounted && data?.user) {
          updateUser(data.user);
        }
      } catch (error) {
        console.error("Error refreshing profile:", error);
      }
    };

    refreshProfile();

    return () => {
      isMounted = false;
    };
  }, [updateUser]);

  // Close profile dropdown menu when clicked outside
  useEffect(() => {
    const handleOutsideClicks = () => {
      if (isProfileMenuOpen) {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener("click", handleOutsideClicks);

    return () => document.removeEventListener("click", handleOutsideClicks);
  }, [isProfileMenuOpen]);

  const handleSignout = () => {
    unauthenticateUser(() => navigate("/", { replace: true }));
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      <header className="h-14 md:h-16 bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 md:px-6 flex justify-between items-center sticky top-0 z-20 shrink-0">
        {/* Logo section */}
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-x-2 md:gap-x-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 rounded-lg"
        >
          <span className="size-7 md:size-8 bg-linear-to-br from-violet-400 to-violet-500 rounded-lg shadow-lg shadow-violet-500/20 flex justify-center items-center transition-all duration-300 group-hover:shadow-violet-500/40 group-focus-visible:shadow-violet-500/40 group-hover:scale-105 group-focus-visible:scale-105">
            <LogoIcon className="size-4 md:size-5 text-white" />
          </span>
          <span className="text-gray-900 font-bold text-lg md:text-xl">
            Bookify
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            to="/jobs"
            className="hidden sm:inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
          >
            <Clock3 className="size-4" />
            Jobs
          </Link>

          <Link
            to="/docs"
            className="hidden sm:inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
          >
            <FileText className="size-4" />
            Docs
          </Link>

          <Link
            to="/api-docs"
            className="hidden lg:inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
          >
            <KeyRound className="size-4" />
            API
          </Link>

          <Link
            to="/community"
            className="hidden md:inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
          >
            <Library className="size-4" />
            Community
          </Link>

          <CreditBalancePill />

          {/* Profile menu */}
          <ProfileMenu
            isOpen={isProfileMenuOpen}
            onToggle={(event) => {
              event.stopPropagation();
              setIsProfileMenuOpen(!isProfileMenuOpen);
            }}
            avatarUrl={user?.avatar || ""}
            username={user?.name || ""}
            email={user?.email || ""}
            role={user?.role || "user"}
            signoutCallback={handleSignout}
          />
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">{children}</div>

      {/* Insufficient Credits Global Modal */}
      {showInsufficientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowInsufficientModal(false)}
              className="absolute top-4 right-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              aria-label="Close modal"
            >
              <X className="size-5" />
            </button>

             <div className="flex items-start gap-4">
              <div className="size-12 rounded-xl bg-amber-50 flex items-center justify-center shrink-0 border border-amber-200">
                <AlertTriangle className="size-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900">
                  Credit Top-Up Required
                </h3>
                <p className="text-slate-500 text-sm mt-2 leading-relaxed">
                  Your account does not have a sufficient credit balance to complete this action. Add a one-time credit pack or upgrade to a subscription plan to continue.
                </p>

                {insufficientDetails && (
                  <div className="mt-3 p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs space-y-1">
                    <p className="text-slate-400 font-semibold uppercase tracking-wider">Details</p>
                    <p className="text-slate-700">Available: <span className="font-bold">{insufficientDetails.balance || 0}</span> credits</p>
                    <p className="text-slate-700">Required: <span className="font-bold text-rose-600">{insufficientDetails.requiredCredits || 0}</span> credits</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setShowInsufficientModal(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowInsufficientModal(false);
                  navigate("/credits");
                }}
                className="px-5 py-2.5 text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 shadow-lg shadow-violet-500/20 active:scale-98 rounded-xl transition"
              >
                Add Credits / Upgrade
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DashboardLayout;
