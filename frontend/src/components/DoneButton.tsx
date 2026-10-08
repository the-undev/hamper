import { useCanGoBack, useNavigate, useRouter } from "@tanstack/react-router";
import type { PlainPath } from "./ScreenHeader";
import { primaryButton } from "./styles";

/** Done, for an editing screen's footer: back to where the user came from, else to the parent. */
export function DoneButton({ parent }: { parent: PlainPath }) {
  const router = useRouter();
  const navigate = useNavigate();
  const canGoBack = useCanGoBack();
  return (
    <button
      type="button"
      className={primaryButton}
      onClick={() => {
        if (canGoBack) {
          router.history.back();
          return;
        }
        void navigate({ to: parent });
      }}
    >
      Done
    </button>
  );
}
