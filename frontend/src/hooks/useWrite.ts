import { useCallback } from "react";
import { showToast } from "@/components/Toast";
import { DomainError } from "@/domain/checks";
import { useDb } from "@/store/provider";
import { type Writer, write } from "@/store/write";

/** Runs domain operations in one store transaction; a refused one shows its reason as a toast and resolves undefined. */
export function useWrite(): <R>(
  fn: (w: Writer) => Promise<R>,
) => Promise<R | undefined> {
  const db = useDb();
  return useCallback(
    async <R>(fn: (w: Writer) => Promise<R>): Promise<R | undefined> => {
      try {
        return await write(db, fn);
      } catch (error) {
        if (!(error instanceof DomainError)) {
          throw error;
        }
        showToast(error.message);
        return undefined;
      }
    },
    [db],
  );
}
