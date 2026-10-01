"use client";

import { useEffect, useState } from "react";
import { sfx } from "@/game/audio";
import { applyTheme } from "@/lib/theme";
import { BestRecords } from "./BestRecords";
import { DesktopFrame } from "./DesktopFrame";
import { InstallButton } from "./InstallButton";
import { PwaProvider } from "./PwaProvider";
import { SaveProvider, useSaveData } from "./SaveProvider";
import { BootScreen } from "./screens/BootScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { PlayScreen } from "./screens/PlayScreen";
import { EditorScreen } from "@/editor/EditorScreen";
import { ToastProvider } from "./ui/Toast";
import styles from "./App.module.css";

export function App() {
  return (
    <PwaProvider>
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
    </PwaProvider>
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

  // 효과음: 설정을 따르고, 첫 터치·클릭·키 입력에서 켜고(브라우저 정책), 백그라운드에선 멈춘다
  const sfxOn = data.settings.sfx;
  useEffect(() => {
    sfx.setEnabled(sfxOn);
  }, [sfxOn]);

  useEffect(() => {
    const unlock = () => sfx.unlock();
    const onVisibility = () => sfx.setHidden(document.visibilityState === "hidden");
    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <DesktopFrame
      side={
        <>
          <BestRecords best={data.best} />
          <InstallButton block />
        </>
      }
    >
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
