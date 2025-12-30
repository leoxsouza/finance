import { useState, useRef, useCallback, useEffect } from "react";

type EditableCellOptions<T = string> = {
  initialValue: T;
  onSave: (value: T) => Promise<void> | void;
  onCancel?: () => void;
  validate?: (value: T) => string | null;
  disabled?: boolean;
};

export function useEditableCell<T = string>({
  initialValue,
  onSave,
  onCancel,
  validate,
  disabled = false,
}: EditableCellOptions<T>) {
  const [isEditing, setIsEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState<T>(initialValue);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  // Reset current value when initial value changes (e.g., from external update)
  useEffect(() => {
    if (!isEditing) {
      setCurrentValue(initialValue);
    }
  }, [initialValue, isEditing]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing) {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      } else if (selectRef.current) {
        selectRef.current.focus();
      }
    }
  }, [isEditing]);

  const startEditing = useCallback(() => {
    if (disabled) return;
    setIsEditing(true);
    setError(null);
  }, [disabled]);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setCurrentValue(initialValue);
    setError(null);
    onCancel?.();
  }, [initialValue, onCancel]);

  const saveValue = useCallback(async () => {
    // Validate if validator provided
    if (validate) {
      const validationError = validate(currentValue);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    // Don't save if value hasn't changed
    if (currentValue === initialValue) {
      cancelEditing();
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(currentValue);
      setIsEditing(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save";
      setError(message);
    } finally {
      setIsSaving(false);
    }
  }, [currentValue, initialValue, onSave, validate, cancelEditing]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Enter") {
        event.preventDefault();
        saveValue();
      } else if (event.key === "Escape") {
        event.preventDefault();
        cancelEditing();
      }
    },
    [saveValue, cancelEditing]
  );

  const handleBlur = useCallback(() => {
    // Small delay to allow click events on other elements to process
    setTimeout(() => {
      if (isEditing) {
        saveValue();
      }
    }, 150);
  }, [isEditing, saveValue]);

  const handleChange = useCallback((value: T) => {
    setCurrentValue(value);
    setError(null);
  }, []);

  return {
    isEditing,
    currentValue,
    isSaving,
    error,
    inputRef,
    selectRef,
    startEditing,
    cancelEditing,
    saveValue,
    handleKeyDown,
    handleBlur,
    handleChange,
  };
}
