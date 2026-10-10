import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { copyMealsFromArchived } from "@/domain/plan";
import { useWrite } from "@/hooks/useWrite";
import { nowIso } from "@/lib/dates";
import type { ShopMeal } from "@/store/types";

/** "Copy these meals to the plan", which fills each day with the archived shop's meals for it after a confirm and opens the plan. */
export function CopyMealsButton({
  shopName,
  meals,
}: {
  shopName: string;
  meals: readonly ShopMeal[];
}) {
  const write = useWrite();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  if (meals.length === 0) {
    return null;
  }
  return (
    <>
      <Button
        type="button"
        aria-label={`Copy the meals of ${shopName} to the plan`}
        variant="outline"
        size="lg"
        className="flex-1"
        onClick={() => setConfirming(true)}
      >
        Copy these meals to the plan
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Copy these meals to the plan?"
        description="Each day takes the meals this shop had on it, in their order, replacing what is there. Days it does not mention are cleared."
        confirmLabel="Copy meals"
        onConfirm={async () => {
          await write((w) => copyMealsFromArchived(w, meals, nowIso()));
          await navigate({ to: "/plan" });
        }}
      />
    </>
  );
}
