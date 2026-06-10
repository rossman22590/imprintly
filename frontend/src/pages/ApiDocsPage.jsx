import { createElement, useState } from "react";
import { Link } from "react-router";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clipboard,
  Code2,
  Copy,
  CreditCard,
  Download,
  FileArchive,
  FileText,
  KeyRound,
  Library,
  ListChecks,
  LockKeyhole,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { LogoIcon } from "../components";
import { useAuthContext } from "../contexts/AuthContext";
import DashboardLayout from "../layouts/DashboardLayout";
import { BOOK_GENRES, WRITING_STYLES } from "../utils/constants";

const PRODUCTION_API_BASE = "https://api.bookify.myapps.ai";
const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || PRODUCTION_API_BASE
).replace(/\/$/, "");
const API_KEY = "book_sk_your_key_here";

const ON_THIS_PAGE = [
  { id: "overview", label: "Overview" },
  { id: "authentication", label: "Authentication" },
  { id: "credits", label: "Check credits" },
  { id: "generate", label: "Generate ebook" },
  { id: "from-document", label: "Book from a document" },
  { id: "poll", label: "Poll job" },
  { id: "lists", label: "List jobs & books" },
  { id: "retrieve", label: "Retrieve book" },
  { id: "downloads", label: "Download files" },
  { id: "parameters", label: "Parameters" },
  { id: "errors", label: "Errors" },
];

const NAV_GROUPS = [
  {
    title: "Start",
    items: [
      { id: "overview", label: "API flow", icon: Rocket },
      { id: "authentication", label: "API keys", icon: KeyRound },
    ],
  },
  {
    title: "Endpoints",
    items: [
      { id: "credits", label: "Check credits", icon: CreditCard },
      { id: "generate", label: "Generate ebook", icon: BookOpen },
      { id: "from-document", label: "Book from a document", icon: FileText },
      { id: "poll", label: "Poll generation", icon: RefreshCw },
      { id: "lists", label: "List jobs & books", icon: ListChecks },
      { id: "retrieve", label: "Retrieve book", icon: Library },
      { id: "downloads", label: "PDF and EPUB", icon: Download },
    ],
  },
  {
    title: "Reference",
    items: [
      { id: "parameters", label: "Parameters", icon: Code2 },
      { id: "errors", label: "Errors", icon: AlertTriangle },
    ],
  },
];

const QUICK_LINKS = [
  { label: "Manage API Keys", to: "/profile", icon: KeyRound },
  { label: "Main Docs", to: "/docs", icon: FileText },
];

const GENRE_FAMILY_ROWS = [
  {
    family: "Fiction",
    matches:
      "Novel, Novella, Fiction, Fantasy, Sci-Fi, Science Fiction, Romance, Thriller, Mystery, Horror, Literary Fiction, Historical Fiction, Young Adult, YA",
    behavior:
      "Story-driven chapters with scene work, POV, dialogue, conflict, reversals, and narrative continuity.",
  },
  {
    family: "Children",
    matches:
      "Children's Book, kids book, picture book, storybook, early reader, or any custom genre containing those terms",
    behavior:
      "Two-page illustrated storybook scenes. chapterCount is treated as an interior page count from 2 to 52, then converted to spreads.",
  },
  {
    family: "Textbook",
    matches:
      "Textbook, text book, school textbook, college textbook, academic textbook, course textbook",
    behavior:
      "Formal textbook chapters with objectives, key terms, definitions, examples, summaries, and review questions.",
  },
  {
    family: "Learning",
    matches:
      "Workbook, worksheet, activity book, Course, study guide, lesson book, curriculum, training manual, journal, planner",
    behavior:
      "Interactive learning modules with exercises, reflection prompts, worksheet space, and practice tasks.",
  },
  {
    family: "Technical",
    matches: "Technical",
    behavior:
      "Precise technical chapters with prerequisites, examples, tradeoffs, implementation detail, and troubleshooting.",
  },
  {
    family: "Practical",
    matches: "How-to Guide, Self-help, Business",
    behavior:
      "Outcome-driven guide chapters with steps, examples, decisions, common mistakes, and applied takeaways.",
  },
  {
    family: "Academic",
    matches: "Academic",
    behavior:
      "Rigorous academic-style chapters with definitions, context, evidence, counterpoints, and careful reasoning.",
  },
  {
    family: "Nonfiction",
    matches: "Nonfiction or any custom value that does not match another family",
    behavior:
      "Polished explanatory ebook chapters with examples, implications, and a coherent reader journey.",
  },
];

const GENERATE_CURL = `curl -X POST "${API_BASE}/api/v1/ebooks" \\
  -H "Authorization: Bearer ${API_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "My Generated Ebook",
    "author": "Ross",
    "topic": "How to build an AI publishing system",
    "genre": "Nonfiction",
    "audience": "Entrepreneurs",
    "chapterCount": 6,
    "chapterLength": "medium",
    "includeCover": true,
    "includeImages": false
  }'`;

