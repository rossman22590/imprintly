# Bookify Developer API (v1)

Programmatic access to ebook generation, retrieval, and export. Everything under `/api/v1` is authenticated with a personal API key and returns JSON (except the PDF/EPUB downloads, which return binary files).

```
Base URL: https://<your-host>/api/v1
Auth:     Authorization: Bearer book_sk_...
```

Machine-readable spec: [`openapi.yaml`](./openapi.yaml)

---

## Authentication

### Getting a key

API keys are created from the web app (Profile → API keys). The underlying endpoints are session-authenticated (login cookie/JWT, **not** API-key authenticated):

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/profile/api-keys` | List your keys (masked) |
| `POST` | `/api/profile/api-keys` | Create a key — body `{ "name": "My integration" }` |
| `PATCH` | `/api/profile/api-keys/:apiKeyId` | Rename a key |
| `DELETE` | `/api/profile/api-keys/:apiKeyId` | Revoke a key (immediate, irreversible) |

Keys look like `book_sk_` followed by 43 URL-safe base64 characters. The full secret is returned **once** at creation; only the prefix and last 4 characters are stored and shown afterward. Treat it like a password — it grants full access to your books and credits.

### Using a key

Send it as a Bearer token on every request:

```bash
curl https://<your-host>/api/v1/credits \
  -H "Authorization: Bearer book_sk_..."
```

Requests fail with `401` for a missing/invalid/revoked key and `403` if the owning account is banned.

### Rate limits

All `/api` traffic shares an IP-based limit of **600 requests per 15 minutes**. Standard `RateLimit-*` headers (draft-8) are returned.

---

## Errors

Errors are JSON with an `error` message and, where applicable, a machine-readable `code`:

```json
{ "error": "Not enough credits. Required 24 credits, available 3.", "code": "INSUFFICIENT_CREDITS" }
```

| Status | Meaning |
| --- | --- |
| `400` | Invalid input that cannot be defaulted (bad book ID, source files on a non-Gemini job, invalid `status` filter) |
| `401` | Missing, malformed, invalid, or revoked API key |
| `402` | Insufficient credits for the estimated job cost (`code: INSUFFICIENT_CREDITS`) |
| `403` | Banned account, or a `bookId` you don't own |
| `404` | Job or book not found (or not yours) |
| `409` | Book not ready for export (still generating, failed, or cancelled) |
| `429` | Rate limited |
| `500` | Unexpected server error |

> **Validation philosophy:** most generation parameters are *forgiving* — an unrecognized value silently falls back to the default rather than failing the request (e.g. `provider: "gpt4"` becomes `groq`, `imageSize: "8K"` becomes `1K`). Hard errors are reserved for the cases in the table above. The per-parameter tables below state the exact fallback for every field.

---

## Endpoints

### `GET /credits`

Returns your credit balance.

```json
{
  "object": "credits",
  "creditsLeft": 42.5,
  "credits": {
    "balance": 42.5,
    "lifetimeGranted": 100,
    "lifetimeSpent": 57.5,
    "monthlyAllowance": 750,
    "monthlyPreset": "premium",
    "monthlyResetAt": "2026-05-01T00:00:00.000Z",
    "nextMonthlyResetAt": "2026-06-01T00:00:00.000Z"
  }
}
```

### `POST /generation-jobs` (alias: `POST /ebooks`)

Creates an asynchronous full-book generation job. Returns `202 Accepted` with a job object. Credits for the estimated image count are checked up front; the job is rejected with `402` before anything runs if your balance can't cover it.

The full request-body reference is in [Generation job parameters](#generation-job-parameters) below.

```json
{
  "object": "generation_job",
  "id": "5e9a7c4e-...",
  "status": "queued",
  "bookId": null,
  "provider": "gemini",
  "progress": { "total": 0, "completed": 0, "failed": 0, "currentChapterIndex": null, "currentChapterTitle": "", "message": "Queued" },
  "failedChapters": [],
  "error": "",
  "createdAt": "2026-06-09T12:00:00.000Z",
  "updatedAt": "2026-06-09T12:00:00.000Z",
  "startedAt": null,
  "completedAt": null
}
```

`bookId` is populated once generation creates (or resolves) the book — poll the job until it appears.

### `GET /generation-jobs`

Lists your generation jobs, newest first.

| Query param | Type | Allowed | Default | Invalid value |
| --- | --- | --- | --- | --- |
| `limit` | integer | 1–100 | 20 | clamped into range |
| `offset` | integer | ≥ 0 | 0 | clamped to 0 |
| `status` | string | `queued`, `generating`, `cancelling`, `cancelled`, `complete`, `failed` | (none — all) | `400` |

```json
{
  "object": "list",
  "data": [ { "object": "generation_job", "id": "...", "status": "complete", "...": "..." } ],
  "count": 20,
  "limit": 20,
  "offset": 0,
  "hasMore": true
}
```

`hasMore: true` means another page exists — request the next page with `offset += limit` until `hasMore` is `false`.

### `GET /generation-jobs/:jobId`

Returns one job (`404` if it isn't yours or doesn't exist).

### `DELETE /generation-jobs/:jobId`

Cancels a running job. Cancelling a job that already reached `complete`, `failed`, or `cancelled` is a no-op that returns the job unchanged. Returns the (now cancelled) job object.

### `POST /generation-jobs/:jobId/retry`

Creates a **new** job that re-runs only the failed/incomplete chapters (and missing images) of the original job's book. Returns `202` with the new job. `404` if the original job has no associated book yet.

### `GET /ebooks` (alias: `GET /books`)

Lists your books, newest first. Same `limit`/`offset` pagination as the jobs list (no `status` filter). Returns lightweight summaries — chapter content is **not** included; fetch a single book for that.

```json
{
  "object": "list",
  "data": [
    {
      "object": "book_summary",
      "id": "68463c1b9f...",
      "title": "The Tides of Mars",
      "subtitle": "",
      "author": "Ross",
      "genre": "Science Fiction",
      "audience": "Adult readers",
      "language": "English",
      "status": "complete",
      "bookStatus": "draft",
      "coverImage": "/uploads/...",
      "chapterCount": 8,
      "createdAt": "2026-06-09T12:00:00.000Z",
      "updatedAt": "2026-06-09T12:30:00.000Z",
      "downloads": { "pdf": { "url": "...", "method": "GET" }, "epub": { "url": "...", "method": "GET" } }
    }
  ],
  "count": 1,
  "limit": 20,
  "offset": 0,
  "hasMore": false
}
```

`status` is the generation status (`manual` for books never generated via a job); `bookStatus` is the draft/published flag.

### `GET /ebooks/:bookId` (alias: `GET /books/:bookId`)

Returns the full book — metadata, every chapter with its markdown `content` and image assets, plus ready-made `downloads` links. `400` for a malformed ID, `404` unknown, `403` not yours.

### `GET /ebooks/:bookId/pdf` and `GET /ebooks/:bookId/epub`

Stream the book as `application/pdf` / `application/epub+zip` attachments. Aliases exist under `/books/...`.

Export readiness (`409 Conflict` otherwise):

- generation status `queued`, `generating`, or `cancelling` → *"Book generation is not complete yet. Poll the generation job before downloading."*
- generation status `failed` or `cancelled` → *"Book generation did not complete successfully. Retry the generation job before downloading."*
- anything else (`complete`, or a manually-written book) → downloads succeed.

---

## Job lifecycle

```
queued → generating → complete
                    ↘ failed      (use POST .../retry)
