import { useAuthContext } from "../../contexts/AuthContext";
import { ArrowRight, BookOpen, Sparkles, WandSparkles, Pen, Zap } from "lucide-react";
import { Link } from "react-router";
import React from "react";

const stats = [
  { value: "50K+", label: "Books Created" },
  { value: "4.9/5", label: "User Rating" },
  { value: "10min", label: "Avg. Creation" },
];

const floatingFeatures = [
  { icon: Pen, label: "Write" },
  { icon: WandSparkles, label: "AI Assist" },
  { icon: BookOpen, label: "Publish" },
  { icon: Zap, label: "Export" },
];

function Hero() {
  const { isAuthenticated } = useAuthContext();

  return (
    <article className="bg-linear-to-br from-violet-50 via-white to-purple-50 overflow-hidden relative">
      {/* Floating background orbs */}
      <div className="size-72 bg-violet-200/40 blur-3xl rounded-full absolute -left-16 top-10 animate-pulse" />
      <div className="size-96 bg-purple-200/30 blur-3xl rounded-full absolute -right-20 bottom-0 animate-pulse delay-700" />
      <div className="size-48 bg-violet-300/20 blur-2xl rounded-full absolute left-1/2 top-1/3 animate-pulse delay-1000" />

      <div className="max-w-4xl px-6 lg:px-8 py-20 sm:py-28 lg:py-36 mx-auto relative text-center">
        {/* Badge */}
        <div className="bg-white/80 backdrop-blur-sm border border-violet-100 rounded-full px-4 py-2 shadow-sm inline-flex items-center gap-x-2 mb-8">
          <WandSparkles className="size-4 text-violet-600" />
          <span className="text-violet-900 text-sm font-medium">
            Smart Publishing Platform
          </span>
        </div>

        {/* Main headline */}
        <h1 className="text-gray-900 text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight tracking-tight mb-6">
          Turn Ideas Into
          <br />
          <span className="text-gradient">Published Books</span>
        </h1>

        {/* Subheadline */}
        <p className="text-base sm:text-lg lg:text-xl text-gray-600 leading-relaxed max-w-2xl mx-auto mb-10">
          Write, design, and export professional books in minutes. Your
          personal publishing assistant that handles the heavy lifting.
        </p>

        {/* CTA links */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <Link
            to={isAuthenticated ? "/dashboard" : "/login"}
            className="bg-linear-to-r from-violet-600 to-purple-600 text-white font-semibold rounded-xl px-8 py-4 shadow-lg shadow-violet-500/30 inline-flex items-center gap-x-2 transition-all duration-200 hover:shadow-violet-500/50 hover:scale-105 focus-visible:shadow-violet-500/50 focus-visible:scale-105 group w-full sm:w-auto justify-center"
          >
            <span>{isAuthenticated ? "Go to Dashboard" : "Create with Bookify"}</span>
            <ArrowRight className="size-5 transition-transform group-hover:translate-x-1 group-focus-visible:translate-x-1" />
          </Link>

          <a
            href="#features"
            className="text-gray-700 font-medium inline-flex items-center gap-x-2 transition-colors duration-200 hover:text-violet-600 focus-visible:text-violet-600 w-full sm:w-auto justify-center"
          >
            <Sparkles className="size-5 text-violet-600" />
            <span>View Features</span>
          </a>
        </div>

        {/* Decorative floating feature pills */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-14">
          {floatingFeatures.map(({ icon, label }) => (
            <div
              key={label}
              className="bg-white/70 backdrop-blur-sm border border-violet-100 rounded-full px-5 py-2.5 shadow-sm inline-flex items-center gap-x-2 text-sm font-medium text-gray-700"
            >
              {React.createElement(icon, {
                className: "size-4 text-violet-500",
              })}
              <span>{label}</span>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12">
          {stats.map(({ value, label }, index) => (
            <React.Fragment key={index}>
              <div className="shrink-0 text-center">
                <p className="text-gray-900 text-2xl sm:text-3xl font-bold">{value}</p>
                <p className="text-gray-500 text-sm mt-0.5">{label}</p>
              </div>
              {index !== stats.length - 1 && (
                <div className="h-10 w-px bg-gray-200 hidden sm:block" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </article>
  );
}

export default Hero;