const GENERATE_RESPONSE = `{
  "object": "generation_job",
  "id": "7d30f8c2-5ce6-48c8-a050-8c7f340f1523",
  "status": "queued",
  "bookId": null,
  "provider": "groq",
  "progress": {
    "total": 0,
    "completed": 0,
    "failed": 0,
    "message": "Queued"
  }
}`;

const POLL_CURL = `curl "${API_BASE}/api/v1/generation-jobs/JOB_ID" \\
  -H "Authorization: Bearer ${API_KEY}"`;

const ALL_PARAMS_CURL = `curl -X POST "${API_BASE}/api/v1/ebooks" \\
  -H "Authorization: Bearer ${API_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "provider": "gemini",
    "useGoogleSearch": true,

    "title": "The Tides of Mars",
    "topic": "A terraforming crew discovers the planet is already alive",
    "description": "Hard sci-fi with an ensemble cast and a slow-burn mystery.",
    "genre": "Sci-Fi",
    "audience": "Adult science-fiction readers",
    "language": "English",
    "style": "Cinematic",
    "chapterCount": 10,
    "chapterLength": "large",
    "includeTextGraphics": false,

    "includeImages": true,
    "imagesPerChapter": 2,
    "imageModel": "gemini-3-pro-image-preview",
    "imageSize": "2K",
    "generateCover": true,
    "coverModel": "gemini-3-pro-image-preview",
    "coverImageSize": "2K",

    "useBibleForInput": true,
    "useBibleForImages": true,
    "bible": {
      "characters": "Capt. Ade Okafor — pragmatic, haunted. Dr. Lin Bao — xenobiologist.",
      "worldRules": "No FTL. Comms to Earth lag 14 minutes. Dust storms season the plot.",
      "styleGuide": "Tight third-person, present-tense action beats, restrained prose."
    },
    "visualBible": {
      "enabled": true,
      "palette": "rust-orange dust, teal habitat lighting, cold starlight",
      "characters": "Okafor: dark skin, shaved head, scarred brow. Lin: wiry, goggles."
    }
  }'`;

const SOURCE_UPLOAD_CURL = `# Step 1 — upload one or more documents (multipart/form-data).
# Gemini only. Max 6 files, 12MB each. Types: PDF, DOCX, MD, TXT, HTML, CSV, RTF, JSON.
curl -X POST "${API_BASE}/api/v1/source-files" \\
  -H "Authorization: Bearer ${API_KEY}" \\
  -F "sourceFiles=@./research.pdf" \\
  -F "sourceFiles=@./interview-notes.md"`;

const SOURCE_UPLOAD_RESPONSE = `{
  "object": "source_files",
  "message": "Source files uploaded. Pass these objects as \`sourceFiles\` on a Gemini generation job.",
  "sourceFiles": [
    {
      "id": "0c4f...",
      "name": "research.pdf",
      "url": "/uploads/sourceFiles-1717000000000-123.pdf",
      "mimeType": "application/pdf",
      "size": 824133,
      "extractedText": "Full extracted text...",
      "textPreview": "First 1,800 characters..."
    }
  ]
}`;

const SOURCE_GEN_CURL = `# Step 2 — paste the returned objects straight into sourceFiles on a Gemini job.
curl -X POST "${API_BASE}/api/v1/ebooks" \\
  -H "Authorization: Bearer ${API_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "provider": "gemini",
    "title": "Findings From the Field",
    "topic": "Turn this research into a readable book",
    "genre": "Nonfiction",
    "chapterCount": 8,
    "chapterLength": "medium",
    "sourceFiles": [
      {
        "name": "research.pdf",
        "url": "/uploads/sourceFiles-1717000000000-123.pdf",
        "mimeType": "application/pdf",
        "size": 824133,
        "extractedText": "Full extracted text..."
      }
    ],
    "generateBibleFromSource": true,
    "includeImages": true,
    "generateCover": true
  }'`;

const SOURCE_PARAMS_NOTE = `// Companion flags once you have sourceFiles (or a bookId that already has stored sources):
//   "useSourceFiles": true,            // reuse the book's stored sources (with bookId)
//   "regenerateFromSource": true,      // rebuild the book from them
//   "regenerateOutlineFromSource": true,
//   "generateBibleFromSource": true    // build the Book Bible from them first
//
// No upload? You can still inline text directly — "url" is then just a required label
// and the PDF binary attachment is skipped (Gemini sees your text only):
//   "sourceFiles": [{ "name": "notes.txt", "url": "/uploads/notes.txt", "mimeType": "text/plain", "extractedText": "..." }]
//
// Provide your own structure to skip AI outline generation entirely:
//   "outline": [{ "title": "Landfall", "description": "Arrival; first anomaly." }, ...]`;

