import { useState } from "react";
import { useWrite } from "@/hooks/useWrite";
import { cn } from "@/lib/utils";
import type { Writer } from "@/store/write";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

function ignoreText(): void {}

/** A labelled text box saved when it loses focus or on Enter, and put back when the save is refused; a title shows the label only to screen readers. */
export function SavedField({
  label,
  value,
  placeholder,
  save,
  title = false,
  onTextChange = ignoreText,
}: {
  label: string;
  value: string;
  placeholder?: string;
  save: (w: Writer, value: string) => Promise<void>;
  title?: boolean;
  /** Called with the text as it is typed. */
  onTextChange?: (text: string) => void;
}) {
  const write = useWrite();
  const [text, setText] = useState(value);
  const commit = async (): Promise<void> => {
    if (text.trim() === value) {
      return;
    }
    const saved = await write(async (w) => {
      await save(w, text);
      return true;
    });
    if (!saved) {
      setText(value);
    }
  };
  return (
    <Label className="flex-col items-stretch gap-1 text-[11px] leading-normal font-semibold text-muted">
      <span className={cn(title && "sr-only")}>{label}</span>
      <Input
        value={text}
        placeholder={placeholder}
        onChange={(event) => {
          setText(event.target.value);
          onTextChange(event.target.value);
        }}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
        className={cn(
          title &&
            "rounded-[10px] bg-transparent px-2 py-0 text-[22px] font-bold text-foreground hover:border-muted focus:border-muted",
        )}
      />
    </Label>
  );
}
