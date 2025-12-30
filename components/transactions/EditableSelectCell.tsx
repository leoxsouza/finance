"use client";

import { cn } from "@/lib/utils";
import Select from "@/components/ui/select";
import { useEditableCell } from "@/hooks/useEditableCell";

type Option = {
  label: string;
  value: string | number;
};

type EditableSelectCellProps = {
  value: string | number;
  options: Option[];
  onSave: (value: string | number) => Promise<void> | void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  displayClassName?: string;
  formatDisplay?: (value: string | number) => string;
};

export function EditableSelectCell({
  value,
  options,
  onSave,
  placeholder,
  disabled = false,
  className,
  displayClassName,
  formatDisplay,
}: EditableSelectCellProps) {
  const {
    isEditing,
    currentValue,
    isSaving,
    error,
    selectRef,
    startEditing,
    cancelEditing,
    saveValue,
    handleKeyDown,
    handleBlur,
    handleChange,
  } = useEditableCell({
    initialValue: value,
    onSave,
    disabled,
  });

  const getDisplayValue = (val: string | number) => {
    const option = options.find(opt => opt.value === val);
    return option ? option.label : String(val);
  };

  const displayValue = formatDisplay ? formatDisplay(value) : getDisplayValue(value);

  if (isEditing) {
    return (
      <div className={cn("relative", className)}>
        <Select
          ref={selectRef}
          value={currentValue}
          options={options}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
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
      aria-label={`Edit select field`}
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
