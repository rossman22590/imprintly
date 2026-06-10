import { createElement, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  AlertTriangle,
  BookOpen,
  Brush,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleHelp,
  Coins,
  CreditCard,
  Cpu,
  Download,
  ExternalLink,
  Eye,
  FileDown,
  FileText,
  Globe2,
  Image,
  KeyRound,
  Layers3,
  LayoutDashboard,
  Library,
  Link2,
  ListChecks,
  Palette,
  PenLine,
  Rocket,
  Search,
  Settings2,
  Share2,
  Sparkles,
  Store,
  Type,
  UserRound,
  WandSparkles,
  Zap,
} from "lucide-react";
import DashboardLayout from "../layouts/DashboardLayout";

const NAV_GROUPS = [
  {
    title: "Start",
    items: [
      { id: "overview", label: "What Bookify does", icon: Sparkles },
      { id: "quick-start", label: "Quick start", icon: Rocket },
      { id: "workflow-map", label: "How features connect", icon: Layers3 },
    ],
  },
  {
    title: "Build",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "editor", label: "Book editor", icon: PenLine },
      { id: "kdp-studio", label: "KDP Studio", icon: FileText },
      { id: "exports", label: "Exports", icon: Download },
      { id: "credits", label: "Credits", icon: Coins },
      { id: "ai-models", label: "AI models", icon: Cpu },
    ],
  },
  {
    title: "Share",
    items: [
      { id: "public-sharing", label: "Public sharing", icon: Share2 },
      { id: "profile-brand", label: "Profile and brand", icon: UserRound },
      { id: "seo", label: "SEO and social cards", icon: Globe2 },
      { id: "themes", label: "Themes", icon: Palette },
    ],
  },
];

const ON_THIS_PAGE = [
  { id: "overview", label: "What Bookify does" },
  { id: "quick-start", label: "Quick start" },
  { id: "workflow-map", label: "How it connects" },
  { id: "core-guides", label: "Feature guides" },
  { id: "credits", label: "Credits" },
  { id: "ai-models", label: "AI models" },
  { id: "field-reference", label: "Field reference" },
  { id: "checklists", label: "Checklists" },
  { id: "troubleshooting", label: "Troubleshooting" },
];

const QUICK_LINKS = [
  { label: "Open Dashboard", to: "/dashboard", icon: Library },
  { label: "Credits", to: "/credits", icon: CreditCard },
  { label: "Edit Profile", to: "/profile", icon: Settings2 },
];

const START_STEPS = [
  {
    step: "01",
    title: "Create a book",
    icon: BookOpen,
    text: "Start from the dashboard. Add the topic, audience, genre, language, and chapter count so the generator has enough context.",
    path: "/dashboard",
  },
  {
    step: "02",
    title: "Review the structure",
    icon: ListChecks,
    text: "Open the editor and check title, subtitle, author, chapters, and outline before spending credits on longer generation.",
    path: "/dashboard",
  },
  {
    step: "03",
    title: "Generate and edit",
    icon: WandSparkles,
    text: "Generate chapter content, then revise for voice, claims, flow, and formatting. Treat AI output as a strong draft.",
    path: "/dashboard",
  },
  {
    step: "04",
    title: "Package for publishing",
    icon: FileText,
    text: "Use KDP Studio for description, keywords, categories, author bio, back cover blurb, risk notes, and table of contents.",
    path: "/dashboard",
  },
  {
    step: "05",
    title: "Export files",
    icon: FileDown,
    text: "Export PDF, DOCX, EPUB, or Markdown after the manuscript is stable. Regenerate exports after major edits.",
    path: "/dashboard",
  },
  {
    step: "06",
    title: "Share the launch",
    icon: Share2,
    text: "Create a shelf link or preview link, choose colors, and make sure profile SEO fields are ready before posting.",
    path: "/profile",
  },
];

const WORKFLOW_LANES = [
  {
    title: "Private writing workspace",
    icon: KeyRound,
    summary:
      "Everything starts privately. Your dashboard, editor, KDP Studio, and exports are visible only after sign in.",
    points: [
      "Dashboard stores your library and view mode.",
      "Editor stores book details, chapters, and images.",
      "KDP Studio stores publishing assets and metadata.",
      "Exports create files from the latest saved manuscript.",
    ],
  },
  {
    title: "Public author layer",
    icon: Globe2,
    summary:
      "Profile settings and share modals control what readers see on your public shelf and first-chapter preview pages.",
    points: [
      "Full Name becomes the pretty URL prefix.",
      "Shelf Page Name and Shelf Photo shape the public shelf header.",
      "Store Link gives readers somewhere to buy or follow.",
      "SEO fields control title, description, and share image.",
    ],
  },
];

