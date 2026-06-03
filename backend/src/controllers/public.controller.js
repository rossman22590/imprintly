const Book = require("../models/Book");
const User = require("../models/User");
const { generatePdf } = require("../utils/pdf.generator");
const { migrateBookImagesToStorage } = require("../utils/image-asset-migration");

function setPublicShareHeaders(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
}

function activeOwnerQuery(query = {}) {
  return {
    ...query,
    $or: [{ status: "active" }, { status: { $exists: false } }],
  };
}

function isBannedOwner(user) {
  return user?.status === "banned";
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

function serializeCommunityBook(book) {
  const owner = book?.userId && typeof book.userId === "object" ? book.userId : {};
  const previewToken = book?.previewShare?.token || "";
  const shelfToken = owner?.bookshelfShare?.token || "";
  const kdpAssets = book?.kdp?.assets || {};
  const purchaseUrl =
    book?.communityListing?.purchaseUrl || owner.storeUrl || "";

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
      shelfPageName: owner.shelfPageName || "",
      shelfPhotoUrl: owner.shelfPhotoUrl || "",
      bookshelfShare: shelfToken
        ? {
            token: shelfToken,
            enabledAt: owner.bookshelfShare.enabledAt,
          }
        : null,
    },
    sales: {
      description: kdpAssets.description || kdpAssets.backCoverBlurb || "",
    },
    previewShare: previewToken
      ? {
          token: previewToken,
          enabledAt: book.previewShare.enabledAt,
        }
      : null,
    communityListing: {
      listedAt: book.communityListing?.listedAt || null,
      purchaseUrl,
      freeFullPdfEnabled: Boolean(book.communityListing?.freeFullPdfEnabled),
      freeFullPdfEnabledAt: book.communityListing?.freeFullPdfEnabledAt || null,
    },
  };
}

function serializeCommunityBookDetails(book) {
  const communityBook = serializeCommunityBook(book);

  return {
    ...communityBook,
    fullPdf: {
      enabled: Boolean(book.communityListing?.freeFullPdfEnabled),
      url: Boolean(book.communityListing?.freeFullPdfEnabled)
        ? `/api/public/community-bookshelf/${book._id}/pdf`
        : "",
    },
  };
}

async function getPublicBookshelf(req, res) {
  try {
    const { shareToken } = req.params;
    const user = await User.findOne(
      activeOwnerQuery({ "bookshelfShare.token": shareToken })
    );

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

async function getCommunityBookshelf(req, res) {
  try {
    setPublicShareHeaders(res);

    const books = await Book.find({ "communityListing.isListed": true })
      .sort({
        "communityListing.listedAt": -1,
        updatedAt: -1,
        createdAt: -1,
      })
      .limit(96)
      .select(
        "title subtitle author coverImage genre audience language chapters._id previewShare communityListing kdp.assets.description kdp.assets.backCoverBlurb createdAt updatedAt userId"
      )
      .populate({
        path: "userId",
        select:
          "name avatar storeUrl shelfPageName shelfPhotoUrl bookshelfShare status",
        match: activeOwnerQuery(),
      })
      .lean();

    const visibleBooks = books.filter(
      (book) => book.userId && !isBannedOwner(book.userId)
    );

    return res.status(200).json({
      message: "Community bookshelf retrieved successfully.",
      count: visibleBooks.length,
      books: visibleBooks.map(serializeCommunityBook),
    });
  } catch (error) {
    console.error("Error getting community bookshelf:", error);

    return res.status(500).json({ error: "Internal Server Error!" });
  }
}

async function getCommunityBook(req, res) {
  try {
    const { bookId } = req.params;

    setPublicShareHeaders(res);

    const book = await Book.findOne({
      _id: bookId,
      "communityListing.isListed": true,
    })
      .select(
        "title subtitle author coverImage genre audience language chapters._id previewShare communityListing kdp.assets.description kdp.assets.backCoverBlurb createdAt updatedAt userId"
      )
      .populate({
        path: "userId",
        select:
          "name avatar storeUrl shelfPageName shelfPhotoUrl bookshelfShare status",
        match: activeOwnerQuery(),
      })
      .lean();

    if (!book || !book.userId || isBannedOwner(book.userId)) {
      return res.status(404).json({ error: "Community book is not active." });
    }

    return res.status(200).json({
      message: "Community book retrieved successfully.",
      book: serializeCommunityBookDetails(book),
    });
  } catch (error) {
    console.error("Error getting community book:", error);

    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid book ID format!" });
    }

    return res.status(500).json({ error: "Internal Server Error!" });
  }
}

async function getCommunityBookPdf(req, res) {
  try {
    const { bookId } = req.params;
    const book = await Book.findOne({
      _id: bookId,
      "communityListing.isListed": true,
      "communityListing.freeFullPdfEnabled": true,
    });

    setPublicShareHeaders(res);

    if (!book) {
      return res.status(404).json({ error: "Free PDF is not active." });
    }

    const owner = await User.findOne(activeOwnerQuery({ _id: book.userId }))
      .select("status")
      .lean();

    if (!owner || isBannedOwner(owner)) {
      return res.status(404).json({ error: "Free PDF is not active." });
    }

    if (await migrateBookImagesToStorage(book)) {
      book.markModified("coverImage");
      book.markModified("chapters");
      await book.save();
    }

    const filename = `${book.title.replace(
      /[^a-zA-Z0-9]/g,
      "_"
    )}_free_full_book.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    res.setHeader("Content-Transfer-Encoding", "binary");

    await generatePdf(book, res);
  } catch (error) {
    console.error("Error getting community book PDF:", error);

    if (!res.headersSent) {
      if (error.name === "CastError") {
        return res.status(400).json({ error: "Invalid book ID format!" });
      }

      res.status(500).json({ error: "Internal Server Error!" });
    }
  }
}

async function getPublicBookPreview(req, res) {
  try {
    const { shareToken } = req.params;
    const book = await Book.findOne({ "previewShare.token": shareToken }).populate({
      path: "userId",
      select:
        "name avatar storeUrl shelfPageName shelfPhotoUrl publicShareMetaTitle publicShareMetaDescription publicShareImageUrl publicShareTheme status",
    });

    setPublicShareHeaders(res);

    if (!book || isBannedOwner(book.userId)) {
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

    const owner = await User.findById(book.userId).select("status");

    if (isBannedOwner(owner)) {
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
  getCommunityBookshelf,
  getCommunityBook,
  getCommunityBookPdf,
  getPublicBookshelf,
  getPublicBookPreview,
  getPublicBookPreviewPdf,
};