const LIST_JOBS_CURL = `curl "${API_BASE}/api/v1/generation-jobs?status=failed&limit=20" \\
  -H "Authorization: Bearer ${API_KEY}"`;

const LIST_BOOKS_CURL = `curl "${API_BASE}/api/v1/ebooks?limit=20&offset=0" \\
  -H "Authorization: Bearer ${API_KEY}"`;

const LIST_BOOKS_RESPONSE = `{
  "object": "list",
  "data": [
    {
      "object": "book_summary",
      "id": "BOOK_ID",
      "title": "My Generated Ebook",
      "author": "Ross",
      "genre": "Nonfiction",
      "status": "complete",
      "bookStatus": "draft",
      "chapterCount": 6,
      "downloads": {
        "pdf": { "url": "${API_BASE}/api/v1/books/BOOK_ID/pdf" },
        "epub": { "url": "${API_BASE}/api/v1/books/BOOK_ID/epub" }
      }
    }
  ],
  "count": 1,
  "limit": 20,
  "offset": 0,
  "hasMore": false
}`;

const CREDITS_CURL = `curl "${API_BASE}/api/v1/credits" \\
  -H "Authorization: Bearer ${API_KEY}"`;

const CREDITS_RESPONSE = `{
  "object": "credits",
  "creditsLeft": 42.5,
  "credits": {
    "balance": 42.5,
    "lifetimeGranted": 100,
    "lifetimeSpent": 57.5,
    "monthlyAllowance": 0,
    "monthlyPreset": "",
    "monthlyResetAt": null,
    "nextMonthlyResetAt": "2026-06-01T00:00:00.000Z"
  }
}`;

const RETRIEVE_CURL = `curl "${API_BASE}/api/v1/ebooks/BOOK_ID" \\
  -H "Authorization: Bearer ${API_KEY}"`;

const RETRIEVE_RESPONSE = `{
  "object": "book",
  "id": "BOOK_ID",
  "status": "complete",
  "book": {
    "id": "BOOK_ID",
    "title": "My Generated Ebook",
    "author": "Ross"
  },
  "downloads": {
    "pdf": {
      "url": "${API_BASE}/api/v1/books/BOOK_ID/pdf",
      "method": "GET",
      "contentType": "application/pdf",
      "auth": "Bearer API key"
    },
    "epub": {
      "url": "${API_BASE}/api/v1/books/BOOK_ID/epub",
      "method": "GET",
      "contentType": "application/epub+zip",
      "auth": "Bearer API key"
    }
  }
}`;

const PDF_CURL = `curl -L "${API_BASE}/api/v1/books/BOOK_ID/pdf" \\
  -H "Authorization: Bearer ${API_KEY}" \\
  -o book.pdf`;

const EPUB_CURL = `curl -L "${API_BASE}/api/v1/books/BOOK_ID/epub" \\
  -H "Authorization: Bearer ${API_KEY}" \\
  -o book.epub`;

const ENDPOINTS = [
  {
    method: "POST",
    path: "/api/v1/ebooks",
    purpose: "Create an async ebook generation job.",
  },
  {
    method: "POST",
    path: "/api/v1/generation-jobs",
    purpose: "Alias for creating the same full-book job.",
  },
  {
    method: "POST",
    path: "/api/v1/source-files",
    purpose:
      "Upload documents (multipart) for Gemini grounding; returns objects to pass as `sourceFiles`.",
  },
  {
    method: "GET",
    path: "/api/v1/credits",
    purpose: "Check the API key owner's remaining credit balance.",
  },
  {
    method: "GET",
    path: "/api/v1/generation-jobs",
    purpose:
      "List your jobs, newest first. Filter with `status`, paginate with `limit` and `offset`.",
  },
  {
    method: "GET",
    path: "/api/v1/generation-jobs/:jobId",
    purpose: "Poll status until `status` is `complete` and `bookId` is set.",
  },
  {
    method: "DELETE",
    path: "/api/v1/generation-jobs/:jobId",
    purpose: "Request cancellation for a queued or running generation job.",
  },
  {
    method: "POST",
    path: "/api/v1/generation-jobs/:jobId/retry",
    purpose: "Retry failed generation steps for an existing job.",
  },
  {
    method: "GET",
    path: "/api/v1/ebooks",
    purpose:
      "List your books as lightweight summaries with download links. Chapter content is not included.",
  },
  {
    method: "GET",
    path: "/api/v1/ebooks/:bookId",
    purpose: "Retrieve the saved book plus PDF and EPUB download links.",
  },
  {
    method: "GET",
    path: "/api/v1/books/:bookId/pdf",
    purpose: "Download binary PDF after generation completes.",
  },
  {
    method: "GET",
    path: "/api/v1/books/:bookId/epub",
    purpose: "Download binary EPUB after generation completes.",
  },
];

