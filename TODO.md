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
  - **Current state:** 🔶 README has been partially updated but `R3` below is still open.

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

- [🔶] **R4 — Flag `break`/`continue` outside any loop**
  - **What:** `collectIssues()` already flags `break`/`continue` nodes that have no `loop` ancestor (see lines 642–643). The validation walk passes `inLoop` flag through recursion. Invalid nodes get the `.invalid` class and are counted in the badge.
  - **Current state:** 🔶 The validation logic exists and works. However, the **card highlighting** should be more prominent — currently just a yellow border, but could also show a warning icon or tooltip explaining *why* it's invalid (e.g., "break must be inside a loop").
  - **Action required:**
    1. Verify the validation works correctly for deeply nested cases (break inside if inside loop)
    2. Add a tooltip or inline warning text on invalid break/continue cards: "⚠ Must be inside a loop"
    3. Consider auto-hiding break/continue from the task type dropdown when not inside a loop, or showing them with a warning
  - **Priority:** MEDIUM — functional but could be more user-friendly
  - **File:** `script.js` lines 638–653

### 5.4 Starter Templates / Presets

- [❌] **R6 — Ship 3–4 built-in workflow templates**
  - **What:** No starter templates exist. Users start from scratch every time. The plan calls for 3–4 built-in trees loadable from the sidebar (e.g., "Bug Triage", "Code Review", "Migration", "Full Project Setup").
  - **Action required:**
    1. Design 3–4 template trees as JSON state objects:
       - **Bug Triage:** Role=QA Tester, steps=REPO CLONE → ANALYZE → IF reproducible → DEBUG → TEST → ELSE → DOCUMENT
       - **Code Review:** Role=Code Reviewer, steps=CLONE → ANALYZE → FOR EACH file in PR → REVIEW → IF issues → DOCUMENT → DEPLOY
       - **Migration:** Role=DevOps Engineer, steps=ANALYZE → RESEARCH → PLAN → IF approved → IMPLEMENT → TEST → DEPLOY → ELSE → REVISION LOOP (max 3)
       - **Full Project Setup:** Role=Senior Software Engineer, multi-phase with sub-agents
    2. Add a "Templates" section to the sidebar (above or below saved workflows)
    3. Clicking a template loads it as current state (with confirmation if unsaved changes exist)
    4. Templates are hardcoded (not in localStorage) so they're always available
  - **Priority:** MEDIUM — significantly improves first-use experience
  - **File:** `script.js` (add template data + sidebar section), `index.html` (add templates container), `style.css` (template item styling)

---

## Phase 6 — Sections, Gates & Loop Enhancements

> **Goal:** Add PHASE/SECTION container, GATE (user-confirmation barrier), and
> loop-back/capped-repeat capabilities. This unlocks multi-phase prompts.

### 6.1 PHASE / SECTION Container Node

- [❌] **P1 / §13.1 — Add `section` container node (ALREADY EXISTS but needs output enhancement)**
  - **What:** The `section` node type already exists in the codebase with `title`, `goalNote`, `exitCriteria`, `collapsed`, and `children[]`. It renders as a card with inputs for title/goal/exit criteria, and its children are in a drop-zone. However, the pseudo-code and markdown generators need to fully leverage the phase structure.
  - **Current state:** 🔶 Section node exists and works. Pseudo-code outputs `=== PHASE N: title ===` with goal and exit criteria. Markdown outputs heading hierarchy. This is largely done.
  - **Remaining work:**
    1. Ensure GOTO can target a section ID (extend `collectReferencableSteps()` to include sections — already partially done at line 183–185)
    2. Ensure section numbering integrates cleanly with the hierarchical walk
    3. Add an optional "entry gate" flag on sections (predecessor to the GATE node)
  - **Priority:** HIGH — the keystone capability for multi-phase prompts
  - **File:** `script.js` — `makeSection()`, `slotsOf()`, `buildSlots()`, `pseudoNode()`, `mdNode()`

### 6.2 GATE Node (User-Confirmation Barrier)