queued/generating → cancelling → cancelled   (via DELETE)
```

Poll `GET /generation-jobs/:jobId` (every few seconds is fine within the rate limit). `progress` reports `total` / `completed` / `failed` steps plus a human-readable `message`. Per-chapter failures land in `failedChapters` without necessarily failing the whole job — retry picks those up.

---

## Generation job parameters

Body of `POST /generation-jobs`. Everything is optional unless noted. Where multiple names are listed, they are accepted aliases (first listed wins when both are present).

### Boolean fields — what counts as "true"

All boolean-ish flags accept **exactly**: `true`, `"true"`, `"yes"`, or the number `1`. Everything else — including `"1"`, `"on"`, `"y"` — is treated as **false**. There is no error for an unrecognized value.

### Engine selection

| Field | Allowed | Default | Invalid value |
| --- | --- | --- | --- |
| `provider` | `"groq"`, `"gemini"` | server `DEFAULT_AI_PROVIDER`, else `groq` | silently falls back to `groq` |
| `model` / `structureModel` / `sectionModel` | **Groq only:** `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `meta-llama/llama-4-scout-17b-16e-instruct`, `llama-3.3-70b-versatile` | `openai/gpt-oss-120b` | silently falls back to server default |
| `useGoogleSearch` / `googleSearch` | boolean | `false` | n/a — ignored unless `provider` is `gemini` |

> Gemini **text** models are configured server-side (`GEMINI_STRUCTURE_MODEL` / `GEMINI_SECTION_MODEL` / `GEMINI_QUALITY_MODEL`, default `gemini-3.5-flash`) and cannot be selected per request. `model`/`structureModel`/`sectionModel` only take effect for Groq. Gemini **image** models *are* per-request (below).

### Book definition

