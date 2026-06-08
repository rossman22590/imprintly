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
  
  book.chapters?.forEach((ch, idx) => {
    console.log(`\n--- Chapter ${idx + 1}: ${ch.title} ---`);
    console.log("Raw Content:\n", ch.content);
    
    const { narrationTextFromMarkdown } = require("./src/utils/elevenlabs.generator");
    const cleanText = narrationTextFromMarkdown(ch.content);
    console.log("Clean Narration Text (Length: " + cleanText.length + "):\n", JSON.stringify(cleanText));
  });

  await mongoose.disconnect();
}

test();
