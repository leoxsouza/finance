import { describe, expect, it } from "vitest";

import { clampPage, getPageCount, getPaginationMeta } from "./pagination";

describe("getPageCount", () => {
  it("returns 0 when total is 0", () => {
    expect(getPageCount(0, 10)).toBe(0);
  });

  it("ceil divides total by page size", () => {
    expect(getPageCount(101, 25)).toBe(5);
  });

  it("guards against invalid pageSize", () => {
    expect(getPageCount(50, 0)).toBe(50);
  });
});

describe("clampPage", () => {
  it("clamps values below 1", () => {
    expect(clampPage(0, 5)).toBe(1);
  });

  it("clamps values above pageCount", () => {
    expect(clampPage(10, 3)).toBe(3);
  });

  it("returns 1 when pageCount is 0", () => {
    expect(clampPage(2, 0)).toBe(1);
  });
});

describe("getPaginationMeta", () => {
  it("computes metadata for populated state", () => {
    const meta = getPaginationMeta({ page: 2, pageSize: 25, total: 60 });

    expect(meta.page).toBe(2);
    expect(meta.pageCount).toBe(3);
    expect(meta.startIndex).toBe(26);
    expect(meta.endIndex).toBe(50);
    expect(meta.hasPreviousPage).toBe(true);
    expect(meta.hasNextPage).toBe(true);
  });

  it("normalizes empty states", () => {
    const meta = getPaginationMeta({ page: 10, pageSize: 25, total: 0 });

    expect(meta.page).toBe(1);
    expect(meta.pageCount).toBe(0);
    expect(meta.startIndex).toBe(0);
    expect(meta.endIndex).toBe(0);
    expect(meta.hasNextPage).toBe(false);
    expect(meta.hasPreviousPage).toBe(false);
  });
});
