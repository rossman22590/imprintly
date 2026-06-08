const fs = require("fs");
const mongoose = require("mongoose");
const ENV = require("./src/configs/env");
const { createZipAlbum, downloadUrlBuffer, fetchTrackBuffers } = require("./src/utils/audiobook.album");
const NodeID3 = require("node-id3");

async function test() {
  await mongoose.connect(ENV.DB_URI);
  console.log("Connected to MongoDB");

  const Book = require("./src/models/Book");
  const book = await Book.findOne({ title: /Pip and the Cloud/i });
  if (!book) {
    console.error("Book not found!");
    await mongoose.disconnect();
    return;
  }

  const tracks = [];
  if (book.audiobook?.intro?.audioUrl) {
    tracks.push({
      title: "Introduction",
      url: book.audiobook.intro.audioUrl,
      trackIndex: 0,
    });
  }

  book.audiobook?.chapters?.forEach((ch) => {
    if (ch.audioUrl) {
      tracks.push({
        title: ch.title || `Chapter ${ch.chapterIndex + 1}`,
        url: ch.audioUrl,
        trackIndex: ch.chapterIndex + 1,
      });
    }
  });

  console.log("Tracks to download:", tracks.length);
  const tracksWithBuffers = await fetchTrackBuffers(tracks);
  const coverRes = book.coverImage ? await downloadUrlBuffer(book.coverImage) : null;

  console.log("Creating ZIP album...");
  const zipBuffer = await createZipAlbum(book, tracksWithBuffers, coverRes);
  fs.writeFileSync("scratch_test_album.zip", zipBuffer);
  console.log("Saved scratch_test_album.zip");

  // Let's unzip the first file and read its tags directly using NodeID3
  const JSZip = require("jszip");
  const zip = await JSZip.loadAsync(zipBuffer);
  const fileNames = Object.keys(zip.files);
  console.log("Files in ZIP:", fileNames);

  if (fileNames.length > 0) {
    const fileBuffer = await zip.files[fileNames[0]].async("nodebuffer");
    const readTags = NodeID3.read(fileBuffer);
    console.log("Read tags from unzipped file:", {
      title: readTags.title,
      artist: readTags.artist,
      album: readTags.album,
      trackNumber: readTags.trackNumber,
      hasImage: !!readTags.image,
    });
  }

  await mongoose.disconnect();
}

test();
