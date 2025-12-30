"use client";

import { cn } from "@/lib/utils";
import Input from "@/components/ui/input";
import { useEditableCell } from "@/hooks/useEditableCell";

type EditableTextCellProps = {
  value: string;
  onSave: (value: string) => Promise<void> | void;
  type?: "text" | "date" | "number";
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  displayClassName?: string;
  validate?: (value: string) => string | null;
  formatDisplay?: (value: string) => string;
};

export function EditableTextCell({
  value,
  onSave,
  type = "text",
  placeholder,
  disabled = false,
  className,
  displayClassName,
  validate,
  formatDisplay,
}: EditableTextCellProps) {
  const {
    isEditing,
    currentValue,
    isSaving,
    error,
    inputRef,
    startEditing,
    handleKeyDown,
    handleBlur,
    handleChange,
  } = useEditableCell({
    initialValue: value,
    onSave,
    validate,
    disabled,
  });

  const displayValue = formatDisplay ? formatDisplay(value) : value;

  if (isEditing) {
    return (
      <div className={cn("relative", className)}>
        <Input
          ref={inputRef}
          type={type}
          value={currentValue}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={isSaving}
          className={cn(
            error && "border-rose-500 focus-visible:ring-rose-500",
            isSaving && "opacity-50"
          )}
        />
        {error && (
          <div className="absolute -bottom-5 left-0 text-xs text-rose-600 whitespace-nowrap">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={startEditing}
      className={cn(
        "cursor-pointer hover:bg-slate-50 rounded px-1 py-0.5 -mx-1 -my-0.5 transition-colors",
        disabled && "cursor-not-allowed hover:bg-transparent",
        displayClassName
      )}
      tabIndex={disabled ? -1 : 0}
      role="button"
      aria-label={`Edit ${type} field`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          startEditing();
        }
      }}
    >
      <span className={cn(!displayValue && "text-slate-400")}>
        {displayValue || placeholder || "Click to edit"}
      </span>
    </div>
  );
}
