import type { PowerShowElement } from "@powershow/document-schema";

import { ELEMENT_TYPE_MESSAGE_KEYS } from "@/features/i18n/studio-i18n";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "./editor-workspace.module.css";

import {
  CodeInspector,
  ContainerInspector,
  ImageInspector,
  TableInspector,
  TerminalInspector,
  TextboxInspector,
  TextInspector,
} from "./inspector";

import type {
  ElementInspectorUpdate,
  FontResourceControls,
} from "./inspector/inspector-types";

interface ElementInspectorProps {
  element: PowerShowElement;

  onUpdate: ElementInspectorUpdate;

  fontResourceControls: FontResourceControls;
}

interface ElementTypeInspectorProps extends ElementInspectorProps {
  unsupportedElementHint: string;
}

// ============================================================
// BEGIN: INSPECTOR DISPATCHER
// ============================================================

function ElementTypeInspector({
  element,
  onUpdate,
  fontResourceControls,
  unsupportedElementHint,
}: ElementTypeInspectorProps) {
  switch (element.type) {
    case "container":
      return <ContainerInspector element={element} onUpdate={onUpdate} />;

    case "text":
      return (
        <TextInspector
          element={element}
          onUpdate={onUpdate}
          fontResourceControls={fontResourceControls}
        />
      );

    case "textbox":
      return (
        <TextboxInspector
          element={element}
          onUpdate={onUpdate}
          fontResourceControls={fontResourceControls}
        />
      );

    case "code":
      return (
        <CodeInspector key={element.id} element={element} onUpdate={onUpdate} />
      );

    case "terminal":
      return <TerminalInspector element={element} onUpdate={onUpdate} />;

    case "image":
      return <ImageInspector element={element} onUpdate={onUpdate} />;

    case "table":
      return <TableInspector element={element} onUpdate={onUpdate} />;

    default:
      return (
        <div className={styles.nextStep}>
          <span>{unsupportedElementHint}</span>
        </div>
      );
  }
}

// ============================================================
// END: INSPECTOR DISPATCHER
// ============================================================

// ============================================================
// BEGIN: ELEMENT INSPECTOR
//
// Este componente identifica o elemento selecionado e entrega
// sua edição ao Inspector específico daquele tipo.
// ============================================================

export function ElementInspector({
  element,
  onUpdate,
  fontResourceControls,
}: ElementInspectorProps) {
  const { t } = useStudioI18n();

  return (
    <>
      {/* =====================================================
          BEGIN: IDENTIFICAÇÃO
          ===================================================== */}

      <div className={styles.inspectorGroup}>
        <span className={styles.inspectorLabel}>{t("inspector.element")}</span>

        <strong>
          <span>{t(ELEMENT_TYPE_MESSAGE_KEYS[element.type])}</span>
        </strong>
      </div>

      <div className={styles.inspectorGroup}>
        <span className={styles.inspectorLabel}>{t("inspector.id")}</span>

        <code>{element.id}</code>
      </div>

      {/* =====================================================
          END: IDENTIFICAÇÃO
          ===================================================== */}

      <ElementTypeInspector
        element={element}
        onUpdate={onUpdate}
        fontResourceControls={fontResourceControls}
        unsupportedElementHint={t("inspector.unsupportedElementHint")}
      />
    </>
  );
}

// ============================================================
// END: ELEMENT INSPECTOR
// ============================================================
