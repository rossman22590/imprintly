const ENV = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: process.env.PORT ?? 3000,
  DB_URI: process.env.DB_URI ?? "",
  JWT_SECRET_KEY: process.env.JWT_SECRET_KEY ?? "",
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
  GEMINI_MAX_OUTPUT_TOKENS: process.env.GEMINI_MAX_OUTPUT_TOKENS ?? "9000",
  GEMINI_IMAGE_MODEL:
    process.env.GEMINI_IMAGE_MODEL ?? "gemini-3.1-flash-image-preview",
  GEMINI_IMAGE_SIZE: process.env.GEMINI_IMAGE_SIZE ?? "1K",
  IMAGE_UPLOAD_API_URL:
    process.env.IMAGE_UPLOAD_API_URL ??
    "https://uplaodpixio-production.up.railway.app/api/upload",
  TRUSTED_IMAGE_HOSTS:
    process.env.TRUSTED_IMAGE_HOSTS ??
    "pixiomedia.nyc3.digitaloceanspaces.com",
  PUBLIC_API_URL: process.env.PUBLIC_API_URL ?? "",
  CLIENT_URL: process.env.CLIENT_URL ?? "",
  CLIENT_URLS: process.env.CLIENT_URLS ?? "",
  CORS_ALLOW_ALL: process.env.CORS_ALLOW_ALL ?? "",
};

module.exports = ENV;