const GUIDES = [
  {
    id: "dashboard",
    group: "Library",
    title: "Dashboard and library",
    icon: LayoutDashboard,
    description:
      "The dashboard is the home base for every book. It keeps the library visible, lets you switch between Standard and 3D Shelf views, and exposes creation, editing, reading, deletion, and shelf sharing.",
    useWhen:
      "Use this page whenever you need to create a book, open an existing book, share the whole shelf, or switch the way the library is displayed.",
    sections: [
      {
        heading: "What you can do",
        bullets: [
          "Create a new AI book from the Create AI Book button.",
          "Open a book card to read, edit, or continue working on the manuscript.",
          "Switch between Standard view and 3D Shelf view. New signups default to Standard view.",
          "Open Share Shelf to create, copy, open, recolor, or revoke the public shelf link.",
        ],
      },
      {
        heading: "How shelf sharing works",
        bullets: [
          "Only one shelf link can be active at a time.",
          "Creating a link gives a public URL such as /rossc/shelf_token.",
          "Revoking the link kills the old URL immediately.",
          "The share modal also stores the public color theme used by shelf and preview pages.",
        ],
      },
    ],
    callout:
      "Keep Standard view for day-to-day work and use 3D Shelf when you want a visual library presentation.",
  },
  {
    id: "editor",
    group: "Writing",
    title: "Book editor",
    icon: PenLine,
    description:
      "The editor is where the manuscript becomes usable. It combines book details, chapter navigation, content generation, manual editing, images, and preview reading in one workspace.",
    useWhen:
      "Use this page when the book still needs structure, chapters, rewrites, generated images, or proofreading before export.",
    sections: [
      {
        heading: "Book details",
        bullets: [
          "Confirm the title, subtitle, author, language, audience, and genre before generating long content.",
          "Use a clear audience description because it affects tone, examples, and chapter depth.",
          "Keep metadata aligned with the final book so exports and KDP assets are accurate.",
          "Save changes before leaving the page or generating dependent assets.",
        ],
      },
      {
        heading: "Chapters and content",
        bullets: [
          "Generate chapter drafts, then edit manually for voice and accuracy.",
          "Use chapter navigation to keep the manuscript order clean.",
          "Add images where they help explain or sell the book.",
          "Preview the book as a reader before sending it to exports or public preview.",
        ],
      },
    ],
    callout:
      "Do not publish raw AI output. The best results come from generating structure quickly, then editing for authority and brand voice.",
  },
  {
    id: "kdp-studio",
    group: "Publishing",
    title: "KDP Studio",
    icon: FileText,
    description:
      "KDP Studio turns the manuscript into publishing support material. It is built for the work around the book: sales copy, keywords, categories, author positioning, table of contents, cover direction, and quality checks.",
    useWhen:
      "Use this after chapters are mostly stable and you are preparing a store listing, launch page, or upload package.",
    sections: [
      {
        heading: "Listing assets",
        bullets: [
          "Draft or revise the book description with a clearer hook, promise, and reader outcome.",
          "Store keyword ideas and category direction for Amazon KDP research.",
          "Write the author bio and back cover blurb from the same context as the manuscript.",
          "Keep all listing copy near the book so the launch package does not drift.",
        ],
      },
      {
        heading: "Production support",
        bullets: [
          "Generate a table of contents PDF when the chapter list is ready.",
          "Capture cover prompts or art direction for a designer or image generator.",
          "Use risk notes to flag unsupported claims, weak structure, or missing citations.",
          "Re-run AI assist after major manuscript changes so metadata matches the final content.",
        ],
      },
    ],
    callout:
      "KDP Studio is not a replacement for store research, but it keeps the author package coherent and much faster to assemble.",
  },
  {
    id: "exports",
    group: "Files",
    title: "Exports",
    icon: Download,
    description:
      "Exports convert the saved manuscript into formats you can read, review, edit, or upload elsewhere. The export is only as current as the saved book content at the time it was generated.",
    useWhen:
      "Use exports when the manuscript is ready for proofreading, client review, print prep, external editing, or digital reading.",
    sections: [
      {
        heading: "Available formats",
        bullets: [
          "PDF is best for reading, reviewing, printing, and first-chapter preview generation.",
          "DOCX is best when you want to edit in Word or send the manuscript to an editor.",
          "EPUB is best for digital reading flows.",
          "Markdown is best for portable plain text, backups, and tool-friendly editing.",
        ],
      },
      {
        heading: "Export habits",
        bullets: [
          "Save manuscript changes first, then export.",
          "Regenerate files after adding images, changing chapter titles, or rewriting sections.",
          "Check the PDF visually before using it as a public preview source.",
          "Keep the latest export tied to the latest launch copy in KDP Studio.",
        ],
      },
    ],
    callout:
      "If an exported file looks stale, the usual fix is to save the manuscript and generate the export again.",
  },
  {
    id: "credits",
    group: "Usage",
    title: "Credits and billing",
    icon: Coins,
    description:
      "Credits are the metered balance used for AI work inside Bookify. Text generation spends credits based on billed token usage, image generation spends a fixed image amount, and the Credits page shows the running ledger.",
    useWhen:
      "Use this page when you need to understand your balance, buy more credits, review a transaction, or check whether a monthly plan reset changed the available amount.",
    sections: [
      {
        heading: "Where to manage credits",
        bullets: [
          "The credit pill in the app header shows the current balance and opens Credits and transactions.",
          "The Credits page shows available balance, lifetime spent, current rates, and recent transaction history.",
          "Buy Credits opens the Stripe checkout link for one-time purchases.",
          "Balances refresh after successful AI requests and when the app window regains focus.",
        ],
      },
      {
        heading: "What spends credits",
        bullets: [
          "Chapter and structure generation debit credits from the actual token cost after the configured markup.",
          "Image generation uses the fixed image credit amount shown on the Credits page.",
          "If the balance is lower than the required charge, generation is blocked before spending.",
          "Transaction rows show whether a charge came from text tokens, images, grants, admin adjustments, or monthly resets.",
        ],
      },
      {
        heading: "Monthly plans",
        bullets: [
          "Premium and Ultra accounts can have recurring monthly credit allowances.",
          "Monthly credits reset on the 1st of each month to the plan allowance.",
          "A reset sets the balance to the allowance; it is not a top-up added on top of leftover credits.",
          "Admins can also assign a custom monthly amount or disable monthly resets.",
        ],
      },
    ],
    callout:
      "The Credits page is the source of truth for live rates and balances because admins and environment settings can change credit amounts.",
  },
  {
    id: "public-sharing",
    group: "Growth",
    title: "Public shelf and preview pages",
    icon: Share2,
    description:
      "Public sharing gives you two reader-facing surfaces: a bookshelf for the whole catalog and a first-chapter preview for a specific book. Both are meant to be shared outside the app.",
    useWhen:
      "Use public sharing when you want to post a link on social, send a book teaser, or point readers to a store page.",
    sections: [
      {
        heading: "Bookshelf link",
        bullets: [
          "Created from Share Shelf on the dashboard.",
          "Uses your pretty slug when a Full Name is set, such as /rossc/shelf_token.",
          "Shows books from your library and the public shelf header from profile settings.",
          "Can show a Store Link for books that do not have a first-chapter preview ready.",
        ],
      },
      {
        heading: "Preview link",
        bullets: [
          "Created from a book share action when you want a sales-page style preview.",
          "Uses a public URL such as /rossc/preview_token.",
          "Shows first-chapter content and a PDF flipbook preview when available.",
          "Uses Store Link, theme, and SEO profile fields so it feels connected to your brand.",
        ],
      },
    ],
    callout:
      "The shelf link sells the catalog. The preview link sells one book. Use both during a launch.",
  },
  {
    id: "profile-brand",
    group: "Brand",
    title: "Profile settings and public brand",
    icon: UserRound,
    description:
      "The profile page is the control panel for your public identity. It affects URLs, headers, store buttons, shelf photos, and social previews.",
    useWhen:
      "Use Profile before sharing links publicly, especially if you want your page to look branded instead of generic.",
    sections: [
      {
        heading: "Identity fields",
        bullets: [
          "Full Name is required and is used to build the pretty public slug.",
          "A name like Ross Cohen becomes a readable prefix like /rossc/ before the share token.",
          "Changing the name can change future pretty links, so keep it stable for a launch.",
          "Avatar is private workspace identity and does not replace the shelf photo.",
        ],
      },
      {
        heading: "Public shelf fields",
        bullets: [
          "Store Link appears on public preview pages and shelf cards when a preview is not available.",
          "Shelf Page Name overrides the default public shelf heading.",
          "Shelf Photo URL appears near the top of shared shelf pages.",
          "Use direct image URLs to PNG, JPG, or WebP files for shelf photos and share images.",
        ],
      },
    ],
    callout:
      "Profile is the first place to check when a public page looks generic, has the wrong title, or is missing a store button.",
  },
  {
    id: "seo",
    group: "Discovery",
    title: "SEO and social preview metadata",
    icon: Globe2,
    description:
      "Public shelf and preview pages include metadata for search engines and social platforms. Profile fields let you control the visible title, description, and share image.",
    useWhen:
      "Use this before posting links on social, sending links to partners, or sharing a launch page in public.",
    sections: [
      {
        heading: "Metadata fields",
        bullets: [
          "Share Meta Title controls the title used by public shelf and preview metadata.",
          "Share Meta Description controls the summary text shown by search and social previews.",
          "Share Image URL controls the image used in social cards when platforms fetch the link.",
          "If SEO fields are blank, public pages fall back to sensible book or shelf defaults.",
        ],
      },
      {
        heading: "Image guidance",
        bullets: [
          "Use a 1200x630 PNG for the cleanest social card crop.",
          "Keep important text away from the image edges because platforms crop differently.",
          "Use a direct image URL, not a page that contains an image.",
          "Social platforms cache aggressively, so old cards can linger after changes.",
        ],
      },
    ],
    callout:
      "SEO changes affect what the app serves immediately, but social networks may need time or a manual re-scrape to show the new card.",
  },
  {
    id: "themes",
    group: "Design",
    title: "Share page themes",
    icon: Palette,
    description:
      "The public shelf and preview pages listen to your selected share theme. The theme is picked in the dashboard share modal and applies across all public share surfaces.",
    useWhen:
      "Use themes when you want public pages to better match the genre, audience, author brand, or launch mood.",
    sections: [
      {
        heading: "Theme behavior",
        bullets: [
          "If no theme is selected, public pages keep the default style.",
          "A selected theme applies to both shelf pages and preview pages.",
          "The choice is saved on your profile, not per individual book.",
          "Theme changes should be treated as brand-level changes for public pages.",
        ],
      },
      {
        heading: "Available styles",
        bullets: [
          "Violet-pink works well for bold launches and creator brands.",
          "Indigo-sky, teal-lime, coral-pop, and ocean-mint give brighter alternatives.",
          "White, gray, and graphite exist for neutral, colorless, or premium black-and-white pages.",
          "Use lighter themes for trust-heavy nonfiction and darker themes for premium presentation.",
        ],
      },
    ],
    callout:
      "Theme choice should support the book's promise. A finance guide and a romance teaser should not have to look the same.",
  },
];

