export const PUBLIC_SHARE_THEME_OPTIONS = [
  {
    id: "violet-pink",
    label: "Violet Pink",
    description: "Deep purple with pink actions.",
    swatches: ["#3b1458", "#f9a8d4", "#fdf7ff"],
  },
  {
    id: "indigo-sky",
    label: "Indigo Sky",
    description: "Ink blue with bright sky accents.",
    swatches: ["#172554", "#7dd3fc", "#f7fbff"],
  },
  {
    id: "teal-lime",
    label: "Teal Lime",
    description: "Deep teal with lime highlights.",
    swatches: ["#064e3b", "#bef264", "#f7fffb"],
  },
  {
    id: "coral-pop",
    label: "Coral Pop",
    description: "Rich berry with coral actions.",
    swatches: ["#881337", "#fb7185", "#fff7f7"],
  },
  {
    id: "ocean-mint",
    label: "Ocean Mint",
    description: "Cool cyan with mint surfaces.",
    swatches: ["#164e63", "#67e8f9", "#f0fdfa"],
  },
  {
    id: "minimal-white",
    label: "Minimal White",
    description: "Clean white with black actions.",
    swatches: ["#ffffff", "#e5e7eb", "#111827"],
  },
  {
    id: "soft-gray",
    label: "Soft Gray",
    description: "Quiet gray with slate controls.",
    swatches: ["#f8fafc", "#94a3b8", "#1f2937"],
  },
  {
    id: "graphite-black",
    label: "Graphite Black",
    description: "Black, white, and restrained gray.",
    swatches: ["#030712", "#71717a", "#f9fafb"],
  },
];

