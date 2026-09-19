# Scripted runtime: manual migration and CP8 inventory

The current authored API is `window.ScriptedRuntime`, accessed as
`ScriptedRuntime.ports`. Its operations, port declarations and validation rules
retain their existing semantics. Instance branding such as **Batata Chip** and
the repository/package identity **web-slideshow** never determine this API.

Historical Scripted JavaScript may use `PowerShow.ports`. The runtime no longer
installs `window.PowerShow`: there is no alias, proxy, getter, or second API.
Historical calls fail until their author edits them manually.

| Historical authored usage | Current authored usage |
| --- | --- |
| `PowerShow.ports.onAction(...)` | `ScriptedRuntime.ports.onAction(...)` |
| `PowerShow.ports.onInput(...)` | `ScriptedRuntime.ports.onInput(...)` |
| `PowerShow.ports.report(...)` | `ScriptedRuntime.ports.report(...)` |

Open the element's JavaScript in the Inspector and manually update the API
usages. Use **Apply / Run**, then test the element and its Player/Control ports.
Save and publish a new version when the draft is ready for playback; published
versions remain immutable. The new runtime also requires manual migration of
historical source in old documents before that source can use the ports API.

Import, load, save, recovery, publication, export and rendering intentionally
do not transform authored HTML, CSS or JavaScript. Schema version 1, Scripted
fields, Presentation JSON and Firestore encoding are unchanged. This is an
authored API cutover, not a document migration.

## Corrected CP8 Scripted legacy inventory

The former compatibility conclusion is superseded. These identifiers are
**removed from the current runtime**, not retained as supported compatibility:

| Historical identifier | Current identifier | Audit classification |
| --- | --- | --- |
| `window.PowerShow` / `PowerShow.ports` | `window.ScriptedRuntime` / `ScriptedRuntime.ports` | A: authored API; manual migration above |
| `powershow:scripted:action` | `scripted:action` | B: internal iframe message |
| `powershow:scripted:input` | `scripted:input` | B: internal iframe message |
| `powershow:scripted:report` | `scripted:report` | B: internal iframe message |
| `powershow-scripted-root` | `scripted-runtime-root` | C: iframe-internal DOM |
| `powershow-scripted-payload` | `scripted-runtime-payload` | C: temporary iframe payload |
| `data-powershow-scripted-bootstrap` | `data-scripted-runtime-bootstrap` | C: iframe bootstrap marker |
| `__powershowScriptedBootCount` | `__scriptedRuntimeBootCount` | C: lifecycle test fixture instrumentation only |

The internal message names and DOM identifiers were not documented authored
APIs. No existing tracked uses of the new internal DOM names conflicted at
cutover. The outer iframe keeps `presentation-scripted`,
`data-presentation-type="scripted"` and `data-presentation-id`; Studio hooks use
`data-presentation-scripted-*` (D: outer DOM/test hooks). These remain distinct
from the iframe document.

The renderer installs the API after HTML and CSS and before appending authored
JavaScript. The host and bootstrap accept only current message names. The
Control hooks use existing Live records, not iframe protocol strings; those
records and their authorization, activation/version/mount checks are unchanged.
Studio previews use the shared renderer. Navigation/reload/cleanup behavior,
source-window validation, exact envelopes, element/port validation, directions,
finite bounds, CSP and the `allow-scripts` sandbox remain unchanged.

Historical names are allowed only in migration explanations (E), preserved
user-content fixtures (F), and regression assertions proving removal of those
historical contracts. They do not indicate runtime support. Non-Scripted legacy
asset/style import mappings and unrelated authored text (G) are outside this
cutover. No separate tracked CP8 inventory file existed in the starting checkout;
this section records the corrected inventory alongside the migration guide.

## Manual smoke procedure

This procedure is prepared for manual acceptance; automated tests are not a
claim that a live browser/Firebase smoke has passed.

Create a Scripted element with HTML `<output id="value">0</output>` and these
ports: `increment` (action), `level` (number, input-output, min 0, max 100).
Use this JavaScript:

```js
let value = 0;
const output = document.getElementById("value");
function show() {
  output.textContent = String(value);
  ScriptedRuntime.ports.report("level", value);
}
ScriptedRuntime.ports.onAction("increment", () => {
  value = Math.min(100, value + 1);
  show();
});
ScriptedRuntime.ports.onInput("level", (next) => {
  value = next;
  show();
});
show();
```

1. Apply/run, save, publish and activate with Player and authenticated Control.
   Trigger the action; set level to 17.25; verify Player output and Control
   report agree. Navigate away/back and reload: confirm a fresh runtime and
   working ports; navigating to the current slide must not restart it.
2. In a separate historical fixture, manually change the API usages to the
   historical authored name in the table. Save/export, import and reload it.
   Verify the source remains exact, but the old calls fail. In the sandbox
   console, verify `typeof window.PowerShow` is `"undefined"`.
3. Manually restore the current API usages, apply/run and publish a new version.
   Repeat the action/input/report checks. Confirm the original published
   version and source were not silently edited.
