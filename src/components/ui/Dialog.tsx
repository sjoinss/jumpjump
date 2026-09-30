"use client";

import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import styles from "./Dialog.module.css";
import { PixelIcon } from "./PixelIcon";

type Props = {
  open: boolean;
  title: string;
  /** ESC, 닫기 버튼, 바깥 클릭이 모두 이 함수를 부른다 */
  onClose: () => void;
  /** 열릴 때 처음 포커스를 받을 요소. 위험 확인창은 "취소" 버튼을 넘긴다 */
  initialFocusRef?: RefObject<HTMLElement | null>;
  description?: string;
  /** false면 닫기(✕) 버튼을 숨긴다. 선택을 강제해야 하는 창에서만 쓴다 */
  showClose?: boolean;
  children?: ReactNode;
  actions?: ReactNode;
};

/**
 * 네이티브 <dialog>의 showModal()을 쓴다. 바깥은 inert가 되어 포커스가 창 안에 갇히고 ESC는 cancel 이벤트로 온다.
 * 닫히면 열기 전에 포커스가 있던 요소로 되돌린다.
 */
export function Dialog({
  open,
  title,
  onClose,
  initialFocusRef,
  description,
  showClose = true,
  children,
  actions,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    const previous = document.activeElement as HTMLElement | null;
    if (!dialog.open) dialog.showModal();
    (initialFocusRef?.current ?? dialog.querySelector<HTMLElement>("[data-autofocus]"))?.focus();
    return () => {
      if (dialog.open) dialog.close();
      previous?.focus?.();
    };
  }, [open, initialFocusRef]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      onCloseRef.current();
    };
    dialog.addEventListener("cancel", onCancel);
    return () => dialog.removeEventListener("cancel", onCancel);
  }, []);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClick={(e) => {
        // 바깥(backdrop) 클릭: 이벤트 대상이 dialog 자신일 때만
        if (e.target === e.currentTarget) onCloseRef.current();
      }}
    >
      {open && (
        <div className={styles.panel}>
          <header className={styles.header}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            {showClose && (
              <button type="button" className={styles.close} onClick={() => onCloseRef.current()} aria-label="닫기">
                <PixelIcon name="close" size={16} />
              </button>
            )}
          </header>
          {description && (
            <p id={descId} className={styles.description}>
              {description}
            </p>
          )}
          {children}
          {actions && <div className={styles.actions}>{actions}</div>}
        </div>
      )}
    </dialog>
  );
}