function findEndpoint(method, path) {
  return ENDPOINTS.find(
    (endpoint) => endpoint.method === method && endpoint.path === path
  );
}

const PARAM_GROUPS = [
  {
    title: "Engine selection",
    params: [
      {
        name: "provider",
        allowed: '"groq" | "gemini"',
        fallback: '"groq"',
        notes: "Unknown values silently fall back to groq.",
      },
      {
        name: "model / structureModel / sectionModel",
        allowed:
          "openai/gpt-oss-120b, openai/gpt-oss-20b, meta-llama/llama-4-scout-17b-16e-instruct, llama-3.3-70b-versatile",
        fallback: "openai/gpt-oss-120b",
        notes:
          "Groq only. Gemini text models are configured server-side and cannot be picked per request.",
      },
      {
        name: "useGoogleSearch",
        allowed: "boolean",
        fallback: "false",
        notes: "Gemini only — grounded outlines and content. Alias: googleSearch.",
      },
    ],
  },
  {
    title: "Book definition",
    params: [
      {
        name: "title / topic / description",
        allowed: "strings",
        fallback: "—",
        notes: "Truncated to 200 / 300 / 800 characters; HTML is stripped.",
      },
      {
        name: "genre",
        allowed:
          `${BOOK_GENRES.join(", ")} — or any custom string (max 100 chars)`,
        fallback: '"Nonfiction"',
        notes:
          "Uses the same dropdown options as the create-book form, but the API also accepts custom values. The value is matched into the genre families below.",
      },
      {
        name: "audience",
        allowed: "string (max 200 chars)",
        fallback: '"General readers"',
        notes: "",
      },
      {
        name: "language",
        allowed: "string (max 50 chars)",
        fallback: '"English"',
        notes: "Alias: bookLanguage.",
      },
      {
        name: "style",
        allowed: "string (max 50 chars)",
        fallback: '"Informative"',
        notes: `Free-form. The app dropdown offers: ${WRITING_STYLES.join(", ")}.`,
      },
      {
        name: "chapterCount",
        allowed: "1–26",
        fallback: "8",
        notes:
          "Clamped into range. Children's books treat it as a page count (2–52) and build two-page spreads.",
      },
      {
        name: "chapterLength",
        allowed: '"small" | "medium" | "large"',
        fallback: '"medium"',
        notes:
          "~1,000–1,600 / 2,000–3,000 / 3,500–5,000 words. Invalid values fall back to medium.",
      },
      {
        name: "outline",
        allowed: "array of { title, description }",
        fallback: "generated",
        notes:
          "Supplies the chapter structure and skips outline generation. Its length overrides chapterCount.",
      },
      {
        name: "bookId",
        allowed: "ID of a book you own",
        fallback: "new book",
        notes: "404 if unknown, 403 if it belongs to someone else.",
      },
      {
        name: "includeTextGraphics",
        allowed: "boolean",
        fallback: "false",
        notes:
          "Text-based diagrams and figures. Aliases: includeGraphics, allowTextGraphics.",
      },
    ],
  },
  {
    title: "Images — always generated by Gemini, even with groq text",
    params: [
      {
        name: "includeImages",
        allowed: "boolean",
        fallback: "false",
        notes: "Chapter illustrations. Alias: generateImages.",
      },
      {
        name: "imagesPerChapter",
        allowed: "1–4",
        fallback: "1",
        notes: "Clamped into range. Aliases: chapterImageCount, imageCountPerChapter.",
      },
      {
        name: "generateCover",
        allowed: "boolean",
        fallback: "false",
        notes: "Alias: includeCover. Covers always render at a 2:3 aspect ratio.",
      },
      {
        name: "imageModel / coverModel",
        allowed:
          "gemini-3.1-flash-image-preview, gemini-3-pro-image-preview, gemini-2.5-flash-image",
        fallback: "gemini-3.1-flash-image-preview",
        notes: "Unknown models silently fall back to the default.",
      },
      {
        name: "imageSize / coverImageSize",
        allowed: '"512" | "1K" | "2K" | "4K"',
        fallback: '"1K"',
        notes: "Unknown sizes silently fall back to 1K.",
      },
    ],
  },
  {
    title: "Source documents — Gemini only (400 with groq)",
    params: [
      {
        name: "sourceFiles",
        allowed: "array, max 6 entries",
        fallback: "[]",
        notes:
          "Each: { name, url, mimeType, size }. PDF, DOCX, Markdown, TXT, HTML, CSV, JSON, RTF. Invalid entries are silently dropped; files are capped at 12MB at upload time.",
      },
      {
        name: "useSourceFiles",
        allowed: "boolean",
        fallback: "true when bookId has stored sources",
        notes: "Send false to ignore the book's stored source files.",
      },
      {
        name: "regenerateFromSource / regenerateOutlineFromSource",
        allowed: "boolean",
        fallback: "false",
        notes: "Regenerate the book (or just its outline) from stored sources.",
      },
    ],
  },
  {
    title: "Book Bible & Visual Bible",
    params: [
      {
        name: "bible",
        allowed: "object",
        fallback: "book's stored bible",
        notes:
          "String keys: source, characters, locations, worldRules, timeline, styleGuide, canonFacts, unresolvedThreads, notes.",
      },
      {
        name: "useBibleForInput",
        allowed: "boolean",
        fallback: "true",
        notes:
          "The only flag that defaults ON — send false to exclude the Book Bible from generation context. Alias: useBible.",
      },
      {
        name: "generateBibleFromSource",
        allowed: "boolean",
        fallback: "false",
        notes:
          "Builds the Book Bible from sourceFiles before writing. Aliases: generateBibleFromSources, generateBibleFromDocuments.",
      },
      {
        name: "visualBible / useBibleForImages",
        allowed: "object / boolean",
        fallback: "stored / false",
        notes: "Visual canon (characters, palette, style) for image consistency.",
      },
    ],
  },
];

