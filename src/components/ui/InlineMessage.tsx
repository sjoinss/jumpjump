import type { ReactNode } from "react";
import styles from "./InlineMessage.module.css";

export type InlineTone = "info" | "success" | "warning" | "error";

const SYMBOL: Record<InlineTone, string> = { success: "✓", warning: "⚠", error: "✕", info: "ℹ" };

type Props = {
  tone: InlineTone;
  title?: string;
  children: ReactNode;
  action?: ReactNode;
};

/** 화면 안에 계속 남는 안내. 색 대신 기호와 문장으로 상태를 알린다 */
export function InlineMessage({ tone, title, children, action }: Props) {
  return (
    <div className={`${styles.message} ${styles[tone]}`} role={tone === "error" ? "alert" : "status"}>
      <span className={styles.symbol} aria-hidden="true">
        {SYMBOL[tone]}
      </span>
      <div className={styles.body}>
        {title && <p className={styles.title}>{title}</p>}
        <p>{children}</p>
        {action && <div className={styles.action}>{action}</div>}
      </div>
    </div>
  );
}
