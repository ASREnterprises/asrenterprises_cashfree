// Lightweight Promise-based confirm modal replacement for window.confirm.
// Renders a branded dialog via ReactDOM portal — no provider plumbing needed.
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { AlertTriangle, ShieldAlert, Trash2 } from "lucide-react";

const ConfirmDialog = ({
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  tone = "danger", // danger | warning | info
  onConfirm,
  onCancel,
}) => {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    // Fade in
    const t = setTimeout(() => setOpen(true), 10);
    const onKey = (e) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [onCancel, onConfirm]);

  const palette = tone === "warning"
    ? { ring: "bg-amber-100", icon: <ShieldAlert className="w-5 h-5 text-amber-600" />, btn: "bg-amber-600 hover:bg-amber-700" }
    : tone === "info"
    ? { ring: "bg-sky-100", icon: <ShieldAlert className="w-5 h-5 text-sky-600" />, btn: "bg-sky-600 hover:bg-sky-700" }
    : { ring: "bg-rose-100", icon: <Trash2 className="w-5 h-5 text-rose-600" />, btn: "bg-rose-600 hover:bg-rose-700" };

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-opacity ${open ? "opacity-100" : "opacity-0"} bg-slate-900/50 backdrop-blur-sm`}
      onClick={onCancel}
      data-testid="asr-confirm-backdrop"
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full max-w-sm transition-transform ${open ? "scale-100" : "scale-95"}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        data-testid="asr-confirm-dialog"
      >
        <div className="p-5">
          <div className="flex items-start gap-3">
            <div className={`${palette.ring} rounded-full p-2 flex-shrink-0`}>{palette.icon}</div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-slate-900" data-testid="asr-confirm-title">{title || "Are you sure?"}</h3>
              {message && (
                <p className="mt-1.5 text-sm text-slate-600 whitespace-pre-line" data-testid="asr-confirm-message">{message}</p>
              )}
            </div>
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
            data-testid="asr-confirm-cancel"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-semibold text-white rounded-xl transition ${palette.btn}`}
            autoFocus
            data-testid="asr-confirm-ok"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * confirm(options) -> Promise<boolean>
 * Usage:
 *   if (!(await confirm({ title: "Delete?", message: "..." }))) return;
 */
export function confirm(options = {}) {
  return new Promise((resolve) => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const cleanup = (value) => {
      try { root.unmount(); } catch (_) {}
      try { document.body.removeChild(container); } catch (_) {}
      resolve(value);
    };
    root.render(
      <ConfirmDialog
        {...options}
        onConfirm={() => cleanup(true)}
        onCancel={() => cleanup(false)}
      />
    );
  });
}

// Back-compat alias — used by components that imported { asrConfirm } previously.
export const asrConfirm = confirm;
export default confirm;
