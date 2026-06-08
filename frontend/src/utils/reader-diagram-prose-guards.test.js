import test from "node:test";
import assert from "node:assert/strict";
import {
  isProseCalloutBlock,
  isRecipeOrMeasurementLine,
} from "./reader-diagram-prose-guards.js";

test("isRecipeOrMeasurementLine detects ingredient lines", () => {
  assert.equal(isRecipeOrMeasurementLine("1 cup of moonlit sugar"), true);
  assert.equal(isRecipeOrMeasurementLine("2 teaspoons of starlight flour"), true);
  assert.equal(isRecipeOrMeasurementLine("Open the hidden door"), false);
});

test("isProseCalloutBlock detects recipe blocks", () => {
  assert.equal(
    isProseCalloutBlock([
      "**Moonlit Recipe**",
      "1 cup of moonlit sugar",
      "2 teaspoons of starlight flour",
    ]),
    true
  );
  assert.equal(
    isProseCalloutBlock(["Title: Onboarding", "Create account", "Verify email"]),
    false
  );
});