const AI_PROVIDERS = [
  {
    id: "groq",
    name: "Groq",
    badge: "Default",
    badgeColor: "violet",
    icon: Zap,
    tagline: "Fast open-weight inference",
    description:
      "Groq is a high-speed AI inference platform that runs open-weight models at very low latency. It is the default provider because it generates book content faster than most cloud APIs, which matters when you are waiting on chapter output. Bookify runs a chain of models through Groq — a larger structure model to plan the book, then a faster section model to write each chapter.",
    models: [
      {
        id: "openai/gpt-oss-120b",
        role: "Structure model — default",
        roleDescription:
          "Runs once per book to generate the skeleton: title, subtitle, author, chapter list, and full outline. The larger size handles the reasoning needed to produce a coherent, well-structured plan before any prose is written.",
        traits: ["120B parameters", "Higher reasoning quality", "Runs once per book"],
      },
      {
        id: "openai/gpt-oss-20b",
        role: "Section model — default",
        roleDescription:
          "Runs once per chapter to write prose content. A 10-chapter book means 10 calls to this model. The smaller size keeps generation fast and credit cost predictable without sacrificing readable output.",
        traits: ["20B parameters", "Fast per-chapter generation", "Lower cost"],
      },
      {
        id: "meta-llama/llama-3.3-70b-versatile",
        role: "Llama 3.3 70B",
        roleDescription:
          "Meta's Llama 3.3 70B is available on Groq for structure or section generation. It handles complex instructions well and produces reliably structured output across nonfiction and fiction book types.",
        traits: ["70B parameters", "Meta open-weight", "Strong instruction following"],
      },
      {
        id: "meta-llama/llama-4-scout-17b-16e-instruct",
        role: "Llama 4 Scout",
        roleDescription:
          "Meta's Llama 4 Scout is a mixture-of-experts model with 17B active parameters across 16 experts. It is fast on Groq and works well as a section model when you want quick per-chapter generation.",
        traits: ["17B active / MoE", "Llama 4 generation", "Fast chapter output"],
      },
    ],
  },
  {
    id: "gemini",
    name: "Gemini",
    badge: "Google",
    badgeColor: "blue",
    icon: Sparkles,
    tagline: "Google's multimodal AI",
    description:
      "Gemini is Google's AI model family. Bookify uses it as an optional text provider and as the exclusive image generation engine. All book cover and chapter images are generated through Gemini regardless of which text provider is active.",
    models: [
      {
        id: "gemini-3.5-flash",
        role: "Text model",
        roleDescription:
          "Used for structure, section writing, and quality checks when Gemini is the selected provider. Gemini Flash is optimized for throughput — long outputs without a long wait.",
        traits: ["Multimodal native", "Long context window", "Thinking support"],
      },
      {
        id: "gemini-3.1-flash-image-preview",
        role: "Image model",
        roleDescription:
          "Used exclusively for all book cover and chapter image generation. This model runs regardless of whether your text provider is Groq or Gemini — images always go through Google.",
        traits: ["Always active for images", "Native image generation", "1K resolution output"],
      },
    ],
    searchGrounding: {
      title: "Google Search Grounding",
      description:
        "When enabled, Gemini queries Google Search in real time during chapter generation. It pulls live web results, uses them to inform the content, and injects inline citations as markdown links directly into the chapter text.",
      howItWorks: [
        "You opt in per generation request by enabling the Search Grounding toggle in the editor.",
        "Gemini decides which search queries to run based on the chapter topic and book context.",
        "Web sources are returned as grounding metadata — the search queries used and the pages found.",
        "Inline citations are inserted at the end of supported sentences as numbered markdown links, e.g. [1](https://...).",
        "Only available when the text provider is set to Gemini — Groq does not support search grounding.",
      ],
      bestFor: [
        "Nonfiction where claims, statistics, or current events benefit from sourced backing.",
        "Any chapter where the AI needs recent information beyond its training cutoff.",
        "Topics where citing a specific source adds credibility for the reader.",
      ],
      caveats:
        "Search grounding increases generation time because Gemini makes live web requests mid-generation. The citations reference the sources Gemini found — review them before publishing to ensure they are still live and say what they appear to say.",
    },
    note: "Switching your text provider to Gemini does not change how images are generated — they always use the Gemini image model.",
  },
];

