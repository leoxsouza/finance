import "@testing-library/jest-dom/vitest";
import React from "react";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PaginationControls } from "./PaginationControls";

const baseProps = {
  page: 1,
  pageCount: 3,
  pageSize: 10,
  totalItems: 30,
  start: 1,
  end: 10,
  onPageChange: vi.fn(),
  onPageSizeChange: vi.fn(),
};

describe("PaginationControls", () => {
  it("renders summary text", () => {
    render(<PaginationControls {...baseProps} />);

    expect(screen.getByText(/showing/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/rows per page/i)).toBeInTheDocument();
  });

  it("invokes callbacks when navigating", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<PaginationControls {...baseProps} onPageChange={onPageChange} />);

    await user.click(screen.getByLabelText(/next page/i));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("changes page size", async () => {
    const user = userEvent.setup();
    const onPageSizeChange = vi.fn();
    render(<PaginationControls {...baseProps} onPageSizeChange={onPageSizeChange} />);

    await user.selectOptions(screen.getByLabelText(/rows per page/i), "25");
    expect(onPageSizeChange).toHaveBeenCalledWith(25);
  });
});
