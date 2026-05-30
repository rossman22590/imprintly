export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(
  /\/$/,
  ""
);

export function resolveImageUrl(url = "") {
  if (!url) return "";

  const value = String(url).replace(/\\/g, "/");

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (value.startsWith("/uploads/")) {
    return `${API_BASE_URL || ""}${value}`;
  }

  return value;
}

export const API_ENDPOINTS = {
  AUTH: {
    REGISTER: "/api/auth/register",
    LOGIN: "/api/auth/login",
    LOGOUT: "/api/auth/logout",
    REQUEST_PASSWORD_RESET: "/api/auth/password-reset/request",
    RESET_PASSWORD: "/api/auth/password-reset/confirm",
  },
  PROFILE: {
    GET: "/api/profile",
    EDIT: "/api/profile",
    UPLOAD_AVATAR: "/api/profile/avatar",
    DELETE_AVATAR: "/api/profile/avatar",
    BOOKSHELF_SHARE: "/api/profile/bookshelf-share",
    API_KEYS: "/api/profile/api-keys",
  },
  CREDITS: {
    GET: "/api/credits",
  },
  ADMIN: {
    JOBS: "/api/admin/jobs",
    PLANS: "/api/admin/plans",
    RUNS: "/api/admin/runs",
    USERS: "/api/admin/users",
  },
  BOOKS: {
    GET_ALL: "/api/books",
    GET_BY_ID: "/api/books",
    CREATE: "/api/books",
    UPDATE_CONTENT: "/api/books",
    UPDATE_COVER: "/api/books",
    UPDATE_KDP: "/api/books",
    PREVIEW_SHARE: "/api/books",
    COMMUNITY_LISTING: "/api/books",
    UPLOAD_VISUAL_REFERENCE: "/api/books/visual-references/upload",
    IMPORT_VISUAL_REFERENCE_URL: "/api/books/visual-references/import-url",
    DELETE: "/api/books",
  },
  AI: {
    GENERATE_OUTLINE: "/api/ai/generate-book-outline",
    GENERATE_CHAPTER_CONTENT: "/api/ai/generate-chapter-content",
    GENERATE_COVER_IMAGE: "/api/ai/generate-cover-image",
    GENERATE_CHAPTER_IMAGE: "/api/ai/generate-chapter-image",
    GENERATE_FULL_BOOK: "/api/ai/generate-full-book",
    FULL_BOOK_JOBS: "/api/ai/full-book-jobs",
    RUNS: "/api/ai/full-book-jobs",
    QUALITY_TOOL: "/api/ai/quality-tool",
  },
  EXPORTS: {
    DOCX: "/api/exports",
    EPUB: "/api/exports",
    MARKDOWN: "/api/exports",
    PDF: "/api/exports",
    CONTINUITY_REPORT: "/api/exports",
  },
  PUBLIC: {
    BOOKSHELF: "/api/public/bookshelves",
    BOOK_PREVIEW: "/api/public/book-previews",
    COMMUNITY_BOOKSHELF: "/api/public/community-bookshelf",
  },
};
