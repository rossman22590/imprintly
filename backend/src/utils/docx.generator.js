const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  ImageRun,
} = require("docx");
const MarkdownIt = require("markdown-it");
const fs = require("fs");
const {
  collectInlineImages,
  getChapterMarkdownForExport,
  inlineTextWithoutImages,
  normalizeMarkdownForExport,
  prepareExportImages,
  resolveExportImagePath,
} = require("./export-markdown");

const md = new MarkdownIt();

const DOCX_CONFIG = {
  fonts: {
    heading: "Calibri",
    body: "Calibri",
    code: "Courier New",
  },
  sizes: {
    title: 32,
    subtitle: 20,
    author: 18,
    chapterTitle: 24,
    h1: 20,
    h2: 18,
    h3: 16,
    body: 11,
    code: 10,
  },
  colors: {
    title: "1a202c",
    subtitle: "4a5568",
    author: "2d3748",
    chapterTitle: "1a202c",
    heading: "1a202c",
    body: "000000",
    code: "d63384",
    codeBlock: "0f172a",
    codeBg: "f8fafc",
    codeBorder: "cbd5e1",
    inlineCodeBg: "f1f5f9",
  },
  spacing: {
    paragraphBefore: 200,
    paragraphAfter: 200,
    chapterBefore: 400,
    chapterAfter: 300,
    headingBefore: 300,
    headingAfter: 150,
  },
};

