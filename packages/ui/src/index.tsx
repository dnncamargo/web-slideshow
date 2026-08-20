import type { ComponentPropsWithoutRef, ReactNode } from "react";

export const BUTTON_VARIANTS = [
  "primary",
  "secondary",
  "ghost",
  "danger",
] as const;

export type ButtonVariant = (typeof BUTTON_VARIANTS)[number];

export const BUTTON_SIZES = ["compact", "default", "touch"] as const;

export type ButtonSize = (typeof BUTTON_SIZES)[number];

export interface ButtonProps extends ComponentPropsWithoutRef<"button"> {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  variant = "secondary",
  size = "default",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={joinClassNames(
        "ps-ui-button",
        `ps-ui-button--${variant}`,
        `ps-ui-button--${size}`,
        className,
      )}
    />
  );
}

export type StatusTone = "neutral" | "success" | "warning" | "danger";

export interface StatusProps {
  children: ReactNode;
  tone?: StatusTone;
  className?: string;
}

export function Status({
  children,
  tone = "neutral",
  className,
}: StatusProps) {
  return (
    <span
      className={joinClassNames(
        "ps-ui-status",
        `ps-ui-status--${tone}`,
        className,
      )}
    >
      {children}
    </span>
  );
}

export const TOPBAR_SLOT_ORDER = [
  "brand",
  "title",
  "actions",
  "locale",
] as const;

export type TopbarMobileLayout = "none" | "stack-title";

export interface TopbarProps {
  children: ReactNode;
  className?: string;
  mobileLayout?: TopbarMobileLayout;
}

/**
 * Application chrome with a fixed trailing locale slot. Actions are a
 * separately constrained grid column, so their changing content can only
 * consume its own space and never displace the locale control.
 */
export function Topbar({
  children,
  className,
  mobileLayout = "none",
}: TopbarProps) {
  return (
    <header
      className={joinClassNames("ps-ui-topbar", className)}
      data-mobile-layout={mobileLayout}
    >
      {children}
    </header>
  );
}

export function TopbarBrand({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={joinClassNames("ps-ui-topbar__brand", className)}>{children}</div>;
}

export function TopbarTitle({
  children,
  className,
  title,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <div
      className={joinClassNames("ps-ui-topbar__title", className)}
      title={title}
    >
      {children}
    </div>
  );
}

export function TopbarActions({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={joinClassNames("ps-ui-topbar__actions", className)}>{children}</div>;
}

export function TopbarLocale({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={joinClassNames("ps-ui-topbar__locale", className)}>{children}</div>;
}

export interface HoverScrollTextProps {
  /**
   * The complete single-line text. It remains fully in the DOM and in the
   * native title attribute; only the visual viewport clips overflow.
   */
  text: string;
  className?: string;
  title?: string;
}

/**
 * Single-line text that never wraps and pans horizontally on hover to reveal
 * clipped overflow, returning to its start on pointer leave.
 *
 * The hover transform is clamped to `min(0, overflow)` so short text can
 * never visibly move and long text translates only by its actual overflow
 * distance. No timers or continuous animation are involved; the pan is a CSS
 * transition on the container-relative transform and is disabled under
 * `prefers-reduced-motion`.
 */
export function HoverScrollText({
  text,
  className,
  title,
}: HoverScrollTextProps) {
  return (
    <span
      className={joinClassNames("ps-ui-hover-scroll", className)}
      title={title ?? text}
    >
      <span className="ps-ui-hover-scroll__inner">{text}</span>
    </span>
  );
}

export function Separator({ className }: { className?: string }) {
  return <span className={joinClassNames("ps-ui-separator", className)} aria-hidden="true" />;
}

function joinClassNames(...classNames: Array<string | undefined>): string {
  return classNames.filter(Boolean).join(" ");
}
