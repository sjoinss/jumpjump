import type { ComponentProps, ReactNode } from "react";
import styles from "./Button.module.css";
import { PixelIcon, type PixelIconName } from "./PixelIcon";

/**
 * primary(딸기), secondary(라벤더), ghost(크림), danger(코랄).
 * 모두 파스텔 채우기 + 잉크 외곽선 + 아래 두께. 누르면 두께만큼 내려간다.
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type Props = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  /** 진행 중이면 누를 수 없고 스피너와 함께 loadingLabel을 보여준다 */
  loading?: boolean;
  loadingLabel?: string;
  block?: boolean;
  size?: "md" | "lg";
  icon?: PixelIconName;
  children: ReactNode;
};

export function Button({
  variant = "secondary",
  loading = false,
  loadingLabel,
  block = false,
  size = "md",
  icon,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: Props) {
  const classes = [styles.button, styles[variant], styles[size], block && styles.block, className]
    .filter(Boolean)
    .join(" ");
  return (
    <button {...rest} type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined}>
      {loading ? (
        <span className={styles.spinner} aria-hidden="true" />
      ) : (
        icon && <PixelIcon name={icon} size={size === "lg" ? 20 : 16} />
      )}
      <span>{loading && loadingLabel ? loadingLabel : children}</span>
    </button>
  );
}

type IconButtonProps = Omit<ComponentProps<"button">, "children"> & {
  icon: PixelIconName;
  /** 화면에 글자가 없으므로 필수. 스크린리더 이름 + 마우스 툴팁으로 쓴다 */
  label: string;
  variant?: "cream" | "primary" | "secondary";
};

/** 아이콘만 있는 둥근 네모 버튼 (HUD용). 이름은 aria-label과 title로 제공한다 */
export function IconButton({ icon, label, variant = "cream", className, type = "button", ...rest }: IconButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      aria-label={label}
      title={label}
      className={[styles.iconButton, styles[`icon_${variant}`], className].filter(Boolean).join(" ")}
    >
      <PixelIcon name={icon} size={22} />
    </button>
  );
}