function processInlineContent(content) {
  const textRuns = [];

  const patterns = [
    { regex: /`([^`]+)`/g, type: "code" }, // must be first
    { regex: /\*\*(.+?)\*\*/g, type: "bold" },
    { regex: /\*(.+?)\*/g, type: "italic" },
    { regex: /__(.+?)__/g, type: "bold" },
    { regex: /_(.+?)_/g, type: "italic" },
  ];

  const matches = [];
  patterns.forEach((pattern) => {
    let match;
    const regex = new RegExp(pattern.regex.source, "g");
    while ((match = regex.exec(content)) !== null) {
      matches.push({
        start: match.index,
        end: regex.lastIndex,
        text: match[1],
        type: pattern.type,
        fullMatch: match[0],
      });
    }
  });

  matches.sort((a, b) => a.start - b.start);

  let processedUntil = 0;
  matches.forEach((match) => {
    if (match.start > processedUntil) {
      const plainText = content.substring(processedUntil, match.start);
      if (plainText) {
        textRuns.push(
          new TextRun({
            text: plainText,
            font: DOCX_CONFIG.fonts.body,
            size: DOCX_CONFIG.sizes.body * 2,
          })
        );
      }
    }

    const runOptions = {
      text: match.text,
      size: DOCX_CONFIG.sizes.body * 2,
    };

    if (match.type === "bold") {
      runOptions.bold = true;
      runOptions.font = DOCX_CONFIG.fonts.body;
    } else if (match.type === "italic") {
      runOptions.italics = true;
      runOptions.font = DOCX_CONFIG.fonts.body;
    } else if (match.type === "code") {
      // inline code styling
      runOptions.font = DOCX_CONFIG.fonts.code;
      runOptions.size = DOCX_CONFIG.sizes.code * 2;
      runOptions.color = DOCX_CONFIG.colors.code;
      runOptions.shading = {
        fill: DOCX_CONFIG.colors.inlineCodeBg,
        type: "clear",
      };
    }

    textRuns.push(new TextRun(runOptions));
    processedUntil = match.end;
  });

  if (processedUntil < content.length) {
    const remainingText = content.substring(processedUntil);
    if (remainingText) {
      textRuns.push(
        new TextRun({
          text: remainingText,
          font: DOCX_CONFIG.fonts.body,
          size: DOCX_CONFIG.sizes.body * 2,
        })
      );
    }
  }

  return textRuns.length > 0
    ? textRuns
    : [
        new TextRun({
          text: content,
          font: DOCX_CONFIG.fonts.body,
          size: DOCX_CONFIG.sizes.body * 2,
        }),
      ];
}

function createImageParagraph(src, alt = "", options = {}) {
  const imagePath = resolveExportImagePath(src);

  if (!imagePath) {
    return alt
      ? new Paragraph({
          children: [
            new TextRun({
              text: `[Image unavailable: ${alt}]`,
              font: DOCX_CONFIG.fonts.body,
              size: 18,
              italics: true,
              color: "64748b",
            }),
          ],
          spacing: { before: 100, after: 200 },
        })
      : null;
  }

  try {
    return new Paragraph({
      children: [
        new ImageRun({
          data: fs.readFileSync(imagePath),
          transformation: {
            width: options.width || 500,
            height: options.height || 281,
          },
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 300 },
    });
  } catch (error) {
    console.error(`Could not embed DOCX image: ${imagePath}`, error);
    return null;
  }
}

function processMdContent(mdContent) {
  if (!mdContent || mdContent.trim() === "") {
    return [];
  }

  const tokens = md.parse(normalizeMarkdownForExport(mdContent), {});
  const paragraphs = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];

    try {
      // HANDLE HEADINGS
      if (token.type === "heading_open") {
        const level = parseInt(token.tag.slice(1), 10);
        const nextToken = tokens[i + 1];

        if (nextToken && nextToken.type === "inline") {
          let headingLevel, fontSize;

          switch (level) {
            case 1:
              headingLevel = HeadingLevel.HEADING_1;
              fontSize = DOCX_CONFIG.sizes.h1;
              break;
            case 2:
              headingLevel = HeadingLevel.HEADING_2;
              fontSize = DOCX_CONFIG.sizes.h2;
              break;
            case 3:
              headingLevel = HeadingLevel.HEADING_3;
              fontSize = DOCX_CONFIG.sizes.h3;
              break;
            default:
              headingLevel = HeadingLevel.HEADING_3;
              fontSize = DOCX_CONFIG.sizes.h3;
          }

          paragraphs.push(
            new Paragraph({
              text: nextToken.content,
              heading: headingLevel,
              spacing: {
                before: DOCX_CONFIG.spacing.headingBefore,
                after: DOCX_CONFIG.spacing.headingAfter,
              },
            })
          );

          i += 2;
          continue;
        }
      }

      // Handle code blocks
      if (token.type === "fence" || token.type === "code_block") {
        const codeLines = token.content
          .replace(/\n$/, "")
          .split("\n");
        const children = codeLines.map((line, index) => {
          const runOptions = {
            text: line || " ",
            font: DOCX_CONFIG.fonts.code,
            size: DOCX_CONFIG.sizes.code * 2,
            color: DOCX_CONFIG.colors.codeBlock,
          };

          if (index > 0) {
            runOptions.break = 1;
          }

          return new TextRun(runOptions);
        });

        paragraphs.push(
          new Paragraph({
            children,
            spacing: {
              before: 180,
              after: 240,
              line: 276,
            },
            shading: {
              fill: DOCX_CONFIG.colors.codeBg,
              type: "clear",
            },
            border: {
              top: {
                color: DOCX_CONFIG.colors.codeBorder,
                space: 6,
                style: "single",
                size: 4,
              },
              bottom: {
                color: DOCX_CONFIG.colors.codeBorder,
                space: 6,
                style: "single",
                size: 4,
              },
              left: {
                color: DOCX_CONFIG.colors.codeBorder,
                space: 6,
                style: "single",
                size: 4,
              },
              right: {
                color: DOCX_CONFIG.colors.codeBorder,
                space: 6,
                style: "single",
                size: 4,
              },
            },
            indent: {
              left: 240,
              right: 240,
            },
          })
        );

        i++;
        continue;
      }

      // HANDLE PARAGRAPHS
      if (token.type === "paragraph_open") {
        const nextToken = tokens[i + 1];

        if (nextToken && nextToken.type === "inline") {
          const images = collectInlineImages(nextToken);
          const textContent = images.length
            ? inlineTextWithoutImages(nextToken).trim()
            : nextToken.content;

          images.forEach((image) => {
            const imageParagraph = createImageParagraph(image.src, image.alt);

            if (imageParagraph) {
              paragraphs.push(imageParagraph);
            }
          });

          const textRuns = textContent
            ? processInlineContent(textContent)
            : [];

          if (textRuns.length > 0) {
            paragraphs.push(
              new Paragraph({
                children: textRuns,
                spacing: {
                  before: DOCX_CONFIG.spacing.paragraphBefore,
                  after: DOCX_CONFIG.spacing.paragraphAfter,
                  line: 360,
                },
                alignment: AlignmentType.LEFT,
              })
            );
          }

          i += 2;
          continue;
        }
      }

      // HANDLE BULLET LISTS
      if (token.type === "bullet_list_open") {
        i++;

        while (i < tokens.length && tokens[i].type !== "bullet_list_close") {
          if (tokens[i].type === "list_item_open") {
            i++;

            if (tokens[i] && tokens[i].type === "paragraph_open") {
              i++;

              if (tokens[i] && tokens[i].type === "inline") {
                const textRuns = processInlineContent(tokens[i].content);

                paragraphs.push(
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "- ",
                        bold: true,
                        font: DOCX_CONFIG.fonts.body,
                        size: DOCX_CONFIG.sizes.body * 2,
                      }),
                      ...textRuns,
                    ],
                    spacing: { before: 100, after: 100 },
                    indent: { left: 360 },
                  })
                );
              }
            }
          }
          i++;
        }

        paragraphs.push(new Paragraph({ text: "", spacing: { after: 200 } }));
        i++;
        continue;
      }

      // HANDLE ORDERED LISTS
      if (token.type === "ordered_list_open") {
        let listCounter = 1;
        i++;

        while (i < tokens.length && tokens[i].type !== "ordered_list_close") {
          if (tokens[i].type === "list_item_open") {
            i++;

            if (tokens[i] && tokens[i].type === "paragraph_open") {
              i++;

              if (tokens[i] && tokens[i].type === "inline") {
                const textRuns = processInlineContent(tokens[i].content);

                paragraphs.push(
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `${listCounter}. `,
                        bold: true,
                        font: DOCX_CONFIG.fonts.body,
                        size: DOCX_CONFIG.sizes.body * 2,
                      }),
                      ...textRuns,
                    ],
                    spacing: { before: 100, after: 100 },
                    indent: { left: 360 },
                  })
                );

                listCounter++;
              }
            }
          }
          i++;
        }

        paragraphs.push(new Paragraph({ text: "", spacing: { after: 200 } }));
        i++;
        continue;
      }

      i++;
    } catch (error) {
      console.error("Error processing token:", token, error);
      i++;
    }
  }

  return paragraphs;
}

// GENERATE COMPLETE DOCX FILE
async function generateDocx(book) {
  await prepareExportImages(book);

  const sections = [];

  // COVER PAGE
  if (book.coverImage && !book.coverImage.includes("pravatar")) {
    const imagePath = resolveExportImagePath(book.coverImage);

    try {
      if (imagePath) {
        const imageBuffer = fs.readFileSync(imagePath);

        sections.push(new Paragraph({ text: "", spacing: { before: 1000 } }));

        sections.push(
          new Paragraph({
            children: [
              new ImageRun({
                data: imageBuffer,
                transformation: {
                  width: 400,
                  height: 550,
                },
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 400 },
          })
        );

        sections.push(
          new Paragraph({
            text: "",
            pageBreakBefore: true,
          })
        );
      } else {
        console.warn(`DOCX cover image not found: ${book.coverImage}`);
      }
    } catch (imgErr) {
      console.error(`Could not embed cover image: ${book.coverImage}`, imgErr);
    }
  }

  // TITLE PAGE
  sections.push(
    new Paragraph({
      children: [
        new TextRun({
          text: book.title,
          color: DOCX_CONFIG.colors.title,
          font: DOCX_CONFIG.fonts.heading,
          size: DOCX_CONFIG.sizes.title * 2,
          bold: true,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 2000, after: 400 },
    })
  );

  if (book.subtitle && book.subtitle.trim()) {
    sections.push(
      new Paragraph({
        children: [
          new TextRun({
            text: book.subtitle,
            color: DOCX_CONFIG.colors.subtitle,
            font: DOCX_CONFIG.fonts.heading,
            size: DOCX_CONFIG.sizes.subtitle * 2,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      })
    );
  }

  sections.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `by ${book.author}`,
          color: DOCX_CONFIG.colors.author,
          font: DOCX_CONFIG.fonts.heading,
          size: DOCX_CONFIG.sizes.author * 2,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    })
  );

  sections.push(
    new Paragraph({
      text: "",
      border: {
        bottom: {
          color: "4f46e5",
          space: 1,
          style: "single",
          size: 12,
        },
      },
      alignment: AlignmentType.CENTER,
      spacing: { before: 400 },
    })
  );

  // PROCESS CHAPTERS
  book.chapters.forEach((chapter, index) => {
    try {
      if (index > 0) {
        sections.push(
          new Paragraph({
            text: "",
            pageBreakBefore: true,
          })
        );
      }

      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: chapter.title,
              color: DOCX_CONFIG.colors.chapterTitle,
              font: DOCX_CONFIG.fonts.heading,
              size: DOCX_CONFIG.sizes.chapterTitle * 2,
              bold: true,
            }),
          ],
          spacing: {
            before: DOCX_CONFIG.spacing.chapterBefore,
            after: DOCX_CONFIG.spacing.chapterAfter,
          },
        })
      );

      const contentParagraphs = processMdContent(
        getChapterMarkdownForExport(chapter)
      );
      sections.push(...contentParagraphs);
    } catch (chapterErr) {
      console.error(`Error processing chapter ${index + 1}:`, chapterErr);
    }
  });

  // CREATE DOCUMENT
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children: sections,
      },
    ],
  });

  // return buffer properly for binary download
  return await Packer.toBuffer(doc);
}

module.exports = { generateDocx };
