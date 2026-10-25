import { type ReactNode } from "react";
import { Dialog } from "@base-ui-components/react/dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export type ModalSize = "sm" | "md" | "lg" | "xl";

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: ModalSize;
  className?: string;
  bodyClassName?: string;
  showCloseButton?: boolean;
}

const sizeClasses: Record<ModalSize, string> = {
  sm: "ma-modal--sm",
  md: "ma-modal--md",
  lg: "ma-modal--lg",
  xl: "ma-modal--xl",
};

/**
 * Mastery Design System Modal Component
 * Built on @base-ui-components/react/dialog and styled with .ma-backdrop, .ma-modal,
 * .ma-modal__head, .ma-modal__body, and .ma-modal__foot.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
  className,
  bodyClassName,
  showCloseButton = true,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="ma-backdrop" />
        <Dialog.Viewport className="ma-modal-viewport">
          <Dialog.Popup className={cn("ma-modal", sizeClasses[size], className)}>
            {(title || showCloseButton) && (
              <header className="ma-modal__head">
                {title && (
                  typeof title === "string" ? (
                    <Dialog.Title className="ma-modal__title">{title}</Dialog.Title>
                  ) : (
                    <div style={{ flex: 1 }}>{title}</div>
                  )
                )}
                {showCloseButton && (
                  <Dialog.Close
                    className="ma-btn ma-btn--bare ma-btn--icon ma-modal__close"
                    aria-label="Close"
                  >
                    <X size={16} />
                  </Dialog.Close>
                )}
              </header>
            )}

            {description && (
              <Dialog.Description className="ma-modal__desc">
                {description}
              </Dialog.Description>
            )}

            <div className={cn("ma-modal__body", bodyClassName)}>
              {children}
            </div>

            {footer && (
              <footer className="ma-modal__foot">
                {footer}
              </footer>
            )}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
