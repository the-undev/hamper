import { Toaster as Sonner, type ToasterProps } from "sonner";

/** Sonner's toaster: one toast at a time, a pill near the bottom, clear of the tabs; a tap passes through the pill except on its action. */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="system"
      position="bottom-center"
      visibleToasts={1}
      offset={{ bottom: 96 }}
      mobileOffset={{ bottom: 96, left: 16, right: 16 }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "pointer-events-none right-0 left-0 mx-auto flex w-fit! max-w-full items-center gap-3 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background shadow-lg",
          actionButton:
            "pointer-events-auto -my-2.5 -mr-2 min-h-11 cursor-pointer rounded-full px-3 underline underline-offset-2",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
