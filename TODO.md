# PromptGenerator — TODO Checklist

> This file is derived from `IMPLEMENTATION_PLAN.md` (Parts I, II, and III).
> Items are ordered by **priority and implementation phase** — higher-priority items
> must be completed first because later items depend on them.

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ⬜ | Not started |
| ✅ | Completed (verified in current codebase) |
| 🔶 | Partially done / needs verification |
| ❌ | Not done / needs implementation |

---

## ⚠️ Verification Pass — 2026-05-30 (automated code review)

> The codebase was cloned and the output generators were **executed headlessly** (jsdom)
> against trees covering every node type, in all four output modes (pseudo/markdown ×
> explicit/compact). Findings below correct several stale statuses in this file.

**Phases 1–8 spot-check: solid.** Section/Phase, Gate, Route, Table, Package, Loop
(`maxIterations` + `exitCondition`), break/continue validation, GOTO (incl. targeting a
section), Variables interpolation, token estimate, and the validation badge all produced
correct output when run. Pseudo-code verbosity (Explicit vs Compact) genuinely differs.

**Corrections to previously-recorded statuses:**

1. **BUG-F1 (`agent.agentic`)** was marked ⬜ — it is actually **done in pseudo-code**
   (emits `(agentic)`), but still **missing in Markdown**. → now 🔶.
2. **BUG-F3 (`q.suggestDefault`)** was marked ⬜ — it is actually **done in pseudo-code
   Explicit** ("Suggest best-practice default."), but **missing in pseudo Compact and in
   Markdown**. → now 🔶.
3. **BUG-F2 (`agent.verbose`)** is worse than recorded: the checkbox is **not rendered in
   the UI at all** (only `agentic`, `isPrimary` are), and the field is read nowhere. It is
   a fully dead field. → still ❌, description corrected.
