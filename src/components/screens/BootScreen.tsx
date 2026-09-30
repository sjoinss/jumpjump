import styles from "./BootScreen.module.css";

/** 저장소를 여는 동안 보이는 화면 */
export function BootScreen() {
  return (
    <main className={styles.screen}>
      <div className={styles.dots} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <p role="status">불러오는 중…</p>
    </main>
  );
}
