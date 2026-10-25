import { useState } from "react";
import { Button } from "@/components/ui/kit";
import { Icon } from "@/components/ui/icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useT } from "@/lib/i18n";

export type ExportActionsProps = {
  onExportCsv?: () => void | Promise<void>;
  onExportExcel?: () => void | Promise<void>;
  onExportPdf?: () => void | Promise<void>;
  isExportingPdf?: boolean;
  isExportingExcel?: boolean;
  disabled?: boolean;
  variant?: "dropdown" | "buttons";
};

export function ExportActions({
  onExportCsv,
  onExportExcel,
  onExportPdf,
  isExportingPdf = false,
  isExportingExcel = false,
  disabled = false,
  variant = "dropdown",
}: ExportActionsProps) {
  const t = useT();
  const [internalBusy, setInternalBusy] = useState(false);
  const busy = isExportingPdf || isExportingExcel || internalBusy;

  const handlePdf = async () => {
    if (!onExportPdf || busy) return;
    try {
      setInternalBusy(true);
      await onExportPdf();
    } finally {
      setInternalBusy(false);
    }
  };

  const handleExcel = async () => {
    if (!onExportExcel || busy) return;
    try {
      setInternalBusy(true);
      await onExportExcel();
    } finally {
      setInternalBusy(false);
    }
  };

  const handleCsv = async () => {
    if (!onExportCsv) return;
    await onExportCsv();
  };

  if (variant === "buttons") {
    return (
      <div className="ma-inline-cluster" role="group" aria-label={t("خيارات التصدير", "Export options")}>
        {onExportExcel && (
          <Button
            kind="soft"
            icon={busy ? "refresh" : "download"}
            label={t("تصدير Excel", "Export Excel")}
            onClick={handleExcel}
            disabled={disabled || busy}
          />
        )}
        {onExportCsv && (
          <Button
            kind="soft"
            icon="download"
            label={t("تصدير CSV", "Export CSV")}
            onClick={handleCsv}
            disabled={disabled}
          />
        )}
        {onExportPdf && (
          <Button
            kind="soft"
            icon={busy ? "refresh" : "file"}
            label={busy ? t("جارٍ تصدير PDF…", "Exporting PDF…") : t("تصدير PDF", "Export PDF")}
            onClick={handlePdf}
            disabled={disabled || busy}
          />
        )}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="ma-btn ma-btn--soft"
          disabled={disabled || busy}
          aria-label={t("خيارات التصدير", "Export options")}
        >
          <Icon name={busy ? "refresh" : "download"} className={busy ? "animate-spin" : undefined} />
          <span>{busy ? t("جارٍ التصدير…", "Exporting…") : t("تصدير", "Export")}</span>
          <Icon name="chevron" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onExportExcel && (
          <DropdownMenuItem onClick={handleExcel} disabled={busy}>
            <Icon name="download" />
            <span>{t("تصدير كملف Excel", "Export as Excel (.xlsx)")}</span>
          </DropdownMenuItem>
        )}
        {onExportCsv && (
          <DropdownMenuItem onClick={handleCsv}>
            <Icon name="download" />
            <span>{t("تصدير كملف CSV", "Export as CSV")}</span>
          </DropdownMenuItem>
        )}
        {onExportPdf && (
          <DropdownMenuItem onClick={handlePdf} disabled={busy}>
            <Icon name="file" />
            <span>{t("تصدير كملف PDF", "Export as PDF")}</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
