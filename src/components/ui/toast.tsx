import { type ReactNode } from "react";
import { Toast } from "@base-ui-components/react/toast";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";

/**
 * Global Toast Manager for imperative toast triggering from anywhere in the app.
 */
export const toastManager = Toast.createToastManager();

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastOptions {
  description?: ReactNode;
  timeout?: number;
}

export const toast = {
  success: (title: ReactNode, options?: ToastOptions | ReactNode) => {
    const opts = typeof options === "object" && options !== null && !("$$typeof" in options)
      ? (options as ToastOptions)
      : { description: options as ReactNode };
    return toastManager.add({
      title,
      description: opts.description,
      timeout: opts.timeout,
      type: "success",
    });
  },

  error: (title: ReactNode, options?: ToastOptions | ReactNode) => {
    const opts = typeof options === "object" && options !== null && !("$$typeof" in options)
      ? (options as ToastOptions)
      : { description: options as ReactNode };
    return toastManager.add({
      title,
      description: opts.description,
      timeout: opts.timeout ?? 3000,
      type: "error",
      priority: "high",
    });
  },

  warning: (title: ReactNode, options?: ToastOptions | ReactNode) => {
    const opts = typeof options === "object" && options !== null && !("$$typeof" in options)
      ? (options as ToastOptions)
      : { description: options as ReactNode };
    return toastManager.add({
      title,
      description: opts.description,
      timeout: opts.timeout,
      type: "warning",
    });
  },

  info: (title: ReactNode, options?: ToastOptions | ReactNode) => {
    const opts = typeof options === "object" && options !== null && !("$$typeof" in options)
      ? (options as ToastOptions)
      : { description: options as ReactNode };
    return toastManager.add({
      title,
      description: opts.description,
      timeout: opts.timeout,
      type: "info",
    });
  },

  dismiss: (id: string) => {
    toastManager.close(id);
  },

  promise: toastManager.promise,
};

/**
 * Toast Provider component using @base-ui-components/react/toast and Mastery design system.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <Toast.Provider toastManager={toastManager} timeout={3000} limit={4}>
      {children}
      <Toast.Portal>
        <Toast.Viewport className="ma-toasts">
          <ToastItems />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

function ToastItems() {
  const { toasts, close } = Toast.useToastManager();

  return toasts.map((t) => {
    const type = (t.type as ToastType) || "info";

    return (
      <Toast.Root
        key={t.id}
        toast={t}
        className={`ma-toast ma-toast--${type}`}
      >
        <div className="ma-toast__icon" aria-hidden="true">
          {type === "success" && <CheckCircle2 size={18} style={{ color: "var(--success, #22c55e)" }} />}
          {type === "error" && <AlertCircle size={18} style={{ color: "var(--danger, #ef4444)" }} />}
          {type === "warning" && <AlertTriangle size={18} style={{ color: "var(--warning, #f59e0b)" }} />}
          {type === "info" && <Info size={18} style={{ color: "var(--sky, #0ea5e9)" }} />}
        </div>
        <Toast.Content className="ma-toast__content">
          {t.title && <Toast.Title className="ma-toast__title" />}
          {t.description && <Toast.Description className="ma-toast__desc" />}
        </Toast.Content>
        <button
          type="button"
          className="ma-toast__close"
          aria-label="Dismiss"
          onClick={() => close(t.id)}
        >
          <X size={15} />
        </button>
      </Toast.Root>
    );
  });
}
