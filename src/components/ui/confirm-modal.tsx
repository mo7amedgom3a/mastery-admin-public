import { type ReactNode } from "react";
import { AlertTriangle, Trash2, HelpCircle } from "lucide-react";
import { Modal } from "./modal";
import { Button } from "./kit";
import { useT } from "@/lib/i18n";

export interface ConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  message: ReactNode;
  description?: ReactNode;
  confirmLabel?: ReactNode;
  cancelLabel?: ReactNode;
  tone?: "danger" | "warning" | "primary";
  loading?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

export function ConfirmModal({
  open,
  onOpenChange,
  title,
  message,
  description,
  confirmLabel,
  cancelLabel,
  tone = "danger",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const t = useT();

  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  const defaultTitle =
    tone === "danger"
      ? t("تأكيد الحذف", "Confirm Deletion")
      : tone === "warning"
      ? t("تنبيه", "Warning")
      : t("تأكيد العملية", "Confirm Action");

  const defaultConfirmLabel =
    tone === "danger"
      ? t("حذف", "Delete")
      : t("تأكيد", "Confirm");

  const defaultCancelLabel = t("إلغاء", "Cancel");

  const renderIcon = () => {
    if (tone === "danger") {
      return (
        <div className="ma-confirm-modal__icon" aria-hidden="true">
          <Trash2 size={22} />
        </div>
      );
    }
    if (tone === "warning") {
      return (
        <div className="ma-confirm-modal__icon ma-confirm-modal__icon--warning" aria-hidden="true">
          <AlertTriangle size={22} />
        </div>
      );
    }
    return (
      <div className="ma-confirm-modal__icon ma-confirm-modal__icon--primary" aria-hidden="true">
        <HelpCircle size={22} />
      </div>
    );
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title ?? defaultTitle}
      size="sm"
      footer={
        <>
          <Button
            kind="secondary"
            label={cancelLabel ?? defaultCancelLabel}
            onClick={handleCancel}
            disabled={loading}
          />
          <Button
            kind={tone === "danger" ? "danger" : "primary"}
            label={confirmLabel ?? defaultConfirmLabel}
            onClick={onConfirm}
            disabled={loading}
            aria-busy={loading}
          />
        </>
      }
    >
      <div className="ma-confirm-modal__body">
        {renderIcon()}
        <div className="ma-confirm-modal__content">
          <p className="ma-confirm-modal__message">{message}</p>
          {description && (
            <p className="ma-confirm-modal__hint">{description}</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
