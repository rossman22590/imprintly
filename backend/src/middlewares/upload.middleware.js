const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { uploadsDirPath } = require("../utils/upload-paths");

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDirPath)) {
  fs.mkdirSync(uploadsDirPath, { recursive: true });
}

const storageEngine = multer.diskStorage({
  destination(req, file, callback) {
    callback(null, uploadsDirPath);
  },
  filename(req, file, callback) {
    // generate unique filename: fieldname-timestamp-randomstring.ext
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    callback(
      null,
      `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`
    );
  },
});

function checkFileType(file, callback) {
  const allowedFileTypes = /jpeg|jpg|png|gif|webp/;
  const extensionMatched = allowedFileTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  const mimetypeMatched = allowedFileTypes.test(file.mimetype);

  if (extensionMatched && mimetypeMatched) {
    callback(null, true);
  } else {
    callback(
      new Error("Only image files (JPEG, JPG, PNG, GIF, WebP) are allowed!")
    );
  }
}

function checkSourceFileType(file, callback) {
  const extension = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = new Set([
    ".csv",
    ".docx",
    ".htm",
    ".html",
    ".json",
    ".md",
    ".markdown",
    ".pdf",
    ".rtf",
    ".text",
    ".txt",
  ]);
  const allowedMimeTypes = new Set([
    "application/json",
    "application/msword",
    "application/pdf",
    "application/rtf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/csv",
    "text/html",
    "text/markdown",
    "text/plain",
    "text/rtf",
  ]);

  if (allowedExtensions.has(extension) && allowedMimeTypes.has(file.mimetype)) {
    callback(null, true);
  } else {
    callback(
      new Error(
        "Only PDF, DOCX, Markdown, text, HTML, CSV, RTF, and JSON source files are allowed."
      )
    );
  }
}

const uploadBookCoverImage = multer({
  storage: storageEngine,
  limits: {
    files: 1,
    fileSize: 2 * 1024 * 1024, // 2MB limit
  },
  fileFilter(req, file, callback) {
    checkFileType(file, callback);
  },
}).single("coverImage");

const uploadAvatarImage = multer({
  storage: storageEngine,
  limits: {
    files: 1,
    fileSize: 2 * 1024 * 1024, // 2MB limit
  },
  fileFilter(req, file, callback) {
    checkFileType(file, callback);
  },
}).single("avatar");

const uploadVisualReferenceImage = multer({
  storage: storageEngine,
  limits: {
    files: 1,
    fileSize: 8 * 1024 * 1024,
  },
  fileFilter(req, file, callback) {
    checkFileType(file, callback);
  },
}).single("referenceImage");

function checkAudioFileType(file, callback) {
  const allowedExtensions = /mp3|m4a|mp4|wav|webm|ogg/;
  const extensionMatched = allowedExtensions.test(
    path.extname(file.originalname).toLowerCase()
  );
  const mimetypeMatched = /^audio\/|^video\/(mp4|webm)/.test(file.mimetype);

  if (extensionMatched || mimetypeMatched) {
    callback(null, true);
  } else {
    callback(new Error("Only audio files are allowed for the intro recording."));
  }
}

const uploadIntroAudio = multer({
  storage: storageEngine,
  limits: {
    files: 1,
    fileSize: 25 * 1024 * 1024, // 25MB limit
  },
  fileFilter(req, file, callback) {
    checkAudioFileType(file, callback);
  },
}).single("introAudio");

const uploadBookSourceFiles = multer({
  storage: storageEngine,
  limits: {
    files: 8,
    fileSize: 12 * 1024 * 1024,
  },
  fileFilter(req, file, callback) {
    checkSourceFileType(file, callback);
  },
}).array("sourceFiles", 8);

// Developer API variant: caps at 6 files (the count generation actually uses) and
// maps multer/filter errors to clear 400s instead of falling through to the
// generic 500 handler with a misleading "Max 2MB" message.
const API_SOURCE_FILE_LIMIT = 6;

const apiSourceUpload = multer({
  storage: storageEngine,
  limits: {
    files: API_SOURCE_FILE_LIMIT,
    fileSize: 12 * 1024 * 1024,
  },
  fileFilter(req, file, callback) {
    checkSourceFileType(file, callback);
  },
}).array("sourceFiles", API_SOURCE_FILE_LIMIT);

function mapSourceUploadError(err) {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return "Each source file must be 12MB or smaller.";
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return `You can upload at most ${API_SOURCE_FILE_LIMIT} source files per request.`;
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return "Unexpected upload field. Send files under the `sourceFiles` form field.";
    }
    return err.message;
  }

  return err.message || "Unsupported source file.";
}

function uploadApiSourceFiles(req, res, next) {
  apiSourceUpload(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: mapSourceUploadError(err) });
    }

    return next();
  });
}

module.exports = {
  mapSourceUploadError,
  uploadApiSourceFiles,
  uploadAvatarImage,
  uploadBookCoverImage,
  uploadBookSourceFiles,
  uploadIntroAudio,
  uploadVisualReferenceImage,
};
