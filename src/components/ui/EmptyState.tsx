import type { ReactNode } from "react";
import styles from "./EmptyState.module.css";

type Props = {
  /** 지금 상태 */
  title: string;
  /** 왜 비어 있는지 / 다음에 무엇을 할 수 있는지 */
  description?: string;
  action?: ReactNode;
  headingLevel?: 2 | 3;
};

export function EmptyState({ title, description, action, headingLevel = 2 }: Props) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <div className={styles.empty}>
      <Heading className={styles.title}>{title}</Heading>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
