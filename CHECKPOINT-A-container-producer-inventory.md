# Checkpoint A — Container producer inventory

This inventory records the current Studio producers and consumers that must
be migrated in Checkpoint B. No Studio producer is switched to the candidate
shape in Checkpoint A.

## Direct Container Inspector producers

- `apps/studio/src/features/editor/inspector/container-inspector.tsx`
  composes the Container sections and writes `style`, `link`, and effect data.
- `apps/studio/src/features/editor/inspector/sections/container-size-section.tsx`
  reads/writes `style.width` and `style.height`; panel presets come from
  `@powershow/theme/panel-size`.
- `apps/studio/src/features/editor/inspector/sections/container-spacing-section.tsx`
  reads/writes `style.padding*`, `style.margin*`, and top-level `gap`.
- `apps/studio/src/features/editor/inspector/sections/container-layout-section.tsx`
  reads/writes top-level `layoutMode`, `direction`, `distribution`,
  `horizontalAlign`, and `verticalAlign`.
- `apps/studio/src/features/editor/inspector/container-inspector-helpers.ts`
  updates the top-level `layoutMode`.
- `apps/studio/src/features/editor/inspector/sections/element-appearance-section.tsx`
  is reused by the Container inspector for background color, gradient,
  pattern, border radius, opacity, and border.
- `apps/studio/src/features/editor/inspector/sections/element-effects-section.tsx`
  is reused by the Container inspector for `style.shadow`.
- `apps/studio/src/features/editor/inspector/sections/element-interaction-section.tsx`
  is reused for Container links.
- `apps/studio/src/features/editor/inspector/sections/element-placement-section.tsx`
  writes `style.placement` for Containers and other elements.

## Creation and layout producers

- `apps/studio/src/features/editor/element-operations.ts` creates new
  Containers with top-level child-layout fields and `style.width`,
  `style.height`, `style.padding`, and `style.background`.
- `apps/studio/src/features/editor/slide-operations.ts` creates Container
  trees for the slide layout presets. It is the primary preset factory and
  writes the same legacy addresses at many preset branches.
- `apps/studio/src/features/editor/editor-demo-presentation.ts` contains
  demo/fixture Container trees using the legacy addresses.
- `apps/studio/src/features/editor/slide-layout-picker.tsx` selects presets;
  the actual Container data is produced by `slide-operations.ts`.
- `apps/studio/src/features/editor/element-crud-controls.tsx` and
  `element-tree-helpers.ts` route creation and traversal through the existing
  element operations; they do not independently define a second Container
  shape.

## Canvas and element-operation consumers

- `apps/studio/src/features/editor/canvas-resize-helpers.ts` treats a
  Container as resizable and updates generic `style.width`/`style.height`.
- `apps/studio/src/features/editor/inspector/sections/element-placement-helpers.ts`
  updates generic `style.placement` and is used by canvas drag behavior.
- `apps/studio/src/features/editor/editor-workspace.tsx` applies canvas drag
  and resize results to `element.style`, including Container dimensions and
  placement offsets.
- `apps/studio/src/features/editor/element-operations.ts` also owns generic
  cloning, insertion, deletion, and replacement paths that preserve Container
  fields recursively.
- `apps/studio/src/features/editor/element-tree-panel.tsx` reads
  `layoutMode` for its Container tree label; this is a read-side migration
  point, not a producer.

## Renderer/schema observations relevant to migration

- `style.position` is emitted by `packages/renderer/src/render-style.ts` and
  is used by the legacy Container link/pattern containing-block logic.
- `style.top`, `right`, `bottom`, and `left` are emitted as direct CSS offsets.
  No Container Inspector control currently produces them; they overlap with
  absolute `style.placement` only when authored independently, so they must be
  audited before any cutover.
- `ContainerElement.width` is accepted and rendered by the legacy Container
  renderer, but the inspected Studio producers use `style.width` instead.
- Generic Container typography (`color`, font fields, text alignment, line
  height, letter spacing, transforms, whitespace, wrapping, and decoration)
  is accepted through `ElementStyle` and can be observable through inherited
  CSS. The candidate style retains these flat fields for parity; no Container
  typography UI is added.
- `className` is emitted on the legacy Container root by the generic style
  path. The candidate retains it as a flat style field; no new abstraction is
  introduced.