const FIELD_REFERENCE = [
  {
    id: "profile-fields",
    title: "Profile fields",
    icon: Settings2,
    rows: [
      {
        term: "Full Name",
        detail:
          "Required account identity. Also builds the pretty public slug — Ross Cohen becomes /rossc/.",
      },
      {
        term: "Store Link",
        detail:
          "Optional buy, author, Amazon, Gumroad, or personal store URL shown on public previews and shelf fallbacks.",
      },
      {
        term: "Shelf Page Name",
        detail:
          "Optional public shelf title. When blank, the app falls back to a default bookshelf heading.",
      },
      {
        term: "Shelf Photo URL",
        detail:
          "Optional direct image URL shown at the top of the public shelf. Use PNG, JPG, or WebP.",
      },
    ],
  },
  {
    id: "share-fields",
    title: "SEO and sharing fields",
    icon: Search,
    rows: [
      {
        term: "Share Meta Title",
        detail:
          "Title used in public page metadata and social cards. Keep it short enough to scan.",
      },
      {
        term: "Share Meta Description",
        detail:
          "Summary used by crawlers and social previews. Aim for one clear reader-facing sentence.",
      },
      {
        term: "Share Image URL",
        detail:
          "Optional direct image URL for social cards. 1200x630 PNG is the safest default.",
      },
      {
        term: "Share Theme",
        detail:
          "Saved from the dashboard share modal. Controls shelf and preview public page colors.",
      },
    ],
  },
  {
    id: "credit-fields",
    title: "Credit fields",
    icon: Coins,
    rows: [
      {
        term: "Available balance",
        detail:
          "Credits currently available for text generation, image generation, and other metered AI work.",
      },
      {
        term: "Lifetime spent",
        detail:
          "Total credits debited from the account over time. This does not include credits that were granted or reset.",
      },
      {
        term: "Image credits",
        detail:
          "The fixed credit amount charged for each AI image generation request.",
      },
      {
        term: "Token charges",
        detail:
          "Text generation charges are calculated from billed input and output tokens, converted through the configured credit rate.",
      },
      {
        term: "Monthly allowance",
        detail:
          "Recurring plan amount that resets the account balance on the 1st of each month when enabled.",
      },
      {
        term: "Transaction history",
        detail:
          "Recent ledger of debits, grants, adjustments, image charges, token charges, and monthly resets.",
      },
    ],
  },
];

const CHECKLISTS = [
  {
    title: "Before creating a book",
    icon: BookOpen,
    items: [
      "Know the reader, not just the topic.",
      "Pick a clear genre and outcome.",
      "Start with fewer chapters if you are testing a concept.",
      "Confirm you have enough credits for generation.",
    ],
  },
  {
    title: "Before spending credits",
    icon: Coins,
    items: [
      "Check the credit pill or Credits page before a large generation run.",
      "Use fewer chapters while testing a new idea or prompt style.",
      "Expect images to spend the fixed image credit amount shown on the Credits page.",
      "Review transaction history after a run if the balance changed more than expected.",
    ],
  },
  {
    title: "Before sharing a preview",
    icon: Eye,
    items: [
      "Read the first chapter all the way through.",
      "Check the PDF flipbook renders correctly.",
      "Set Store Link if readers should buy or follow.",
      "Set share title, description, image, and theme.",
    ],
  },
  {
    title: "Before exporting",
    icon: FileDown,
    items: [
      "Save the latest manuscript edits.",
      "Check chapter names and order.",
      "Regenerate stale table of contents assets.",
      "Open the exported file and scan the first pages.",
    ],
  },
];

const TROUBLESHOOTING = [
  {
    problem: "The public shelf link no longer works.",
    icon: Link2,
    cause:
      "The active shelf token was probably revoked or replaced. Only one public shelf link can exist at a time.",
    fix: "Open Dashboard → Share Shelf and create or copy the current active link.",
  },
  {
    problem: "A public page has the wrong title or image.",
    icon: Image,
    cause:
      "Profile SEO fields may be blank, outdated, or cached by the social platform.",
    fix: "Update Profile → Share SEO, save, then refresh the public page. For social apps, trigger a re-scrape when available.",
  },
  {
    problem: "The store button is missing.",
    icon: Store,
    cause:
      "Store Link is blank or invalid, so the public page has nothing safe to show.",
    fix: "Open Profile, add a full Store Link, save, and reload the shared shelf or preview.",
  },
  {
    problem: "A preview page has no flipbook.",
    icon: FileText,
    cause:
      "The first-chapter PDF preview may not exist yet or the PDF export is stale.",
    fix: "Regenerate or refresh the preview source after saving the latest book content.",
  },
  {
    problem: "Generation says not enough credits.",
    icon: Coins,
    cause:
      "The requested text or image generation costs more credits than the current account balance.",
    fix: "Open Credits and transactions, buy credits if needed, then retry the generation after the balance refreshes.",
  },
  {
    problem: "Monthly credits changed my balance.",
    icon: CalendarClock,
    cause:
      "Recurring plans reset the balance to the monthly allowance on the 1st instead of adding the allowance on top of leftovers.",
    fix: "Check the monthly reset transaction in Credits and transactions. It shows the previous balance and the plan allowance used for the reset.",
  },
];