const ERRORS = [
  {
    code: "400",
    title: "Invalid input",
    text: "Malformed book IDs, source files on a non-Gemini job, or an invalid `status` list filter. Most other invalid values silently fall back to defaults instead.",
  },
  {
    code: "401",
    title: "Missing or invalid API key",
    text: "Send `Authorization: Bearer book_sk_...` on every `/api/v1` request.",
  },
  {
    code: "402",
    title: "Insufficient credits",
    text: "API generations spend the same account credits as the normal app.",
  },
  {
    code: "403",
    title: "Account disabled or resource forbidden",
    text: "Banned accounts cannot use API keys. Books and jobs must belong to the user who owns the key.",
  },
  {
    code: "404",
    title: "Job or book not found",
    text: "The resource must belong to the user who owns the API key.",
  },
  {
    code: "409",
    title: "Export not ready",
    text: "PDF and EPUB downloads are blocked while a generated book is queued, generating, failed, or cancelled.",
  },
  {
    code: "429",
    title: "Rate limited",
    text: "All `/api` traffic shares a limit of 600 requests per 15 minutes. Standard `RateLimit-*` headers are returned.",
  },
];

function DocIcon({ icon, className = "size-5" }) {
  return createElement(icon, { className });
}

function SectionHeader({ eyebrow, title, description }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-600">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-2xl font-black text-slate-950">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
        {description}
      </p>
    </div>
  );
}

