const ENV = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: process.env.PORT ?? 3000,
  DB_URI: process.env.DB_URI ?? "",
  JWT_SECRET_KEY: process.env.JWT_SECRET_KEY ?? "",
  API_KEY_HASH_SECRET: process.env.API_KEY_HASH_SECRET ?? "",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? "",
  GROQ_API_KEY: process.env.GROQ_API_KEY ?? "",
  DEFAULT_AI_PROVIDER: process.env.DEFAULT_AI_PROVIDER ?? "groq",
  GROQ_STRUCTURE_MODEL:
    process.env.GROQ_STRUCTURE_MODEL ?? "openai/gpt-oss-120b",
  GROQ_SECTION_MODEL: process.env.GROQ_SECTION_MODEL ?? "openai/gpt-oss-20b",
  GROQ_STRUCTURE_MAX_TOKENS: process.env.GROQ_STRUCTURE_MAX_TOKENS ?? "12000",
  GROQ_SECTION_MAX_TOKENS: process.env.GROQ_SECTION_MAX_TOKENS ?? "9000",
  GEMINI_STRUCTURE_MODEL:
    process.env.GEMINI_STRUCTURE_MODEL ?? "gemini-3.5-flash",
  GEMINI_SECTION_MODEL: process.env.GEMINI_SECTION_MODEL ?? "gemini-3.5-flash",
  GEMINI_QUALITY_MODEL: process.env.GEMINI_QUALITY_MODEL ?? "gemini-3.5-flash",
  GEMINI_MAX_OUTPUT_TOKENS: process.env.GEMINI_MAX_OUTPUT_TOKENS ?? "16000",
  GEMINI_THINKING_LEVEL: process.env.GEMINI_THINKING_LEVEL ?? "low",
  GEMINI_IMAGE_MODEL:
    process.env.GEMINI_IMAGE_MODEL ?? "gemini-3.1-flash-image-preview",
  GEMINI_IMAGE_SIZE: process.env.GEMINI_IMAGE_SIZE ?? "1K",
  IMAGE_UPLOAD_API_URL:
    process.env.IMAGE_UPLOAD_API_URL ??
    "https://uplaodpixio-production.up.railway.app/api/upload",
  TRUSTED_IMAGE_HOSTS:
    process.env.TRUSTED_IMAGE_HOSTS ??
    "pixiomedia.nyc3.digitaloceanspaces.com",
  STARTING_CREDITS: process.env.STARTING_CREDITS ?? "500",
  BOOKIFY_USD_PER_CREDIT:
    process.env.BOOKIFY_USD_PER_CREDIT ?? "0.01",
  AI_TOKEN_MARKUP_MULTIPLIER:
    process.env.AI_TOKEN_MARKUP_MULTIPLIER ?? "2",
  ADMIN_EMAILS: process.env.ADMIN_EMAILS ?? "rcohen@mytsi.org",
  BOOTSTRAP_FIRST_ADMIN:
    process.env.BOOTSTRAP_FIRST_ADMIN ??
    (process.env.NODE_ENV === "production" ? "false" : "true"),
  PUBLIC_API_URL: process.env.PUBLIC_API_URL ?? "",
  CLIENT_URL: process.env.CLIENT_URL ?? "",
  CLIENT_URLS: process.env.CLIENT_URLS ?? "",
  CORS_ALLOW_ALL: process.env.CORS_ALLOW_ALL ?? "",
  RESEND_API_KEY: process.env.RESEND_API_KEY ?? "",
  MAIL_FROM_NAME: process.env.MAIL_FROM_NAME ?? "Bookify",
  MAIL_FROM_EMAIL: process.env.MAIL_FROM_EMAIL ?? "bookify@myapps.ai",
  PASSWORD_RESET_TOKEN_TTL_MINUTES:
    process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES ?? "60",
};

module.exports = ENV;
