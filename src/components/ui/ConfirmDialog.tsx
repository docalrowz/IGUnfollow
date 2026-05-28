import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Preact-native replacement for the browser `confirm()` and `alert()`
 * primitives.
 *
 * Mount `<DialogProvider>` at the root once; any descendant can then
 * call `useConfirm()` / `useAlert()` to get an async function that
 * resolves with the user's choice. Confirm resolves `boolean`; alert
 * resolves `void` after acknowledgement.
 *
 * Native dialogs were synchronous and blocked the JS event loop, which
 * froze the scan/unfollow loops mid-await. The Preact version keeps
 * everything async so React state updates and the in-flight fetch
 * pipeline keep ticking while the user reads the prompt.
 */

interface DialogPayload {
  readonly kind: 'confirm' | 'alert';
  readonly title?: string;
  readonly message: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly resolve: (ok: boolean) => void;
}

interface AskConfirmOptions {
  readonly title?: string;
  readonly message: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
}

interface AskAlertOptions {
  readonly title?: string;
  readonly message: string;
  readonly confirmLabel?: string;
}

interface DialogContextValue {
  readonly confirm: (opts: AskConfirmOptions | string) => Promise<boolean>;
  readonly alert: (opts: AskAlertOptions | string) => Promise<void>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

export function DialogProvider({ children }: { readonly children: React.ReactNode }) {
  const [pending, setPending] = useState<DialogPayload | null>(null);

  const confirm = useCallback((opts: AskConfirmOptions | string): Promise<boolean> => {
    const resolved = typeof opts === 'string' ? { message: opts } : opts;
    return new Promise<boolean>(resolve => {
      setPending({
        kind: 'confirm',
        title: resolved.title,
        message: resolved.message,
        confirmLabel: resolved.confirmLabel ?? 'Confirm',
        cancelLabel: resolved.cancelLabel ?? 'Cancel',
        resolve,
      });
    });
  }, []);

  const alertFn = useCallback((opts: AskAlertOptions | string): Promise<void> => {
    const resolved = typeof opts === 'string' ? { message: opts } : opts;
    return new Promise<void>(resolve => {
      setPending({
        kind: 'alert',
        title: resolved.title,
        message: resolved.message,
        confirmLabel: resolved.confirmLabel ?? 'OK',
        cancelLabel: '',
        resolve: () => resolve(),
      });
    });
  }, []);

  const value = useMemo<DialogContextValue>(
    () => ({ confirm, alert: alertFn }),
    [confirm, alertFn],
  );

  const close = useCallback((ok: boolean) => {
    if (pending !== null) {
      pending.resolve(ok);
      setPending(null);
    }
  }, [pending]);

  return (
    <DialogContext.Provider value={value}>
      {children}
      {pending !== null && (
        <ModalDialog
          payload={pending}
          onConfirm={() => close(true)}
          onCancel={() => close(false)}
        />
      )}
    </DialogContext.Provider>
  );
}

function ModalDialog({
  payload,
  onConfirm,
  onCancel,
}: {
  readonly payload: DialogPayload;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    confirmRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key !== 'Tab' || dialogRef.current === null) {
        return;
      }
      const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) {
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus();
      }
    };
  }, [onCancel]);

  return (
    <div className='dialog-backdrop' role='presentation' onClick={onCancel}>
      <div
        ref={dialogRef}
        className='dialog'
        role={payload.kind === 'alert' ? 'alertdialog' : 'dialog'}
        aria-modal='true'
        aria-labelledby={payload.title !== undefined ? 'dialog-title' : undefined}
        aria-describedby='dialog-message'
        onClick={e => e.stopPropagation()}
      >
        {payload.title !== undefined && <h2 id='dialog-title' className='dialog-title'>{payload.title}</h2>}
        <p id='dialog-message' className='dialog-message'>{payload.message}</p>
        <div className='dialog-actions'>
          {payload.kind === 'confirm' && (
            <button type='button' className='dialog-cancel' onClick={onCancel}>
              {payload.cancelLabel}
            </button>
          )}
          <button ref={confirmRef} type='button' className='dialog-confirm' onClick={onConfirm}>
            {payload.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (ctx === null) {
    throw new Error('useDialog must be used inside <DialogProvider>');
  }
  return ctx;
}

export function useConfirm(): DialogContextValue['confirm'] {
  return useDialog().confirm;
}

export function useAlert(): DialogContextValue['alert'] {
  return useDialog().alert;
}
