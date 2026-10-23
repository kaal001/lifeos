"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, Trash2 } from "lucide-react";

export type ConfirmDialogOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

type PendingConfirmation = ConfirmDialogOptions & {
  resolve: (confirmed: boolean) => void;
};

type ConfirmDialogContextValue = {
  requestConfirmation: (
    options: ConfirmDialogOptions,
  ) => Promise<boolean>;
};

const ConfirmDialogContext =
  createContext<ConfirmDialogContextValue | null>(null);

export function ConfirmDialogProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [pending, setPending] =
    useState<PendingConfirmation | null>(null);

  const pendingRef = useRef<PendingConfirmation | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const titleId = useId();
  const messageId = useId();

  const requestConfirmation = useCallback(
    (options: ConfirmDialogOptions): Promise<boolean> => {
      if (pendingRef.current) {
        return Promise.resolve(false);
      }

      return new Promise<boolean>((resolve) => {
        const confirmation: PendingConfirmation = {
          ...options,
          resolve,
        };

        returnFocusRef.current =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;

        pendingRef.current = confirmation;
        setPending(confirmation);
      });
    },
    [],
  );

  const finishConfirmation = useCallback(
    (confirmed: boolean) => {
      const current = pendingRef.current;

      if (!current) return;

      pendingRef.current = null;
      setPending(null);
      current.resolve(confirmed);
    },
    [],
  );

  useEffect(() => {
    if (pending) {
      cancelButtonRef.current?.focus();
      return;
    }

    const element = returnFocusRef.current;
    returnFocusRef.current = null;
    element?.focus();
  }, [pending]);

  useEffect(() => {
    if (!pending) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        finishConfirmation(false);
        return;
      }

      if (event.key !== "Tab") return;

      const cancelButton = cancelButtonRef.current;
      const confirmButton = confirmButtonRef.current;

      if (!cancelButton || !confirmButton) return;

      if (event.shiftKey) {
        if (document.activeElement === cancelButton) {
          event.preventDefault();
          confirmButton.focus();
        } else if (document.activeElement !== confirmButton) {
          event.preventDefault();
          confirmButton.focus();
        }
      } else {
        if (document.activeElement === confirmButton) {
          event.preventDefault();
          cancelButton.focus();
        } else if (document.activeElement !== cancelButton) {
          event.preventDefault();
          cancelButton.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [pending, finishConfirmation]);

  return (
    <ConfirmDialogContext.Provider value={{ requestConfirmation }}>
      {children}

      {pending && (
        <div className="lifeos-confirm-overlay">
          <section
            className="lifeos-confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={messageId}
          >
            <div className="lifeos-confirm-icon" aria-hidden="true">
              <AlertTriangle size={25} />
            </div>

            <div className="lifeos-confirm-copy">
              <h2 id={titleId}>{pending.title}</h2>
              <p id={messageId}>{pending.message}</p>
            </div>

            <div className="lifeos-confirm-actions">
              <button
                ref={cancelButtonRef}
                type="button"
                className="lifeos-confirm-cancel"
                onClick={() => finishConfirmation(false)}
              >
                {pending.cancelLabel ?? "Cancel"}
              </button>

              <button
                ref={confirmButtonRef}
                type="button"
                className="lifeos-confirm-delete"
                onClick={() => finishConfirmation(true)}
              >
                <Trash2 size={16} />
                {pending.confirmLabel ?? "Delete"}
              </button>
            </div>
          </section>
        </div>
      )}
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirmDialog() {
  const context = useContext(ConfirmDialogContext);

  if (!context) {
    throw new Error(
      "useConfirmDialog must be used within ConfirmDialogProvider.",
    );
  }

  return context;
}