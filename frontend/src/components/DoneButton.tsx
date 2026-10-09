import { useCanGoBack, useNavigate, useRouter } from "@tanstack/react-router";
import type { PlainPath } from "./ScreenHeader";
import { primaryButton } from "./styles";

/** Returns the function that leaves an editing screen: back to where the user came from, else to the parent. */
export function useLeave(parent: PlainPath): () => void {
  const router = useRouter();
  const navigate = useNavigate();
  const canGoBack = useCanGoBack();
  return () => {
    if (canGoBack) {
      router.history.back();
      return;
    }
    void navigate({ to: parent });
  };
}

/** Done, for an editing screen's footer: back to where the user came from, else to the parent. */
export function DoneButton({ parent }: { parent: PlainPath }) {
  const leave = useLeave(parent);
  return (
    <button type="button" className={primaryButton} onClick={leave}>
      Done
    </button>
  );
}
