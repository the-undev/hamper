import { useState } from "react";
import { useWrite } from "@/hooks/useWrite";
import { cn } from "@/lib/utils";
import type { Writer } from "@/store/write";
import { textInput } from "./styles";

/** A labelled text box saved when it loses focus or on Enter, and put back when the save is refused; a title shows the label only to screen readers. */
export function SavedField({
  label,
  value,
  placeholder,
  save,
  title = false,
}: {
  label: string;
  value: string;
  placeholder?: string;
  save: (w: Writer, value: string) => Promise<void>;
  title?: boolean;
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
    <label className="flex flex-col gap-1 text-[11px] font-semibold text-muted">
      <span className={cn(title && "sr-only")}>{label}</span>
      <input
        value={text}
        placeholder={placeholder}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
        className={
          title
            ? "min-h-11 w-full rounded-[10px] border border-transparent bg-transparent px-1 text-[22px] font-bold text-foreground hover:border-line focus:border-line"
            : textInput
        }
      />
    </label>
  );
}
