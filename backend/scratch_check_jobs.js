const mongoose = require("mongoose");
const ENV = require("./src/configs/env");

async function test() {
  await mongoose.connect(ENV.DB_URI);
  console.log("Connected to MongoDB");

  const GenerationJob = require("./src/models/GenerationJob");
  const Book = require("./src/models/Book");
  
  const jobs = await GenerationJob.find({ provider: "elevenlabs" }).sort({ createdAt: -1 });
  console.log(`Found ${jobs.length} audiobook jobs:`);
  jobs.forEach((j) => {
    console.log(`Job ID: ${j.id}, Status: ${j.status}, BookID: ${j.bookId}, Error: ${j.error}, Progress:`, j.progress);
  });

  const books = await Book.find();
  console.log(`\nFound ${books.length} books in total.`);
  for (const b of books) {
    if (b.audiobook) {
      console.log(`Book "${b.title}" (${b._id}): status: ${b.audiobook.status}, jobId: ${b.audiobook.jobId}`);
    }
  }

  await mongoose.disconnect();
}

test();
