function buildEbookCoverPrompt({ book, customPrompt = "" }) {
  const coverDirection = customPrompt
    ? `Creative direction from the author: ${customPrompt}`
    : "Creative direction: premium contemporary publishing cover, memorable first-glance composition, polished commercial finish.";

  return `Create a professional ebook front cover image.

Book title: ${book.title}
Subtitle: ${book.subtitle || "None"}
Author: ${book.author}
Genre: ${book.genre || "Nonfiction"}
Audience: ${book.audience || "General readers"}
${coverDirection}

Requirements:
1. Front cover only, not a 3D mockup, not a spread, and no spine.
2. Include the exact title text: "${book.title}".
3. Include the exact author name: "${book.author}".
4. Use readable, intentional typography with strong hierarchy and safe margins.
5. Match the genre and audience while avoiding generic stock-photo styling.`;
}

module.exports = {
  buildEbookCoverPrompt,
};
