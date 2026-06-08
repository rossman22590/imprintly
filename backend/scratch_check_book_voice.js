const mongoose = require("mongoose");
const ENV = require("./src/configs/env");

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

  console.log("Book Title:", book.title);
  console.log("Audiobook subdocument:", JSON.stringify(book.audiobook, null, 2));

  await mongoose.disconnect();
}

test();