function normalizeText(value = "") {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^\w\s./:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toSearchText(value) {
  if (Array.isArray(value)) return value.map(toSearchText).join(" ");
  if (value && typeof value === "object") {
    return Object.values(value).map(toSearchText).join(" ");
  }
  return value == null ? "" : String(value);
}

function matchesQuery(values, query) {
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery) return true;

  const haystack = normalizeText(toSearchText(values));
  const terms = normalizedQuery.split(" ").filter(Boolean);

  return terms.every((term) => haystack.includes(term));
}

function filterGroupRowsByQuery(group, query) {
  if (!query || matchesQuery([group.id, group.title], query)) return group;

  const rows = group.rows.filter((row) => matchesQuery(row, query));
  return rows.length ? { ...group, rows } : null;
}

function filterChecklistByQuery(checklist, query) {
  if (!query || matchesQuery([checklist.title], query)) return checklist;

  const items = checklist.items.filter((item) => matchesQuery(item, query));
  return items.length ? { ...checklist, items } : null;
}

function filterProviderByQuery(provider, query) {
  if (!query) return provider;

  const providerMatch = matchesQuery(
    [
      provider.id,
      provider.name,
      provider.badge,
      provider.tagline,
      provider.description,
      provider.searchGrounding,
      provider.note,
    ],
    query
  );
  const models = provider.models.filter((model) => matchesQuery(model, query));

  if (!providerMatch && models.length === 0) return null;

  return {
    ...provider,
    models: providerMatch ? provider.models : models,
  };
}

function DocIcon({ icon: Icon, className = "size-5" }) {
  return createElement(Icon, { className });
}

function SectionHeader({ id, eyebrow, title, description }) {
  return (
    <div id={id} className="scroll-mt-24 mb-8">
      {eyebrow && (
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-violet-600">
          {eyebrow}
        </p>
      )}
      <h2 className="text-2xl font-black tracking-tight text-slate-900">
        {title}
      </h2>
      {description && (
        <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-500">
          {description}
        </p>
      )}
    </div>
  );
}

