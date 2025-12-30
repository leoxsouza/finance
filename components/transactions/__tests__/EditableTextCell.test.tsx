import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { EditableTextCell } from "../EditableTextCell";

describe("EditableTextCell", () => {
  const mockOnSave = vi.fn();

  beforeEach(() => {
    mockOnSave.mockClear();
  });

  it("displays the initial value", () => {
    render(<EditableTextCell value="test value" onSave={mockOnSave} />);
    
    expect(screen.getByText("test value")).toBeInTheDocument();
  });

  it("shows placeholder when value is empty", () => {
    render(<EditableTextCell value="" onSave={mockOnSave} placeholder="Click to edit" />);
    
    expect(screen.getByText("Click to edit")).toBeInTheDocument();
  });

  it("enters edit mode when clicked", async () => {
    const user = userEvent.setup();
    render(<EditableTextCell value="test" onSave={mockOnSave} />);
    
    await user.click(screen.getByText("test"));
    
    expect(screen.getByDisplayValue("test")).toBeInTheDocument();
  });

  it("saves value on blur", async () => {
    const user = userEvent.setup();
    render(<EditableTextCell value="initial" onSave={mockOnSave} />);
    
    await user.click(screen.getByText("initial"));
    const input = screen.getByDisplayValue("initial");
    
    await user.clear(input);
    await user.type(input, "updated");
    
    fireEvent.blur(input);
    
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith("updated");
    });
  });

  it("saves value on Enter key", async () => {
    const user = userEvent.setup();
    render(<EditableTextCell value="initial" onSave={mockOnSave} />);
    
    await user.click(screen.getByText("initial"));
    const input = screen.getByDisplayValue("initial");
    
    await user.clear(input);
    await user.type(input, "updated");
    fireEvent.keyDown(input, { key: "Enter" });
    
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith("updated");
    });
  });

  it("cancels edit on Escape key", async () => {
    const user = userEvent.setup();
    render(<EditableTextCell value="initial" onSave={mockOnSave} />);
    
    await user.click(screen.getByText("initial"));
    const input = screen.getByDisplayValue("initial");
    
    await user.clear(input);
    await user.type(input, "updated");
    fireEvent.keyDown(input, { key: "Escape" });
    
    expect(mockOnSave).not.toHaveBeenCalled();
    expect(screen.getByText("initial")).toBeInTheDocument();
  });

  it("does not save if value hasn't changed", async () => {
    const user = userEvent.setup();
    render(<EditableTextCell value="test" onSave={mockOnSave} />);
    
    await user.click(screen.getByText("test"));
    const input = screen.getByDisplayValue("test");
    
    fireEvent.blur(input);
    
    await waitFor(() => {
      expect(mockOnSave).not.toHaveBeenCalled();
    });
  });

  it("validates input before saving", async () => {
    const user = userEvent.setup();
    const validate = vi.fn().mockReturnValue("Invalid value");
    render(<EditableTextCell value="test" onSave={mockOnSave} validate={validate} />);
    
    await user.click(screen.getByText("test"));
    const input = screen.getByDisplayValue("test");
    
    fireEvent.blur(input);
    
    await waitFor(() => {
      expect(validate).toHaveBeenCalledWith("test");
      expect(mockOnSave).not.toHaveBeenCalled();
    });
    
    expect(screen.getByText("Invalid value")).toBeInTheDocument();
  });

  it("shows loading state while saving", async () => {
    const user = userEvent.setup();
    mockOnSave.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    
    render(<EditableTextCell value="test" onSave={mockOnSave} />);
    
    await user.click(screen.getByText("test"));
    const input = screen.getByDisplayValue("test");
    
    fireEvent.blur(input);
    
    expect(screen.getByDisplayValue("test")).toBeDisabled();
    expect(screen.getByDisplayValue("test")).toHaveClass("opacity-50");
  });

  it("handles save errors", async () => {
    const user = userEvent.setup();
    mockOnSave.mockRejectedValue(new Error("Save failed"));
    
    render(<EditableTextCell value="test" onSave={mockOnSave} />);
    
    await user.click(screen.getByText("test"));
    const input = screen.getByDisplayValue("test");
    
    await user.clear(input);
    await user.type(input, "updated");
    fireEvent.blur(input);
    
    await waitFor(() => {
      expect(screen.getByText("Save failed")).toBeInTheDocument();
    });
    
    expect(screen.getByDisplayValue("updated")).toBeInTheDocument();
  });

  it("is disabled when disabled prop is true", () => {
    render(<EditableTextCell value="test" onSave={mockOnSave} disabled />);
    
    const cell = screen.getByText("test").parentElement;
    expect(cell).toHaveClass("cursor-not-allowed");
  });

  it("formats display value when formatDisplay is provided", () => {
    const formatDisplay = (value: string) => value.toUpperCase();
    render(<EditableTextCell value="test" onSave={mockOnSave} formatDisplay={formatDisplay} />);
    
    expect(screen.getByText("TEST")).toBeInTheDocument();
  });
});