- [❌] **P4 / §13.2 — Add `gate` leaf node**
  - **What:** A new node type that represents a mandatory user-confirmation checkpoint. The agent must stop and wait for explicit user approval before proceeding.
  - **Action required:**
    1. **Factory:** `{ id, type:'gate', prompt:'Confirm to continue', onReject:'' }` (leaf node, not a container)
    2. **Render:** A distinctive card with:
       - A required text input: "What the user must confirm" (e.g., "Approve the project name before proceeding")
       - An optional text input: "If rejected…" (e.g., "Return to Phase 0 and re-ask")
       - Visual barrier styling (thick horizontal line, stop icon 🛑)
    3. **Pseudo-code output (Compact):** `N. GATE — <prompt>`
    4. **Pseudo-code output (Explicit):** `>>> STOP. Wait for explicit user confirmation before continuing. Do NOT proceed past this point until the user replies. <<< Confirm: <prompt>. If rejected: <onReject>.`
    5. **Markdown output:** `> **🛑 GATE:** <prompt>` with rejection note
    6. **Validation:** Empty `prompt` is flagged as incomplete
    7. **Add to `makeNode()`, `cardBody()`, `pseudoNode()`, `mdNode()`**
    8. **Add "🛑 Gate" button to the add-buttons bar**
  - **Priority:** HIGH — critical for multi-phase agent workflows
  - **Files:** `script.js`, `index.html`, `style.css`

### 6.3 Capped Revision Loops

- [❌] **P9 / §13.8 — Add `maxIterations` field to loop + section-targetable GOTO**
  - **What:** Loops currently support `for_each`, `while`, and `repeat N times`, but have no "until satisfied, max N cycles" idiom. GOTO cannot currently target a section.
  - **Action required:**
    1. **Add `maxIterations` field to `makeLoop()`:** `{ ..., maxIterations: '' }` — empty means unlimited
    2. **Add `exitCondition` field to `makeLoop()`:** `{ ..., exitCondition: '' }` — human-readable exit condition (e.g., "user is satisfied with the result")
    3. **Update `loopHead()` renderer:** Show maxIterations input (optional) and exitCondition input (optional, especially for `repeat` loops)
    4. **Update pseudo-code output:**
       - Compact: `REPEAT 3 TIMES (until user satisfied):`
       - Explicit: `REPEAT the following at most 3 times. After each iteration, check: "user is satisfied with the result". If the condition is met, exit the loop early and continue to the next step.`
    5. **Update markdown output similarly**
    6. **Extend GOTO to target sections:** `collectReferencableSteps()` already lists sections — verify the GOTO dropdown shows them and the output resolves to the section's current number + title
    7. **Bump SCHEMA to 4** and add migration for new loop fields
  - **Priority:** HIGH — essential for revision-cycle patterns
  - **Files:** `script.js`, `style.css`

---

## Phase 7 — Agent-Spec Primitives

> **Goal:** Add questionnaire (ASK), file output (PRODUCE FILE + PACKAGE), richer
> sub-agents, rules/conventions block, and memory directive. This unlocks the ability
> to produce real-world agent system-prompt specifications.

### 7.1 ASK Node (Questionnaire)

- [❌] **P3 / §13.3 — Add `ask` node type**
  - **What:** A node that instructs the agent to ask the user clarifying questions. Supports free-text and multiple-choice questions, optional "Other" and "Suggest default" flags. Optionally branches based on the answer.
  - **Action required:**
    1. **Factory:**
       ```js
       { id, type:'ask', oneMessage:true,
         questions: [
           { id, text:'', kind:'choice', options:[], allowOther:true, suggestDefault:false, saveTo:'' }
         ],
         branches: [] // optional: one child-array per question option (like IF's elseifs)
       }
       ```
    2. **Render:** Card with:
       - Toggle: "Ask all in one message" (default on)
       - List of questions, each with:
         - Text input: the question
         - Kind select: Free text / Multiple choice
         - If choice: editable option list with + / ✕ buttons
         - Checkboxes: "Allow 'Other'" and "Suggest best practice"
         - `saveTo` input: variable name to store the answer (ties to `${var}` interpolation)
       - Optional branching UI (if enabled: one slot per option)
    3. **Pseudo-code (Compact):** `N. ASK USER: <questions>`
    4. **Pseudo-code (Explicit):** `ASK THE USER the following question(s) in a SINGLE message and WAIT for their answer:` then enumerated questions with options
    5. **Markdown:** Formatted question list with options as bullet points
    6. **Add `ask` to `CONTAINER_TYPES` if branching is enabled, otherwise it's a leaf**
    7. **Add "❓ Ask" button to the add-buttons bar**
  - **Priority:** MEDIUM — important for interactive agent prompts
  - **Files:** `script.js`, `index.html`, `style.css`

### 7.2 PRODUCE FILE Task Sub-type

