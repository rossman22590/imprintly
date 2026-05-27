import { useEffect, useState } from "react";
import { useAuthContext } from "../../contexts/AuthContext";
import { Link, useLocation, useNavigate } from "react-router";
import { LogOut, Menu, X } from "lucide-react";
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from "framer-motion";
import ProfileMenu from "../ProfileMenu";
import LogoIcon from "../LogoIcon";

const navLinks = [
  { label: "Features", href: "/#features", hash: "#features" },
  { label: "Pricing", to: "/pricing" },
  { label: "Testimonials", href: "/#testimonials", hash: "#testimonials" },
];

function Navbar() {
  const { isAuthenticated, user, unauthenticateUser } = useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();

  const [activeUrlHash, setActiveUrlHash] = useState(window.location.hash);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    setIsScrolled(latest > 50);
  });

  useEffect(() => {
    const updateUrlHash = () => setActiveUrlHash(window.location.hash);
    window.addEventListener("hashchange", updateUrlHash);
    return () => window.removeEventListener("hashchange", updateUrlHash);
  }, []);

  useEffect(() => {
    const handleOutsideClicks = () => {
      if (isProfileMenuOpen) setIsProfileMenuOpen(false);
    };
    document.addEventListener("click", handleOutsideClicks);
    return () => document.removeEventListener("click", handleOutsideClicks);
  }, [isProfileMenuOpen]);

  const handleSignout = () => {
    unauthenticateUser(() => navigate("/", { replace: true }));
  };

  return (
    <motion.header
      className="sticky top-0 z-50 border-b transition-colors duration-300"
      animate={{
        backgroundColor: isScrolled ? "rgba(255,255,255,0.97)" : "rgba(255,255,255,0)",
        borderColor: isScrolled ? "rgba(228,228,231,1)" : "rgba(228,228,231,0)",
        boxShadow: isScrolled ? "0 1px 20px rgba(0,0,0,0.06)" : "none",
      }}
      transition={{ duration: 0.3 }}
    >
      <div className="max-w-7xl h-16 px-6 lg:px-8 mx-auto flex justify-between items-center gap-4">
        {/* Logo */}
        <Link to="/" className="inline-flex items-center gap-x-2.5 group">
          <motion.span
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.96 }}
            className="size-9 bg-linear-to-br from-violet-600 to-purple-700 rounded-xl shadow-lg shadow-violet-500/20 inline-flex justify-center items-center"
          >
            <LogoIcon className="size-5 text-white" />
          </motion.span>
          <span className="text-[1.05rem] font-bold text-zinc-900 tracking-tight font-headline">
            Bookify
          </span>
        </Link>

        {/* Desktop navigation */}
        <nav className="hidden lg:flex items-center gap-x-1">
          {navLinks.map(({ label, href, hash, to }) => {
            const isActive = to
              ? location.pathname === to
              : location.pathname === "/" && activeUrlHash === hash;
            return to ? (
              <Link
                key={label}
                to={to}
                className="relative px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors duration-200 group"
              >
                {label}
                <motion.span
                  className="absolute bottom-0 left-4 right-4 h-px bg-violet-600 origin-left"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: isActive ? 1 : 0 }}
                  whileHover={{ scaleX: 1 }}
                  transition={{ duration: 0.2 }}
                />
              </Link>
            ) : (
              <a
                key={label}
                href={href}
                className="relative px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors duration-200 group"
              >
                {label}
                <motion.span
                  className="absolute bottom-0 left-4 right-4 h-px bg-violet-600 origin-left"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: isActive ? 1 : 0 }}
                  whileHover={{ scaleX: 1 }}
                  transition={{ duration: 0.2 }}
                />
              </a>
            );
          })}
        </nav>

        {/* Desktop auth buttons */}
        <div className="hidden lg:flex items-center gap-x-3">
          {isAuthenticated ? (
            <ProfileMenu
              isOpen={isProfileMenuOpen}
              onToggle={(event) => {
                event.stopPropagation();
                setIsProfileMenuOpen(!isProfileMenuOpen);
              }}
              avatarUrl={user?.avatar}
              username={user?.name}
              email={user?.email}
              signoutCallback={handleSignout}
            />
          ) : (
            <>
              <Link
                to="/login"
                className="text-zinc-600 text-sm font-medium px-4 py-2 rounded-lg transition-colors duration-200 hover:bg-zinc-100 hover:text-zinc-900"
              >
                Sign in
              </Link>
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                <Link
                  to="/register"
                  className="bg-zinc-900 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-zinc-900/20 transition-all duration-200 hover:bg-zinc-800 inline-block"
                >
                  Get Started
                </Link>
              </motion.div>
            </>
          )}
        </div>

        {/* Mobile menu toggler */}
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
          className="lg:hidden text-zinc-600 rounded-full p-2 transition-colors duration-200 hover:bg-zinc-100 hover:text-zinc-900"
        >
          <AnimatePresence mode="wait" initial={false}>
            {isMobileMenuOpen ? (
              <motion.span
                key="close"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <X className="size-5" />
              </motion.span>
            ) : (
              <motion.span
                key="menu"
                initial={{ rotate: 90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -90, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Menu className="size-5" />
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            key="mobile-menu"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="lg:hidden overflow-hidden bg-white/98 backdrop-blur-md border-t border-zinc-100"
          >
            <nav className="p-4 grid grid-cols-1 gap-y-1">
              {navLinks.map(({ label, href, hash, to }) => {
                const isActive = to
                  ? location.pathname === to
                  : location.pathname === "/" && activeUrlHash === hash;
                const className = `text-sm font-medium rounded-lg px-4 py-2.5 transition-colors duration-200 ${
                  isActive
                    ? "bg-violet-50 text-violet-700"
                    : "text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900"
                }`;

                return to ? (
                  <Link
                    key={label}
                    to={to}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={className}
                  >
                    {label}
                  </Link>
                ) : (
                  <a
                    key={label}
                    href={href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={className}
                  >
                    {label}
                  </a>
                );
              })}
            </nav>

            <div className="p-4 border-t border-zinc-100">
              {isAuthenticated ? (
                <div className="space-y-3">
                  <div className="px-2 flex items-center gap-x-3">
                    <div className="size-10 bg-linear-to-br from-violet-500 to-purple-600 rounded-xl flex justify-center items-center shrink-0">
                      <span className="text-white text-sm font-semibold">
                        {user?.name?.[0]?.toUpperCase() ?? "U"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-zinc-900 text-sm font-medium truncate">{user?.name ?? ""}</p>
                      <p className="text-zinc-500 text-xs truncate">{user?.email ?? ""}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleSignout}
                    className="w-full text-red-600 text-sm font-medium rounded-lg px-4 py-2.5 flex justify-center items-center gap-x-2 transition-colors duration-200 hover:bg-red-50"
                  >
                    <LogOut className="size-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-y-2">
                  <Link
                    to="/login"
                    className="text-zinc-600 text-sm font-medium rounded-lg px-4 py-2.5 text-center transition-colors duration-200 hover:bg-zinc-50 hover:text-zinc-900"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/register"
                    className="bg-zinc-900 text-white text-sm font-semibold rounded-xl px-4 py-2.5 text-center shadow-md shadow-zinc-900/20 transition-colors duration-200 hover:bg-zinc-800"
                  >
                    Get Started
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

export default Navbar;
