import { useAuthContext } from "../../contexts/AuthContext";
import { Link } from "react-router";
import LogoIcon from "../LogoIcon";

const socials = [
  {
    href: "https://x.com/myaitutor",
    ariaLabel: "Visit @myaitutor on X (formerly Twitter)",
    imgSrc: "/social-icons/x.svg",
  },
];

function Footer() {
  const { isAuthenticated } = useAuthContext();

  return (
    <footer className="bg-zinc-950 text-white border-t border-violet-600/30">
      <div className="max-w-7xl px-6 lg:px-8 mx-auto">
        {/* Main footer content */}
        <div className="py-12 sm:py-16 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-10 lg:gap-20 items-start">

          {/* Brand column */}
          <div className="space-y-5">
            <a href="/" className="inline-flex items-center gap-x-2.5 group w-fit">
              <span className="size-9 bg-linear-to-br from-violet-600 to-purple-700 rounded-xl shadow-lg shadow-violet-600/30 inline-flex justify-center items-center transition-all duration-300 group-hover:shadow-violet-500/50 group-hover:scale-105">
                <LogoIcon className="size-5 text-white" />
              </span>
              <span className="font-headline text-xl font-bold tracking-tight text-white">
                Bookify
              </span>
            </a>

            <p className="text-zinc-500 text-sm leading-relaxed max-w-xs">
              Empowering storytellers to craft, design, and share their
              narratives with the world — effortlessly.
            </p>

            {/* Social links */}
            <ul className="flex items-center gap-x-2 pt-1">
              {socials.map(({ href, ariaLabel, imgSrc }, index) => (
                <li key={index}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={ariaLabel}
                    className="size-9 bg-white/5 rounded-lg inline-flex justify-center items-center transition-all duration-200 hover:bg-violet-600 hover:scale-105"
                  >
                    <img
                      src={imgSrc}
                      alt=""
                      className="size-4 brightness-0 invert"
                    />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Quick links */}
          <nav>
            <h3 className="text-zinc-400 text-xs font-semibold mb-4 tracking-widest uppercase">
              Quick Links
            </h3>
            <ul className="space-y-2.5">
              <li>
                <Link
                  to={isAuthenticated ? "/dashboard" : "/login"}
                  className="text-zinc-500 text-sm transition-colors duration-200 hover:text-white inline-block"
                >
                  Jump In
                </Link>
              </li>
              <li>
                <a
                  href="#features"
                  className="text-zinc-500 text-sm transition-colors duration-200 hover:text-white inline-block"
                >
                  Features
                </a>
              </li>
              <li>
                <a
                  href="#testimonials"
                  className="text-zinc-500 text-sm transition-colors duration-200 hover:text-white inline-block"
                >
                  Testimonials
                </a>
              </li>
            </ul>
          </nav>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/5 py-6 flex flex-col sm:flex-row justify-between items-center gap-y-3">
          <p className="text-zinc-600 text-xs">
            &copy; {new Date().getFullYear()} Bookify. All rights reserved.
          </p>
          <p className="text-zinc-600 text-xs flex items-center gap-x-1">
            <span>Crafted with</span>
            <span className="text-violet-400">&#9829;</span>
            <span>
              by{" "}
              <a
                href="https://x.com/myaitutor"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-500 transition-colors duration-200 hover:text-white"
              >
                AI Tutor
              </a>
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