- [❌] **P5 (partial) / §13.7 — Add `produce_file` task action**
  - **What:** A task sub-type that instructs the agent to create a specific file with a given path, format, and content outline. Supports `${var}` in filename.
  - **Action required:**
    1. **Add to `TASK_TYPES`:**
       ```js
       { value:'produce_file', label:'📄 Produce File', verb:'PRODUCE FILE',
         ph: 'docs/plan/${project}_plan.md' }
       ```
    2. **Add `contentOutline` field to task node** (only shown for `produce_file` action): a textarea for the file's expected content structure
    3. **Pseudo-code (Compact):** `N. PRODUCE FILE <path>`
    4. **Pseudo-code (Explicit):** `CREATE the file "<path>" with the following content outline: <outline>. Ensure the file is complete and follows the format specified.`
    5. **Markdown:** `- **N. PRODUCE FILE:** \`<path>\`` with outline as sub-bullets
    6. **Update `taskFields()`** to show contentOutline textarea when action is `produce_file`
  - **Priority:** MEDIUM — needed for file-output prompts
  - **Files:** `script.js`

### 7.3 PACKAGE Node (Deliverable)

- [❌] **P5 (partial) / §13.6 — Add `package` node type**
  - **What:** A node that declares a deliverable archive (zip) with an exact folder tree structure. The agent must bundle all produced files into this archive.
  - **Action required:**
    1. **Factory:** `{ id, type:'package', archiveName:'project_${var}.zip', tree:'', filesNote:'', collapsed:false }`
    2. **Render:** Card with:
       - Archive name input (supports `${var}`)
       - Multiline monospace textarea for the folder tree layout (e.g., `docs/plan/research/`, `src/`)
       - Optional note field
    3. **Pseudo-code (Compact):** `N. PACKAGE → <archiveName> { <tree> }`
    4. **Pseudo-code (Explicit):** `Collect the files listed below and bundle them into a single archive named "<archiveName>", reproducing EXACTLY this folder structure:` then fenced code block with the tree
    5. **Markdown:** Formatted tree in a code block with archive name as heading
    6. **Add to `makeNode()`, `cardBody()`, `pseudoNode()`, `mdNode()`**
    7. **Add "📦 Package" button to the add-buttons bar**
  - **Priority:** MEDIUM — needed for deliverable-oriented prompts
  - **Files:** `script.js`, `index.html`, `style.css`

### 7.4 Richer Sub-Agent Specifications

- [❌] **P7 / §13.8 — Extend agent object with domain, rationale, outputFile, isPrimary**
  - **What:** Currently each sub-agent only has `role`, `task`, and `agentic` flag. Real agent prompts need more: research domain, why this agent matters, output filename pattern, and whether it's the primary/architect agent.
  - **Action required:**
    1. **Extend `makeAgent()`:**
       ```js
       { id, role:'', task:'', agentic:true, verbose:false,
         domain:'',           // e.g., "Security analysis"
         rationale:'',        // e.g., "Ensures OWASP top-10 coverage"
         outputFile:'',       // e.g., "${project}_${role}_report.md"
         isPrimary:false,     // marks the lead/architect agent
         children:[] }
       ```
    2. **Update `buildSlots()` subagent case** to show new fields:
       - Domain input (optional)
       - Rationale input (optional)
       - Output file pattern input (optional, supports `${var}`)
       - Primary agent checkbox (only one can be primary)
    3. **Update pseudo-code output** to include domain and rationale:
       - Compact: `- agent "<role>" → <task>`
       - Explicit: `- Agent "<role>" (domain: <domain>): <task>. Rationale: <rationale>. Write report to: <outputFile>.`
    4. **Update markdown output similarly**
    5. **Bump SCHEMA to 4** and migrate old agent objects (fill new fields with defaults)
  - **Priority:** MEDIUM — significantly improves sub-agent prompt quality
  - **Files:** `script.js`, `style.css`

### 7.5 RULES Block (Conventions / Constraints)

- [❌] **P8 / §13.7 — Add `rules` task action or container**
  - **What:** A titled list of free-text rules/conventions that the agent must follow (e.g., "Filenames hyphen-separated", "Conventional Commits, ≤100 chars", "OGF.md never edited"). Emitted verbatim as a `RULES:` block.
  - **Action required:**
    1. **Add to `TASK_TYPES`:**
       ```js
       { value:'rules', label:'📜 Rules / Conventions', verb:'RULES', ph: 'Naming conventions, commit format…' }
       ```
    2. **Add `rulesList` field to task node** (multiline textarea, only shown for `rules` action): one rule per line
    3. **Pseudo-code (Compact):** `N. RULES:\n  - rule1\n  - rule2`
    4. **Pseudo-code (Explicit):** `RULES — The following conventions are mandatory and must be followed without exception:\n  1. rule1\n  2. rule2`
    5. **Markdown:** `**N. RULES:**` then numbered list of rules
    6. **Update `taskFields()`** to show rulesList textarea when action is `rules`
  - **Priority:** MEDIUM — needed for output-contract prompts
  - **Files:** `script.js`

