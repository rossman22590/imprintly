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
import DashboardLayout from "../layouts/DashboardLayout";

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
  { id: "poll", label: "Poll job" },
  { id: "retrieve", label: "Retrieve book" },
  { id: "downloads", label: "Download files" },
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
      { id: "poll", label: "Poll generation", icon: RefreshCw },
      { id: "retrieve", label: "Retrieve book", icon: Library },
      { id: "downloads", label: "PDF and EPUB", icon: Download },
    ],
  },
  {
    title: "Reference",
    items: [{ id: "errors", label: "Errors", icon: AlertTriangle }],
  },
];

const QUICK_LINKS = [
  { label: "Manage API Keys", to: "/profile", icon: KeyRound },
  { label: "Main Docs", to: "/docs", icon: FileText },
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
    method: "GET",
    path: "/api/v1/credits",
    purpose: "Check the API key owner's remaining credit balance.",
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

const ERRORS = [
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

function ApiDocsPage() {
  return (
    <DashboardLayout>
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
                Create full-book jobs, poll generation status, retrieve the saved
                book, and download PDF or EPUB files from `/api/v1`.
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
    </DashboardLayout>
  );
}

export default ApiDocsPage;