const PUBLIC_SHARE_THEMES = {
  "violet-pink": {
    page: "bg-[#fdf7ff] text-[#2f1245]",
    skeleton: "bg-fuchsia-100",
    hero: "bg-[#3b1458] text-[#fff7ff]",
    heroBorder: "border-fuchsia-950/40",
    heroLink: "text-purple-100 hover:text-white focus-visible:ring-pink-200",
    eyebrow: "text-pink-200",
    heroMuted: "text-purple-100",
    heroSubtle: "text-purple-200",
    heroBody: "text-purple-50",
    primaryButton:
      "bg-pink-300 text-purple-950 hover:bg-pink-200 focus-visible:ring-pink-100",
    secondaryButton:
      "bg-fuchsia-200 text-purple-950 hover:bg-fuchsia-100 focus-visible:ring-fuchsia-100",
    ghostButton:
      "bg-white/10 text-white hover:bg-white/15 focus-visible:ring-pink-100",
    darkButton:
      "bg-[#5b1b7a] text-white hover:bg-[#4a1367] focus-visible:ring-fuchsia-400",
    card: "bg-white border-fuchsia-100 shadow-fuchsia-100/60",
    cardEyebrow: "text-fuchsia-600",
    cardMuted: "text-purple-700",
    cardBody: "text-purple-800",
    soft: "bg-fuchsia-50",
    softText: "text-fuchsia-500",
    icon: "text-fuchsia-700",
    iconBorder: "border-fuchsia-100 hover:bg-fuchsia-50 focus-visible:ring-fuchsia-400",
    outline:
      "border-fuchsia-200 text-purple-900 hover:bg-fuchsia-50 focus-visible:ring-fuchsia-400",
    flipbookBg: "bg-[#2f1245] text-[#fff7ff] shadow-fuchsia-950/20",
    flipbookPage: "bg-[#fff7ff]",
    flipbookGlow:
      "bg-[radial-gradient(circle_at_25%_10%,rgba(244,114,182,0.24),transparent_28rem)]",
    flipbookAccent: "text-pink-200",
    flipbookProgress: "bg-pink-300",
    flipbookCaption: "text-pink-100/80",
    flipbookPrimary:
      "bg-pink-300 text-purple-950 hover:bg-pink-200 focus-visible:ring-pink-100",
    flipbookControl:
      "bg-white/10 text-white hover:bg-white/15 focus-visible:ring-pink-200",
  },
  "indigo-sky": {
    page: "bg-[#f7fbff] text-[#102044]",
    skeleton: "bg-sky-100",
    hero: "bg-[#172554] text-[#f8fbff]",
    heroBorder: "border-blue-950/40",
    heroLink: "text-sky-100 hover:text-white focus-visible:ring-sky-200",
    eyebrow: "text-sky-200",
    heroMuted: "text-blue-100",
    heroSubtle: "text-sky-200",
    heroBody: "text-blue-50",
    primaryButton:
      "bg-sky-300 text-blue-950 hover:bg-sky-200 focus-visible:ring-sky-100",
    secondaryButton:
      "bg-indigo-200 text-blue-950 hover:bg-indigo-100 focus-visible:ring-indigo-100",
    ghostButton:
      "bg-white/10 text-white hover:bg-white/15 focus-visible:ring-sky-100",
    darkButton:
      "bg-[#1d4ed8] text-white hover:bg-[#1e40af] focus-visible:ring-sky-400",
    card: "bg-white border-sky-100 shadow-sky-100/60",
    cardEyebrow: "text-sky-700",
    cardMuted: "text-blue-700",
    cardBody: "text-blue-900",
    soft: "bg-sky-50",
    softText: "text-sky-600",
    icon: "text-sky-700",
    iconBorder: "border-sky-100 hover:bg-sky-50 focus-visible:ring-sky-400",
    outline:
      "border-sky-200 text-blue-900 hover:bg-sky-50 focus-visible:ring-sky-400",
    flipbookBg: "bg-[#102044] text-[#f8fbff] shadow-blue-950/20",
    flipbookPage: "bg-[#f8fbff]",
    flipbookGlow:
      "bg-[radial-gradient(circle_at_25%_10%,rgba(125,211,252,0.24),transparent_28rem)]",
    flipbookAccent: "text-sky-200",
    flipbookProgress: "bg-sky-300",
    flipbookCaption: "text-sky-100/80",
    flipbookPrimary:
      "bg-sky-300 text-blue-950 hover:bg-sky-200 focus-visible:ring-sky-100",
    flipbookControl:
      "bg-white/10 text-white hover:bg-white/15 focus-visible:ring-sky-200",
  },
  "teal-lime": {
    page: "bg-[#f7fffb] text-[#073b35]",
    skeleton: "bg-emerald-100",
    hero: "bg-[#064e3b] text-[#f7fffb]",
    heroBorder: "border-emerald-950/40",
    heroLink: "text-emerald-100 hover:text-white focus-visible:ring-lime-200",
    eyebrow: "text-lime-200",
    heroMuted: "text-emerald-100",
    heroSubtle: "text-lime-200",
    heroBody: "text-emerald-50",
    primaryButton:
      "bg-lime-300 text-emerald-950 hover:bg-lime-200 focus-visible:ring-lime-100",
    secondaryButton:
      "bg-teal-200 text-emerald-950 hover:bg-teal-100 focus-visible:ring-teal-100",
    ghostButton:
      "bg-white/10 text-white hover:bg-white/15 focus-visible:ring-lime-100",
    darkButton:
      "bg-[#047857] text-white hover:bg-[#065f46] focus-visible:ring-lime-400",
    card: "bg-white border-emerald-100 shadow-emerald-100/60",
    cardEyebrow: "text-emerald-700",
    cardMuted: "text-emerald-700",
    cardBody: "text-emerald-900",
    soft: "bg-emerald-50",
    softText: "text-emerald-600",
    icon: "text-emerald-700",
    iconBorder:
      "border-emerald-100 hover:bg-emerald-50 focus-visible:ring-lime-400",
    outline:
      "border-emerald-200 text-emerald-900 hover:bg-emerald-50 focus-visible:ring-lime-400",
    flipbookBg: "bg-[#073b35] text-[#f7fffb] shadow-emerald-950/20",
    flipbookPage: "bg-[#f7fffb]",
    flipbookGlow:
      "bg-[radial-gradient(circle_at_25%_10%,rgba(190,242,100,0.24),transparent_28rem)]",
    flipbookAccent: "text-lime-200",
    flipbookProgress: "bg-lime-300",
    flipbookCaption: "text-lime-100/80",
    flipbookPrimary:
      "bg-lime-300 text-emerald-950 hover:bg-lime-200 focus-visible:ring-lime-100",
    flipbookControl:
      "bg-white/10 text-white hover:bg-white/15 focus-visible:ring-lime-200",
  },
  "coral-pop": {
    page: "bg-[#fff7f7] text-[#4a1024]",
    skeleton: "bg-rose-100",
    hero: "bg-[#881337] text-[#fff7f7]",
    heroBorder: "border-rose-950/40",
    heroLink: "text-rose-100 hover:text-white focus-visible:ring-rose-200",
    eyebrow: "text-rose-200",
    heroMuted: "text-rose-100",
    heroSubtle: "text-rose-200",
    heroBody: "text-rose-50",
    primaryButton:
      "bg-rose-300 text-rose-950 hover:bg-rose-200 focus-visible:ring-rose-100",
    secondaryButton:
      "bg-pink-200 text-rose-950 hover:bg-pink-100 focus-visible:ring-pink-100",
    ghostButton:
      "bg-white/10 text-white hover:bg-white/15 focus-visible:ring-rose-100",
    darkButton:
      "bg-[#be123c] text-white hover:bg-[#9f1239] focus-visible:ring-rose-400",
    card: "bg-white border-rose-100 shadow-rose-100/60",
    cardEyebrow: "text-rose-700",
    cardMuted: "text-rose-700",
    cardBody: "text-rose-900",
    soft: "bg-rose-50",
    softText: "text-rose-600",
    icon: "text-rose-700",
    iconBorder: "border-rose-100 hover:bg-rose-50 focus-visible:ring-rose-400",
    outline:
      "border-rose-200 text-rose-900 hover:bg-rose-50 focus-visible:ring-rose-400",
    flipbookBg: "bg-[#4a1024] text-[#fff7f7] shadow-rose-950/20",
    flipbookPage: "bg-[#fff7f7]",
    flipbookGlow:
      "bg-[radial-gradient(circle_at_25%_10%,rgba(251,113,133,0.24),transparent_28rem)]",
    flipbookAccent: "text-rose-200",
    flipbookProgress: "bg-rose-300",
    flipbookCaption: "text-rose-100/80",
    flipbookPrimary:
      "bg-rose-300 text-rose-950 hover:bg-rose-200 focus-visible:ring-rose-100",
    flipbookControl:
      "bg-white/10 text-white hover:bg-white/15 focus-visible:ring-rose-200",
  },
  "ocean-mint": {
    page: "bg-[#f0fdfa] text-[#103a43]",
    skeleton: "bg-cyan-100",
    hero: "bg-[#164e63] text-[#f0fdfa]",
    heroBorder: "border-cyan-950/40",
    heroLink: "text-cyan-100 hover:text-white focus-visible:ring-cyan-200",
    eyebrow: "text-cyan-200",
    heroMuted: "text-cyan-100",
    heroSubtle: "text-teal-200",
    heroBody: "text-cyan-50",
    primaryButton:
      "bg-cyan-300 text-cyan-950 hover:bg-cyan-200 focus-visible:ring-cyan-100",
    secondaryButton:
      "bg-teal-200 text-cyan-950 hover:bg-teal-100 focus-visible:ring-teal-100",
    ghostButton:
      "bg-white/10 text-white hover:bg-white/15 focus-visible:ring-cyan-100",
    darkButton:
      "bg-[#0891b2] text-white hover:bg-[#0e7490] focus-visible:ring-cyan-400",
    card: "bg-white border-cyan-100 shadow-cyan-100/60",
    cardEyebrow: "text-cyan-700",
    cardMuted: "text-cyan-700",
    cardBody: "text-cyan-900",
    soft: "bg-cyan-50",
    softText: "text-cyan-600",
    icon: "text-cyan-700",
    iconBorder: "border-cyan-100 hover:bg-cyan-50 focus-visible:ring-cyan-400",
    outline:
      "border-cyan-200 text-cyan-900 hover:bg-cyan-50 focus-visible:ring-cyan-400",
    flipbookBg: "bg-[#103a43] text-[#f0fdfa] shadow-cyan-950/20",
    flipbookPage: "bg-[#f0fdfa]",
    flipbookGlow:
      "bg-[radial-gradient(circle_at_25%_10%,rgba(103,232,249,0.24),transparent_28rem)]",
    flipbookAccent: "text-cyan-200",
    flipbookProgress: "bg-cyan-300",
    flipbookCaption: "text-cyan-100/80",
    flipbookPrimary:
      "bg-cyan-300 text-cyan-950 hover:bg-cyan-200 focus-visible:ring-cyan-100",
    flipbookControl:
      "bg-white/10 text-white hover:bg-white/15 focus-visible:ring-cyan-200",
  },
  "minimal-white": {
    page: "bg-white text-gray-950",
    skeleton: "bg-gray-100",
    hero: "bg-white text-gray-950",
    heroBorder: "border-gray-200",
    heroLink: "text-gray-600 hover:text-gray-950 focus-visible:ring-gray-400",
    eyebrow: "text-gray-600",
    heroMuted: "text-gray-600",
    heroSubtle: "text-gray-500",
    heroBody: "text-gray-700",
    primaryButton:
      "bg-gray-950 text-white hover:bg-gray-800 focus-visible:ring-gray-400",
    secondaryButton:
      "bg-gray-100 text-gray-950 hover:bg-gray-200 focus-visible:ring-gray-300",
    ghostButton:
      "bg-gray-100 text-gray-950 hover:bg-gray-200 focus-visible:ring-gray-300",
    darkButton:
      "bg-gray-950 text-white hover:bg-gray-800 focus-visible:ring-gray-400",
    card: "bg-white border-gray-200 shadow-gray-100/70",
    cardEyebrow: "text-gray-600",
    cardMuted: "text-gray-600",
    cardBody: "text-gray-800",
    soft: "bg-gray-50",
    softText: "text-gray-500",
    icon: "text-gray-700",
    iconBorder: "border-gray-200 hover:bg-gray-50 focus-visible:ring-gray-400",
    outline:
      "border-gray-300 text-gray-900 hover:bg-gray-50 focus-visible:ring-gray-400",
    flipbookBg: "bg-white text-gray-950 shadow-gray-200/80 border border-gray-200",
    flipbookPage: "bg-white",
    flipbookGlow:
      "bg-[radial-gradient(circle_at_25%_10%,rgba(229,231,235,0.48),transparent_28rem)]",
    flipbookAccent: "text-gray-600",
    flipbookProgress: "bg-gray-950",
    flipbookCaption: "text-gray-500",
    flipbookPrimary:
      "bg-gray-950 text-white hover:bg-gray-800 focus-visible:ring-gray-400",
    flipbookControl:
      "bg-gray-100 text-gray-950 hover:bg-gray-200 focus-visible:ring-gray-300",
  },
  "soft-gray": {
    page: "bg-slate-50 text-slate-950",
    skeleton: "bg-slate-200",
    hero: "bg-slate-200 text-slate-950",
    heroBorder: "border-slate-300",
    heroLink: "text-slate-700 hover:text-slate-950 focus-visible:ring-slate-400",
    eyebrow: "text-slate-600",
    heroMuted: "text-slate-700",
    heroSubtle: "text-slate-600",
    heroBody: "text-slate-800",
    primaryButton:
      "bg-slate-800 text-white hover:bg-slate-700 focus-visible:ring-slate-400",
    secondaryButton:
      "bg-slate-300 text-slate-950 hover:bg-slate-200 focus-visible:ring-slate-400",
    ghostButton:
      "bg-white/60 text-slate-950 hover:bg-white focus-visible:ring-slate-400",
    darkButton:
      "bg-slate-800 text-white hover:bg-slate-700 focus-visible:ring-slate-400",
    card: "bg-white border-slate-200 shadow-slate-200/60",
    cardEyebrow: "text-slate-600",
    cardMuted: "text-slate-600",
    cardBody: "text-slate-800",
    soft: "bg-slate-100",
    softText: "text-slate-500",
    icon: "text-slate-700",
    iconBorder: "border-slate-200 hover:bg-slate-100 focus-visible:ring-slate-400",
    outline:
      "border-slate-300 text-slate-900 hover:bg-slate-100 focus-visible:ring-slate-400",
    flipbookBg: "bg-slate-800 text-white shadow-slate-950/20",
    flipbookPage: "bg-slate-50",
    flipbookGlow:
      "bg-[radial-gradient(circle_at_25%_10%,rgba(148,163,184,0.28),transparent_28rem)]",
    flipbookAccent: "text-slate-200",
    flipbookProgress: "bg-slate-200",
    flipbookCaption: "text-slate-200/80",
    flipbookPrimary:
      "bg-slate-200 text-slate-950 hover:bg-white focus-visible:ring-slate-300",
    flipbookControl:
      "bg-white/10 text-white hover:bg-white/15 focus-visible:ring-slate-300",
  },
  "graphite-black": {
    page: "bg-[#030712] text-gray-50",
    skeleton: "bg-zinc-800",
    hero: "bg-[#030712] text-gray-50",
    heroBorder: "border-zinc-800",
    heroLink: "text-gray-300 hover:text-white focus-visible:ring-zinc-400",
    eyebrow: "text-gray-300",
    heroMuted: "text-gray-300",
    heroSubtle: "text-zinc-400",
    heroBody: "text-gray-200",
    primaryButton:
      "bg-white text-gray-950 hover:bg-gray-200 focus-visible:ring-zinc-300",
    secondaryButton:
      "bg-zinc-800 text-white hover:bg-zinc-700 focus-visible:ring-zinc-400",
    ghostButton:
      "bg-white/10 text-white hover:bg-white/15 focus-visible:ring-zinc-300",
    darkButton:
      "bg-white text-gray-950 hover:bg-gray-200 focus-visible:ring-zinc-300",
    card: "bg-zinc-950 border-zinc-800 shadow-black/30",
    cardEyebrow: "text-gray-400",
    cardMuted: "text-gray-300",
    cardBody: "text-gray-200",
    soft: "bg-zinc-900",
    softText: "text-zinc-400",
    icon: "text-gray-200",
    iconBorder: "border-zinc-800 hover:bg-zinc-900 focus-visible:ring-zinc-400",
    outline:
      "border-zinc-700 text-gray-100 hover:bg-zinc-900 focus-visible:ring-zinc-400",
    flipbookBg: "bg-[#030712] text-gray-50 shadow-black/40 border border-zinc-800",
    flipbookPage: "bg-zinc-950",
    flipbookGlow:
      "bg-[radial-gradient(circle_at_25%_10%,rgba(113,113,122,0.28),transparent_28rem)]",
    flipbookAccent: "text-gray-300",
    flipbookProgress: "bg-white",
    flipbookCaption: "text-gray-300/80",
    flipbookPrimary:
      "bg-white text-gray-950 hover:bg-gray-200 focus-visible:ring-zinc-300",
    flipbookControl:
      "bg-white/10 text-white hover:bg-white/15 focus-visible:ring-zinc-300",
  },
};

export function getPublicShareTheme(themeId = "") {
  return (
    PUBLIC_SHARE_THEMES[themeId] || PUBLIC_SHARE_THEMES["violet-pink"]
  );
}

export function normalizePublicShareTheme(themeId = "") {
  return PUBLIC_SHARE_THEMES[themeId] ? themeId : "violet-pink";
}

export function getProfileShareSlug(name = "") {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const firstName = parts[0] || "author";
  const lastInitial = parts.length > 1 ? parts[parts.length - 1][0] : "";
  const slug = `${firstName}${lastInitial}`
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();

  return slug || "author";
}

export function getPublicSharePath(token = "", profileName = "") {
  if (!token) return "";

  return `/${getProfileShareSlug(profileName)}/${token}`;
}

export function getPublicShareUrl(token = "", profileName = "") {
  if (!token || typeof window === "undefined") return "";

  return `${window.location.origin}${getPublicSharePath(token, profileName)}`;
}
