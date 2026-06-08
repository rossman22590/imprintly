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

module.exports = {
  uploadAvatarImage,
  uploadBookCoverImage,
  uploadBookSourceFiles,
  uploadIntroAudio,
  uploadVisualReferenceImage,
};
