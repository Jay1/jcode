// FILE: InlineRenameField.tsx
// Purpose: Shared inline terminal rename input for pane tabs and group titles.
// Layer: Terminal presentation primitive

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";

import { cn } from "~/lib/utils";

interface InlineRenameFieldProps {
  initialValue: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
  autoFocus?: boolean | undefined;
  className?: string | undefined;
}

export default function InlineRenameField({
  autoFocus,
  className,
  initialValue,
  onCancel,
  onCommit,
}: InlineRenameFieldProps) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        onCommit(value.trim());
      } else if (event.key === "Escape") {
        onCancel();
      }
    },
    [onCancel, onCommit, value],
  );

  const handleBlur = useCallback(() => {
    onCommit(value.trim());
  }, [onCommit, value]);

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      className={cn(
        "bg-background px-1.5 py-0.5 text-[11px] leading-4 text-foreground outline-none ring-1 ring-inset ring-[var(--color-ring)]",
        className,
      )}
      autoFocus={autoFocus}
    />
  );
}
