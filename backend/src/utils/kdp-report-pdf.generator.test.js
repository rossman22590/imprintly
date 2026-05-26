const test = require("node:test");
const assert = require("node:assert/strict");
const {
  __private,
  generateKdpReportPdf,
} = require("./kdp-report-pdf.generator");

test("extracts only KDP risk notes for the special report", () => {
  const riskNotes = __private.getRiskNotes({
    kdp: {
      assets: {
        description: "This should not be in the risk notes PDF.",
        tableOfContents: "1. Also not included.",
        riskNotes: "**Risk:** add copyright attribution.",
      },
    },
  });

  assert.equal(riskNotes, "**Risk:** add copyright attribution.");
  assert.equal(
    __private.markdownToPlainText(riskNotes),
    "Risk: add copyright attribution."
  );
});

function countPdfPages(buffer) {
  return (buffer.toString("latin1").match(/\/Type\s*\/Page\b/g) || []).length;
}

test("generates a markdown-rendered AI risk notes PDF buffer", async () => {
  const buffer = await generateKdpReportPdf({
    title: "Publishing Report",
    author: "Bookify",
    kdp: {
      assets: {
        description: "Description should not be exported here.",
        riskNotes:
          "## Risk Review\n\n- **Risk:** Missing copyright page.\n- **Action:** Add a copyright page before KDP upload.\n\n`KDP` check complete.",
      },
    },
  });

  assert.ok(buffer.length > 1000);
  assert.equal(buffer.subarray(0, 4).toString(), "%PDF");
  assert.equal(countPdfPages(buffer), 1);
});