| Field | Type | Limits / behavior | Default |
| --- | --- | --- | --- |
| `title` | string | truncated to 200 chars; HTML/scripts stripped | derived from topic |
| `topic` | string | truncated to 300 chars | `title` |
| `description` | string | truncated to 800 chars (outline) / 1000 (Book Bible) | `""` |
| `genre` | string | truncated to 100 chars — free-form, but the app's dropdown offers: `Nonfiction`, `How-to Guide`, `Business`, `Technical`, `Textbook`, `Self-help`, `Academic`, `Novel`, `Fiction`, `Fantasy`, `Sci-Fi`, `Children's Book`, `Workbook`, `Course`. The value also selects the writing family (see below) | `"Nonfiction"` |
| `audience` | string | truncated to 200 chars | `"General readers"` |
| `language` / `bookLanguage` | string | truncated to 50 chars | `"English"` |
| `style` | string | truncated to 50 chars | `"Informative"` |
| `chapterCount` | integer | clamped to **1–26**. Children's books: interpreted as a *page count* (clamped 2–52), producing `ceil(pages / 2)` two-page spreads | 8 |
| `chapterLength` | string | `"small"` (~1,000–1,600 words), `"medium"` (~2,000–3,000), `"large"` (~3,500–5,000); invalid → `medium` | `"medium"` |
| `outline` | array | `[{ "title": "...", "description": "..." }, ...]` — supplies the chapter structure and **skips outline generation**; its length overrides `chapterCount` | generated |
| `bookId` | string | regenerate into an existing book. Must be a valid Mongo ObjectId you own — `404` unknown, `403` not yours | new book |
| `includeTextGraphics` / `includeGraphics` / `allowTextGraphics` | boolean | enables text-based diagrams/figures inside chapters | `false` |

`style` is free-form, but the app dropdown offers: `Informative`, `Formal`, `Conversational`, `Professional`, `Academic`, `Narrative`, `Creative`, `Descriptive`, `Technical`, `Instructional`, `Inspirational`, `Motivational`, `Humorous`, `Sarcastic`, `Witty`, `Poetic`, `Storytelling`, `Journalistic`, `Analytical`, `Critical`, `Persuasive`, `Emotional`, `Dramatic`, `Mystical`, `Reflective`, `Philosophical`, `Minimalist`, `Casual`, `Friendly`, `Bold`, `Direct`, `Objective`, `Subjective`, `Uplifting`, `Melancholic`, `Dark`, `Satirical`, `Whimsical`, `Playful`, `Epic`, `Fantasy`, `Sci-Fi`, `Technical Coding`, `Business`, `Marketing`, `Product Copy`, `Academic Research`, `Whitepaper`, `Case Study`, `SEO Optimized`.

**The create-book dropdown values are:** `Nonfiction`, `How-to Guide`, `Business`, `Technical`, `Textbook`, `Self-help`, `Academic`, `Novel`, `Fiction`, `Fantasy`, `Sci-Fi`, `Children's Book`, `Workbook`, `Course`.

**How `genre` picks the writing family.** Any string is accepted, but it is matched against book-type rules:

| Family | Matched values | Generation behavior |
| --- | --- | --- |
| Fiction | `Novel`, `Novella`, `Fiction`, `Fantasy`, `Sci-Fi`, `Science Fiction`, `Romance`, `Thriller`, `Mystery`, `Horror`, `Literary Fiction`, `Historical Fiction`, `Young Adult`, `YA` | Story-driven chapters with scene work, POV, dialogue, conflict, reversals, and narrative continuity |
| Children's | anything containing `children`, `childrens`, `kid`, `kids`, `picture`, `storybook`, or `early reader` | Two-page illustrated storybook scenes; `chapterCount` is interpreted as interior pages, clamped 2–52, then converted to 1–26 spreads |
| Textbook | `Textbook`, `text book`, `school textbook`, `college textbook`, `academic textbook`, `educational textbook`, `course textbook` | Formal textbook chapters with learning objectives, key terms, definitions, examples, summaries, and review questions |
| Learning | `Workbook`, `work book`, `worksheet`, `activity book`, `Course`, `study guide`, `lesson book`, `curriculum`, `training manual`, `journal`, `planner` | Interactive learning modules with exercises, reflection prompts, worksheet space, and practice tasks |
| Technical | `Technical` | Precise technical chapters with prerequisites, examples, tradeoffs, implementation detail, and troubleshooting |
| Practical | `How-to Guide`, `Self-help`, `Business` | Outcome-driven guide chapters with steps, examples, decisions, common mistakes, and applied takeaways |
| Academic | `Academic` | Rigorous academic-style chapters with definitions, context, evidence, counterpoints, and careful reasoning |
| Nonfiction | `Nonfiction` or any custom value that does not match another family | Polished explanatory ebook chapters with examples, implications, and a coherent reader journey |

### Images

Image generation **always runs on Gemini image models**, even when `provider` is `groq` for the text.