function CodeBlock({ label, code }) {
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-sm">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
          <Terminal className="size-4" />
          {label}
        </div>
        <button
          type="button"
          onClick={copyCode}
          className="inline-flex h-8 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-bold text-slate-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          {copied ? (
            <CheckCircle2 className="size-3.5 text-emerald-300" />
          ) : (
            <Copy className="size-3.5" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-xs leading-6 text-slate-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function ParamTable({ group }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3 text-sm font-black text-slate-950">
        {group.title}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs font-bold uppercase tracking-wider text-slate-400">
              <th className="px-4 py-2.5">Field</th>
              <th className="px-4 py-2.5">Allowed</th>
              <th className="px-4 py-2.5">Default</th>
              <th className="px-4 py-2.5">Notes</th>
            </tr>
          </thead>
          <tbody>
            {group.params.map((param) => (
              <tr
                key={param.name}
                className="border-b border-slate-50 align-top last:border-b-0"
              >
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-bold text-slate-900">
                  {param.name}
                </td>
                <td className="px-4 py-3 text-xs leading-5 text-slate-600">
                  {param.allowed}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">
                  {param.fallback}
                </td>
                <td className="px-4 py-3 text-xs leading-5 text-slate-500">
                  {param.notes}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OptionChips({ title, options }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-black text-slate-950">{title}</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => (
          <code
            key={option}
            className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700"
          >
            {option}
          </code>
        ))}
      </div>
    </div>
  );
}

function GenreFamilyTable() {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3 text-sm font-black text-slate-950">
        How genre changes generation
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs font-bold uppercase tracking-wider text-slate-400">
              <th className="px-4 py-2.5">Family</th>
              <th className="px-4 py-2.5">Matched values</th>
              <th className="px-4 py-2.5">Behavior</th>
            </tr>
          </thead>
          <tbody>
            {GENRE_FAMILY_ROWS.map((row) => (
              <tr
                key={row.family}
                className="border-b border-slate-50 align-top last:border-b-0"
              >
                <td className="whitespace-nowrap px-4 py-3 text-xs font-bold text-slate-900">
                  {row.family}
                </td>
                <td className="px-4 py-3 text-xs leading-5 text-slate-600">
                  {row.matches}
                </td>
                <td className="px-4 py-3 text-xs leading-5 text-slate-500">
                  {row.behavior}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EndpointCard({ endpoint }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-md bg-slate-950 px-2.5 py-1 font-mono text-xs font-bold text-white">
          {endpoint.method}
        </span>
        <code className="break-all text-sm font-bold text-slate-900">
          {endpoint.path}
        </code>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-500">
        {endpoint.purpose}
      </p>
    </div>
  );
}

function PublicApiDocsShell({ children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-gray-200 bg-white/90 px-4 backdrop-blur-md md:h-16 md:px-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-lg font-bold text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-linear-to-br from-violet-400 to-violet-500 text-white shadow-lg shadow-violet-500/20">
            <LogoIcon className="size-5" />
          </span>
          <span className="text-lg">Bookify</span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            to="/login"
            className="inline-flex h-10 items-center rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
          >
            Sign in
          </Link>
          <Link
            to="/register"
            className="inline-flex h-10 items-center rounded-xl bg-slate-950 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
          >
            Create account
          </Link>
        </div>
      </header>
      <div>{children}</div>
    </div>
  );
}

function ApiDocsContent() {
  return (
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-6 bg-[radial-gradient(circle_at_15%_15%,rgba(124,58,237,0.14),transparent_20rem),linear-gradient(135deg,#ffffff,#f8fafc)] p-6 md:grid-cols-[1fr_auto] md:items-end lg:p-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">
                Developer API
              </p>
              <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
                Generate ebooks with your own key
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 md:text-base">
                Create full-book jobs, poll generation status, list your jobs
                and books, retrieve the saved book, and download PDF or EPUB
                files from `/api/v1`.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {QUICK_LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="group flex min-w-36 items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                >
                  <span className="flex items-center gap-2">
                    <DocIcon icon={link.icon} className="size-4" />
                    {link.label}
                  </span>
                  <ChevronRight className="size-4 transition group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[15rem_1fr] xl:grid-cols-[15rem_1fr_15rem]">
          <aside className="hidden lg:block">
            <nav
              aria-label="API documentation sections"
              className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2"
            >
              <div className="space-y-6">
                {NAV_GROUPS.map((group) => (
                  <div key={group.title}>
                    <p className="mb-2 px-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                      {group.title}
                    </p>
                    <div className="space-y-1">
                      {group.items.map((item) => (
                        <a
                          key={item.id}
                          href={`#${item.id}`}
                          className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-slate-600 transition hover:bg-violet-50 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                        >
                          <DocIcon icon={item.icon} className="size-4" />
                          {item.label}
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </nav>
          </aside>

          <div className="min-w-0">
            <section id="overview" className="scroll-mt-24">
              <SectionHeader
                eyebrow="Overview"
                title="Two calls to generate, one call to retrieve"
                description="The API is async because full books can take longer than a normal HTTP request. Create a job, poll until complete, then retrieve the book record with authenticated download links."
              />

              <div className="grid gap-4 md:grid-cols-3">
                {[
                  {
                    icon: BookOpen,
                    title: "Create",
                    text: "POST `/api/v1/ebooks` with title, author, topic, audience, chapter count, and generation options.",
                  },
                  {
                    icon: RefreshCw,
                    title: "Poll",
                    text: "GET `/api/v1/generation-jobs/:jobId` until `status` is `complete` and `bookId` is present.",
                  },
                  {
                    icon: Download,
                    title: "Download",
                    text: "GET the retrieved `downloads.pdf.url` or `downloads.epub.url` with the same API key.",
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <DocIcon icon={item.icon} className="size-5 text-violet-600" />
                    <h3 className="mt-4 text-base font-black text-slate-950">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {item.text}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section
              id="authentication"
              className="scroll-mt-24 mt-14 border-t border-slate-100 pt-14"
            >
              <SectionHeader
                eyebrow="Authentication"
                title="Use a book secret key"
                description="Create keys from Profile. Secret keys are shown once, stored hashed, and must be sent as bearer tokens."
              />

              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">
                <div className="mb-2 flex items-center gap-2 font-black">
                  <ShieldCheck className="size-4" />
                  API generations use account credits
                </div>
                A request authenticated with `book_sk_...` spends credits from
                the user who owns that key, using the same credit logic as the
                app generation page.
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                    <LockKeyhole className="size-4 text-violet-600" />
                    Header
                  </div>
                  <code className="mt-3 block rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                    Authorization: Bearer book_sk_your_key_here
                  </code>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                    <Clipboard className="size-4 text-violet-600" />
                    Key format
                  </div>
                  <code className="mt-3 block rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                    book_sk_...
                  </code>
                </div>
              </div>
            </section>

            <section
              id="credits"
              className="scroll-mt-24 mt-14 border-t border-slate-100 pt-14"
            >
              <SectionHeader
                eyebrow="Credits"
                title="Check credits left"
                description="Use this endpoint before starting a generation job when your integration needs to confirm the account has credits available."
              />

              <EndpointCard endpoint={findEndpoint("GET", "/api/v1/credits")} />
              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <CodeBlock label="curl" code={CREDITS_CURL} />
                <CodeBlock label="200 response" code={CREDITS_RESPONSE} />
              </div>
            </section>

            <section
              id="generate"
              className="scroll-mt-24 mt-14 border-t border-slate-100 pt-14"
            >
              <SectionHeader
                eyebrow="Generate"
                title="Create an ebook generation job"
                description="This endpoint starts the same full-book job system used by the app. It returns immediately with a job ID."
              />

              <EndpointCard endpoint={findEndpoint("POST", "/api/v1/ebooks")} />
              <div className="mt-4 space-y-4">
                <CodeBlock label="curl" code={GENERATE_CURL} />
                <CodeBlock label="202 response" code={GENERATE_RESPONSE} />
              </div>
            </section>

            <section
              id="from-document"
              className="scroll-mt-24 mt-14 border-t border-slate-100 pt-14"
            >
              <SectionHeader
                eyebrow="Source documents"
                title="Make a book from your own document"
                description="Ground a Gemini book in your own files (research, notes, a draft). Upload the documents, then pass the returned objects into a generation job. Gemini only."
              />

              <EndpointCard
                endpoint={findEndpoint("POST", "/api/v1/source-files")}
              />

              <div className="mt-4 space-y-4">
                <CodeBlock label="Step 1 — upload" code={SOURCE_UPLOAD_CURL} />
                <CodeBlock label="201 response" code={SOURCE_UPLOAD_RESPONSE} />
                <CodeBlock label="Step 2 — generate" code={SOURCE_GEN_CURL} />
                <CodeBlock label="companion flags" code={SOURCE_PARAMS_NOTE} />
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                {[
                  {
                    icon: FileText,
                    title: "What's accepted",
                    text: "Up to 6 files, 12MB each: PDF, DOCX, Markdown, TXT, HTML, CSV, RTF, JSON. The response includes extracted text and a preview.",
                  },
                  {
                    icon: ShieldCheck,
                    title: "How Gemini reads them",
                    text: "Extracted text grounds the outline and chapters. PDFs are also attached natively so Gemini sees the original document.",
                  },
                  {
                    icon: Library,
                    title: "Build the Book Bible",
                    text: "Add generateBibleFromSource: true to distill characters, facts, and canon from your files before writing.",
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <DocIcon icon={item.icon} className="size-5 text-violet-600" />
                    <h3 className="mt-4 text-base font-black text-slate-950">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {item.text}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section
              id="poll"
              className="scroll-mt-24 mt-14 border-t border-slate-100 pt-14"
            >
              <SectionHeader
                eyebrow="Poll"
                title="Check generation status"
                description="Poll the job until the response has `status: complete`. Use the returned `bookId` for retrieval and downloads."
              />

              <EndpointCard
                endpoint={findEndpoint("GET", "/api/v1/generation-jobs/:jobId")}
              />
              <div className="mt-4">
                <CodeBlock label="curl" code={POLL_CURL} />
              </div>
            </section>

            <section
              id="lists"
              className="scroll-mt-24 mt-14 border-t border-slate-100 pt-14"
            >
              <SectionHeader
                eyebrow="Lists"
                title="List your jobs and books"
                description="Lost an ID? Both resources are listable, newest first. `hasMore: true` means another page exists — request it with `offset += limit` (limit 1-100, default 20). Jobs accept a `status` filter: queued, generating, cancelling, cancelled, complete, or failed."
              />

              <div className="grid gap-3">
                <EndpointCard
                  endpoint={findEndpoint("GET", "/api/v1/generation-jobs")}
                />
                <EndpointCard endpoint={findEndpoint("GET", "/api/v1/ebooks")} />
              </div>
              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <CodeBlock label="curl — failed jobs" code={LIST_JOBS_CURL} />
                <CodeBlock label="curl — your books" code={LIST_BOOKS_CURL} />
              </div>
              <div className="mt-4">
                <CodeBlock label="200 response" code={LIST_BOOKS_RESPONSE} />
              </div>
            </section>

            <section
              id="retrieve"
              className="scroll-mt-24 mt-14 border-t border-slate-100 pt-14"
            >
              <SectionHeader
                eyebrow="Retrieve"
                title="Get the generated book and file links"
                description="The retrieve endpoint returns the saved book JSON and authenticated PDF/EPUB URLs."
              />

              <EndpointCard endpoint={findEndpoint("GET", "/api/v1/ebooks/:bookId")} />
              <div className="mt-4 space-y-4">
                <CodeBlock label="curl" code={RETRIEVE_CURL} />
                <CodeBlock label="200 response" code={RETRIEVE_RESPONSE} />
              </div>
            </section>

            <section
              id="downloads"
              className="scroll-mt-24 mt-14 border-t border-slate-100 pt-14"
            >
              <SectionHeader
                eyebrow="Downloads"
                title="Download PDF and EPUB"
                description="File URLs return binary responses. Send the same bearer key and write the output to disk."
              />

              <div className="grid gap-4 md:grid-cols-2">
                <EndpointCard endpoint={findEndpoint("GET", "/api/v1/books/:bookId/pdf")} />
                <EndpointCard endpoint={findEndpoint("GET", "/api/v1/books/:bookId/epub")} />
              </div>
              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <CodeBlock label="PDF" code={PDF_CURL} />
                <CodeBlock label="EPUB" code={EPUB_CURL} />
              </div>
            </section>

            <section
              id="parameters"
              className="scroll-mt-24 mt-14 border-t border-slate-100 pt-14"
            >
              <SectionHeader
                eyebrow="Reference"
                title="Generation job parameters"
                description="Every field accepted by POST /api/v1/ebooks, with allowed values, defaults, and what happens when a value is invalid."
              />

              <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                <div className="mb-2 flex items-center gap-2 font-black">
                  <AlertTriangle className="size-4" />
                  Two rules to know
                </div>
                Boolean flags accept exactly true, "true", "yes", or the number
                1 — anything else (including "1" as a string) is treated as
                false. And most invalid values do not error: they silently fall
                back to the documented default. Hard 400/402/403/404 errors are
                reserved for the cases in the error reference below.
              </div>

              <div className="mb-6">
                <h3 className="mb-2 text-sm font-black text-slate-950">
                  Full request — every common field
                </h3>
                <p className="mb-3 max-w-3xl text-sm leading-6 text-slate-500">
                  A maximal Gemini job: AI-written outline, 10 long chapters, 2
                  illustrations per chapter, a generated cover, and a Book Bible
                  plus Visual Bible for character and art continuity. Drop any
                  field to fall back to its default.
                </p>
                <CodeBlock label="curl — all parameters" code={ALL_PARAMS_CURL} />
                <div className="mt-3">
                  <CodeBlock label="optional add-ons" code={SOURCE_PARAMS_NOTE} />
                </div>
              </div>

              <div className="space-y-5">
                <OptionChips
                  title="Create-book genre dropdown values"
                  options={BOOK_GENRES}
                />
                <GenreFamilyTable />
                {PARAM_GROUPS.map((group) => (
                  <ParamTable key={group.title} group={group} />
                ))}
              </div>
            </section>

            <section
              id="errors"
              className="scroll-mt-24 mt-14 border-t border-slate-100 pt-14 pb-16"
            >
              <SectionHeader
                eyebrow="Reference"
                title="Endpoint reference and errors"
                description="All `/api/v1` routes require the same bearer key. Jobs can be polled, cancelled, or retried; downloads return `409` while generated books are still running or failed."
              />

              <div className="grid gap-3">
                {ENDPOINTS.map((endpoint) => (
                  <EndpointCard key={`${endpoint.method}-${endpoint.path}`} endpoint={endpoint} />
                ))}
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-2">
                {ERRORS.map((error) => (
                  <div
                    key={error.code}
                    className="rounded-xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex items-center gap-3">
                      <span className="rounded-md bg-slate-950 px-2.5 py-1 font-mono text-xs font-bold text-white">
                        {error.code}
                      </span>
                      <h3 className="text-sm font-black text-slate-950">
                        {error.title}
                      </h3>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-500">
                      {error.text}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>

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
                  Response types
                </p>
                <div className="space-y-2.5">
                  {[
                    { icon: CreditCard, text: "Credits balance JSON" },
                    { icon: Code2, text: "JSON for jobs and books" },
                    { icon: FileText, text: "PDF binary download" },
                    { icon: FileArchive, text: "EPUB zip download" },
                    { icon: RefreshCw, text: "Cancel and retry job controls" },
                    { icon: ListChecks, text: "409 for running or failed jobs" },
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
            </div>
          </aside>
        </div>
      </main>
  );
}

function ApiDocsPage() {
  const { isAuthenticated } = useAuthContext();
  const content = <ApiDocsContent />;

  if (isAuthenticated) {
    return <DashboardLayout>{content}</DashboardLayout>;
  }

  return <PublicApiDocsShell>{content}</PublicApiDocsShell>;
}

export default ApiDocsPage;
