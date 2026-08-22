import React, {
  useEffect,
  useRef,
} from "react";
import {
  AlertTriangle,
  Loader2,
} from "lucide-react";

import "./ConfirmActionModal.css";

let modalId = 0;

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const nextModalId = () => {
  modalId += 1;
  return `confirm-action-modal-${modalId}`;
};

const focusableElements = (container) =>
  container
    ? Array.from(
        container.querySelectorAll(FOCUSABLE_SELECTOR)
      ).filter(
        (element) =>
          element.getAttribute("aria-hidden") !== "true"
      )
    : [];

const ConfirmActionModal = ({
  open,
  title,
  description,
  body,
  children,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  loading = false,
  variant = "normal",
  closeOnBackdrop = true,
}) => {
  const dialogRef = useRef(null);
  const cancelButtonRef = useRef(null);
  const previousFocusRef = useRef(null);
  const onCancelRef = useRef(onCancel);
  const loadingRef = useRef(loading);
  const idsRef = useRef(null);

  onCancelRef.current = onCancel;
  loadingRef.current = loading;

  if (!idsRef.current) {
    const baseId = nextModalId();
    idsRef.current = {
      title: `${baseId}-title`,
      body: `${baseId}-body`,
    };
  }

  useEffect(() => {
    if (!open) return undefined;

    previousFocusRef.current = document.activeElement;
    const focusTimer = window.setTimeout(() => {
      const initialTarget =
        cancelButtonRef.current &&
        !cancelButtonRef.current.disabled
          ? cancelButtonRef.current
          : dialogRef.current;
      initialTarget?.focus();
    }, 0);

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        if (loadingRef.current) return;
        event.preventDefault();
        onCancelRef.current?.();
        return;
      }

      if (event.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusable = focusableElements(dialog);
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (!dialog.contains(active)) {
        event.preventDefault();
        first.focus();
        return;
      }

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const normalizedVariant =
    variant === "danger" ? "danger" : "normal";
  const content = body ?? description ?? children;

  const handleCancel = () => {
    if (!loading) onCancel();
  };

  const handleConfirm = () => {
    if (!loading) onConfirm();
  };

  return (
    <div
      className="confirm-action-modal__backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (
          !loading &&
          closeOnBackdrop &&
          event.target === event.currentTarget
        ) {
          onCancel();
        }
      }}
    >
      <section
        ref={dialogRef}
        tabIndex={-1}
        className={`confirm-action-modal confirm-action-modal--${normalizedVariant}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idsRef.current.title}
        aria-describedby={content ? idsRef.current.body : undefined}
        aria-busy={loading ? "true" : "false"}
      >
        <header className="confirm-action-modal__header">
          {normalizedVariant === "danger" && (
            <span
              className="confirm-action-modal__icon"
              aria-hidden="true"
            >
              <AlertTriangle size={22} strokeWidth={2} />
            </span>
          )}

          <h2 id={idsRef.current.title}>{title}</h2>
        </header>

        {content && (
          <div
            id={idsRef.current.body}
            className="confirm-action-modal__body"
          >
            {content}
          </div>
        )}

        <footer className="confirm-action-modal__footer">
          <button
            ref={cancelButtonRef}
            type="button"
            className="confirm-action-modal__button confirm-action-modal__button--cancel"
            onClick={handleCancel}
            disabled={loading}
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            className={`confirm-action-modal__button confirm-action-modal__button--confirm confirm-action-modal__button--${normalizedVariant}`}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading && (
              <Loader2
                className="confirm-action-modal__spinner"
                size={17}
                aria-hidden="true"
              />
            )}
            {confirmLabel}
          </button>
        </footer>
      </section>
    </div>
  );
};

export default ConfirmActionModal;
