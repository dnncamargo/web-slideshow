import type { ReactNode } from "react";

import styles from "../editor-workspace.module.css";

interface InspectorSectionProps {
  title: string;

  children: ReactNode;

  defaultOpen?: boolean;

  open?: boolean;

  onOpenChange?: (open: boolean) => void;

  count?: number;

  className?: string;
}

// ============================================================
// BEGIN: INSPECTOR SECTION
// ============================================================

export function InspectorSection({
  title,
  children,
  defaultOpen = false,
  open,
  onOpenChange,
  count,
  className,
}: InspectorSectionProps) {
  const sectionClassName = className
    ? `${styles.inspectorSection} ${className}`
    : styles.inspectorSection;

  return (
      <details
        className={sectionClassName}
        open={open ?? (defaultOpen || undefined)}
        onToggle={onOpenChange === undefined ? undefined : (event) => onOpenChange(event.currentTarget.open)}
      >
      <summary className={styles.inspectorSectionTitle}>
        <span>{title}</span>

        {count !== undefined && (
          <span className={styles.sectionCount}>{count}</span>
        )}
      </summary>

      <div className={styles.inspectorSectionContent}>{children}</div>
    </details>
  );
}

// ============================================================
// END: INSPECTOR SECTION
// ============================================================