function TroubleshootRow({ item }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="flex w-full items-center gap-3 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-inset"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-500">
          <DocIcon icon={item.icon} className="size-4" />
        </span>
        <span className="flex-1 text-sm font-semibold text-slate-900">
          {item.problem}
        </span>
        {isOpen ? (
          <ChevronUp className="size-4 shrink-0 text-slate-400" />
        ) : (
          <ChevronDown className="size-4 shrink-0 text-slate-400" />
        )}
      </button>

      {isOpen && (
        <div className="pb-5 pl-11 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">
              Cause
            </p>
            <p className="text-sm leading-7 text-slate-600">{item.cause}</p>
          </div>
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-emerald-700">
              Fix
            </p>
            <p className="text-sm leading-7 text-slate-700">{item.fix}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function GuideArticle({ guide }) {
  return (
    <article id={guide.id} className="scroll-mt-24 border-t border-slate-100 pt-8 mt-8 first:border-t-0 first:pt-0 first:mt-0">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
          <DocIcon icon={guide.icon} className="size-4" />
        </span>
        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {guide.group}
        </span>
      </div>

      <h3 className="text-xl font-black tracking-tight text-slate-900">
        {guide.title}
      </h3>
      <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">
        {guide.description}
      </p>

      <div className="mt-4 rounded-lg border-l-4 border-violet-300 bg-violet-50 px-4 py-3">
        <span className="text-xs font-bold uppercase tracking-widest text-violet-600">
          Use when
        </span>
        <p className="mt-1 text-sm leading-6 text-slate-700">{guide.useWhen}</p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        {guide.sections.map((section) => (
          <div key={section.heading}>
            <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
              {section.heading}
            </h4>
            <ul className="space-y-2.5">
              {section.bullets.map((bullet) => (
                <li
                  key={bullet}
                  className="flex gap-2.5 text-sm leading-6 text-slate-600"
                >
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-lg bg-slate-50 px-4 py-3">
        <p className="text-sm leading-6 text-slate-600">
          <span className="font-semibold text-slate-900">Note: </span>
          {guide.callout}
        </p>
      </div>
    </article>
  );
}

function DocsPage() {
  const [query, setQuery] = useState("");
  const normalizedQuery = normalizeText(query);

  const overviewMatches = useMemo(
    () =>
      matchesQuery(
        [
          "overview what Bookify does documentation",
          "AI-assisted book production workspace",
          "book idea manuscript publishing assets export files public reader links",
          "Write the book Package the launch Share with readers",
        ],
        normalizedQuery
      ),
    [normalizedQuery]
  );

  const filteredStartSteps = useMemo(
    () => START_STEPS.filter((step) => matchesQuery(step, normalizedQuery)),
    [normalizedQuery]
  );

  const filteredWorkflowLanes = useMemo(
    () => WORKFLOW_LANES.filter((lane) => matchesQuery(lane, normalizedQuery)),
    [normalizedQuery]
  );

  const filteredGuides = useMemo(
    () =>
      GUIDES.filter((guide) =>
        matchesQuery(
          [
            guide.id,
            guide.group,
            guide.title,
            guide.description,
            guide.useWhen,
            guide.callout,
            guide.sections.map((s) => [s.heading, s.bullets]),
          ],
          normalizedQuery
        )
      ),
    [normalizedQuery]
  );

  const filteredAiProviders = useMemo(
    () =>
      AI_PROVIDERS.map((provider) =>
        filterProviderByQuery(provider, normalizedQuery)
      ).filter(Boolean),
    [normalizedQuery]
  );

  const filteredReference = useMemo(
    () =>
      FIELD_REFERENCE.map((group) =>
        filterGroupRowsByQuery(group, normalizedQuery)
      ).filter(Boolean),
    [normalizedQuery]
  );

  const filteredChecklists = useMemo(
    () =>
      CHECKLISTS.map((checklist) =>
        filterChecklistByQuery(checklist, normalizedQuery)
      ).filter(Boolean),
    [normalizedQuery]
  );

  const filteredTroubleshooting = useMemo(
    () =>
      TROUBLESHOOTING.filter((item) =>
        matchesQuery([item.problem, item.cause, item.fix], normalizedQuery)
      ),
    [normalizedQuery]
  );

  const hasSearch = Boolean(normalizedQuery);
  const searchResultCount =
    (overviewMatches ? 1 : 0) +
    filteredStartSteps.length +
    filteredWorkflowLanes.length +
    filteredGuides.length +
    filteredAiProviders.length +
    filteredReference.length +
    filteredChecklists.length +
    filteredTroubleshooting.length;
  const hasSearchResults = !hasSearch || searchResultCount > 0;
  const showOverview = !hasSearch || overviewMatches;
  const showQuickStart = !hasSearch || filteredStartSteps.length > 0;
  const showWorkflowMap = !hasSearch || filteredWorkflowLanes.length > 0;
  const showGuides = !hasSearch || filteredGuides.length > 0;
  const showAiModels = !hasSearch || filteredAiProviders.length > 0;
  const showReference = !hasSearch || filteredReference.length > 0;
  const showChecklists = !hasSearch || filteredChecklists.length > 0;
  const showTroubleshooting =
    !hasSearch || filteredTroubleshooting.length > 0;

  return (
    <DashboardLayout>
      <main className="min-h-full bg-white text-slate-950">
        {/* ── Page header ─────────────────────────────────────────────── */}
        <header className="border-b border-slate-200 bg-white px-4 py-8 md:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-4">
              <Sparkles className="size-3.5 text-violet-500" />
              <span>Bookify</span>
              <ChevronRight className="size-3" />
              <span className="font-semibold text-slate-700">Documentation</span>
            </div>

            <div className="flex flex-col gap-1 max-w-2xl mb-6">
              <h1 className="text-3xl font-black tracking-tight text-slate-950">
                Documentation
              </h1>
              <p className="text-sm leading-7 text-slate-500">
                Everything you need to build, package, and share AI-generated
                books — from first draft to reader-ready pages.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="relative block flex-1 max-w-xl">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search docs: store link, preview, KDP, SEO, themes..."
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                />
              </label>
              <div className="flex gap-2">
                {QUICK_LINKS.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-violet-200 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                  >
                    <DocIcon icon={link.icon} className="size-4" />
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </header>

        {/* ── Three-column layout ────────────────────────────────────── */}
        <div className="mx-auto grid max-w-7xl grid-cols-1 px-4 py-8 md:px-6 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_200px] lg:gap-10">
          {/* ── Left nav ──────────────────────────────────────────────── */}
          <aside className="hidden lg:block">
            <nav
              aria-label="Documentation navigation"
              className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2"
            >
              <div className="space-y-6">
                {NAV_GROUPS.map((group) => (
                  <div key={group.title}>
                    <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                      {group.title}
                    </p>
                    <div className="space-y-0.5">
                      {group.items.map((item) => (
                        <a
                          key={item.id}
                          href={`#${item.id}`}
                          className="group flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-violet-50 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                        >
                          <DocIcon
                            icon={item.icon}
                            className="size-4 shrink-0 text-slate-400 transition group-hover:text-violet-500"
                          />
                          <span className="truncate">{item.label}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </nav>
          </aside>

          {/* ── Main content ──────────────────────────────────────────── */}
          <div className="min-w-0 max-w-3xl">
            {/* Search result banner */}
            {hasSearch && (
              <div className="mb-8 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-sm text-slate-600">
                  Results for{" "}
                  <span className="font-semibold text-slate-900">
                    &ldquo;{query}&rdquo;
                  </span>
                </p>
                <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-bold text-violet-700">
                  {searchResultCount} match{searchResultCount !== 1 ? "es" : ""}
                </span>
              </div>
            )}

            {!hasSearchResults && (
              <div className="rounded-xl border border-slate-200 py-14 text-center">
                <Search className="mx-auto size-7 text-slate-300" />
                <p className="mt-3 text-sm font-semibold text-slate-900">
                  No docs matched
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Try credits, dashboard, preview, KDP, SEO, themes, or image
                  generation.
                </p>
              </div>
            )}

            {/* ── Overview ──────────────────────────────────────────── */}
            {showOverview && (
            <section>
              <SectionHeader
                id="overview"
                eyebrow="Overview"
                title="What Bookify does"
                description="Bookify is an AI-assisted book production workspace. It helps you move from book idea to manuscript, publishing assets, export files, and public reader links without jumping between disconnected tools."
              />

              <div className="grid grid-cols-1 gap-px rounded-xl border border-slate-200 bg-slate-100 overflow-hidden sm:grid-cols-3">
                {[
                  {
                    title: "Write the book",
                    icon: PenLine,
                    text: "Create a title, audience, genre, outline, chapters, and supporting images in one private workspace.",
                  },
                  {
                    title: "Package the launch",
                    icon: FileText,
                    text: "Prepare KDP-style listing copy, metadata, risk notes, cover direction, table of contents, and export files.",
                  },
                  {
                    title: "Share with readers",
                    icon: Share2,
                    text: "Publish shelf links and first-chapter previews with store buttons, themes, SEO, and social share images.",
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="flex flex-col gap-3 bg-white p-5"
                  >
                    <span className="flex size-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                      <DocIcon icon={item.icon} className="size-4.5" />
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        {item.title}
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-slate-500">
                        {item.text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
            )}

            {/* ── Quick start ───────────────────────────────────────── */}
            {showQuickStart && (
            <section className="mt-14 border-t border-slate-100 pt-14">
              <SectionHeader
                id="quick-start"
                eyebrow="Quick start"
                title="Fastest path from idea to shareable book"
                description="Use this path when you want the shortest reliable route through the product. It keeps you focused on the order that prevents rework."
              />

              <div className="space-y-0">
                {filteredStartSteps.map((item, idx) => (
                  <div key={item.step} className="relative flex gap-4">
                    {idx < filteredStartSteps.length - 1 && (
                      <div className="absolute left-[19px] top-10 h-full w-px bg-slate-200" />
                    )}
                    <div className="relative z-10 mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-violet-200 bg-white text-xs font-black text-violet-600">
                      {item.step}
                    </div>
                    <Link
                      to={item.path}
                      className="group min-w-0 flex-1 pb-8 focus-visible:outline-none"
                    >
                      <div className="flex items-center gap-2">
                        <DocIcon
                          icon={item.icon}
                          className="size-4 text-violet-500"
                        />
                        <h3 className="text-sm font-bold text-slate-900 group-hover:text-violet-700 transition-colors">
                          {item.title}
                        </h3>
                        <ChevronRight className="size-3.5 text-slate-300 opacity-0 -translate-x-1 transition group-hover:opacity-100 group-hover:translate-x-0 text-violet-500" />
                      </div>
                      <p className="mt-1.5 text-sm leading-6 text-slate-500">
                        {item.text}
                      </p>
                    </Link>
                  </div>
                ))}
              </div>
            </section>
            )}

            {/* ── Workflow map ──────────────────────────────────────── */}
            {showWorkflowMap && (
            <section className="mt-14 border-t border-slate-100 pt-14">
              <SectionHeader
                id="workflow-map"
                eyebrow="Workflow map"
                title="How the features connect"
                description="The app is easier to understand when split into two layers: your private creation workspace and your public author presence."
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {filteredWorkflowLanes.map((lane) => (
                  <div
                    key={lane.title}
                    className="rounded-xl border border-slate-200 bg-white p-5"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                        <DocIcon icon={lane.icon} className="size-4.5" />
                      </span>
                      <h3 className="text-sm font-bold text-slate-900">
                        {lane.title}
                      </h3>
                    </div>
                    <p className="text-sm leading-6 text-slate-500 mb-4">
                      {lane.summary}
                    </p>
                    <ul className="space-y-2">
                      {lane.points.map((point) => (
                        <li
                          key={point}
                          className="flex items-start gap-2 text-sm text-slate-600"
                        >
                          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-violet-400" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
            )}

            {/* ── Feature guides ────────────────────────────────────── */}
            {showGuides && (
            <section className="mt-14 border-t border-slate-100 pt-14">
              <SectionHeader
                id="core-guides"
                eyebrow="Core guides"
                title="Feature-by-feature manual"
                description="What each major page is for, when to use it, what you can do there, and where mistakes usually happen."
              />

              {filteredGuides.length === 0 ? (
                <div className="rounded-xl border border-slate-200 py-12 text-center">
                  <Search className="mx-auto size-7 text-slate-300" />
                  <p className="mt-3 text-sm font-semibold text-slate-900">
                    No guides matched
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Try searching for dashboard, preview, store, KDP, theme, or SEO.
                  </p>
                </div>
              ) : (
                <div>
                  {filteredGuides.map((guide) => (
                    <GuideArticle key={guide.id} guide={guide} />
                  ))}
                </div>
              )}
            </section>
            )}

            {/* ── AI models ────────────────────────────────────────── */}
            {showAiModels && (
            <section
              id="ai-models"
              className="scroll-mt-24 mt-14 border-t border-slate-100 pt-14"
            >
              <SectionHeader
                eyebrow="AI models"
                title="How the AI works under the hood"
                description="Bookify uses two separate AI providers: Groq for fast text generation and Gemini for image creation. Understanding which model does what helps you set expectations around speed, quality, and cost."
              />

              <div className="mb-8 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3.5">
                <div className="flex items-start gap-3">
                  <Cpu className="mt-0.5 size-4 shrink-0 text-violet-500" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Two-phase generation
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Every book goes through two AI calls: a{" "}
                      <span className="font-semibold text-slate-800">
                        structure pass
                      </span>{" "}
                      that builds the outline, and a{" "}
                      <span className="font-semibold text-slate-800">
                        section pass
                      </span>{" "}
                      that writes each chapter. Different models handle each
                      phase. Images are always a separate call to Gemini.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                {filteredAiProviders.map((provider) => {
                  const badgeClasses =
                    provider.badgeColor === "violet"
                      ? "bg-violet-50 text-violet-700 border-violet-200"
                      : "bg-blue-50 text-blue-700 border-blue-200";

                  return (
                    <div
                      key={provider.id}
                      className="rounded-xl border border-slate-200 bg-white overflow-hidden"
                    >
                      <div className="flex items-start gap-4 border-b border-slate-100 px-5 py-4">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                          <DocIcon icon={provider.icon} className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-bold text-slate-900">
                              {provider.name}
                            </h3>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${badgeClasses}`}
                            >
                              {provider.badge}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-slate-400">
                            {provider.tagline}
                          </p>
                        </div>
                      </div>

                      <div className="px-5 py-4">
                        <p className="text-sm leading-7 text-slate-600 mb-5">
                          {provider.description}
                        </p>

                        <div className="space-y-3">
                          {provider.models.map((model) => (
                            <div
                              key={model.id}
                              className="rounded-lg border border-slate-100 bg-slate-50 p-4"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                                <code className="font-mono text-xs font-semibold text-violet-700 bg-violet-50 rounded px-1.5 py-0.5 border border-violet-100">
                                  {model.id}
                                </code>
                                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                                  {model.role}
                                </span>
                              </div>
                              <p className="text-sm leading-6 text-slate-600 mb-3">
                                {model.roleDescription}
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {model.traits.map((trait) => (
                                  <span
                                    key={trait}
                                    className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-medium text-slate-600"
                                  >
                                    {trait}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>

                        {provider.searchGrounding && (
                          <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 overflow-hidden">
                            <div className="flex items-center gap-2.5 border-b border-violet-200 px-4 py-3">
                              <Search className="size-4 shrink-0 text-violet-600" />
                              <h4 className="text-sm font-bold text-violet-900">
                                {provider.searchGrounding.title}
                              </h4>
                              <span className="ml-auto rounded-full bg-violet-100 border border-violet-200 px-2 py-0.5 text-xs font-semibold text-violet-700">
                                Gemini only
                              </span>
                            </div>
                            <div className="px-4 py-4 space-y-4">
                              <p className="text-sm leading-7 text-violet-900">
                                {provider.searchGrounding.description}
                              </p>

                              <div>
                                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-violet-700">
                                  How it works
                                </p>
                                <ul className="space-y-2">
                                  {provider.searchGrounding.howItWorks.map((item) => (
                                    <li
                                      key={item}
                                      className="flex gap-2.5 text-sm leading-6 text-violet-900"
                                    >
                                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-violet-500" />
                                      <span>{item}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              <div>
                                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-violet-700">
                                  Best for
                                </p>
                                <ul className="space-y-2">
                                  {provider.searchGrounding.bestFor.map((item) => (
                                    <li
                                      key={item}
                                      className="flex gap-2.5 text-sm leading-6 text-violet-900"
                                    >
                                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-violet-400" />
                                      <span>{item}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              <div className="rounded-lg border border-violet-200 bg-white px-4 py-3">
                                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                                  Caveat
                                </p>
                                <p className="text-sm leading-6 text-slate-600">
                                  {provider.searchGrounding.caveats}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {provider.note && (
                          <div className="mt-4 rounded-lg border-l-4 border-slate-200 bg-slate-50 px-4 py-2.5">
                            <p className="text-xs leading-5 text-slate-500">
                              <span className="font-semibold text-slate-700">
                                Note:{" "}
                              </span>
                              {provider.note}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
            )}

            {/* ── Field reference ───────────────────────────────────── */}
            {showReference && (
            <section
              id="field-reference"
              className="scroll-mt-24 mt-14 border-t border-slate-100 pt-14"
            >
              <SectionHeader
                eyebrow="Reference"
                title="Fields and what they change"
                description="Use this section when a public link, profile setting, or social preview looks unexpected."
              />

              {filteredReference.length === 0 ? (
                <div className="rounded-xl border border-slate-200 py-10 text-center">
                  <CircleHelp className="mx-auto size-7 text-slate-300" />
                  <p className="mt-3 text-sm text-slate-500">
                    No field reference matched this search.
                  </p>
                </div>
              ) : (
                <div className="space-y-8">
                  {filteredReference.map((group) => (
                    <div key={group.id}>
                      <div className="flex items-center gap-2.5 mb-4">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-violet-50 text-violet-600">
                          <DocIcon icon={group.icon} className="size-3.5" />
                        </span>
                        <h3 className="text-sm font-bold text-slate-900">
                          {group.title}
                        </h3>
                      </div>
                      <dl className="rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                        {group.rows.map((row) => (
                          <div
                            key={row.term}
                            className="grid grid-cols-1 gap-1 bg-white px-4 py-3.5 sm:grid-cols-[180px_1fr] sm:gap-4"
                          >
                            <dt className="font-mono text-xs font-semibold text-violet-700 sm:pt-0.5">
                              {row.term}
                            </dt>
                            <dd className="text-sm leading-6 text-slate-600">
                              {row.detail}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))}
                </div>
              )}
            </section>
            )}

            {/* ── Checklists ────────────────────────────────────────── */}
            {showChecklists && (
            <section
              id="checklists"
              className="scroll-mt-24 mt-14 border-t border-slate-100 pt-14"
            >
              <SectionHeader
                eyebrow="Checklists"
                title="Repeatable operating habits"
                description="Short checks that help you avoid common problems: stale exports, missing store links, and generic public pages."
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredChecklists.map((checklist) => (
                  <div
                    key={checklist.title}
                    className="rounded-xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex items-center gap-2.5 mb-4">
                      <DocIcon
                        icon={checklist.icon}
                        className="size-4 text-violet-600"
                      />
                      <h3 className="text-sm font-bold text-slate-900">
                        {checklist.title}
                      </h3>
                    </div>
                    <ul className="space-y-2.5">
                      {checklist.items.map((item) => (
                        <li
                          key={item}
                          className="flex gap-2.5 text-sm leading-6 text-slate-600"
                        >
                          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
            )}

            {/* ── Troubleshooting ───────────────────────────────────── */}
            {showTroubleshooting && (
            <section
              id="troubleshooting"
              className="scroll-mt-24 mt-14 border-t border-slate-100 pt-14 pb-16"
            >
              <SectionHeader
                eyebrow="Troubleshooting"
                title="Common problems and fixes"
                description="When something is missing, stale, or confusing, start here."
              />

              {filteredTroubleshooting.length === 0 ? (
                <div className="rounded-xl border border-slate-200 py-10 text-center">
                  <AlertTriangle className="mx-auto size-7 text-slate-300" />
                  <p className="mt-3 text-sm text-slate-500">
                    No troubleshooting item matched this search.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-white px-4 divide-y-0">
                  {filteredTroubleshooting.map((item) => (
                    <TroubleshootRow key={item.problem} item={item} />
                  ))}
                </div>
              )}
            </section>
            )}
          </div>

          {/* ── Right sidebar ─────────────────────────────────────────── */}
          <aside className="hidden xl:block">
            <div className="sticky top-24 space-y-6">
              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">
                  On this page
                </p>
                <nav aria-label="Page sections" className="space-y-1">
                  {ON_THIS_PAGE.map((item) => (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      className="block rounded-md px-2.5 py-1.5 text-sm text-slate-500 transition hover:bg-violet-50 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                    >
                      {item.label}
                    </a>
                  ))}
                </nav>
              </div>

              <div className="border-t border-slate-100 pt-6">
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">
                  Set up before you share
                </p>
                <div className="space-y-2.5">
                  {[
                    {
                      icon: Type,
                      text: "Add your full name for a clean public URL.",
                    },
                    {
                      icon: Store,
                      text: "Add a Store Link to show buy buttons.",
                    },
                    {
                      icon: Brush,
                      text: "Pick a theme color for your public pages.",
                    },
                    {
                      icon: ExternalLink,
                      text: "Share your shelf or a single-book preview.",
                    },
                  ].map((item) => (
                    <div key={item.text} className="flex items-start gap-2">
                      <DocIcon
                        icon={item.icon}
                        className="mt-0.5 size-3.5 shrink-0 text-violet-500"
                      />
                      <p className="text-xs leading-5 text-slate-500">
                        {item.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-6">
                <Link
                  to="/dashboard"
                  className="group flex items-center justify-between rounded-lg border border-slate-200 bg-slate-950 px-4 py-3 text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                >
                  <span>
                    <span className="block text-sm font-bold">Go build</span>
                    <span className="block text-xs text-slate-400">
                      Open dashboard
                    </span>
                  </span>
                  <ChevronRight className="size-4 transition group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </DashboardLayout>
  );
}

export default DocsPage;