### 7.6 Memory Directive

- [❌] **P6 — Add prompt-level memory directive**
  - **What:** A toggle + filename field at the prompt level that tells the agent to save this prompt as a file and re-read it on every request. Emitted as a top-of-prompt `MEMORY:` rule.
  - **Action required:**
    1. **Add to `defaultState()`:** `memoryDirective: false, memoryFile: 'AGENT_PROMPT.md'`
    2. **Add UI to the Context card:** checkbox "Save & re-read prompt as file" + filename input
    3. **Pseudo-code output (if enabled):** `MEMORY: Save this entire prompt as "<memoryFile>" and re-read it at the start of every new request. Never discard or summarize it.`
    4. **Markdown output:** Same as a top-level note
    5. **Update `headerLines()` / `generatePseudo()` / `generateMarkdown()`**
    6. **Bump SCHEMA to 4**
  - **Priority:** LOW — useful but not blocking
  - **Files:** `script.js`, `index.html`, `style.css`

### 7.7 Additional Task Sub-types

- [❌] **§13.7 — Add PLAN, LOG, SPLIT, VALIDATE, SYNTHESIZE, COMMIT task actions**
  - **What:** These are leaf "directive" nodes implemented as new `action` values on the existing `task` node. Each has a tailored field and Explicit-mode output.
  - **Action required (for each):**

    | Action | Verb | Placeholder | Explicit Output |
    |--------|------|-------------|-----------------|
    | `plan` | PLAN | `docs/${project}_plan.md` | `CREATE a plan document "<target>" with the next sequential Task-ID (continue from the highest existing).` |
    | `log` | LOG | `docs/worklog.md` | `WRITE a worklog "<target>" recording: start/end time, actions taken, problems + resolutions, files changed, test results, deviations.` |
    | `split` | SPLIT | `criteria for splitting…` | `If this task is too large, SPLIT it into smaller sub-tasks, record them in the plan, and do not write code yet — report the breakdown to the user.` |
    | `validate` | VALIDATE | `npm test` | `Run the tests ("<target>"). If ANY test fails: do NOT mark this step complete — report the failures to the user and wait. Only continue when all tests pass or the user explicitly overrides.` |
    | `synthesize` | SYNTHESIZE | `reports from sub-agents` | `READ the listed reports and MERGE them into one consolidated document "<target>", resolving conflicts and noting trade-offs.` |
    | `commit` | COMMIT | `type(scope): subject` | `PROVIDE (do not run) a Conventional-Commits message: "type(scope): subject" (≤100 chars) plus a ≤350-char body. Do not run git commit unless the user explicitly asks.` |

    1. Add each to `TASK_TYPES` array with appropriate label, verb, and placeholder
    2. Mark them in `NO_TARGET` set or handle specially as needed
    3. Add Explicit-mode expansions in `pseudoNode()` for each
    4. Add Markdown expansions in `mdNode()` for each
  - **Priority:** LOW — individually small, collectively useful
  - **Files:** `script.js`

---

## Phase 8 — Modes, Routes & Polish

> **Goal:** Add modes/commands with flags, ROUTE dispatch node, keyboard accessibility,
> and final polish. This enables multi-mode agent specifications.

### 8.1 MODE + FLAG (Top-Level)

- [❌] **P2 / §13.5 — Add multi-mode support**
  - **What:** Named entry points (e.g., `/plan`, `/dev`, `/suggest`, `/analyse`), each owning its own node tree and optional flags/parameters (e.g., `--bulk`, `--no-subagent`).
  - **Action required:**
    1. **Model change:** Add `state.modes = [{ id, name:'/plan', summary:'', flags:[{name:'--bulk', desc:''}], nodes:[] }]` alongside or replacing the single `state.nodes`
    2. **Keep a default single mode** for simple use; reveal mode tabs only when >1 mode exists (progressive disclosure)
    3. **UI:** Mode tab-bar above the step list; clicking a tab swaps the rendered tree
    4. **Add/Edit Mode dialog:** Name, summary, flags list (each with name + description)
    5. **Output:** `## MODE: /name — <summary>` then `Flags: --bulk: <desc>`, then the mode's tree
    6. **Flags are referenceable** inside IF conditions (e.g., `IF flag --no-subagent is set`)
    7. **Bump SCHEMA to 4 or 5**
  - **Priority:** MEDIUM — needed for multi-mode agent specs
  - **Files:** `script.js`, `index.html`, `style.css`