| Field | Allowed | Default | Invalid value |
| --- | --- | --- | --- |
| `includeImages` / `generateImages` | boolean | `false` | treated as false |
| `imagesPerChapter` / `chapterImageCount` / `imageCountPerChapter` | integer **1–4** | 1 (genre default) | clamped into 1–4; non-numeric → default |
| `generateCover` / `includeCover` | boolean | `false` | treated as false |
| `imageModel` (chapter images), `coverModel` (cover) | `gemini-3.1-flash-image-preview`, `gemini-3-pro-image-preview`, `gemini-2.5-flash-image` | `gemini-3.1-flash-image-preview` | silently falls back to default |
| `imageSize`, `coverImageSize` | `"512"`, `"1K"`, `"2K"`, `"4K"` | `"1K"` | silently falls back to `"1K"` |

Covers are always rendered at a 2:3 aspect ratio. Estimated image credits — `(cover ? 1 : 0) + chapters × imagesPerChapter` at the chosen model/size — are checked before the job starts (`402` on shortfall).

### Source documents (Gemini only)

Generate a book grounded in your own documents. Using any of these with `provider: "groq"` fails with `400` *"Source files are only available with the Gemini 3.5 Flash Book Engine."*

| Field | Type | Behavior |
| --- | --- | --- |
| `sourceFiles` | array | Max **6** entries (extras silently dropped). Each: `{ "name": "...", "url": "/uploads/...", "mimeType": "...", "size": 123, "extractedText": "..." }`. Entries with a non-upload URL or unsupported MIME type are silently dropped. Files must be ≤ 12 MB (enforced at upload time via the web app). |
| `useSourceFiles` | boolean | reuse the source files already stored on the `bookId` book; set explicitly to `false` to ignore stored sources |
| `regenerateFromSource` | boolean | regenerate the book from its stored sources |
| `regenerateOutlineFromSource` | boolean | rebuild the outline from sources even if the book already has chapters |

Supported MIME types: `application/pdf`, `application/json`, `application/msword`, `application/rtf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (docx), `text/csv`, `text/html`, `text/markdown`, `text/plain`, `text/rtf`.

### Book Bible & Visual Bible (continuity canon)

| Field | Type | Behavior | Default |
| --- | --- | --- | --- |
| `bible` | object | seed canon — string keys `source`, `characters`, `locations`, `worldRules`, `timeline`, `styleGuide`, `canonFacts`, `unresolvedThreads`, `notes` | book's stored bible |
| `useBibleForInput` / `useBible` | boolean | set **`false`** to exclude the Book Bible from generation context (note: default is *on*, unlike other flags) | `true` |
| `generateBibleFromSource` / `generateBibleFromSources` / `generateBibleFromDocuments` | boolean | build the Book Bible from `sourceFiles` before writing (Gemini + sources required) | `false` |
| `visualBible` | object | visual canon used for image consistency (characters, palette, style) | book's stored visual bible |
| `useBibleForImages` | boolean | apply the visual bible to image prompts even without chapter images/cover enabled | `false` |

### Reserved fields

`apiSource` and `apiKeyId` are set by the server on every API-created job (for usage attribution) — any values you send are overwritten.

---

## Examples

**Create a Gemini book with images and a cover:**

```bash
curl -X POST https://<your-host>/api/v1/generation-jobs \
  -H "Authorization: Bearer book_sk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "gemini",
    "title": "The Tides of Mars",
    "topic": "A sci-fi novella about terraforming",
    "genre": "Science Fiction",
    "audience": "Adult readers",
    "chapterCount": 8,
    "chapterLength": "medium",
    "includeImages": true,
    "imagesPerChapter": 1,
    "imageModel": "gemini-3-pro-image-preview",
    "imageSize": "2K",
    "generateCover": true,
    "coverModel": "gemini-3-pro-image-preview",
    "useGoogleSearch": true
  }'
```

**Poll until done, then download:**

```bash
JOB_ID=...; KEY="Authorization: Bearer book_sk_..."

curl -s -H "$KEY" https://<your-host>/api/v1/generation-jobs/$JOB_ID
# ... repeat until "status": "complete", then read "bookId"

curl -H "$KEY" -o book.pdf  https://<your-host>/api/v1/ebooks/<bookId>/pdf
curl -H "$KEY" -o book.epub https://<your-host>/api/v1/ebooks/<bookId>/epub
```

**Recover lost IDs via the list endpoints:**

```bash
curl -s -H "$KEY" "https://<your-host>/api/v1/ebooks?limit=50"
curl -s -H "$KEY" "https://<your-host>/api/v1/generation-jobs?status=failed"
```

**Retry a job's failed chapters:**

```bash
curl -X POST -H "$KEY" https://<your-host>/api/v1/generation-jobs/$JOB_ID/retry
```
