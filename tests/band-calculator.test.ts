import { describe, expect, it } from "vitest";
import {
  calculateCriterionBand,
  calculateOverallBand,
  calculateWritingFromTasks,
  convertRawToBand,
  roundIeltsBand,
} from "@/lib/band-calculator";
import { DEFAULT_BAND_CONVERSIONS } from "@/lib/seed-data";

describe("IELTS Band Calculator — Official Rounding Rules", () => {
  it("rounds .25 UP to .5 (6.25 -> 6.5)", () => {
    expect(roundIeltsBand(6.25)).toBe(6.5);
    expect(roundIeltsBand(7.25)).toBe(7.5);
    expect(roundIeltsBand(5.25)).toBe(5.5);
  });

  it("rounds .75 UP to the next whole band (6.75 -> 7.0)", () => {
    expect(roundIeltsBand(6.75)).toBe(7.0);
    expect(roundIeltsBand(7.75)).toBe(8.0);
    expect(roundIeltsBand(8.75)).toBe(9.0);
  });

  it("rounds .125 DOWN to .0 and .625 DOWN to .5", () => {
    expect(roundIeltsBand(6.125)).toBe(6.0);
    expect(roundIeltsBand(6.625)).toBe(6.5);
    expect(roundIeltsBand(7.125)).toBe(7.0);
    expect(roundIeltsBand(7.625)).toBe(7.5);
  });

  it("rounds .375 UP to .5 and .875 UP to next whole", () => {
    expect(roundIeltsBand(6.375)).toBe(6.5);
    expect(roundIeltsBand(6.875)).toBe(7.0);
  });

  it("calculates Overall IELTS Band correctly across real 4-skill combinations", () => {
    // (6.5 + 6.5 + 6.0 + 6.0) / 4 = 6.25 -> 6.5
    expect(
      calculateOverallBand({ listening: 6.5, reading: 6.5, writing: 6.0, speaking: 6.0 })
    ).toEqual({ average: 6.25, overall: 6.5 });

    // (7.5 + 7.5 + 6.0 + 6.0) / 4 = 6.75 -> 7.0
    expect(
      calculateOverallBand({ listening: 7.5, reading: 7.5, writing: 6.0, speaking: 6.0 })
    ).toEqual({ average: 6.75, overall: 7.0 });

    // (6.5 + 6.0 + 6.0 + 6.0) / 4 = 6.125 -> 6.0
    expect(
      calculateOverallBand({ listening: 6.5, reading: 6.0, writing: 6.0, speaking: 6.0 })
    ).toEqual({ average: 6.125, overall: 6.0 });
  });

  it("converts Listening, Academic Reading, and General Reading raw scores accurately", () => {
    expect(convertRawToBand(40, "listening", DEFAULT_BAND_CONVERSIONS)).toBe(9.0);
    expect(convertRawToBand(30, "listening", DEFAULT_BAND_CONVERSIONS)).toBe(7.0);
    expect(convertRawToBand(23, "listening", DEFAULT_BAND_CONVERSIONS)).toBe(6.0);

    // Academic vs General Reading at 30/40: Academic = 7.0, General = 6.0
    expect(convertRawToBand(30, "reading_academic", DEFAULT_BAND_CONVERSIONS)).toBe(7.0);
    expect(convertRawToBand(30, "reading_general", DEFAULT_BAND_CONVERSIONS)).toBe(6.0);
    expect(convertRawToBand(40, "reading_general", DEFAULT_BAND_CONVERSIONS)).toBe(9.0);
    expect(convertRawToBand(39, "reading_general", DEFAULT_BAND_CONVERSIONS)).toBe(8.5);
  });

  it("applies Writing 1/3 Task 1 + 2/3 Task 2 weighting and 4-criterion Speaking average", () => {
    // (6.0 + 2*7.0) / 3 = 6.667 -> 6.5
    expect(calculateWritingFromTasks(6.0, 7.0).band).toBe(6.5);
    // (7.0 + 2*7.5) / 3 = 7.333 -> 7.5
    expect(calculateWritingFromTasks(7.0, 7.5).band).toBe(7.5);
    // Speaking criteria (7.0, 6.5, 6.5, 7.0) -> avg 6.75 -> 7.0
    expect(calculateCriterionBand(7.0, 6.5, 6.5, 7.0).band).toBe(7.0);
  });
});
