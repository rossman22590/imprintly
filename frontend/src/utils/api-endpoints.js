export const API_BASE_URL = import.meta.env.PROD
  ? ""
  : import.meta.env.VITE_API_BASE_URL;

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
  },
  PROFILE: {
    GET: "/api/profile",
    EDIT: "/api/profile",
    UPLOAD_AVATAR: "/api/profile/avatar",
    DELETE_AVATAR: "/api/profile/avatar",
  },
  CREDITS: {
    GET: "/api/credits",
  },
  ADMIN: {
    USERS: "/api/admin/users",
  },
  BOOKS: {
    GET_ALL: "/api/books",
    GET_BY_ID: "/api/books",
    CREATE: "/api/books",
    UPDATE_CONTENT: "/api/books",
    UPDATE_COVER: "/api/books",
    DELETE: "/api/books",
  },
  AI: {
    GENERATE_OUTLINE: "/api/ai/generate-book-outline",
    GENERATE_CHAPTER_CONTENT: "/api/ai/generate-chapter-content",
    GENERATE_COVER_IMAGE: "/api/ai/generate-cover-image",
    GENERATE_CHAPTER_IMAGE: "/api/ai/generate-chapter-image",
    GENERATE_FULL_BOOK: "/api/ai/generate-full-book",
    FULL_BOOK_JOBS: "/api/ai/full-book-jobs",
    QUALITY_TOOL: "/api/ai/quality-tool",
  },
  EXPORTS: {
    DOCX: "/api/exports",
    EPUB: "/api/exports",
    MARKDOWN: "/api/exports",
    PDF: "/api/exports",
  },
};