### 8.2 ROUTE Node (Intent Dispatch)

- [❌] **§13.4 — Add `route` container node**
  - **What:** A labeled multi-branch switch that dispatches based on user intent or request type. Essentially a typed IF with named cases.
  - **Action required:**
    1. **Factory:**
       ```js
       { id, type:'route', on:'user intent',
         cases: [ { label:'', match:'', children:[] } ],
         default: [],
         collapsed: false }
       ```
    2. **Slots:** One per case + `default` (like IF's elseifs + else)
    3. **Render:** Card with:
       - "Dispatch based on" input
       - List of cases, each with label + match pattern + slot for children
       - "Otherwise" default slot
       - + Add Case / ✕ Remove Case buttons
    4. **Pseudo-code (Compact):** `N. ROUTE on <on>:\n  case "<label>" → …\n  default → …`
    5. **Pseudo-code (Explicit):** `DECIDE based on <on>:\n  If the request is "<label>" (<match>): …\n  Otherwise: …`
    6. **Add to `CONTAINER_TYPES`, `makeNode()`, `slotsOf()`, `getSlotArr()`, `buildSlots()`, `pseudoNode()`, `mdNode()`**
    7. **Add "🔀 Route" button to the add-buttons bar**
  - **Priority:** MEDIUM — cleanly models request-type dispatching
  - **Files:** `script.js`, `index.html`, `style.css`

### 8.3 Keyboard Accessibility for Reorder

- [❌] **R5 — Add keyboard reorder (Alt+↑/↓)**
  - **What:** The drag handle is mouse-only. Users cannot reorder cards with the keyboard.
  - **Action required:**
    1. **Make drag handle focusable:** Add `tabindex="0"` to `.drag-handle`
    2. **Add `Alt+↑/↓` keydown handler** on the drag handle: moves the focused card up/down within its slot
    3. **Add `aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"`** to the handle
    4. **Add visual focus ring** on the handle when focused
    5. **Test:** Navigate to a card via Tab, use Alt+↑/↓ to reorder
  - **Priority:** MEDIUM — accessibility compliance
  - **Files:** `script.js`, `style.css`

### 8.4 Table Content Node (Optional)

- [❌] **P10 — Add `table` content node for markdown output**
  - **What:** A node that renders as a markdown table in the output. Useful for request-type tables and flag tables.
  - **Action required:**
    1. **Factory:** `{ id, type:'table', caption:'', headers:[''], rows:[['']] }`
    2. **Render:** Editable table with caption, add/remove rows/columns
    3. **Markdown output:** Standard markdown table syntax
    4. **Pseudo-code output:** Rendered as a structured list (agents read lists fine)
  - **Priority:** LOW — agents read lists fine without tables
  - **Files:** `script.js`, `index.html`, `style.css`

---

## Summary: Priority-Ordered Action List

| Priority | Item | Phase | Effort | Status |
|----------|------|-------|--------|--------|
| 🔴 P0 | R1 — CSS depth cues for nested blocks | 5 | Small | ✅ |
| 🔴 P0 | R3 — README rewrite | 5 | Medium | ✅ |
| 🟠 P1 | GATE node | 6 | Medium | ❌ |
| 🟠 P1 | Capped revision loops (maxIterations) | 6 | Small | ❌ |
| 🟠 P1 | Section GOTO targetability (verify) | 6 | Small | 🔶 |
| 🟡 P2 | R6 — Starter templates | 5 | Medium | ❌ |
| 🟡 P2 | R4 — break/continue validation UX | 5 | Small | 🔶 |
| 🟡 P2 | ASK node (questionnaire) | 7 | Large | ❌ |
| 🟡 P2 | PRODUCE FILE task sub-type | 7 | Small | ❌ |
| 🟡 P2 | PACKAGE node (deliverable) | 7 | Medium | ❌ |
| 🟡 P2 | Richer sub-agent specs | 7 | Medium | ❌ |
| 🟡 P2 | RULES block | 7 | Small | ❌ |
| 🟢 P3 | Memory directive | 7 | Small | ❌ |
| 🟢 P3 | Additional task sub-types (PLAN, LOG, etc.) | 7 | Medium | ❌ |
| 🟢 P3 | MODE + FLAG support | 8 | Large | ❌ |
| 🟢 P3 | ROUTE node | 8 | Medium | ❌ |
| 🟢 P3 | R5 — Keyboard reorder (Alt+↑/↓) | 8 | Small | ❌ |
| ⚪ P4 | Table content node | 8 | Medium | ❌ |

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
