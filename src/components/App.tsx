"use client";

import { useEffect, useState } from "react";
import { applyTheme } from "@/lib/theme";
import { BestRecords } from "./BestRecords";
import { DesktopFrame } from "./DesktopFrame";
import { SaveProvider, useSaveData } from "./SaveProvider";
import { BootScreen } from "./screens/BootScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { PlayScreen } from "./screens/PlayScreen";
import { EditorScreen } from "@/editor/EditorScreen";
import { ToastProvider } from "./ui/Toast";
import styles from "./App.module.css";

export function App() {
  return (
    <ToastProvider>
      <SaveProvider
        loading={
          <DesktopFrame>
            <BootScreen />
          </DesktopFrame>
        }
      >
        <Screens />
      </SaveProvider>

      <div className={styles.rotate}>
        <p className={styles.rotateTitle}>세로로 돌려주세요</p>
        <p>이 게임은 세로 화면에서 플레이해요.</p>
      </div>
    </ToastProvider>
  );
}

/**
 * React가 맡는 화면 전환. 시작 장면·게임·일시정지는 PlayScreen(엔진 Phase)이 맡고,
 * 에디터는 따로 화면, 설정은 어디서 열든 위에 덮는 화면이다.
 */
type Screen = "play" | "editor";

function Screens() {
  const [screen, setScreen] = useState<Screen>("play");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [data] = useSaveData();
  const theme = data.settings.theme;

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <DesktopFrame side={<BestRecords best={data.best} />}>
      {screen === "play" && (
        <div className={styles.layer} inert={settingsOpen}>
          <PlayScreen
            covered={settingsOpen}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenEditor={() => setScreen("editor")}
          />
        </div>
      )}
      {screen === "editor" && (
        <div className={styles.layer} inert={settingsOpen}>
          <EditorScreen onClose={() => setScreen("play")} />
        </div>
      )}
      {settingsOpen && (
        <div className={styles.overlay}>
          <SettingsScreen onClose={() => setSettingsOpen(false)} />
        </div>
      )}
    </DesktopFrame>
  );
}