4. The **BUG-F4 audit table** had wrong rows for the three fields above (claimed "NOT USED
   in BOTH") — corrected inline.

**Newly discovered bugs (were not tracked):** see **BUG-F5** (IF/ELSE-IF/ELSE branch
numbering collision) and **BUG-F6** (`${itemVar}` shows UNDEFINED inside loop body) added
to §9.3.

**V6 confirmed accurate:** Markdown output is byte-identical in Explicit vs Compact for
structural nodes (only the leaf sub-type tasks vary) — the ⬜ is correct.

---

## 🛠️ Progress — 2026-05-30 (settings foundation + full generator sweep)

> Implemented and verified end-to-end (jsdom: overriding any setting changes the output;
> 14/14 cross-node override assertions pass).

- **S1 — Settings data model:** ✅ done. `DEFAULT_SETTINGS` (single source of truth for every
  component's output text), `getSetting(path)` (override → default, partial-path safe),
  `fill(tpl, vars)` for templates. Verbs derived from `TASK_TYPES` so they never desync.
- **S6 — Persistence:** ✅ load/save done. Separate `prompt_generator_settings` key;
  `loadSettings()` called at boot after `loadState()`; `saveSettings()` debounced.
- **S3 — Connect settings to generators:** ✅ done. Header (ROLE/VARS/CONTEXT/MEMORY/RESOURCES/
  MODE/STEPS), task verbs (`getVerb`), and **every** node (gate, loop, if, route, section,
  subagent, parallel, ask, table, package) now read from `getSetting`, in **both** pseudo and
  Markdown. (Leaf task sub-type explicit expansions — goto/break/plan/etc. — still use literals;
  optional follow-up.)
- **S4 — Role presets:** 🔶 resolution path done — `getEffectiveRole()` reads
  `getSetting('role.presets.<key>')`. Editing UI is part of S2 (modal), still ⬜.
- **V1–V5:** ✅ Compact vs Explicit now genuinely differ across the whole header and all nodes.
- **V6 (Markdown node explicit):** ✅ explicit prose added for gate/loop/route/subagent/ask/
  section/package in Markdown.
- **BUG-F1 / F2 / F3:** ✅ fixed — sub-agent `agentic` now in Markdown; sub-agent `verbose` now
  emitted in both generators (output side; UI checkbox still TODO under F2); ASK `suggestDefault`
  now in Markdown and pseudo-compact.
- **S2 — Settings modal UI:** ✅ done. ⚙️ button opens a modal built dynamically from
  `DEFAULT_SETTINGS`: fields grouped by component (Role, Gate, Loop, …), live-edit updates the
  preview, per-field ↺ reset, a search filter, and an ● marker on overridden fields.
- **S5 — Import / Export / Reset-all:** ✅ done, inside the modal. Export/Import the overrides
  as JSON (separate `prompt_generator_settings` key); "Reset all" clears every override.
- **Still open:** F2 UI checkbox (sub-agent `verbose` is wired in output + settings, just no
  editor checkbox in the agent card yet), and BUG-F5/F6 (IF-branch numbering, loop `${itemVar}`
  UNDEFINED).

**Next:** add the sub-agent `verbose` checkbox (finish F2), then fix BUG-F5 (IF/ELSE-IF/ELSE
step-number collision) and BUG-F6 (`${itemVar}` UNDEFINED inside loop body).

---

## Phase 1 — Foundation (Core Model Rebuild)

> **Goal:** Replace the flat string-body model with a recursive node tree, fix cheap bugs,
> and make the app functionally equivalent to the old version with the new model.

### 1.1 Stable String IDs

- [✅] **B13 — Replace integer IDs with collision-resistant string IDs**
  - **What:** Node IDs must use `uid()` which generates strings like `t_a1b2c3d4` using `crypto.getRandomValues()` instead of `Date.now()` + incrementing integers.
  - **Why:** Integer IDs collide when workflows are imported from different machines or when multiple states are merged.
  - **Current state:** ✅ Implemented — `uid()` function exists and uses `crypto.getRandomValues()`.
  - **File:** `script.js` lines 70–75

### 1.2 Node Tree Model

- [✅] **Introduce recursive node tree (`state.nodes`)**
  - **What:** Replace the flat `state.tasks` array with `state.nodes`, where every container node owns slot arrays of child nodes. Node types: `task`, `if`, `loop`, `subagent`, `parallel`, `section`.
  - **Why:** Without a tree model, nesting (loop inside if, if inside loop) is impossible — bodies were just multi-line strings.
  - **Current state:** ✅ Implemented — `makeNode()`, `slotsOf()`, `getSlotArr()`, `findNode()`, `walk()` all exist.
  - **File:** `script.js` lines 80–208

### 1.3 Tree Helper Functions

- [✅] **Implement tree helpers: `findNode`, `removeNode`, `moveNode`, `walk`, `collectReferencableSteps`**
  - **What:** Pure helper functions that traverse the tree so the rest of the code never hand-walks it. Includes a cycle guard in `moveNode` to prevent dropping a container into its own descendant.
  - **Why:** All rendering, DnD, generation, and validation depend on these helpers.
  - **Current state:** ✅ Implemented.
  - **File:** `script.js` lines 129–208

### 1.4 Migration from Flat Model

- [✅] **B18 — Add schema version and migration from old flat model**
  - **What:** On `loadState()`, detect `state.schema < 2` and migrate old flat string-body tasks to the tree model. Each line of an old textarea becomes a `custom_task` node. Bump `STORAGE_KEY` to `..._v5`.
  - **Why:** Without migration, users lose all saved data when upgrading.
  - **Current state:** ✅ Implemented — `SCHEMA = 3`, `migrate()` function, `linesToNodes()` helper, `migrateOldActions()` all exist.
  - **File:** `script.js` lines 213–324

### 1.5 Schema-Driven Card Rendering

- [✅] **Per-type field schemas drive card rendering**
  - **What:** Each node type has its own card renderer (`taskFields`, `ifHead`, `loopHead`, `subagentHead`, `sectionHead`). Fields change reactively when the type changes (e.g., switching task action changes available fields).
  - **Why:** Eliminates duplicate render functions and makes adding new node types straightforward.
  - **Current state:** ✅ Implemented — each node type has its own head/fields renderer.
  - **File:** `script.js` lines 743–816

### 1.6 Bug Fixes (Phase 1)

- [✅] **B1 — Fix invalid CSS property**
  - **What:** `border-bottom-bottom-radius` is not a real CSS property.
  - **Current state:** ✅ The property no longer exists in the current CSS.

- [✅] **B3 — Give sections distinct icon colors**
  - **What:** `.icon-context` and `.icon-tasks` shared the same amber color.
  - **Current state:** ✅ `.icon-tasks` now uses `#ede9fe` (indigo), distinct from `.icon-context` amber.

- [✅] **B4 — Add distinct `md-h3` class for heading hierarchy**
  - **What:** `## ` and `### ` both mapped to class `md-h2`.
  - **Current state:** ✅ `.md-h3` class exists in CSS (line 320) and is used in `highlight()`.

- [✅] **B5 — Remove dead `contextOutput` change handler**
  - **What:** A `contextOutput` handler was registered inside the `taskList` change listener, but `#contextOutput` is not a child of `taskList`, so it never ran.
  - **Current state:** ✅ The dead branch has been removed.

- [✅] **B8 — Update README filenames and storage key references**
  - **What:** README referenced `styles.css` / `app.js` and storage key `_v3`.
  - **Current state:** ✅ Done — superseded by R3 (full README rewrite), which is also complete. (Earlier note here claiming R3 was "still open" was stale.)

- [✅] **B9 — Wrap placeholder in `escapeHtml()`**
  - **What:** `def.paramPlaceholder` was injected into HTML without escaping.
  - **Current state:** ✅ All user-facing values now use `attr()` or `escapeHtml()`.

---

## Phase 2 — Nesting & Rendering

> **Goal:** Enable true recursive nesting with drag-into-container, recursive output
> generation, and proper visual depth cues.

### 2.1 Recursive Rendering with Slots

- [✅] **Recursive `renderInto()` + `buildSlots()` + `dropZone()`**
  - **What:** `renderInto(arr, container, depth)` recurses through the tree. For container nodes, `buildSlots()` renders each slot (THEN, ELSE, BODY, BRANCH, etc.) as a nested drop-zone. Inline `+` buttons inside each slot allow adding nodes directly into containers.
  - **Why:** Without recursive rendering, nesting is impossible.
  - **Current state:** ✅ Fully implemented.
  - **File:** `script.js` lines 697–923

### 2.2 Drag-into-Container

- [✅] **B14 — Rewrite DnD to support dropping into containers**
  - **What:** `dragover`/`drop` resolve the target slot from `data-parent-id` + `data-slot`. `moveNode()` with cycle guard handles the actual move. Visual feedback via `.dz-over` class.
  - **Why:** Old DnD only worked within the flat root array.
  - **Current state:** ✅ Fully implemented.
  - **File:** `script.js` lines 1050–1100

### 2.3 Recursive Output Generation

- [✅] **B17 — Generate markdown/pseudo-code recursively with depth-based indentation**
  - **What:** `pseudoNode()` and `mdNode()` recurse through the tree. Numbering is hierarchical (`1`, `1.1`, `1.1.1`). Indentation increases with depth.
  - **Why:** Old generators used fixed 2-space indent regardless of nesting.
  - **Current state:** ✅ Fully implemented.
  - **File:** `script.js` lines 402–622

### 2.4 Collapse / Expand Containers

- [✅] **5.5 — Per-container collapse chevron**
  - **What:** Each container node has a `collapsed` flag. A ▸/▾ toggle button hides/shows the slot contents. The flag is stored on the node but not exported.
  - **Why:** Deep trees get very tall without collapse.
  - **Current state:** ✅ Implemented.
  - **File:** `script.js` line 1042

### 2.5 Bug Fixes (Phase 2)

- [✅] **B2 — Mobile sidebar toggle off-screen**
  - **What:** On mobile, when sidebar opens the toggle button moves to `left: sidebar-width + 20px` and goes off-screen.
  - **Current state:** ✅ Fixed — mobile breakpoint overrides to `left: auto; right: 16px`.

- [✅] **B12 — Remove "mutate last task to analyze" behavior**
  - **What:** Deleting the only task used to replace it with an `analyze` task instead of allowing an empty list.
  - **Current state:** ✅ The empty-state UI exists and the magic replacement is gone.

- [🔶] **B16 — Textarea max-height too small; no empty/invalid styling**
  - **What:** `.task-details-input` / branch textareas cap at `max-height:80px`. Inputs lack visible invalid state.
  - **Current state:** 🔶 `max-height` raised to 140px for details. Invalid state styling exists via `.invalid` class, but branch textareas still have limited sizing.

---

## Phase 3 — Sub-Agents & Control Flow

> **Goal:** Add sub-agent component, stable GOTO references, and loop control verbs.

### 3.1 Sub-Agent Node

- [✅] **Sub-agent container with parallel/sequential execution mode**
  - **What:** `subagent` node type with `agents[]` slot. Each agent has `role`, `task`, `agentic` flag, and `children[]` (its own nested steps). Execution mode toggle: Parallel ⇉ vs Sequential ▸. Can be nested inside loops.
  - **Why:** Enables "FOR EACH module → SPAWN a reviewer sub-agent" patterns.
  - **Current state:** ✅ Fully implemented.
  - **File:** `script.js` — `makeSubagent()`, `makeAgent()`, `subagentHead()`, `buildSlots()` subagent case

### 3.2 Stable Step References

- [✅] **B10 — Replace positional step references with ID-based references**
  - **What:** `GOTO` stores a `gotoRef` pointing to a node `id`. A `<select>` dropdown lists all referenceable steps with their live-computed position (e.g., "Step 3.2 — Deploy"). If the referenced node is deleted, shows `⚠ deleted`.
  - **Why:** Positional references silently break when steps are inserted/reordered/deleted.
  - **Current state:** ✅ Fully implemented — `collectReferencableSteps()`, `gotoTitle()`, `stepNumberOf()`.
  - **File:** `script.js` lines 177–201, 774–780

### 3.3 Loop Control Verbs

- [✅] **5.11 — `break` and `continue` task sub-types**
  - **What:** `break` and `continue` are available as task actions. They render as `BREAK` / `CONTINUE` in pseudo-code output. In Explicit mode they expand to unambiguous instructions.
  - **Why:** Real control flow requires break/continue.
  - **Current state:** ✅ Implemented — in `TASK_TYPES` array, `pseudoNode()`, `mdNode()`.
  - **File:** `script.js` lines 42–43, 464–469

---

## Phase 4 — Output, Polish & Features

> **Goal:** Add output modes, token estimate, validation, undo/redo, variables,
> dark mode, accessibility, and robust import.

### 4.1 Pseudo-code vs Markdown Toggle

- [✅] **Two output modes in the preview header**
  - **What:** Toggle between Pseudo-code (token-lean, agent-optimized) and Markdown (human-friendly). Both are generated recursively.
  - **Current state:** ✅ Implemented — `modeToggle`, `generatePseudo()`, `generateMarkdown()`.

### 4.2 Verbosity Toggle (Explicit vs Compact)

- [✅] **Agent-Clarity Mandate — two verbosity levels**
  - **What:** `Explicit` mode (default) expands every control word into an unmistakable instruction. `Compact` mode is terse and token-efficient. Example: `GOTO Step 3` → Explicit: `GO BACK TO and re-execute Step 3 ("title"). This is a loop-back, not a one-time jump.`
  - **Current state:** ✅ Implemented — `verbosityToggle`, `isExplicit()`, expanded output in `pseudoNode()`.

### 4.3 Token Estimate

- [✅] **5.6 — Rough token estimate in the preview**
  - **What:** Display `~N tok` badge (chars/4) that updates live with the preview.
  - **Current state:** ✅ Implemented — `tokenBadge`, line 661.

### 4.4 Validation

- [✅] **5.2 — Field validation + "incomplete" badge**
  - **What:** `collectIssues()` walks the tree checking for empty required fields, misused `break`/`continue` (outside loops), and missing GOTO targets. Results shown in `✓ complete` / `⚠ N incomplete` badge. Invalid cards are highlighted.
  - **Current state:** ✅ Implemented — `collectIssues()`, `validBadge`, `.invalid` class on cards.
  - **File:** `script.js` lines 635–677

### 4.5 Undo / Redo

- [✅] **5.4 — Bounded history stack**
  - **What:** Keep up to 60 serialized `state` snapshots. `Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y` to undo/redo. History is suppressed during programmatic restores to avoid duplicate entries.
  - **Current state:** ✅ Implemented — `history[]`, `histIndex`, `pushHistory()`, `undo()`, `redo()`.
  - **File:** `script.js` lines 235–245

### 4.6 Variables

- [✅] **5.1 — Variables panel with `${name}` interpolation**
  - **What:** Key/value list of variables. `${name}` is substituted in all emitted fields (target, details, condition, source, agent fields). Unknown variables are marked `${name:UNDEFINED}` so nothing is silently wrong.
  - **Why:** Pseudo-code is far more useful with named variables like `$repo`, `$modules`.
  - **Current state:** ✅ Implemented — `renderVariables()`, `varMap()`, `interp()`.
  - **File:** `script.js` lines 1140–1162, 351–385

### 4.7 Resources & Attachments

- [✅] **Resources panel with `@name` referencing**
  - **What:** Resource types: text, file, image, zip, link, other. Each has a name, kind, value, and optional note. `@name` references in fields are interpolated. Text resources are inlined at the top of the output. Images get inline thumbnails if < 200KB.
  - **Current state:** ✅ Implemented — `renderResources()`, `resourceSet()`, `resourcesPseudo()`, `resourcesMd()`.
  - **File:** `script.js` lines 1164–1230

### 4.8 Dark Mode

- [✅] **5.7 — Light/dark theme toggle**
  - **What:** `[data-theme="dark"]` CSS custom-property set overrides all colors. Toggle persists to localStorage. Theme icon switches between 🌙 and ☀️.
  - **Current state:** ✅ Implemented — `applyTheme()`, `themeToggle`, CSS `[data-theme="dark"]` block.
  - **File:** `style.css` lines 34–54, `script.js` lines 1324–1332

### 4.9 Export Formats

- [✅] **5.8 — Copy, Download (.txt/.md), Export JSON**
  - **What:** Copy to clipboard, download as text file (pseudo-code → .txt, markdown → .md), export the full tree as re-importable JSON.
  - **Current state:** ✅ Implemented — `btnCopy`, `btnDownload`, `btnExportJson`, `download()` helper.

### 4.10 Duplicate Node

- [✅] **5.9 — Deep-clone a node with fresh IDs**
  - **What:** `⧉ Duplicate` button deep-clones a node (with fresh IDs via `reId()`) and inserts it after the original in the same slot.
  - **Current state:** ✅ Implemented — `duplicateNode()`.
  - **File:** `script.js` lines 947–953

### 4.11 Workflow Save/Load/Import/Export

- [✅] **B7 — Robust workflow import with validation**
  - **What:** Save named workflows to localStorage. Export all as JSON. Import JSON file with validation (`validWorkflow()` checks `name:string` and `state.nodes:array`). Bad entries are skipped with a toast.
  - **Current state:** ✅ Implemented — sidebar with workflow list, `saveCurrentWorkflow()`, `loadWorkflow()`, `validWorkflow()`.

### 4.12 Bug Fixes (Phase 4)

- [✅] **B6 — Unknown type fallback**
  - **What:** When a task action is unknown, `TASK_TYPE_MAP` returns `undefined`. The code now falls back gracefully instead of silently using `TASK_TYPES[1]`.
  - **Current state:** ✅ `pseudoNode()` handles missing `TASK_TYPE_MAP` entries: `const t = TASK_TYPE_MAP[n.action] || { verb: n.action }`.

- [✅] **B11 — ARIA labels and accessibility**
  - **What:** Add `aria-label` to all icon buttons, `aria-live="polite"` to the toast and preview block, `role="group"` to toggles.
  - **Current state:** ✅ Most ARIA labels added. Some remain for keyboard reorder (see R5).

- [✅] **B15 — Debounce preview render**
  - **What:** Preview was re-rendered on every keystroke without debounce.
  - **Current state:** ✅ `updatePreview()` debounces at 110ms via `setTimeout`.

---

## Phase 5 — Finish the Rebuild (HIGH PRIORITY — Next Steps)

> **Goal:** Fix remaining gaps from the tree-model rebuild. These are small, high-value
> items with no model change required.

### 5.1 Visual Depth Cues for Nested Blocks

- [✅] **R1 — Add CSS rules for `depth-N` classes**
  - **What:** `buildCard()` adds classes `depth-0` through `depth-6` to `.task-card` elements, but **no CSS rules existed** for these classes. Deep trees had no progressive indentation or color cue.
  - **Action completed:**
    1. ✅ Added `.task-card.depth-0` through `.task-card.depth-6` CSS rules with:
       - Progressive left padding (`20px`, `24px`, `28px`, `32px`, `36px`, `40px`)
       - Tinted left border that changes color by depth (primary → border-strong → loop → if → sub → par → primary)
       - Subtle background tint shift per depth level using `color-mix()` for containers
    2. ✅ Container cards get stronger background tints at each depth
    3. ✅ Added a tiny colored indicator bar (`::before` pseudo-element) at the top of deeply nested cards (depth 2+)
    4. ✅ Works in both light and dark themes (uses CSS custom properties)
  - **Priority:** HIGH — directly impacts usability for complex prompts
  - **File:** `style.css` lines 267–363

### 5.2 README Corrections

- [✅] **R3 — Rewrite README with correct filenames, keys, and new features**
  - **What:** The old README referenced outdated filenames (`styles.css`, `app.js`) and storage key (`_v3`). It also didn't document the tree model, new node types, variables, resources, verbosity toggle, or validation.
  - **Action completed:**
    1. ✅ Fixed all filename references: `style.css` / `script.js`
    2. ✅ Fixed storage key: `prompt_generator_state_v5`
    3. ✅ Documented the tree node model and all 6 node types with a table
    4. ✅ Documented variables (`${name}`), resources (`@name`), verbosity toggle (Explicit/Compact)
    5. ✅ Documented validation badge, token estimate, and workflow import/export
    6. ✅ Updated the feature list with depth cues, Phase/Section, resources, and example output
    7. ✅ Updated the project structure table with all current files
    8. ✅ Added complete Task Actions reference table
    9. ✅ Added Data & Persistence section with all localStorage keys
    10. ✅ Added Example Output section showing pseudo-code in Explicit mode
  - **Priority:** HIGH — users and contributors need accurate documentation
  - **File:** `README.md`

### 5.3 break/continue Validation

- [✅] **R4 — Flag `break`/`continue` outside any loop**
  - **What:** `collectIssues()` flags `break`/`continue` nodes that have no `loop` ancestor. Invalid nodes get the `.invalid` class and are counted in the badge.
  - **Action completed:**
    1. ✅ Validation works correctly for deeply nested cases (break inside if inside loop)
    2. ✅ Added inline warning text `⚠ Must be inside a loop` on invalid break/continue cards in `taskFields()`
    3. ✅ Added tooltip (`title` attribute) on invalid cards in `renderPreviewNow()`
 4. ✅ Cards are visually highlighted with `.invalid` class (yellow border + shadow)
  - **Priority:** MEDIUM — functional and user-friendly
  - **File:** `script.js`

### 5.4 Starter Templates / Presets

- [✅] **R6 — Ship 4 built-in workflow templates (with full-state JSON)**
  - **What:** No starter templates exist. Users start from scratch every time. The plan calls for 3–4 built-in trees loadable from the sidebar (e.g., "Bug Triage", "Code Review", "Migration", "Full Project Setup").
  - **Action completed:**
    1. ✅ Designed 4 template trees as full-state JSON objects (including role, context, variables, resources, nodes):
       - **Bug Triage:** Role=QA Tester, steps=CLONE → ANALYZE → IF reproducible → DEBUG → IMPLEMENT → TEST → GATE → DEPLOY, ELSE → DOCUMENT
       - **Code Review:** Role=Code Reviewer, steps=CLONE → ANALYZE → FOR EACH file in PR → REVIEW → IF issues → DOCUMENT → GATE → DOCUMENT summary
       - **Migration:** Role=DevOps Engineer, phases=Research & Planning (SECTION) → GATE → Implementation & Testing (SECTION with LOOP max 3 cycles, IF tests pass) → DEPLOY
       - **Full Project Setup:** Role=Senior Software Engineer, 3 phases with richer sub-agents (domain, rationale, outputFile, isPrimary), RULES block, PACKAGE node, variables ($project, $repo), gates
    2. ✅ Added a "Templates" section to the sidebar (above saved workflows)
    3. ✅ Clicking a template loads the FULL state (role, context, variables, resources, nodes) — not just the steps tree
    4. ✅ Templates are hardcoded (not in localStorage) so they're always available
    5. ✅ Added `buildTemplateState()`, `BUILTIN_TEMPLATES[]`, `renderTemplateList()`, `loadTemplate()` functions
    6. ✅ Templates get fresh unique IDs via `reId()` on load (safe to modify without ID conflicts)
    7. ✅ `deepClone()` used to avoid mutating template originals
    8. ✅ Keyboard accessible (tabindex, Enter/Space key handlers, aria-label)
    9. ✅ Added CSS styling for template items (name, description, role badge, hover effects)
    10. ✅ Added sidebar section title and visual divider between templates and saved workflows
    11. ✅ **Full-state template save/load:** Templates now save/restore entire state (role, context, variables, resources, nodes, output mode, verbosity, etc.) using `Object.assign(defaultState(), ...)`
    12. ✅ **Templates as separate JSON files:** Created `/templates/` folder with individual JSON files:
        - `bug-triage.json`, `code-review.json`, `migration.json`, `full-project-setup.json`
        - Each file contains `name`, `desc`, and full `state` object — same format as the save-section export
    13. ✅ **Template export/import:** Added "💾 Export Template" and "📥 Import Template" buttons in the sidebar for saving/loading template JSON files
    14. ✅ **User templates in localStorage:** Added `TEMPLATES_KEY` for user-created templates that persist between sessions
  - **Priority:** MEDIUM — significantly improves first-use experience
  - **Files:** `script.js` (template data + sidebar section + load logic + export/import), `index.html` (templates container + buttons), `style.css` (template item styling), `templates/*.json`

---

## Phase 6 — Sections, Gates & Loop Enhancements

> **Goal:** Add PHASE/SECTION container, GATE (user-confirmation barrier), and
> loop-back/capped-repeat capabilities. This unlocks multi-phase prompts.

### 6.1 PHASE / SECTION Container Node

- [✅] **P1 / §13.1 — Add `section` container node (ALREADY EXISTS but needs output enhancement)**
  - **What:** The `section` node type already exists in the codebase with `title`, `goalNote`, `exitCriteria`, `collapsed`, and `children[]`. It renders as a card with inputs for title/goal/exit criteria, and its children are in a drop-zone. However, the pseudo-code and markdown generators need to fully leverage the phase structure.
  - **Current state:** ✅ Section node exists and works fully. GOTO can target sections (verified: `collectReferencableSteps()` includes sections, `gotoTitle()` resolves section titles, `stepNumberOf()` works for section IDs). Pseudo-code outputs `=== PHASE N: title ===` with goal and exit criteria. Markdown outputs heading hierarchy. Section numbering integrates cleanly with hierarchical walk.
  - **Completed:**
    1. ✅ GOTO can target a section ID (`collectReferencableSteps()` already includes sections at line 183–185)
    2. ✅ Section numbering integrates cleanly with the hierarchical walk
    3. ✅ Entry gate concept now handled by separate `gate` node type
  - **Priority:** HIGH — the keystone capability for multi-phase prompts
  - **File:** `script.js` — `makeSection()`, `slotsOf()`, `buildSlots()`, `pseudoNode()`, `mdNode()`

### 6.2 GATE Node (User-Confirmation Barrier)

- [✅] **P4 / §13.2 — Add `gate` leaf node**
  - **What:** A new node type that represents a mandatory user-confirmation checkpoint. The agent must stop and wait for explicit user approval before proceeding.
  - **Action completed:**
    1. ✅ **Factory:** `makeGate()` creates `{ id, type:'gate', prompt:'', onReject:'' }` (leaf node)
    2. ✅ **Render:** Distinctive card with `card-gate` CSS class, red accent styling (🛑 icon), `gate-prompt` and `gate-onreject` inputs
    3. ✅ **Pseudo-code output (Compact):** `N. GATE — <prompt>` with optional `If rejected:` line
    4. ✅ **Pseudo-code output (Explicit):** `>>> STOP. Wait for explicit user confirmation before continuing. Do NOT proceed past this point until the user replies. <<<` + `N. Confirm: <prompt>` + optional `If rejected: <onReject>`
    5. ✅ **Markdown output:** `- **N. GATE:** <prompt>` with optional `_If rejected:_` sub-item
    6. ✅ **Validation:** Empty `prompt` is flagged as incomplete in `collectIssues()`
    7. ✅ Added to `makeNode()`, `cardBody()`, `pseudoNode()`, `mdNode()`, `buildCard()`
    8. ✅ Added "🛑 Gate" button to the add-buttons bar in `index.html` and inline add bars
    9. ✅ Added to `collectReferencableSteps()` (gate nodes are valid GOTO targets)
    10. ✅ Added `gate` keyword to syntax highlighting
    11. ✅ Added CSS custom properties (`--gate-color`, `--gate-light`, `--gate-border`) in both light and dark themes
  - **Priority:** HIGH — critical for multi-phase agent workflows
  - **Files:** `script.js`, `index.html`, `style.css`

### 6.3 Capped Revision Loops

- [✅] **P9 / §13.8 — Add `maxIterations` field to loop + section-targetable GOTO**
  - **What:** Loops currently support `for_each`, `while`, and `repeat N times`, but have no "until satisfied, max N cycles" idiom. GOTO cannot currently target a section.
  - **Action completed:**
    1. ✅ **Added `maxIterations` field to `makeLoop()`:** `{ ..., maxIterations: '' }` — empty means unlimited
    2. ✅ **Added `exitCondition` field to `makeLoop()`:** `{ ..., exitCondition: '' }` — human-readable exit condition
    3. ✅ **Updated `loopHead()` renderer:** Shows "Max iterations" and "Exit condition" input fields (optional, always visible)
    4. ✅ **Updated pseudo-code output:**
       - Compact: `FOR EACH item IN src (until user satisfied, max 3):` or `(max 3)` or `(until condition)`
       - Explicit: `FOR EACH item IN src  (at most 3 cycles):` + `After each iteration, check: "user is satisfied". If the condition is met, exit the loop early and continue to the next step.`
    5. ✅ **Updated markdown output** with `(until …, max …)` suffixes on the loop heading
    6. ✅ **Verified GOTO targets sections:** `collectReferencableSteps()` already lists sections with label `Phase N — title`. `gotoTitle()` returns section title. `stepNumberOf()` resolves section position.
    7. ⚠️ **SCHEMA not bumped** — new fields default to empty strings, so old data loads fine without migration. No schema bump needed.
  - **Priority:** HIGH — essential for revision-cycle patterns
  - **Files:** `script.js`, `style.css`

---

## Phase 7 — Agent-Spec Primitives

> **Goal:** Add questionnaire (ASK), file output (PRODUCE FILE + PACKAGE), richer
> sub-agents, rules/conventions block, and memory directive. This unlocks the ability
> to produce real-world agent system-prompt specifications.

### 7.1 ASK Node (Questionnaire)

- [✅] **P3 / §13.3 — Add `ask` node type**
  - **What:** A node that instructs the agent to ask the user clarifying questions. Supports free-text and multiple-choice questions, optional "Other" and "Suggest default" flags. Optionally branches based on the answer.
  - **Action completed:**
    1. ✅ **Factory:** `makeAsk()` with `questions[]` (text, kind, options, allowOther, suggestDefault, saveTo) and `branches[]`
    2. ✅ **Added `ask` to `CONTAINER_TYPES`** — ask is always a container (branches array)
    3. ✅ **Card rendering:** `askHead()` with full question editing UI — text inputs, kind select, option list with +/✕, checkboxes, saveTo input, branching toggle
    4. ✅ **Pseudo-code output:** Both compact and explicit modes with enumerated questions, options, branching
    5. ✅ **Markdown output:** Formatted question list with options
    6. ✅ **Validation:** Empty questions flagged in `collectIssues()`
    7. ✅ **Event handling:** Full input/change/click handling for all question fields
    8. ✅ **CSS:** Purple accent (`--ask-color: #8b5cf6`), question rows with left border, option list styling
    9. ✅ **Added "❓ Ask" button** to the add-buttons bar and inline add bars
    10. ✅ **SCHEMA bumped to 4** with migration for new node types
  - **Priority:** MEDIUM — important for interactive agent prompts
  - **Files:** `script.js`, `index.html`, `style.css`

### 7.2 PRODUCE FILE Task Sub-type

- [✅] **P5 (partial) / §13.7 — Add `produce_file` task action**
  - **What:** A task sub-type that instructs the agent to create a specific file with a given path, format, and content outline. Supports `${var}` in filename.
  - **Action completed:**
    1. ✅ Added to `TASK_TYPES`: `{ value:'produce_file', label:'📄 Produce File', verb:'PRODUCE FILE', ph: 'docs/plan/${project}_plan.md' }`
    2. ✅ Added `contentOutline` field to `makeTask()` — multiline textarea shown when action is `produce_file`
    3. ✅ Pseudo-code (Compact): `N. PRODUCE FILE <path>` with content outline as comment
    4. ✅ Pseudo-code (Explicit): `CREATE the file "<path>" with the following content outline: <outline>. Ensure the file is complete and follows the format specified.`
    5. ✅ Markdown: `**N. PRODUCE FILE:** \`<path>\`` with outline as sub-bullets
    6. ✅ Updated `taskFields()` to show target input + contentOutline textarea when action is `produce_file`
    7. ✅ Added `PRODUCE FILE` to `highlight()` keyword regex
    8. ✅ Added `contentOutline` to `migrateSchema5()` migration
  - **Priority:** MEDIUM — needed for file-output prompts
  - **Files:** `script.js`

### 7.3 PACKAGE Node (Deliverable)

- [✅] **P5 (partial) / §13.6 — Add `package` node type**
  - **What:** A node that declares a deliverable archive (zip) with an exact folder tree structure. The agent must bundle all produced files into this archive.
  - **Action completed:**
    1. ✅ **Factory:** `makePackage()` with `archiveName`, `tree`, `filesNote`, `collapsed`
    2. ✅ **Leaf node:** Not in `CONTAINER_TYPES`; leaf-only like gate
    3. ✅ **Card rendering:** `packageHead()` with archive name input (supports `${var}`), monospace tree textarea, note field
    4. ✅ **Pseudo-code output:** Both compact (`PACKAGE → name { tree }`) and explicit modes
    5. ✅ **Markdown output:** Formatted tree in a code block
    6. ✅ **Validation:** Empty archiveName flagged in `collectIssues()`
    7. ✅ **CSS:** Orange accent (`--pkg-color: #ea580c`), monospace tree textarea
    8. ✅ **Added "📦 Package" button** to the add-buttons bar and inline add bars
  - **Priority:** MEDIUM — needed for deliverable-oriented prompts
  - **Files:** `script.js`, `index.html`, `style.css`

### 7.4 Richer Sub-Agent Specifications

- [✅] **P7 / §13.8 — Extend agent object with domain, rationale, outputFile, isPrimary**
  - **What:** Currently each sub-agent only has `role`, `task`, and `agentic` flag. Real agent prompts need more: research domain, why this agent matters, output filename pattern, and whether it's the primary/architect agent.
  - **Action completed:**
    1. ✅ **Extended `makeAgent()`** with `domain`, `rationale`, `outputFile`, `isPrimary` fields
    2. ✅ **Updated `buildSlots()` subagent case** to show new fields: domain input, rationale input, output file pattern input, primary agent checkbox
    3. ✅ **Primary enforcement:** When `isPrimary` is checked, all other agents in the same subagent are unchecked
    4. ✅ **Updated pseudo-code output** to include domain, rationale, outputFile, isPrimary in both compact and explicit modes
    5. ✅ **Updated markdown output** similarly
    6. ✅ **SCHEMA bumped to 4** with `migrateSchema4()` that adds new fields to old agents
  - **Priority:** MEDIUM — significantly improves sub-agent prompt quality
  - **Files:** `script.js`, `style.css`

### 7.5 RULES Block (Conventions / Constraints)

- [✅] **P8 / §13.7 — Add `rules` task action**
  - **What:** A titled list of free-text rules/conventions that the agent must follow (e.g., "Filenames hyphen-separated", "Conventional Commits, ≤100 chars", "OGF.md never edited"). Emitted verbatim as a `RULES:` block.
  - **Action completed:**
    1. ✅ **Added `rules` to `TASK_TYPES`:** `{ value:'rules', label:'📜 Rules / Conventions', verb:'RULES', ph: 'Naming conventions, commit format…' }`
    2. ✅ **Added `rulesList` field** to `makeTask()` — multiline textarea shown when action is `rules`
    3. ✅ **Added `rules` to `NO_TARGET` set** (no target field for rules)
    4. ✅ **Pseudo-code (Compact):** `N. RULES:` then bullet list of rules
    5. ✅ **Pseudo-code (Explicit):** `N. RULES — The following conventions are mandatory and must be followed without exception:` then numbered list
    6. ✅ **Markdown:** `**N. RULES:**` then numbered list of rules
    7. ✅ **Added `RULES` keyword** to `highlight()` regex
    8. ✅ **SCHEMA bumped to 4** with `migrateSchema4()` that adds `rulesList` to old tasks
  - **Priority:** MEDIUM — needed for output-contract prompts
  - **Files:** `script.js`

### 7.6 Memory Directive

- [✅] **P6 — Add prompt-level memory directive**
  - **What:** A toggle + filename field at the prompt level that tells the agent to save this prompt as a file and re-read it on every request. Emitted as a top-of-prompt `MEMORY:` rule.
  - **Action completed:**
    1. ✅ Added to `defaultState()`: `memoryDirective: false, memoryFile: 'AGENT_PROMPT.md'`
    2. ✅ Added UI to the Context card: checkbox "Save & re-read prompt as file" + filename input (`.memory-field` with toggle)
    3. ✅ Pseudo-code output (if enabled): `MEMORY: Save this entire prompt as "<memoryFile>" and re-read it at the start of every new request. Never discard or summarize it.`
    4. ✅ Markdown output: `## Memory Directive` section with same instruction
    5. ✅ Updated `generatePseudo()` / `generateMarkdown()` with MEMORY line
    6. ✅ Wired checkbox and input in top-level listeners + `updateAllUI()`
    7. ✅ Added CSS for `.memory-field` with conditional display
    8. ✅ SCHEMA bumped to 5
  - **Priority:** MEDIUM — useful for persistent agent prompts
  - **Files:** `script.js`, `index.html`, `style.css`

### 7.7 Additional Task Sub-types

- [✅] **§13.7 — Add PLAN, LOG, SPLIT, VALIDATE, SYNTHESIZE, COMMIT task actions**
  - **What:** These are leaf "directive" nodes implemented as new `action` values on the existing `task` node. Each has a tailored field and Explicit-mode output.
  - **Action completed:**

    | Action | Verb | Placeholder | Explicit Output |
    |--------|------|-------------|-----------------|
    | `plan` | PLAN | `docs/${project}_plan.md` | `CREATE a plan document "<target>" with the next sequential Task-ID (continue from the highest existing).` |
    | `log` | LOG | `docs/worklog.md` | `WRITE a worklog "<target>" recording: start/end time, actions taken, problems + resolutions, files changed, test results, deviations.` |
    | `split` | SPLIT | `criteria for splitting…` | `If this task is too large, SPLIT it into smaller sub-tasks, record them in the plan, and do not write code yet — report the breakdown to the user.` |
    | `validate` | VALIDATE | `npm test` | `Run the tests ("<target>"). If ANY test fails: do NOT mark this step complete — report the failures to the user and wait. Only continue when all tests pass or the user explicitly overrides.` |
    | `synthesize` | SYNTHESIZE | `reports from sub-agents` | `READ the listed reports and MERGE them into one consolidated document "<target>", resolving conflicts and noting trade-offs.` |
    | `commit` | COMMIT | `type(scope): subject` | `PROVIDE (do not run) a Conventional-Commits message: "type(scope): subject" (≤100 chars) plus a ≤350-char body. Do not run git commit unless the user explicitly asks.` |

    1. ✅ Added each to `TASK_TYPES` array with appropriate label, verb, and placeholder
    2. ✅ Added Explicit-mode expansions in `pseudoNode()` for each
    3. ✅ Added Markdown expansions in `mdNode()` for each
    4. ✅ Added all verbs to `highlight()` keyword regex
  - **Priority:** MEDIUM — individually small, collectively useful
  - **Files:** `script.js`

---

## Phase 8 — Modes, Routes & Polish

> **Goal:** Add modes/commands with flags, ROUTE dispatch node, keyboard accessibility,
> and final polish. This enables multi-mode agent specifications.

### 8.1 MODE + FLAG (Top-Level)

- [✅] **P2 / §13.5 — Add multi-mode support**
  - **What:** Named entry points (e.g., `/plan`, `/dev`, `/suggest`, `/analyse`), each owning its own node tree and optional flags/parameters (e.g., `--bulk`, `--no-subagent`).
  - **Action completed:**
    1. ✅ **Model change:** Added `state.modes = [{ id, name:'/default', summary, flags:[{name, desc}], nodes:[] }]` alongside `state.nodes`; `state.nodes` and `modes[0].nodes` share the same reference when multi-mode is off
    2. ✅ **Progressive disclosure:** When only 1 default mode exists with no flags, the Modes card is collapsed and shows an "Enable multi-mode" button. Full mode tabs and editing UI are revealed only when multi-mode is enabled.
    3. ✅ **UI:** Mode tab-bar in the Modes card; clicking a tab switches the active mode and re-renders the task list with that mode's nodes. Active tab is highlighted.
    4. ✅ **Mode editing:** Each mode has name, summary, and flags list (each with name + description inputs). Add/Remove flag and Add/Remove mode buttons.
    5. ✅ **Pseudo-code output:** `MODE: /name — summary` then `Flag: --flag: description` for each flag, then `STEPS` and the mode's tree. Single default mode output is unchanged (backward compatible).
    6. ✅ **Markdown output:** `## Mode: /name — summary` then flags list, then task tree for each mode.
    7. ✅ **SCHEMA bumped to 6** with `migrateSchema6()` that moves `state.nodes` to `state.modes[0].nodes` for backward compatibility
    8. ✅ **Helper functions:** `getActiveModeNodes()`, `getActiveMode()`, `isSingleDefaultMode()`, `defaultMode()`
    9. ✅ All tree operations (add, remove, move, find, walk, etc.) use `getActiveModeNodes()` when multi-mode is enabled
    10. ✅ Validation validates all modes' nodes when multi-mode is enabled
    11. ✅ CSS: `.mode-tab`, `.mode-tab.active`, `.mode-edit-fields`, `.mode-flag-row`, `.modes-collapsed`
  - **Priority:** MEDIUM — needed for multi-mode agent specs
  - **Files:** `script.js`, `index.html`, `style.css`

### 8.2 ROUTE Node (Intent Dispatch)

- [✅] **§13.4 — Add `route` container node**
  - **What:** A labeled multi-branch switch that dispatches based on user intent or request type. Essentially a typed IF with named cases.
  - **Action completed:**
    1. ✅ **Factory:** `makeRoute()` creates `{ id, type:'route', on:'user intent', cases:[{label, match, children}], defaultCase:[], collapsed:false }`
    2. ✅ **Added `'route'` to `CONTAINER_TYPES`**
    3. ✅ **Slots:** One per case (`case:0`, `case:1`, …) + `default` slot; updated `slotsOf()` and `getSlotArr()` to handle route type
    4. ✅ **Card rendering:** `routeHead()` renders "🔀 Route — Intent Dispatch" label, "Dispatch based on" input, list of cases with label + match pattern inputs, "+ Add Case" button
    5. ✅ **buildSlots()** creates case blocks with drop zones and a default "Otherwise" block
    6. ✅ **Pseudo-code (Compact):** `N. ROUTE on <on>:` then `case "<label>" →` for each case + `default →`
    7. ✅ **Pseudo-code (Explicit):** `DECIDE based on <on>:` then `If the request matches "<label>" ("<match>"):` for each case + `Otherwise:`
    8. ✅ **Markdown output:** `**N. ROUTE** on \`<on>\`:` then each case as sub-item with children
    9. ✅ **Added `ROUTE` and `DECIDE` keywords** to `highlight()` regex
    10. ✅ **CSS:** Indigo accent (`--route-color: #6366f1`, `--route-light: #eef2ff`, `--route-border: #a5b4fc`), `.card-route`, `.label-route`, `.branch-route`, dark theme variants
    11. ✅ **Added "🔀 Route" button** to the add-buttons bar and inline add bars
    12. ✅ **Validation:** Route must have at least 1 case; each case should have a label; `on` field should not be empty
    13. ✅ **Event handling:** Input handlers for `case_label` and `case_match` fields; click handlers for `addCase` and `removeCase`
    14. ✅ **Migration:** `migrateSchema6Nodes()` ensures route nodes have `cases`, `defaultCase`, and `on` fields
  - **Priority:** MEDIUM — cleanly models request-type dispatching
  - **Files:** `script.js`, `index.html`, `style.css`

### 8.3 Keyboard Accessibility for Reorder

- [✅] **R5 — Add keyboard reorder (Alt+↑/↓)**
  - **What:** The drag handle is mouse-only. Users cannot reorder cards with the keyboard.
  - **Action completed:**
    1. ✅ Made drag handle focusable with `tabindex="0"`
    2. ✅ Added `Alt+↑/↓` keydown handler on taskList: moves the focused card up/down within its slot
    3. ✅ Added `aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"` to the handle
    4. ✅ Added visual focus ring on the handle when focused (`.drag-handle:focus`)
    5. ✅ After move, refocuses the drag handle on the new card position
  - **Priority:** MEDIUM — accessibility compliance
  - **Files:** `script.js`, `style.css`

### 8.4 Table Content Node (Optional)

- [✅] **P10 — Add `table` content node for markdown output**
  - **What:** A node that renders as a markdown table in the output. Useful for request-type tables and flag tables.
  - **Action completed:**
    1. ✅ **Factory:** `makeTable()` creates `{ id, type:'table', caption:'', headers:['Column 1', 'Column 2'], rows:[['', '']], collapsed: false }`
    2. ✅ **Render:** Editable table with caption, per-column header inputs, per-cell inputs, +/− row/column buttons
    3. ✅ **Markdown output:** Standard markdown table syntax with `|` separators and `---` header divider
    4. ✅ **Pseudo-code output:** Compact: `N. TABLE: <caption> (<rows>x<cols>)`; Explicit: structured row list
    5. ✅ **CSS:** Green accent (`--tbl-color: #059669`), `.card-table`, `.tbl-edit` table styles
    6. ✅ Added "📊 Table" button to the add-buttons bar and inline add bars
    7. ✅ Added to `LEAF_TYPES`, `makeNode()`, `cardBody()`, `collectReferencableSteps()`, `gotoTitle()`, `reId()`
    8. ✅ Validation: table must have at least 1 header
    9. ✅ Event handling: full input/change/click for header, cell, add/remove column/row
  - **Priority:** MEDIUM — useful for structured data in agent prompts
  - **Files:** `script.js`, `index.html`, `style.css`

---

## Summary: Priority-Ordered Action List

| Priority | Item | Phase | Effort | Status |
|----------|------|-------|--------|--------|
| 🔴 P0 | R1 — CSS depth cues for nested blocks | 5 | Small | ✅ |
| 🔴 P0 | R3 — README rewrite | 5 | Medium | ✅ |
| 🟠 P1 | GATE node | 6 | Medium | ✅ |
| 🟠 P1 | Capped revision loops (maxIterations) | 6 | Small | ✅ |
| 🟠 P1 | Section GOTO targetability (verify) | 6 | Small | ✅ |
| 🟡 P2 | R6 — Starter templates | 5 | Medium | ✅ |
| 🟡 P2 | R4 — break/continue validation UX | 5 | Small | ✅ |
| 🟡 P2 | ASK node (questionnaire) | 7 | Large | ✅ |
| 🟡 P2 | PRODUCE FILE task sub-type | 7 | Small | ✅ |
| 🟡 P2 | PACKAGE node (deliverable) | 7 | Medium | ✅ |
| 🟡 P2 | Richer sub-agent specs | 7 | Medium | ✅ |
| 🟡 P2 | RULES block | 7 | Small | ✅ |
| 🟢 P3 | Memory directive | 7 | Small | ✅ |
| 🟢 P3 | Additional task sub-types (PLAN, LOG, etc.) | 7 | Medium | ✅ |
| 🟢 P3 | R5 — Keyboard reorder (Alt+↑/↓) | 8 | Small | ✅ |
| 🟢 P3 | Table content node | 8 | Medium | ✅ |
| 🔵 P4 | MODE + FLAG support | 8 | Large | ✅ |
| 🔵 P4 | ROUTE node | 8 | Medium | ✅ |

---

## Phase 10 — UX & Architecture (found 2026-05-30, user review)

> All five items below were verified against the current `script.js` before planning.
> Recommended order: **P10-1 (quick bug) → P10-3 → P10-2 → P10-4 → P10-5 (big refactor, last)**.
> Do the architecture split (P10-5) LAST so the feature work doesn't have to be re-merged.

### P10-1 — Disabling multi-mode doesn't collapse the panel when the active mode isn't `/default`

- [✅] **BUG-MM — "Disable multi-mode" leaves the panel expanded** — FIXED 2026-05-30
  - **VERIFIED:** The output is correct (generators only check `state.multiModeEnabled`), but the
    *panel* uses `isSingleDefaultMode()` (script.js ~L421) to decide whether to collapse to the
    minimal UI, and that function requires `m.name === '/default'`:
    ```js
    function isSingleDefaultMode() {
        if (!state.modes || state.modes.length !== 1) return false;
        const m = state.modes[0];
        return m.name === '/default' && !(m.flags && m.flags.length) && !state.multiModeEnabled;
    }
    ```
    Repro: add a mode (e.g. `/plan`), make it active, click "↩ Disable multi-mode". `disableMultiMode()`
    sets `state.modes = [active]` (named `/plan`) and `multiModeEnabled = false`, so the name check
    fails → `renderModes()` keeps the expanded panel even though multi-mode is off.
  - **Fix options (pick one):**
    1. Decouple the panel from the name: `isSingleDefaultMode()` should return `!state.multiModeEnabled`
       (when multi-mode is off, always show the collapsed UI regardless of the single mode's name). This
       is the cleanest — the name is irrelevant once multi-mode is off.
    2. In `disableMultiMode()`, rename the surviving mode back to `/default` (loses the user's name; worse).
  - **Recommendation:** Option 1. Also re-check `renderModes()` early-return so the collapsed branch
    fires purely on `!state.multiModeEnabled`.
  - **Priority:** HIGH (small) · **Files:** `script.js` (`isSingleDefaultMode`, maybe `renderModes`)

### P10-2 — Task types are near-identical; add per-type fields + a `none` target option

- [⬜] **TASK-1 — Add a `none` option to the File/Folder target-type toggle**
  - **VERIFIED:** `HAS_TARGET_TYPE = { create, update, delete, rename }` and the card renders only two
    buttons (📄 File / 📁 Folder, script.js ~L1538). `getVerb()` always appends ` FILE`/` FOLDER`.
  - **What:** Add a third option **🚫 None** so e.g. `create` emits just `CREATE <target>` with no
    FILE/FOLDER suffix. Store `targetType: 'none'`; `getVerb()` skips the suffix when `'none'`.
  - **Files:** `script.js` (`makeTask` default, target-type button group, `getVerb`, `TARGET_TYPE_PH`).
- [⬜] **TASK-2 — Audit & differentiate task types (per-type fields)**
  - **VERIFIED:** All ~30 entries in `TASK_TYPES` share one shape (`target` + `details`); only the
    directive sub-types (plan/log/split/validate/synthesize/commit/produce_file/rules/goto) special-case
    their output. Many tasks would benefit from type-specific fields/placeholders.
  - **What:** Define an optional per-type field schema (e.g. `clone` → branch/depth; `test` →
    framework/scope; `deploy` → target env; `commit` → type+scope+subject; `review` → checklist).
    Drive the card body and the generator from this schema instead of one generic `target/details` pair.
  - **Approach:** Add a `fields:[…]` descriptor to each `TASK_TYPES` entry (default = the current
    target+details), render dynamically in the task card, read in the generators. Keep back-compat by
    treating missing `fields` as the current behaviour.
  - **Priority:** MEDIUM (medium–large) · **Files:** `script.js` (TASK_TYPES, task card render, generators).

### P10-3 — `plan` task should support "plan then execute", not only "create a plan file"

- [✅] **TASK-3 — Plan task: add a "plan & execute" mode** — DONE 2026-05-30 (file / plan_then_do / inline; settings-overridable; verified)
  - **VERIFIED:** `plan` explicit output is hard-coded to *create a plan document* only
    (script.js: `CREATE a plan document "…" with the next sequential Task-ID…`). There's no option to
    say "produce a plan and then carry it out."
  - **What:** Add a per-node choice on the `plan` task — e.g. `planMode: 'file' | 'plan_then_do' | 'inline'`:
    - `file` (current): write the plan to the target file.
    - `plan_then_do`: "First lay out a step-by-step plan, then execute it in order, updating the plan as you go."
    - `inline`: present the plan to the user and wait (no file).
  - Wire the three variants into both pseudo + Markdown explicit/compact, and make the wording overridable
    via `DEFAULT_SETTINGS` (`verbs`/a new `plan` settings group) so it fits the Phase-9 settings system.
  - **Priority:** MEDIUM (small–medium) · **Files:** `script.js` (makeTask, plan card UI, generators, settings).

### P10-4 — Allow nesting children inside any task (and other leaf nodes)

- [⬜] **NEST-1 — Let leaf nodes (task, gate, package, table) contain sub-nodes**
  - **VERIFIED:** `slotsOf()` returns child slots only for containers
    (`section/if/loop/subagent/parallel/ask/route`); `task` and the other leaves return `[]`, so the card
    shows no drop-zone / "+ Task" bar. `LEAF_TYPES = ['task','gate','package','table']`.
  - **What:** Give `task` (priority) an optional `children: []` slot so a user can, e.g., create a
    "CREATE FILE" task and nest sub-tasks under it. Render the drop-zone + inline-add bar on the task card,
    and have the generators recurse into `node.children` (indented sub-steps with `N.x` numbering, like
    sections do).
  - **Design decisions to settle first:**
    - Output semantics: are nested children "sub-steps of this task" (numbered `N.1, N.2…`) — recommended —
      or a separate concept? Pick numbered sub-steps for consistency with `section`.
    - Migration: add `children: []` in `makeTask`; treat missing as empty (back-compat).
    - Scope: start with `task`; optionally extend to `gate`/`package`/`table` afterwards.
  - **Touch points:** `slotsOf` (add `{key:'children', …}` for task), `makeTask`, task-card render
    (drop-zone), `pseudoNode`/`mdNode` task branch (recurse + number), validation, drag-drop, `reId`/clone.
  - **Priority:** MEDIUM (medium) · **Files:** `script.js`.

### P10-5 — Split the single `script.js` into smaller modules (~3–4 files)

- [⬜] **ARCH-1 — Modularize `script.js` (currently one ~3,150-line IIFE)**
  - **VERIFIED:** Everything lives in one IIFE in `script.js`. It loads via a single
    `<script src="script.js">` (no bundler, no `type="module"` today).
  - **Proposed split (ES modules — simplest given no build step):**
    1. `js/data.js` — static data + config: `TASK_TYPES`, `HAS_TARGET_TYPE`, `TARGET_TYPE_PH`,
       `LOOP_TYPES`, `CONTAINER_TYPES`, `LEAF_TYPES`, `DEFAULT_SETTINGS`, storage-key constants.
    2. `js/state.js` — state model + persistence: `defaultState`, `loadState`/`saveState`,
       `loadSettings`/`saveSettings`, `getSetting`/`fill`, migrations, history (undo/redo), node factories
       (`makeTask`…), tree helpers (`findNode`, `slotsOf`, `reId`, `deepClone`).
    3. `js/generate.js` — pure generators: `generatePseudo`, `generateMarkdown`, `pseudoNode`, `mdNode`,
       `headerLines`, `getVerb`, `interp`, token estimate, validation (`collectIssues`).
    4. `js/ui.js` — DOM rendering + event wiring: task cards, modes panel, settings modal, sidebar,
       toolbar, drag-drop, keyboard shortcuts, boot sequence.
    - Then `index.html`: `<script type="module" src="js/main.js">` where `main.js` imports the others.
  - **Constraints / risks:**
    - The generators are the most testable seam — moving them to `js/generate.js` as pure functions of
      `(state, settings)` makes the jsdom harness simpler. Watch the closure access to `state`/`getSetting`
      (pass them in or keep a small shared module).
    - ES modules need to be served over http (the repo already deploys via GitHub Pages — fine; `file://`
      won't load modules, so note it for local dev / the jsdom harness).
    - No behaviour change — this is a pure refactor; lock current output with snapshot tests BEFORE moving
      code, then assert byte-identical output after.
  - **Priority:** MEDIUM (large) · **Do LAST.** · **Files:** new `js/*.js`, `index.html`, `script.js` (removed).

### Phase 10 Summary

| Priority | Item | # | Effort | Status |
|----------|------|---|--------|--------|
| 🟠 P1 | BUG-MM — Disable multi-mode doesn't collapse panel | 10.1 | Small | ✅ |
| 🟡 P2 | TASK-3 — Plan task "plan & execute" mode | 10.3 | Small-Med | ✅ |
| 🟡 P2 | TASK-1 — `none` target-type option | 10.2 | Small | ⬜ |
| 🟡 P2 | TASK-2 — Per-type task fields audit | 10.2 | Med-Large | ⬜ |
| 🟡 P2 | NEST-1 — Nest sub-nodes inside tasks | 10.4 | Medium | ⬜ |
| 🟢 P3 | ARCH-1 — Split script.js into modules | 10.5 | Large | ⬜ |

---

## Completed Items (for reference)

| Item | Phase | Status |
|------|-------|--------|
| B13 — Stable string IDs | 1 | ✅ |
| Node tree model | 1 | ✅ |
| Tree helper functions | 1 | ✅ |
| B18 — Schema migration | 1 | ✅ |
| Schema-driven card rendering | 1 | ✅ |
| B1, B3, B4, B5, B8, B9 — Bug fixes | 1 | ✅ |
| Recursive rendering with slots | 2 | ✅ |
| B14 — Drag-into-container | 2 | ✅ |
| B17 — Recursive output generation | 2 | ✅ |
| Collapse/expand containers | 2 | ✅ |
| B2, B12 — Bug fixes | 2 | ✅ |
| Sub-agent node | 3 | ✅ |
| B10 — Stable step references | 3 | ✅ |
| Break/continue task sub-types | 3 | ✅ |
| Pseudo-code vs Markdown toggle | 4 | ✅ |
| Explicit vs Compact verbosity | 4 | ✅ |
| Token estimate | 4 | ✅ |
| Validation badges | 4 | ✅ |
| Undo/redo | 4 | ✅ |
| Variables with interpolation | 4 | ✅ |
| Resources/attachments | 4 | ✅ |
| Dark mode | 4 | ✅ |
| Export formats | 4 | ✅ |
| Duplicate node | 4 | ✅ |
| Workflow save/load/import/export | 4 | ✅ |
| B6, B11, B15 — Bug fixes | 4 | ✅ |
| Section/Phase container | 4 | ✅ |
| R1 — CSS depth cues for nested blocks | 5 | ✅ |
| R3 — README rewrite | 5 | ✅ |
| GATE node (user-confirmation barrier) | 6 | ✅ |
| Capped revision loops (maxIterations + exitCondition) | 6 | ✅ |
| Section GOTO targetability (verified) | 6 | ✅ |

---

## Phase 9 — Bug Fixes, Compact/Explicit Expansion & Settings System

> **Goal:** Fix reported bugs, expand Compact/Explicit verbosity to ALL output sections (not just steps),
> and build a comprehensive Settings system that allows users to customize every hardcoded default text
> in the output, with global import/export.

### 9.1 BUG: Multi-mode Cannot Be Disabled

- [✅] **BUG-M1 — Add "Disable multi-mode" button**
  - **What:** When multi-mode is enabled via the "🔀 Enable multi-mode" button, `state.multiModeEnabled` is set to `true`. There is no UI to set it back to `false`. Users who accidentally enable multi-mode or want to revert must reset the entire state.
  - **Root cause:** `btnEnableMultiMode` only sets `state.multiModeEnabled = true`. No "Disable" button exists in `renderModes()`.
  - **Fix completed:**
    1. ✅ Added "↩ Disable multi-mode" button (`btnDisableMultiMode`) at the bottom of the mode edit area in `renderModes()`
    2. ✅ When clicked with only 1 mode: sets `state.multiModeEnabled = false`, syncs `state.nodes = state.modes[0].nodes`, re-renders
    3. ✅ When clicked with multiple modes: shows a confirm dialog warning that only the active mode will be kept, then removes all other modes, disables multi-mode
    4. ✅ After disabling, the Modes card collapses back to the "Enable multi-mode" button state
    5. ✅ Added standalone `disableMultiMode()` function for reuse
    6. ✅ Added CSS styling for `.btn-disable-multimode` (neutral gray with red hover)
  - **Priority:** HIGH — broken UX
  - **Files:** `script.js`, `style.css`

### 9.2 BUG: Focus Loss When Typing in Mode Summary

- [✅] **BUG-M2 — Fix focus loss in mode name/summary inputs**
  - **What:** When typing in the mode Name or Summary input fields, the `input` event handler calls `renderModes()` which re-renders the entire `modeEditArea.innerHTML`. This destroys and recreates the DOM elements, causing the text input to lose focus after every keystroke.
  - **Root cause:** In `renderModes()`, the `input` handler for `[data-modefield]` elements calls `renderModes()` after every keystroke, which rebuilds the entire edit area DOM.
  - **Fix completed:**
    1. ✅ Removed `renderModes()` call from the `[data-modefield]` input handler — now only calls `updatePreview()`, `saveState()`, and directly updates the active tab text without DOM rebuild
    2. ✅ The `[data-flagfield]` input handler was already correct (no `renderModes()` call), confirmed unchanged
    3. ✅ Structural changes (add/remove flag, add/remove mode, switch mode) still call `renderModes()` as expected
    4. ✅ Mode tab text updates live when name field changes (direct DOM update: `activeTab.textContent = e.target.value`)
  - **Priority:** HIGH — broken UX, makes mode editing impossible
  - **Files:** `script.js`

### 9.3 BUG: Fields That Don't Affect Output

- [🔶] **BUG-F1 — Sub-agent `agentic` checkbox: done in pseudo, MISSING in markdown**
  - **VERIFIED 2026-05-30:** `pseudoNode()` **does** emit `(agentic)` after the agent name (both Compact and Explicit). However `mdNode()`'s subagent branch never reads `a.agentic`, so it is absent from Markdown output. Previously recorded as ⬜ (not done at all) — that was stale.
  - **Remaining fix (Markdown only):**
    - Add `_agentic_` label on the agent line in `mdNode()`.
    - Optional: in Explicit pseudo, expand to a full sentence rather than just `(agentic)`.
  - **Priority:** MEDIUM — parity between the two output modes
  - **Files:** `script.js` — `mdNode()` subagent branch

- [❌] **BUG-F2 — Sub-agent `verbose` is a fully dead field (not rendered AND not output)**
  - **VERIFIED 2026-05-30:** Worse than previously recorded. `makeAgent()` stores `verbose: false`, but `buildSlots()` renders **no `verbose` checkbox** for agents (only `agentic` and `isPrimary` are rendered — grep `data-field="verbose"` returns nothing). The field is also read by neither `pseudoNode()` nor `mdNode()`. So users can never set it and it never affects output. The earlier claim that "the checkbox is rendered and stored" is incorrect.
  - **Fix (two parts):**
    1. **UI:** Add a `verbose` checkbox to the agent block in `buildSlots()` (next to `agentic`).
    2. **Output:** Read `a.verbose` in both `pseudoNode()` and `mdNode()` (e.g. `(verbose)` tag / Explicit sentence / `_verbose_` label).
    - Alternatively, if `verbose` is not wanted, remove it from `makeAgent()` to avoid a dangling field.
  - **Priority:** MEDIUM — dead field; decide to wire-up or remove
  - **Files:** `script.js`

- [🔶] **BUG-F3 — ASK `suggestDefault`: done in pseudo Explicit, MISSING in Compact + Markdown**
  - **VERIFIED 2026-05-30:** `pseudoNode()` Explicit branch **does** emit "Suggest best-practice default." for `q.suggestDefault`. However it is **omitted in pseudo Compact**, and `mdNode()`'s ask branch never reads `q.suggestDefault`. Previously recorded as ⬜ — stale.
  - **Remaining fix:**
    - **Pseudo Compact:** add a `(suggest default)` marker after the question.
    - **Markdown:** add a note line when `q.suggestDefault`.
  - **Priority:** LOW — minor but inconsistent across modes
  - **Files:** `script.js` — `pseudoNode()` (compact ask), `mdNode()` (ask)

- [⬜] **BUG-F4 — Audit ALL input fields for output coverage**
  - **What:** Ensure every single input field that is rendered in the editor actually affects the generated output in BOTH pseudo-code AND markdown modes.
  - **Full audit checklist:**

    | Component | Field | Pseudo-code | Markdown | Status |
    |-----------|-------|-------------|----------|--------|
    | Role | roleSelectValue | ✅ | ✅ | OK |
    | Role | customRole | ✅ | ✅ | OK |
    | Role | agentic | ✅ | ✅ | OK |
    | Role | subagent | ✅ | ✅ | OK |
    | Role | verbose | ✅ | ✅ | OK |
    | Role | strict | ✅ | ✅ | OK |
    | Context | contextProject | ✅ | ✅ | OK |
    | Context | contextTech | ✅ | ✅ | OK |
    | Context | contextConstraints | ✅ | ✅ | OK |
    | Context | contextOutput | ✅ | ✅ | OK |
    | Memory | memoryDirective | ✅ | ✅ | OK |
    | Memory | memoryFile | ✅ | ✅ | OK |
    | Mode | name | ✅ | ✅ | OK |
    | Mode | summary | ✅ | ✅ | OK |
    | Mode | flag.name | ✅ | ✅ | OK |
    | Mode | flag.desc | ✅ | ✅ | OK |
    | Variable | name/value | ✅ | ✅ | OK |
    | Resource | name/kind/value/note | ✅ | ✅ | OK |
    | Task | action | ✅ | ✅ | OK |
    | Task | target | ✅ | ✅ | OK |
    | Task | details | ✅ | ✅ (only pseudo uses `//`) | OK |
    | Task | targetType | ✅ | ✅ | OK |
    | Task | rulesList | ✅ | ✅ | OK |
    | Task | contentOutline | ✅ | ✅ | OK |
    | Task | gotoRef | ✅ | ✅ | OK |
    | If | condition | ✅ | ✅ | OK |
    | Loop | loopType/source/itemVar | ✅ | ✅ | OK |
    | Loop | maxIterations | ✅ | ✅ | OK |
    | Loop | exitCondition | ✅ | ✅ | OK |
    | Gate | prompt | ✅ | ✅ | OK |
    | Gate | onReject | ✅ | ✅ | OK |
    | Section | title/goalNote/exitCriteria | ✅ | ✅ | OK |
    | Sub-agent | execMode | ✅ | ✅ | OK |
    | Sub-agent | agent.role | ✅ | ✅ | OK |
    | Sub-agent | agent.task | ✅ | ✅ | OK |
    | Sub-agent | agent.agentic | ✅ | ❌ NOT in MD | **FIX MD (BUG-F1)** |
    | Sub-agent | agent.verbose | ❌ + not rendered | ❌ | **DEAD FIELD (BUG-F2)** |
    | Sub-agent | agent.domain | ✅ | ✅ | OK |
    | Sub-agent | agent.rationale | ✅ | ✅ | OK |
    | Sub-agent | agent.outputFile | ✅ | ✅ | OK |
    | Sub-agent | agent.isPrimary | ✅ | ✅ | OK |
    | Ask | oneMessage | ✅ | ✅ | OK |
    | Ask | q.text | ✅ | ✅ | OK |
    | Ask | q.kind | ✅ | ✅ | OK |
    | Ask | q.options | ✅ | ✅ | OK |
    | Ask | q.allowOther | ✅ | ✅ | OK |
    | Ask | q.suggestDefault | ✅ Explicit / ❌ Compact | ❌ | **PARTIAL (BUG-F3)** |
    | Ask | q.saveTo | ✅ | ✅ | OK |
    | Package | archiveName/tree/filesNote | ✅ | ✅ | OK |
    | Table | caption/headers/rows | ✅ | ✅ | OK |
    | Route | on | ✅ | ✅ | OK |
    | Route | case.label/match | ✅ | ✅ | OK |

  - **Priority:** MEDIUM — completeness and user trust
  - **Files:** `script.js`

- [❌] **BUG-F5 — IF / ELSE-IF / ELSE branches collide on step numbers (NEW, found 2026-05-30)**
  - **What:** In `pseudoNode()`/`mdNode()` for the `if` node, every branch (`then`, each `elseif`, `else`) is rendered with the **same** parent number passed to `slotPseudo()`/`slotMd()`. So the first child of THEN, of ELSE-IF, and of ELSE all get the **same** number. Verified output:
    ```
    1.2. IF tests pass:
      1.2.1. DEPLOY staging
       ELSE IF flaky:
      1.2.1. TEST retry      ← duplicate 1.2.1
       ELSE:
      1.2.1. DEBUG failures  ← duplicate 1.2.1
    ```
  - **Why it matters:** Confusing to read, and `stepNumberOf()` (used by GOTO references) cannot point unambiguously to a step inside a non-THEN branch. Note `route` does NOT have this bug — its cases get distinct numbers (`3.1`, `3.2`), so the two container types are inconsistent.
  - **Fix idea:** Give each branch a distinct sub-number (e.g. THEN=`num.1`, ELSE-IF #k=`num.(k+1)`, ELSE=last), matching how `route` numbers cases; or render branch labels with their own index. Apply in both `pseudoNode()` and `mdNode()`.
  - **Priority:** MEDIUM — correctness of numbering & references
  - **Files:** `script.js` — `pseudoNode()` if-branch, `mdNode()` if-branch

- [❌] **BUG-F6 — Loop `itemVar` renders as `${name:UNDEFINED}` inside the loop body (NEW, found 2026-05-30)**
  - **What:** A `for_each` loop declares `itemVar` (e.g. `mod`), but referencing `${mod}` in a child task's target/details runs through `interp()`/`varMap()`, which only knows global Variables. The loop variable is not in scope, so it emits `${mod:UNDEFINED}`. Verified output: `IMPLEMENT ${mod:UNDEFINED} feature`.
  - **Why it matters:** It is the natural way to use a loop variable, and the `UNDEFINED` marker makes a correct prompt look broken.
  - **Fix idea:** When recursing into a loop body, register the loop's `itemVar` as a known name for interpolation within that subtree (treat as defined; substitute literally, or leave `${mod}` un-marked). Thread a scope set through `pseudoNode`/`mdNode`/`interp`.
  - **Priority:** MEDIUM — common pattern, misleading output
  - **Files:** `script.js` — `interp()`, `varMap()`, loop recursion in `pseudoNode()`/`mdNode()`

### 9.4 FEATURE: Expand Compact/Explicit Verbosity to ALL Output Sections

- [⬜] **V1 — Compact/Explicit for Role header**
  - **What:** Currently the Role line is identical in both Compact and Explicit modes: `ROLE: <role> [caps]`. In Compact mode, it should be shorter; in Explicit mode, it should expand capabilities into full sentences.
  - **Current Compact:** `ROLE: Senior Software Engineer (full-stack, React/Node.js, writes production-grade code)  [agentic, verbose]`
  - **Desired Compact:** `ROLE: Senior Software Engineer [agentic, verbose]` (omit parenthetical detail)
  - **Desired Explicit:** `ROLE: You are a Senior Software Engineer (full-stack, React/Node.js, writes production-grade code). You operate in agentic mode — perform iterative, autonomous tasks. You must explain your reasoning (verbose mode).`
  - **Priority:** MEDIUM
  - **Files:** `script.js` — `generatePseudo()`, `generateMarkdown()`

- [⬜] **V2 — Compact/Explicit for Context & Constraints**
  - **What:** Currently the Context section outputs identically regardless of verbosity: `CONTEXT: project=X; stack=Y; rules=Z; output=W`.
  - **Desired Compact:** `CONTEXT: project=X; stack=Y; rules=Z; output=W` (current, keep as-is)
  - **Desired Explicit:**
    ```
    CONTEXT:
      Project: X
      Tech Stack: Y
      Constraints & Rules: Z
      Output Format: W
    ```
  - **Priority:** MEDIUM
  - **Files:** `script.js` — `generatePseudo()`, `generateMarkdown()`

- [⬜] **V3 — Compact/Explicit for Variables**
  - **What:** Currently `VARS: name=value; name2=value2` regardless of verbosity.
  - **Desired Compact:** `VARS: name=value; name2=value2` (current, keep as-is)
  - **Desired Explicit:**
    ```
    VARIABLES (use ${name} to reference in steps):
      name = value
      name2 = value2
    ```
  - **Priority:** LOW
  - **Files:** `script.js`

- [⬜] **V4 — Compact/Explicit for Resources**
  - **What:** Resources section is currently identical in both modes. In Explicit mode, text resources should be expanded with more context.
  - **Desired Compact:** Current output (brief `@name [kind] — value`)
  - **Desired Explicit:** Add explanation: "The following resources are available for reference. Use @name to refer to them in any step." + full inline text with line numbers
  - **Priority:** LOW
  - **Files:** `script.js` — `resourcesPseudo()`, `resourcesMd()`

- [⬜] **V5 — Compact/Explicit for Mode headers**
  - **What:** Mode headers currently output `MODE: /name — summary` then `Flag: --flag: desc` regardless of verbosity.
  - **Desired Compact:** `MODE: /name` (summary omitted, flags as `--flag` only, no descriptions)
  - **Desired Explicit:** Full `MODE: /name — summary` + expanded flag descriptions with usage guidance
  - **Priority:** LOW
  - **Files:** `script.js`

- [⬜] **V6 — Compact/Explicit for all node types in Markdown output**
  - **VERIFIED 2026-05-30:** Confirmed real — Markdown output is byte-identical in Explicit vs Compact for all structural/container nodes (IF, LOOP, SUBAGENT, PARALLEL, ROUTE, SECTION, GATE, ASK). Only the leaf "directive" task sub-types (PLAN/LOG/SPLIT/VALIDATE/SYNTHESIZE/COMMIT) add an extra Explicit bullet. So this item is correctly ⬜.
  - **What:** The Markdown output (`mdNode()`) currently has LIMITED compact/explicit variation. Most node types output identically in both modes. Need to add explicit expansions for:
    - **IF:** Explicit should add "Evaluate the condition and follow the matching branch" prose
    - **LOOP:** Explicit should add "Iterate through the collection" / "Repeat until condition is met" prose
    - **SUBAGENT:** Explicit should add "Spawn the following agents" prose with role descriptions
    - **PARALLEL:** Explicit should add "Execute the following branches concurrently" prose
    - **ROUTE:** Explicit should add "Analyze the user's request and route to the matching case" prose
    - **SECTION:** Explicit should add full goal/criteria explanations
    - **GATE:** Explicit should add full stop-and-wait instruction (currently only in pseudo-code)
    - **ASK:** Explicit should add "Before proceeding, ask the user the following questions" prose
  - **Priority:** MEDIUM — Markdown output is currently thin in Explicit mode
  - **Files:** `script.js` — `mdNode()`

### 9.5 FEATURE: Settings System (LARGE)

- [✅] **S1 — Design settings data model**
  - **What:** Create a `DEFAULT_SETTINGS` object that contains every customizable default string in the app. This is the single source of truth for all hardcoded output text. The user's custom settings override defaults.
  - **Model:**
    ```javascript
    const DEFAULT_SETTINGS = {
      // Role labels
      role: {
        label: 'ROLE',
        explicitPrefix: 'You are a ',
        explicitSuffix: '.',
        capsFormat: 'brackets', // 'brackets' | 'inline' | 'none'
      },
      // Gate output
      gate: {
        compactLabel: 'GATE',
        explicitStopWord: 'STOP',
        explicitInstruction: 'Wait for explicit user confirmation before continuing. Do NOT proceed past this point until the user replies.',
        confirmWord: 'Confirm',
        rejectWord: 'If rejected',
      },
      // Task verbs (customizable verb names)
      verbs: {
        clone: 'CLONE',
        analyze: 'ANALYZE',
        implement: 'IMPLEMENT',
        // ... all verbs
      },
      // Section labels
      section: {
        label: 'PHASE',
        goalLabel: 'Goal',
        exitLabel: 'Exit when',
      },
      // Loop labels
      loop: {
        forEachLabel: 'FOR EACH',
        whileLabel: 'WHILE',
        repeatLabel: 'REPEAT',
        inKeyword: 'IN',
        timesKeyword: 'TIMES',
        maxLabel: 'max',
        untilLabel: 'until',
      },
      // Sub-agent labels
      subagent: {
        spawnLabel: 'SPAWN sub-agents',
        agenticLabel: 'agentic',
        verboseLabel: 'verbose',
        primaryLabel: '⭐',
        rationaleLabel: 'Rationale',
        reportLabel: 'Report',
      },
      // ASK labels
      ask: {
        label: 'ASK USER',
        suggestDefaultLabel: 'suggest default',
        allowOtherLabel: 'or Other',
        saveToLabel: 'Save to',
      },
      // ROUTE labels
      route: {
        label: 'ROUTE',
        decideLabel: 'DECIDE based on',
        caseLabel: 'case',
        defaultLabel: 'Otherwise',
      },
      // Context labels
      context: {
        label: 'CONTEXT',
        projectLabel: 'project',
        stackLabel: 'stack',
        rulesLabel: 'rules',
        outputLabel: 'output',
      },
      // Resource labels
      resource: {
        label: 'RESOURCES',
        referenceNote: 'referenced below by @name',
      },
      // Mode labels
      mode: {
        label: 'MODE',
        flagLabel: 'Flag',
        stepsLabel: 'STEPS',
      },
      // Role presets (customizable full text for each role option)
      rolePresets: {
        'Senior Software Engineer': 'Senior Software Engineer (full-stack, React/Node.js, writes production-grade code)',
        'Code Reviewer': 'Code Reviewer (meticulous, checks security, performance & readability)',
        'DevOps Engineer': 'DevOps Engineer (CI/CD, Docker, AWS, infrastructure-as-code)',
        'Security Analyst': 'Security Analyst (finds vulnerabilities, OWASP top 10, threat modeling)',
        'QA Tester': 'QA Tester (automated testing, edge cases, regression suites)',
        'Technical Writer': 'Technical Writer (clear docs, tutorials, API references)',
        'Data Scientist': 'Data Scientist (ML pipelines, data cleaning, model evaluation)',
        'Product Manager': 'Product Manager (user stories, roadmapping, prioritization)',
        'Frontend Developer': 'Frontend Developer (React, Vue, CSS, responsive UI, accessibility)',
        'Backend Developer': 'Backend Developer (APIs, databases, auth, server-side logic)',
        'Full-Stack Developer': 'Full-Stack Developer (end-to-end, database to UI)',
        'Solutions Architect': 'Solutions Architect (system design, tech evaluation, scalability)',
        'Database Administrator': 'Database Administrator (schema, migrations, performance, replication)',
        'UX Designer': 'UX Designer (wireframes, prototypes, usability testing)',
        'API Designer': 'API Designer (RESTful, GraphQL, versioning, DX)',
        'Site Reliability Engineer': 'Site Reliability Engineer (uptime, SLOs, monitoring, alerting)',
      },
      // Memory directive
      memory: {
        label: 'MEMORY',
        instruction: 'Save this entire prompt as "{file}" and re-read it at the start of every new request. Never discard or summarize it.',
      },
      // Step numbering
      steps: {
        label: 'STEPS',
        emptyLabel: '(no steps)',
      },
    };
    ```
  - **State:** `state.settings = {}` — initially empty (all defaults from `DEFAULT_SETTINGS`). Only overridden keys are stored.
  - **Lookup:** `function getSetting(path)` — traverses dot-path like `'gate.explicitStopWord'`, returns `state.settings[path]` if set, else `DEFAULT_SETTINGS` value.
  - **Priority:** HIGH — foundation for the entire settings system
  - **Files:** `script.js`

- [⬜] **S2 — Build Settings Modal UI**
  - **What:** A modal/panel window accessible via a ⚙️ gear icon button (placed next to the theme toggle in the header, or in the sidebar footer). The modal shows ALL customizable settings organized by category (Role, Gate, Loop, Section, etc.), with input fields for each value.
  - **UI structure:**
    - Tabbed or accordion sections for each category
    - Each setting shows: label + current value input + "Reset to default" button
    - Search/filter to quickly find a setting
    - "Reset All to Defaults" button
    - "Import Settings" / "Export Settings" buttons
    - Changes apply live (preview updates in real-time)
  - **Modal behavior:**
    - Opens over the main layout as an overlay
    - Close via ✕ button or clicking outside
    - Changes are auto-saved to `state.settings` and persisted in localStorage
  - **Priority:** HIGH — core UI for settings
  - **Files:** `script.js`, `index.html`, `style.css`

- [⬜] **S3 — Connect settings to output generators**
  - **What:** Replace ALL hardcoded strings in `generatePseudo()`, `generateMarkdown()`, `pseudoNode()`, `mdNode()`, `resourcesPseudo()`, `resourcesMd()`, `headerLines()` with `getSetting()` calls.
  - **Examples:**
    - `ROLE:` → `getSetting('role.label') + ':'`
    - `GATE` → `getSetting('gate.compactLabel')`
    - `STOP` → `getSetting('gate.explicitStopWord')`
    - `Wait for explicit user confirmation...` → `getSetting('gate.explicitInstruction')`
    - `FOR EACH` → `getSetting('loop.forEachLabel')`
    - `SPAWN sub-agents` → `getSetting('subagent.spawnLabel')`
    - Role preset text → `getSetting('rolePresets.' + key)` or user's custom override
  - **Scope:** Every string in the output that is NOT user-entered data should be customizable via settings.
  - **Priority:** HIGH — makes settings actually functional
  - **Files:** `script.js`

- [⬜] **S4 — Role preset customization**
  - **What:** The Role `<select>` dropdown has hardcoded option values like `"Frontend Developer (React, Vue, CSS, responsive UI, accessibility)"`. Users want to change these to their own preferred text (e.g., `"Frontend Developer (CSS, JS, HTML)"`).
  - **Implementation:**
    1. The `DEFAULT_SETTINGS.rolePresets` object maps role key → default full text
    2. When a role is selected, `getEffectiveRole()` looks up `getSetting('rolePresets.' + roleKey)` and uses that text
    3. In the Settings modal, the Role section shows each preset with an editable text field
    4. Users can modify any preset's full text
    5. The `<select>` dropdown shows the short label (e.g., "Frontend Developer"), but the effective output uses the customizable full text
  - **Priority:** HIGH — explicitly requested by user
  - **Files:** `script.js`, `style.css`

- [⬜] **S5 — Settings import/export**
  - **What:** Add buttons in the Settings modal (and optionally in the sidebar) to:
    - **Export Settings:** Download `state.settings` as a JSON file (`settings-YYYY-MM-DD.json`)
    - **Import Settings:** Upload a JSON file and merge it into `state.settings`
    - **Reset All:** Clear `state.settings` entirely (revert to all defaults)
  - **Implementation:**
    1. Export: `JSON.stringify(state.settings, null, 2)` → download as file
    2. Import: Read file → parse JSON → validate structure → `Object.assign(state.settings, imported)` → save
    3. Reset: `state.settings = {}` → save → re-render
  - **Priority:** HIGH — explicitly requested by user
  - **Files:** `script.js`

- [✅] **S6 — Settings persistence and migration**
  - **What:** Settings should persist in localStorage alongside the main state. When the app loads, custom settings are merged with defaults.
  - **Storage key:** `prompt_generator_settings` (separate from main state for easier import/export)
  - **Migration:** If new settings keys are added in future versions, they automatically get default values from `DEFAULT_SETTINGS` without breaking old saves.
  - **Priority:** MEDIUM
  - **Files:** `script.js`

---

## Summary: Phase 9 Priority-Ordered Action List

| Priority | Item | Section | Effort | Status |
|----------|------|---------|--------|--------|
| 🔴 P0 | BUG-M1 — Multi-mode disable button | 9.1 | Small | ✅ |
| 🔴 P0 | BUG-M2 — Focus loss in mode Summary | 9.2 | Small | ✅ |
| 🟠 P1 | BUG-F1 — Sub-agent agentic now in pseudo + MD | 9.3 | Small | ✅ |
| 🟠 P1 | BUG-F2 — Sub-agent verbose now in output (UI checkbox TODO) | 9.3 | Small | 🔶 |
| 🟠 P1 | BUG-F3 — ASK suggestDefault now in all modes | 9.3 | Small | ✅ |
| 🟠 P1 | BUG-F4 — Full audit of all fields (table corrected) | 9.3 | Small | 🔶 |
| 🟠 P1 | BUG-F5 — IF/ELSE-IF/ELSE step-number collision (NEW) | 9.3 | Small | ❌ |
| 🟠 P1 | BUG-F6 — Loop itemVar shows UNDEFINED in body (NEW) | 9.3 | Small | ❌ |
| 🟠 P1 | S1 — Settings data model | 9.5 | Medium | ✅ |
| 🟠 P1 | S2 — Settings modal UI | 9.5 | Large | ✅ |
| 🟠 P1 | S3 — Connect settings to generators | 9.5 | Large | ✅ |
| 🟡 P2 | V1 — Compact/Explicit for Role | 9.4 | Small | ⬜ |
| 🟡 P2 | V2 — Compact/Explicit for Context | 9.4 | Small | ⬜ |
| 🟡 P2 | V6 — Compact/Explicit for all node types in MD | 9.4 | Medium | ⬜ |
| 🟡 P2 | S4 — Role preset customization | 9.5 | Medium | ⬜ |
| 🟡 P2 | S5 — Settings import/export | 9.5 | Medium | ⬜ |
| 🟢 P3 | V3 — Compact/Explicit for Variables | 9.4 | Small | ⬜ |
| 🟢 P3 | V4 — Compact/Explicit for Resources | 9.4 | Small | ⬜ |
| 🟢 P3 | V5 — Compact/Explicit for Mode headers | 9.4 | Small | ⬜ |
| 🟢 P3 | S6 — Settings persistence and migration | 9.5 | Small | ✅ |
