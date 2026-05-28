import { useEffect, useState } from "react";
import { useAuthContext } from "../contexts/AuthContext";
import { Link, useNavigate } from "react-router";
import { CreditBalancePill, LogoIcon, ProfileMenu } from "../components";
import axiosInstance from "../lib/axios";
import { API_ENDPOINTS } from "../utils/api-endpoints";
import { Activity, Clock3, FileText, KeyRound } from "lucide-react";

function DashboardLayout({ children }) {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const { user, unauthenticateUser, updateUser } = useAuthContext();
  const navigate = useNavigate();

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
            to="/runs"
            className="hidden sm:inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
          >
            <Activity className="size-4" />
            Runs
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
    </div>
  );
}

export default DashboardLayout;
