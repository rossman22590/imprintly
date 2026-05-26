const Book = require("../models/Book");
const User = require("../models/User");
const { generatePdf } = require("../utils/pdf.generator");
const { migrateBookImagesToStorage } = require("../utils/image-asset-migration");

function setPublicShareHeaders(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
}

function firstPreviewChapter(book) {
  const chapters = Array.isArray(book?.chapters) ? book.chapters : [];

  return (
    chapters.find((chapter) => String(chapter?.content || "").trim()) ||
    chapters[0] ||
    null
  );
}

function serializePublicBook(book) {
  const previewToken = book?.previewShare?.token || "";

  return {
    _id: book._id,
    title: book.title,
    subtitle: book.subtitle,
    author: book.author,
    coverImage: book.coverImage,
    genre: book.genre,
    audience: book.audience,
    language: book.language,
    status: book.status,
    chapterCount: Array.isArray(book.chapters) ? book.chapters.length : 0,
    createdAt: book.createdAt,
    updatedAt: book.updatedAt,
    previewShare: previewToken
      ? {
          token: previewToken,
          enabledAt: book.previewShare.enabledAt,
        }
      : null,
  };
}

function serializePublicPreview(book) {
  const chapter = firstPreviewChapter(book);
  const kdpAssets = book?.kdp?.assets || {};
  const owner = book?.userId && typeof book.userId === "object" ? book.userId : {};

  return {
    _id: book._id,
    title: book.title,
    subtitle: book.subtitle,
    author: book.author,
    coverImage: book.coverImage,
    genre: book.genre,
    audience: book.audience,
    language: book.language,
    chapterCount: Array.isArray(book.chapters) ? book.chapters.length : 0,
    createdAt: book.createdAt,
    updatedAt: book.updatedAt,
    owner: {
      name: owner.name || "",
      avatar: owner.avatar || "",
      storeUrl: owner.storeUrl || "",
      shelfPageName: owner.shelfPageName || "",
      shelfPhotoUrl: owner.shelfPhotoUrl || "",
      publicShareMetaTitle: owner.publicShareMetaTitle || "",
      publicShareMetaDescription: owner.publicShareMetaDescription || "",
      publicShareImageUrl: owner.publicShareImageUrl || "",
      publicShareTheme: owner.publicShareTheme || "",
    },
    sales: {
      description: kdpAssets.description || "",
      backCoverBlurb: kdpAssets.backCoverBlurb || "",
      authorBio: kdpAssets.authorBio || "",
    },
    firstChapter: chapter
      ? {
          _id: chapter._id,
          title: chapter.title,
          description: chapter.description,
          content: chapter.content,
          wordCount: chapter.wordCount,
        }
      : null,
  };
}

async function getPublicBookshelf(req, res) {
  try {
    const { shareToken } = req.params;
    const user = await User.findOne({ "bookshelfShare.token": shareToken });

    setPublicShareHeaders(res);

    if (!user) {
      return res.status(404).json({ error: "Bookshelf link is not active." });
    }

    const books = await Book.find({ userId: user._id }).sort({
      updatedAt: -1,
      createdAt: -1,
    });

    return res.status(200).json({
      message: "Bookshelf retrieved successfully.",
      owner: {
        name: user.name,
        avatar: user.avatar,
        storeUrl: user.storeUrl || "",
        shelfPageName: user.shelfPageName || "",
        shelfPhotoUrl: user.shelfPhotoUrl || "",
        publicShareMetaTitle: user.publicShareMetaTitle || "",
        publicShareMetaDescription: user.publicShareMetaDescription || "",
        publicShareImageUrl: user.publicShareImageUrl || "",
        publicShareTheme: user.publicShareTheme || "",
      },
      bookshelfShare: {
        token: user.bookshelfShare.token,
        enabledAt: user.bookshelfShare.enabledAt,
      },
      count: books.length,
      books: books.map(serializePublicBook),
    });
  } catch (error) {
    console.error("Error getting public bookshelf:", error);

    return res.status(500).json({ error: "Internal Server Error!" });
  }
}

async function getPublicBookPreview(req, res) {
  try {
    const { shareToken } = req.params;
    const book = await Book.findOne({ "previewShare.token": shareToken }).populate({
      path: "userId",
      select:
        "name avatar storeUrl shelfPageName shelfPhotoUrl publicShareMetaTitle publicShareMetaDescription publicShareImageUrl publicShareTheme",
    });

    setPublicShareHeaders(res);

    if (!book) {
      return res.status(404).json({ error: "Preview link is not active." });
    }

    return res.status(200).json({
      message: "Book preview retrieved successfully.",
      book: serializePublicPreview(book),
    });
  } catch (error) {
    console.error("Error getting public book preview:", error);

    return res.status(500).json({ error: "Internal Server Error!" });
  }
}

async function getPublicBookPreviewPdf(req, res) {
  try {
    const { shareToken } = req.params;
    const book = await Book.findOne({ "previewShare.token": shareToken });

    setPublicShareHeaders(res);

    if (!book) {
      return res.status(404).json({ error: "Preview link is not active." });
    }

    if (await migrateBookImagesToStorage(book)) {
      book.markModified("coverImage");
      book.markModified("chapters");
      await book.save();
    }

    const chapter = firstPreviewChapter(book);
    const previewBook = {
      ...book.toObject(),
      chapters: chapter
        ? [chapter.toObject ? chapter.toObject() : chapter]
        : [],
    };
    const filename = `${book.title.replace(
      /[^a-zA-Z0-9]/g,
      "_"
    )}_first_chapter_preview.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    res.setHeader("Content-Transfer-Encoding", "binary");

    await generatePdf(previewBook, res);
  } catch (error) {
    console.error("Error getting public book preview PDF:", error);

    if (!res.headersSent) {
      res.status(500).json({ error: "Internal Server Error!" });
    }
  }
}

module.exports = {
  getPublicBookshelf,
  getPublicBookPreview,
  getPublicBookPreviewPdf,
};
