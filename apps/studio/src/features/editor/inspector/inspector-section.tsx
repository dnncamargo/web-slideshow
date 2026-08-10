import type { ReactNode } from "react";

import styles from "../editor-workspace.module.css";

interface InspectorSectionProps {
  title: string;

  children: ReactNode;

  defaultOpen?: boolean;

  className?: string;
}

// ============================================================
// BEGIN: INSPECTOR SECTION
// ============================================================

export function InspectorSection({
  title,
  children,
  defaultOpen = false,
  className,
}: InspectorSectionProps) {
  const sectionClassName = className
    ? `${styles.inspectorSection} ${className}`
    : styles.inspectorSection;

  return (
    <details className={sectionClassName} open={defaultOpen || undefined}>
      <summary className={styles.inspectorSectionTitle}>
        <span>{title}</span>
      </summary>

      <div className={styles.inspectorSectionContent}>{children}</div>
    </details>
  );
}

// ============================================================
// END: INSPECTOR SECTION
// ============================================================
