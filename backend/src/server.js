const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const ENV = require("./configs/env");
const { connectToDB } = require("./configs/db");
const adminRouter = require("./routes/admin.route");
const authRouter = require("./routes/auth.route");
const creditsRouter = require("./routes/credits.route");
const profileRouter = require("./routes/profile.route");
const booksRouter = require("./routes/books.route");
const aiRouter = require("./routes/ai.route");
const exportsRouter = require("./routes/exports.route");
const publicRouter = require("./routes/public.route");
const developerApiRouter = require("./routes/developer-api.route");
const {
  recoverInterruptedGenerationJobs,
} = require("./utils/book-generation.jobs");
const {
  getPublicShareMetaForPath,
  injectPublicShareMeta,
} = require("./utils/public-share-meta");

const app = express();
function getCspImageSources() {
  const configuredHosts = [
    ENV.TRUSTED_IMAGE_HOSTS,
    ENV.IMAGE_UPLOAD_API_URL,
  ]
    .flatMap((value) => String(value || "").split(","))
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      if (/^https?:\/\//i.test(value)) {
        try {
          return new URL(value).origin;
        } catch {
          return "";
        }
      }

      return `https://${value.replace(/^\/+|\/+$/g, "")}`;
    })
    .filter(Boolean);

  return ["'self'", "data:", "blob:", ...new Set(configuredHosts)];
}

const configuredOrigins = [ENV.CLIENT_URL, ...ENV.CLIENT_URLS.split(",")]
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);
const allowedOrigins = new Set(configuredOrigins);
const shouldAllowAllCors =
  ENV.NODE_ENV !== "production" ||
  ENV.CORS_ALLOW_ALL === "true" ||
  allowedOrigins.size === 0;
const corsOptions = {
  origin(origin, callback) {
    if (!origin || shouldAllowAllCors) {
      callback(null, true);
      return;
    }

    const normalizedOrigin = origin.replace(/\/$/, "");

    if (allowedOrigins.has(normalizedOrigin)) {
      callback(null, true);
      return;
    }

    callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
  exposedHeaders: ["X-Auth-Token"],
  optionsSuccessStatus: 204,
};
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

// Trust Render's proxy so express-rate-limit can read X-Forwarded-For correctly
app.set("trust proxy", 1);

// Middlewares
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        imgSrc: getCspImageSources(),
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(cors(corsOptions));
app.options("/{*any}", cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" })); // for form data
app.use("/api", apiLimiter);

// Routes
app.use("/api/auth", authLimiter, authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/credits", creditsRouter);
app.use("/api/profile", profileRouter);
app.use("/api/books", booksRouter);
app.use("/api/ai", aiRouter);
app.use("/api/exports", exportsRouter);
app.use("/api/public", publicRouter);
app.use("/api/v1", developerApiRouter);

// Static folder for user uploads - serve from backend/uploads
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.get("/healthz", (_, res) => {
  res.json({ status: "ok" });
});

const frontendDistPath = path.join(__dirname, "../../frontend/dist");
const frontendIndexPath = path.join(frontendDistPath, "index.html");

function getRequestOrigin(req) {
  const forwardedProtocol = String(req.get("x-forwarded-proto") || "")
    .split(",")[0]
    .trim();
  const forwardedHost = String(req.get("x-forwarded-host") || "")
    .split(",")[0]
    .trim();
  const protocol = forwardedProtocol || req.protocol || "https";
  const host = forwardedHost || req.get("host");

  if (!host) return ENV.CLIENT_URL.replace(/\/$/, "");

  return `${protocol}://${host}`;
}

// PRODUCTION: serve React frontend only when this service includes a built frontend.
if (ENV.NODE_ENV === "production" && fs.existsSync(frontendIndexPath)) {
  // serve static files from the React build
  app.use(express.static(frontendDistPath));

  // catch-all route: for any route not matched above, serve index.html
  // this allows React Router to handle routing on the client side
  app.get("/{*any}", async (req, res) => {
    try {
      const origin = getRequestOrigin(req);
      const pageUrl = `${origin}${req.originalUrl || req.url}`;
      const meta = await getPublicShareMetaForPath(req.path, {
        origin,
        pageUrl,
      });

      if (meta) {
        const html = fs.readFileSync(frontendIndexPath, "utf8");
        res.type("html").send(injectPublicShareMeta(html, meta));
        return;
      }
    } catch (error) {
      console.error("Error rendering public share meta:", error);
    }

    res.sendFile(frontendIndexPath);
  });
} else {
  app.get("/", (_, res) => {
    res.json({ message: "Bookify API is running." });
  });
}

// ERROR HANDLING - Multer specific errors
app.use((err, _, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ error: "File size too large! Max 2MB allowed." });
    }

    return res.status(400).json({ error: err.message });
  }

  // delegate non-multer errors to the general error handler
  return next(err);
});

// GENERAL ERROR HANDLER
app.use((err, _, res, next) => {
  console.error("Unhandled error:", err);

  // don't send another response if headers already sent
  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    error: "Something went wrong!",
    ...(ENV.NODE_ENV === "development" && { details: err.message }),
  });
});

// Start server
async function startServer() {
  await connectToDB();
  app.listen(ENV.PORT, () => {
    console.log(`Server running on port ${ENV.PORT}`);
    console.log(`Environment: ${ENV.NODE_ENV}`);
  });

  recoverInterruptedGenerationJobs().catch((error) => {
    console.error("Generation job recovery failed:", error);
  });
}

(async () => {
  try {
    await startServer();
  } catch (error) {
    console.error("Error starting the server:", error);
  }
})();
