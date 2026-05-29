# PromptGenerator — Rebuild & Enhancement Plan

> Goal: turn the current flat prompt builder into a **visual pseudo-code editor** that
> produces token-efficient, agent-readable prompts. The final tool must let a user
> visually compose nested control flow (tasks, conditionals, loops, sub-agents) and
> export a clean, unambiguous instruction set for an AI agent.
>
> Constraint: everything stays in **three files** — `index.html`, `style.css`, `script.js`.
> No build step, no dependencies, no backend.

---

## 0. The Core Problem (read this first)

The single biggest blocker behind requests #3, #4, and #6 is the **data model**.

Today, control-flow bodies are stored as **plain multi-line strings**:

```js
// current model — bodies are just text
{ id, type:'if',   condition:'', thenSteps:'<string>', elseIfs:[{condition,steps:'<string>'}], elseSteps:'<string>' }
{ id, type:'loop', loopType:'for_each', loopSource:'', loopVar:'item', loopBody:'<string>' }
```

You cannot put a real `Loop` *inside* an `If`, or an `If` *inside* a `Loop`, because a
body is text, not a list of components. Every advanced feature you asked for requires
replacing this with a **recursive tree of nodes**:

```js
// target model — bodies are arrays of child nodes (recursive)
{
  id: 'n_ab12',          // stable, unique, never reused
  type: 'task',          // 'task' | 'if' | 'loop' | 'subagent' | 'parallel'
  // ...type-specific fields...
  children: [ <node>, <node>, ... ]   // present on container types
}
```

A node is referenced by its **stable `id`**, never by its position. This single change
is what makes nesting, drag-into-container, and stable step references all possible.

**Everything below assumes this tree model is adopted in Phase 1.** It is the
foundation; skipping it makes the rest impossible.

---

## 1. Bugs to Fix

### 1.1 Bugs I found in the first pass (still valid)

| # | Severity | File | Location | Bug | Fix |
|---|----------|------|----------|-----|-----|
| B1 | Visual | `style.css` | line ~301 | `border-bottom-bottom-radius` is not a real CSS property; the drag-over-bottom indicator renders wrong. | Rename to `border-bottom-left-radius` (and add `border-bottom-right-radius: 0`). |
| B2 | Functional (mobile) | `style.css` | `@media (max-width:600px)` | When sidebar is open on mobile it is full-width, but the toggle/close button still moves to `left: sidebar-width + 20px` → pushed off-screen, user can't close it via the button. | In the mobile breakpoint, override `body.sidebar-open .sidebar-toggle { left: auto; right: 16px; }` so the ✕ stays reachable. |
| B3 | Visual | `style.css` | lines ~215–216 | `.icon-context` and `.icon-tasks` share the identical amber color, killing section distinction. | Give each section its own token color (e.g. context = amber, tasks = indigo/teal). |
| B4 | Visual | `script.js` | `updatePreview()` lines ~339–340 | `## ` and `### ` both map to class `md-h2`; heading hierarchy is lost in the preview. | Add a distinct `md-h3` class and CSS rule; map `### ` to it. |
| B5 | Dead code | `script.js` | lines ~643–648 | A `contextOutput` change handler is registered inside the `taskList` `change` listener. `#contextOutput` is not a child of `taskList`, so this branch never runs (the real handler at line ~759 does the work). | Delete the dead branch. |
| B6 | Robustness | `script.js` | `getTaskTypeDef()` line ~209 | Falls back to `TASK_TYPES[1]` (Analyze) silently when a type is unknown → imported/old data is silently mislabeled. | Return an explicit `{ value:type, label:type, paramPlaceholder:'' }` fallback, or surface an "unknown type" badge. |
| B7 | Robustness | `script.js` | `importWorkflows()` / `loadWorkflow()` lines ~159–179, ~132–141 | Only checks `Array.isArray(imported)`. A valid-JSON-but-wrong-shape file (e.g. missing `state.tasks`) crashes `loadWorkflow` at `state.tasks.map(...)`. | Validate each workflow has `name:string` and `state.tasks:array` before accepting; show a toast and skip bad entries. Guard `loadWorkflow` with `Array.isArray(found.state?.tasks)`. |
| B8 | Docs | `README.md` | throughout | README references `styles.css` / `app.js`, but the real files are `style.css` / `script.js`; also storage key listed as `_v3` while code uses `_v4`. | Update README filenames, structure table, and storage-key references. |
| B9 | Consistency | `script.js` | `renderStandardCard()` line ~394 | `def.paramPlaceholder` injected into HTML without `escapeHtml`. Currently safe (static strings) but inconsistent and a foot-gun once placeholders become user-editable. | Wrap in `escapeHtml(...)`. |

### 1.2 Additional bugs / weaknesses found in the second pass

| # | Severity | File | Bug | Fix |
|---|----------|------|-----|-----|
| B10 | **Functional (your #4)** | `script.js` | **Positional step references.** Steps are titled `Step ${index+1}` and there is no stable ID exposed to the user. Any conditional/loop body that says "go to Step 4" silently points at the wrong step the moment a step is inserted/reordered/deleted above it. | Adopt stable node IDs (Phase 1). Replace free-text "go to step N" with a **typed reference field** that stores a node `id` and renders its *current* position. See §3.4. |
| B11 | Accessibility | `index.html` / `script.js` | Zero `aria-*` attributes and no `role`s anywhere; icon-only buttons (▲ ▼ ✕ 📂 🗑️) have no accessible name beyond `title`; drag handle is not keyboard-operable. | Add `aria-label` to all icon buttons, `role="list"`/`"listitem"` to task list, `aria-live="polite"` to the toast, and keyboard reorder (already have ▲▼ — wire `aria-keyshortcuts`). |
| B12 | Functional | `script.js` | `removeTask()` special-cases "last task" by mutating it back to an `analyze` task. With containers this is surprising (deleting your only loop turns it into an analyze task). | Allow the list to become empty (the empty-state UI already exists) and drop the magic replacement. |
| B13 | Functional | `script.js` | `taskIdCounter = Date.now()` plus `id++` integers can **collide** across import/merge of workflows created on different machines (same millisecond, or restored max+1 overlapping an imported id). | Use string IDs like `n_${crypto.randomUUID().slice(0,8)}` (or a counter + random suffix). Eliminates collisions on import/merge. |
| B14 | Functional | `script.js` | Drag & drop is flat-only. `handleDrop` splices within a single `state.tasks` array; there is no concept of dropping *into* a container. | Rewrite DnD against the tree: compute a drop target = `(parentNodeId, index)` and move the node via tree helpers. See §3.3. |
| B15 | UX | `script.js` | `updatePreview()` runs full `generateMarkdown()` + regex render on **every keystroke** in every field. Fine now; will lag once trees get deep. | Debounce preview render (~120 ms) and/or render incrementally. |
| B16 | Visual | `style.css` | `.task-details-input` / branch textareas cap at `max-height:80px` with `resize:vertical` — long content scrolls inside a tiny box. Inputs also lack a visible invalid/empty state. | Raise max-height, add subtle empty-required styling. |
| B17 | Correctness | `script.js` | Markdown body lines are emitted with a fixed 2-space indent regardless of nesting depth, so nested blocks won't read as nested in the output. | Generate markdown recursively with depth-based indentation / numbered sub-steps. See §4. |
| B18 | Data hygiene | `script.js` | No schema version inside the saved `state`; future model changes (flat→tree) will silently load broken old data. | Add `state.schema = 2` and a one-time **migration** from the old flat string-body model to the tree model on load. See §3.5. |

---

## 2. Target Feature Set (what we are building)

Mapping each of your numbered requests to concrete work:

1. **Pseudo-code prompts for AI/agents** → the whole output is restructured as
   readable pseudo-code (numbered steps, explicit `IF/ELSE`, `FOR EACH`, `SPAWN`,
   `PARALLEL`), see §4.
2. **Things it's missing / I should add** → see §5 (variables, validation, presets,
   templates, undo/redo, dark mode, export formats, etc.).
3. **Nestable Loop bodies** → containers hold child nodes; loops can contain tasks,
   ifs, and other loops. §3.1–3.3.
4. **Stable conditional targets** → reference a node by id, not by step number. §3.4.
5. **Per-type fields** → a field schema per node type drives rendering. §3.6.
6. **Sub-agent component** that holds sub-agents (role + tasks), usable inside loops,
   with **parallel vs sequential** execution. §3.7.
7. **Short but useful agent-facing text** → token-lean output mode + concise copy. §4, §5.6.

---

## 3. Architecture & Implementation

### 3.1 The node tree (single source of truth)

```js
const NODE_TYPES = {
  task:     { container:false, fields:['action','target','details'] },
  if:       { container:true,  fields:['condition'], slots:['then','elseifs[]','else'] },
  loop:     { container:true,  fields:['loopType','source','itemVar'], slots:['body'] },
  subagent: { container:true,  fields:['execMode'], slots:['agents[]'] }, // each agent has role + body
  parallel: { container:true,  fields:[], slots:['branches[]'] }          // run children concurrently
};
```

* `state.nodes` is an **array of root nodes** (replaces `state.tasks`).
* Every container node owns one or more **slots**, each slot being an array of child
  nodes. `if` has `then`, optional `elseifs[]` (each its own `{condition, children[]}`),
  and `else`. `loop` has `body`. `subagent` has `agents[]` (each `{id, role, capabilities, children[]}`).
* This is recursive: any slot array can contain any node type, including more containers.

### 3.2 Tree helper functions (new, in `script.js`)

Implement a small set of pure helpers so the rest of the code never hand-walks the tree:

```js
findNode(rootArr, id)            // → { node, parentArr, index } or null
removeNode(id)                   // splice out, return the detached node
insertNode(node, parentArr, idx) // insert at position
moveNode(id, targetArr, idx)     // remove + insert, with cycle guard
walk(rootArr, fn, depth=0)       // visit every node (for rendering + markdown + numbering)
collectReferencableSteps(rootArr)// → [{id, label, path}] for the reference dropdown (§3.4)
```

A **cycle guard** in `moveNode` prevents dropping a container into its own descendant
(which would otherwise create infinite recursion in render/markdown).

### 3.3 Rendering & drag-into-container

* `renderNodes(arr, container, depth)` recurses: for each node render its card; for
  container nodes, render each slot as a nested drop-zone `<div class="slot" data-parent-id data-slot>` and recurse into it.
* Each slot is a valid **drop target**. On `dragover`/`drop`, resolve the target slot
  array from `data-parent-id` + `data-slot`, compute insert index from pointer Y,
  then `moveNode(draggedId, targetArr, idx)` and re-render.
* Visual nesting via left border + indentation per depth (`--depth` CSS var or padding).
* Keep the existing handle-only drag rule (`draggable` only on `.drag-handle`).
* Also keep ▲▼ buttons, but make them **move within the current slot**; add an
  "outdent / indent" affordance later if desired.

### 3.4 Stable step references (fixes #4 / B10)

* Give every node a stable `id` at creation (B13).
* Anywhere the user wants to point at another step (e.g. a `goto`/`continue from` field,
  or "if X, jump to <step>"), render a **`<select>` of referenceable nodes** populated
  from `collectReferencableSteps()`. The select stores `node.id`; the label shows the
  node's *live* computed number/path (e.g. `Step 3.2 — Deploy`).
* On every render, numbers are recomputed by walking the tree, so a stored reference
  always resolves to the same node even after insert/reorder/delete. If the referenced
  node was deleted, show `⚠ (deleted step)` and let the user re-pick.
* In markdown, emit the reference as the node's current number plus a short slug so the
  agent reads an unambiguous target.

### 3.5 Migration (B18)

On `loadState()`:

```text
if no state.schema  -> assume legacy flat model:
   for each old task:
     task          -> { type:'task', action, target:param, details, ... }
     if            -> { type:'if', condition,
                        then: linesToTaskNodes(thenSteps),
                        elseifs: oldElseIfs.map(e=>({condition, children:linesToTaskNodes(e.steps)})),
                        else: linesToTaskNodes(elseSteps) }
     loop          -> { type:'loop', loopType, source:loopSource, itemVar:loopVar,
                        body: linesToTaskNodes(loopBody) }
   set state.schema = 2
```

`linesToTaskNodes(str)` turns each non-empty line of an old textarea into a simple
`custom_task` node so no user data is lost. Bump `STORAGE_KEY` to `..._v5` so a corrupt
half-migrated blob can't load; keep the migration as the bridge.

### 3.6 Per-type field schemas (your #5)

Drive card rendering from a declarative schema instead of three near-duplicate render
functions:

```js
const FIELD_SCHEMA = {
  task:     [ {key:'action', kind:'select', options:TASK_TYPES},
              {key:'target', kind:'text', placeholderFrom:'action'},
              {key:'details', kind:'textarea'} ],
  if:       [ {key:'condition', kind:'text', placeholder:'e.g. tests pass'} ],
  loop:     [ {key:'loopType', kind:'select', options:LOOP_TYPES},
              {key:'source', kind:'text', placeholderFrom:'loopType'},
              {key:'itemVar', kind:'text', showIf:'loopType==for_each'} ],
  subagent: [ {key:'execMode', kind:'select', options:['sequential','parallel']} ],
};
```

`renderCard(node)` reads the schema, builds inputs, and a generic `input`/`change`
delegate writes back to `node[key]` by `data-field`. This removes duplication and makes
adding a node type a one-line schema change. `placeholderFrom` / `showIf` give you the
"fields change based on type" behavior you asked for.

### 3.7 Sub-agent component (your #6)

* New node type `subagent` is a **container** whose slot is `agents[]`.
* Each agent = `{ id, role, capabilities:{agentic,verbose,...}, children:[] }` where
  `children` are the tasks that agent performs (reuse the same node renderer recursively).
* The sub-agent card has: an **execution mode** toggle (`Sequential` ▸ run one-by-one /
  `Parallel` ⇉ run concurrently), an **"+ Add sub-agent"** button, and per-agent a role
  field + its own nested task list.
* Because agents hold `children[]`, you can drop a `loop` or `if` inside an agent, and a
  whole `subagent` node can itself live inside a `loop` (e.g. "FOR EACH module → SPAWN a
  reviewer sub-agent"). This satisfies "use sub-agents inside a loop" + "parallel or
  one-by-one".

---

## 4. Output: pseudo-code for agents (your #1 and #7)

Replace the flat markdown with a recursive generator that emits compact, unambiguous
pseudo-code. Two output modes (toggle in the preview header):

* **Pseudo-code mode (default)** — terse, agent-optimized, low token count.
* **Markdown prose mode** — current style, human-friendly.

Example target output (pseudo-code mode):

```
ROLE: Senior Software Engineer (full-stack). agentic, strict.
CONTEXT: project=E-commerce; stack=React,Node,Postgres; out=code_only

STEPS
1. CLONE github.com/acme/shop
2. ANALYZE src/  → list risky modules
3. FOR EACH mod IN risky_modules:
   3.1 IF mod.has_tests:
       3.1.1 REVIEW mod
       ELSE:
       3.1.2 TEST mod  (write missing tests)
   3.2 SPAWN sub-agents [PARALLEL]:
       - agent "Security" → scan mod for OWASP top-10
       - agent "Perf"     → profile hot paths in mod
4. IF all_pass: DEPLOY staging  ELSE: GOTO 2
```

Implementation: `generate(arr, depth, numberPrefix)` recurses; numbering is
`1`, `1.1`, `1.1.1`; indentation = `depth`. Keep verbs short and uppercase
(`CLONE/ANALYZE/IF/FOR EACH/SPAWN/PARALLEL/GOTO`) — short tokens, clear structure.
Empty fields render as explicit placeholders (`<target?>`) so the agent knows what's
missing rather than guessing. This directly serves #7 (short but useful).

---

## 5. Additions worth making (your #2 + things you may not have considered)

| Feature | Why | Sketch |
|---|---|---|
| 5.1 **Variables panel** | Pseudo-code is far more useful with named vars (`$repo`, `$modules`). | A small key/value list; `${var}` interpolation in fields; export a `VARS:` block. |
| 5.2 **Field validation + "missing fields" badge** | Agents fail on ambiguous prompts; warn before export. | Mark empty required fields; show a count badge on the preview ("3 incomplete"). |
| 5.3 **Templates / presets** | Faster start; showcases capability. | Ship 3–4 built-in trees ("Bug triage", "Code review", "Migration") loadable from the sidebar. |
| 5.4 **Undo / redo** | Tree editing is destructive; users will mis-drag. | Keep a bounded history stack of `state` snapshots; `Ctrl+Z`/`Ctrl+Shift+Z`. |
| 5.5 **Collapse / expand containers** | Deep trees get tall. | Per-container collapse chevron; store collapsed flag on node (not exported). |
| 5.6 **Token estimate** | Your #7 — keep prompts lean. | Rough `chars/4` estimate shown under the preview; updates live. |
| 5.7 **Dark mode** | The preview is already dark; the app isn't. | Add `:root` light + `[data-theme=dark]` token sets; toggle persists to localStorage. |
| 5.8 **Export formats** | Different agents want different inputs. | Buttons: copy as Pseudo-code / Markdown / JSON (the raw tree, re-importable). |
| 5.9 **Duplicate node** | Common editing need. | "⧉ Duplicate" action deep-clones a node (with fresh ids) into the same slot. |
| 5.10 **Keyboard a11y for reorder** | Drag isn't keyboard-friendly. | `Alt+↑/↓` move within slot; `Tab` to focus cards. |
| 5.11 **`continue` / `break` for loops** | Real control flow. | Add as task sub-types that render `CONTINUE` / `BREAK` in output. |

---

## 6. Suggested implementation phases

> Phases are ordered so the app stays runnable after each one.

* **Phase 1 — Foundation (do first).** Stable string IDs (B13); introduce the node tree
  + tree helpers (§3.1–3.2); migration from the old flat model (§3.5, B18); render the
  existing three types from the schema (§3.6) with **no nesting yet** so behavior matches
  today. Fix the cheap bugs alongside: B1, B3, B4, B5, B8, B9.
* **Phase 2 — Nesting.** Recursive rendering with slots + drag-into-container (§3.3, B14);
  nested markdown/pseudo-code generation (§4, B17); collapse/expand (5.5); empty-list
  behavior cleanup (B12). Fix B2 (mobile toggle) and B16 (textarea sizing) here.
* **Phase 3 — Sub-agents & control targets.** `subagent` node with parallel/sequential
  (§3.7); stable step references via dropdown (§3.4, B10); `continue`/`break` (5.11).
* **Phase 4 — Output & polish.** Pseudo-code vs markdown toggle, token estimate, JSON
  export/import of the tree (§4, 5.6, 5.8); validation badges (5.2); undo/redo (5.4);
  variables (5.1); dark mode (5.7); accessibility pass (B11, 5.10); robust import
  validation (B7) and unknown-type handling (B6); README rewrite (B8).

---

## 7. File-by-file impact (staying within the 3 files)

* **`index.html`** — add: output-mode toggle + token estimate in the preview header;
  variables panel container; theme toggle; `aria-label`s on all icon buttons; templates
  list in the sidebar. No structural framework added; still plain semantic HTML.
* **`style.css`** — add: nesting/indent styles (`--depth`, slot drop-zones, container
  left-borders), sub-agent + parallel styling, dark-mode token set, collapse chevrons,
  validation/empty states; fix B1, B3, B4 (new `md-h3`), B16, B2 (mobile).
* **`script.js`** — the bulk of the work: node-tree model + helpers, schema-driven
  rendering, recursive DnD, recursive generators (pseudo-code + markdown), references,
  migration, undo/redo, variables, validation, import hardening, a11y wiring; remove dead
  code (B5).

No new dependencies, no bundler — everything remains vanilla and openable via
`file://` or `npx serve .`.

---

## 8. Acceptance checklist

- [ ] A `loop` can contain an `if`, and that `if` can contain another `loop` (true nesting).
- [ ] A `subagent` node holds ≥1 sub-agent, each with a role and its own task list, with a
      working Parallel/Sequential toggle, and can sit inside a `loop`.
- [ ] Inserting a step above a referenced step keeps the conditional pointing at the
      *same* node (reference survives reorder/insert/delete).
- [ ] Card fields differ by node type and update reactively when the type changes.
- [ ] Exported pseudo-code is compact, correctly indented/numbered, and lists missing
      fields explicitly.
- [ ] Old saved workflows (flat model) migrate without data loss.
- [ ] All originally listed bugs (B1–B9) and second-pass bugs (B10–B18) are resolved.
- [ ] Still three files; opens with no build step.

---
---

# PART II — Post-Rebuild Review & Benchmark-Driven Requirements

> This part was added after the tree-model rebuild. It records (A) bugs/gaps still
> open after the rebuild, verified by runtime testing, and (B) a gap analysis against
> three real-world benchmark prompts the tool is expected to be able to produce.

## 9. Remaining work found in the post-rebuild review

The tree model, nesting, sub-agents, stable GOTO references, undo/redo, variables,
dark mode, and workflow save/load were all verified working via headless (jsdom)
runtime tests. The following items are still open:

| # | Severity | Area | Finding | Fix |
|---|----------|------|---------|-----|
| R1 | UX (high) | CSS | `buildCard` adds `depth-0`…`depth-6` classes but **no CSS rule exists** for them. Deep trees have no progressive indentation/colour cue, only the slot-block border. Nesting is hard to read past 2 levels. | Add `.depth-N` rules: left padding/border-tint that increases with depth, so nested blocks visibly step inward. |
| R2 | Functional (high) | JS | **Variables are decorative.** `${name}` is emitted in a `VARS:` header but never substituted into `target`/`details`/`condition`/`source`/agent fields. Users expect `${repo}` in a field to resolve. | Add an `interpolate(str)` pass over every emitted field in both generators, replacing `${name}` with the variable value (leave unknown vars as-is, or flag them). |
| R3 | Docs | README | Still references `styles.css`, `app.js`, and storage key `_v3`. Real files are `style.css` / `script.js`; key is `_v5`. | Rewrite README: correct filenames, key, and document the new tree model + features. (Original bug B8.) |
| R4 | Validation | JS | `break` / `continue` are selectable and render anywhere, even outside a loop, with no warning. | In validation walk, flag a `break`/`continue` node that has no `loop` ancestor; show it in the incomplete badge and mark the card. |
| R5 | A11y | JS/CSS | ARIA labels added, but the drag handle is mouse-only; no keyboard reorder. | Add `Alt+↑/↓` to move the focused card within its slot; make handle focusable with `tabindex`. |
| R6 | Feature | JS | No starter templates/presets (was planned in §5.3, still absent). | Ship 3–4 built-in trees loadable from the sidebar. |

## 10. Benchmark prompts — can the current app produce them?

Three real agent system-prompts were used as benchmarks (a Planning Agent with
sub-agent orchestration; a plan-aware Development Agent; a compact multi-mode
Project-Manager agent). Verdict: **the app can express small fragments of them, but
not the prompts as a whole.** These prompts are *structured multi-section agent
specifications*, while the app currently emits a single flat "ROLE / CONTEXT / STEPS"
document. The gaps below are what separate the two.

### 10.1 What the app already covers
- Sequential numbered steps, `IF/ELSE`, `FOR EACH/WHILE/REPEAT`, nested blocks.
- Sub-agents with role + objective and a parallel/sequential execution mode
  (covers the "spawn 2–5 sub-agents in parallel, each writes a report" idea at a
  shallow level).
- A single role line + capability flags (agentic/verbose/strict) + a context line.

### 10.2 What is missing (each becomes a feature requirement)

| # | Capability the prompts need | Seen in | Current state | Requirement |
|---|------------------------------|---------|---------------|-------------|
| P1 | **Phases / named sections** — a prompt is divided into "Phase 0…8" or "Modes" or "Workflow for Type 1", each a titled group of steps. | All three | No grouping primitive; only a flat step list. | New container node **`section`** (a.k.a. Phase/Stage): has a `title`, optional `description`, and `children[]`. Renders as `## <title>` (markdown) or `### PHASE n: <title>` (pseudo-code). Nestable like any container. |
| P2 | **Modes / commands** — `/plan`, `/dev`, `/suggest`, `/analyse`, each with its own workflow and flags. | Prompt 3 (and Prompt 2's "request types") | None. | New top-level concept **`mode`**: named entry points, each owning its own node tree. UI: tabs or a mode picker; export emits a `## Mode: /name` block per mode. Modes also need a **flags/parameters** list (e.g. `--bulk`, `--no-subagent`). |
| P3 | **Questionnaire / clarifying-questions step** — "ask all questions in one message; multiple-choice; include 'Other' + 'Suggest best practice'." | Prompt 1 | None. | New task sub-type **`ask`** with: a list of questions, each with `kind` (free/multiple-choice), options, and toggles for "Other" / "suggest default". Renders as an `ASK USER:` block. |
| P4 | **Wait / gate for user input** — "do not proceed until the user confirms / picks a name." | Prompts 1 & 2 | None. | New task sub-type **`await_user`** (a.k.a. checkpoint/gate). Renders as `WAIT FOR USER CONFIRMATION` and acts as a visual barrier between phases. |
| P5 | **File / artifact outputs** — produce `synthesis.md`, `{project}_plan.md`, `structure.md`, reports in `docs/plan/research/`, and a final `.zip` with an exact folder tree. | All three | The app only outputs the prompt text itself; it has no notion of files the *agent* must create. | New task sub-type **`produce_file`**: fields = path/filename (supports `${var}`), format, and a content outline. Plus a **`deliverable`** node for "package these into `X.zip` with this tree." Renders a `WRITE FILE <path>:` / `PACKAGE → <zip> { tree }` block. |
| P6 | **Persistent-memory / self-storage instruction** — "save this prompt as `AGENT_PROMPT.md`, re-read it every request." | Prompts 2 & 3 | None. | A prompt-level **memory directive** toggle + filename field, emitted as a top-of-prompt `MEMORY:` rule. |
| P7 | **Per-sub-agent rich spec** — each sub-agent has a role, a research domain, *why it matters*, an output filename pattern, and "first agent is always the General Architect." | Prompts 1 & 3 | Sub-agent has only `role` + one-line `task` + agentic flag. | Extend the agent object: add `domain`, `rationale`, `outputFile` (pattern with `${project}`/`${role}`), and a "primary/architect" flag. Optionally a min/max count hint (2–5). |
| P8 | **Output contract / formatting rules** — "filenames hyphen-separated, capitalised", "`-OGF.md` never edited, `-FIN.md` is the copy", "Conventional Commits, ≤100 chars", "placeholder files deleted when real file arrives." | Prompts 2 & 3 | None. | A **rules/conventions** section node: a titled list of free-text constraints emitted verbatim as a `RULES:` block. (Covers commit-format, naming, file-lifecycle rules generically without hard-coding each.) |
| P9 | **Loop-back / revision cycles with a cap** — "allow up to 3 revision cycles, then finalize." | Prompt 1 | `loop` has for_each/while/repeat but no "until user satisfied, max N" idiom, and `GOTO` can't target a *section*. | Allow `repeat` loops to carry a human-readable exit condition; allow `GOTO`/loop targets to reference a **section** (P1), not only a task. |
| P10 | **Tables in output** — request-type tables, flag tables. | Prompts 2 & 3 | Generators emit only lists/pseudo-code. | Optional: a `table` content node for the markdown output mode. Lower priority (agents read lists fine). |
| P11 | **Conditional tool/flags & "user override" semantics** — "if user says 'no sub-agents', obey." | All three | None. | Mostly expressible via `IF` + `ask`, once P3/P4 exist; no new primitive needed, but document the pattern as a template (§R6). |

### 10.3 Reframing: from "step list" to "agent-spec builder"

The benchmark prompts show the tool's real target is **composing an agent system-prompt**,
which is a *document with sections*, not just a *procedure*. The single highest-leverage
change is **P1 (section/phase container)** — once sections exist, modes (P2), gates (P4),
questionnaires (P3), file outputs (P5), and rules (P8) all slot in as node types within
sections, and the existing recursive renderer/DnD handles them for free.

### 10.4 Recommended phase ordering for Part II

* **Phase 5 — Finish the rebuild.** R1 (depth CSS), R2 (variable interpolation),
  R3 (README), R4 (break/continue validation). Small, high-value, no model change.
* **Phase 6 — Sections & gates.** P1 `section`, P4 `await_user`, P9 (section-targetable
  GOTO / capped repeat). This unlocks multi-phase prompts (Prompt 1's Phase 0–8).
* **Phase 7 — Agent-spec primitives.** P3 `ask`, P5 `produce_file` + `deliverable`,
  P7 richer sub-agents, P8 rules block, P6 memory directive. This unlocks Prompts 2 & 3.
* **Phase 8 — Modes & polish.** P2 modes/commands + flags, P10 tables, R5 keyboard a11y,
  R6 templates (ship the three benchmark prompts themselves as built-in templates to
  prove coverage). 

### 10.5 Acceptance test for Part II
The tool is "benchmark-complete" when a user can rebuild each of the three prompts
end-to-end inside the UI and export text that is structurally equivalent:
- [ ] Prompt 1: 8 phases as `section`s, a `questionnaire` step, name-selection `await_user`
      gate, parallel sub-agents each with domain+rationale+output filename, file outputs
      (`synthesis.md`, `*_plan.md`, `structure.md`, research reports), a `deliverable` zip
      with the exact `docs/plan/` tree, and a capped 3-cycle revision loop.
- [ ] Prompt 2: request-type sections, per-type workflows with steps, test-gate
      (`IF tests fail → report+await_user`), file outputs under `docs/plan/...`, a
      persistent-memory directive, and a Conventional-Commits rules block.
- [ ] Prompt 3: four `mode`s (`/plan`,`/dev`,`/suggest`,`/analyse`) each with its own tree
      and flags, the exact folder-structure deliverable, OGF/FIN naming rules, placeholder
      deletion rule, and per-mode zip deliverables.

---
---

# PART III — User Capability Plan (reconciled) + Agent-Clarity Mandate

> This part folds in the user's own capability list, reconciles it with Part II
> (removing double-counts), specifies each new capability at implementation level
> against the existing node/slot/factory conventions, and adds a cross-cutting
> requirement: **the generated prompt must be unambiguous to an AI/agent, even at the
> cost of extra tokens.**

## 11. Reconciliation: user's list ↔ Part II

The user's list and Part II overlap. Canonical names and merges:

| User item | Part II item | Canonical capability | Note |
|-----------|-------------|----------------------|------|
| 1 GATE | P4 await_user | **GATE** | same thing — a user-confirmation barrier |
| 2 ASK | P3 ask | **ASK** | questionnaire step; ASK can also branch on the answer |
| 3 MODE | P2 | **MODE** | named entry points with own trees |
| 4 FLAG | P2 (flags) | **FLAG** | parameters that modify a mode's behaviour |
| 5 ROUTE | P2/P11 | **ROUTE** | intent → workflow dispatch (a typed multi-branch switch) |
| 6 PACKAGE | P5 (deliverable) | **PACKAGE** | zip + folder tree |
| 7 PLAN | — (new) | **PLAN** | emit a plan doc with auto Task-ID |
| 8 LOG | — (new) | **LOG** | worklog directive |
| 9 SPLIT | — (new) | **SPLIT** | decompose a task into sub-tasks |
| 10 VALIDATE | — (new) | **VALIDATE** | run tests → on fail retry/stop |
| 11 PHASE | P1 section | **PHASE/SECTION** | titled container; THE keystone |
| 12 Sub-agent aggregation | P7-adjacent | **SYNTHESIZE** (= item 15) | merge sub-agent reports |
| 13 Conditional sub-agent | P11 pattern | **conditional sub-agent** | express via IF + complexity flag |
| 14 COMMIT | P8-adjacent | **COMMIT** | conventional-commit message block |
| 15 SYNTHESIZE | =12 | **SYNTHESIZE** | merged with 12 |
| 16 File-naming rules | P8 | **RULES** | generic verbatim rules block |
| 17 TEMPLATE (folder) | P5-adjacent | **STRUCTURE** | folder-tree artifact (part of PACKAGE) |
| 18 max loop iterations | P9 | **loop maxIterations** | field on loop |

Net new node types after merge: **PHASE, GATE, ASK, ROUTE, MODE(+FLAG), PACKAGE
(+STRUCTURE), PLAN, LOG, SPLIT, VALIDATE, SYNTHESIZE, COMMIT, RULES**, plus field-level
additions (loop `maxIterations`, richer sub-agent, `memory` directive from P6).

## 12. The Agent-Clarity Mandate (cross-cutting)

The user is right that some emitted directives could be misread by an agent. New rule
for ALL generators: **prefer unambiguous, self-describing output over terse output.**
Token minimisation is no longer the top priority; *correct agent interpretation is.*
Concretely:

1. **Two verbosity levels**, user-selectable in the preview header:
   `Compact` (current pseudo-code) and **`Explicit` (new, default for export)**.
   Explicit mode expands every control word into an unmistakable instruction.
2. **Expansion rules (Explicit mode):**
   - `GATE` → `>>> STOP. Wait for explicit user confirmation before continuing. Do NOT proceed past this point until the user replies. <<<`
   - `ASK` → `ASK THE USER the following question(s) in a SINGLE message and WAIT for their answer:` then the enumerated questions with their options.
   - `GOTO Step 3` → `GO BACK TO and re-execute Step 3 ("<step title>"). This is a loop-back, not a one-time jump.`
   - `BREAK` / `CONTINUE` → `EXIT the current loop ("<loop label>") entirely.` / `SKIP the rest of this iteration and start the next one.`
   - `SPAWN sub-agents [PARALLEL]` → `Launch the following sub-agents AT THE SAME TIME (in parallel). Each works independently and returns its own report:`
   - `[SEQUENTIAL]` → `Run the following sub-agents ONE AT A TIME, in order; each finishes before the next starts:`
   - `PACKAGE → x.zip { tree }` → `Collect the files listed below and bundle them into a single archive named "x.zip", reproducing EXACTLY this folder structure:`
   - `VALIDATE` → `Run the tests. If ANY test fails: do NOT mark this step complete — report the failures to the user and wait. Only continue when all tests pass or the user explicitly overrides.`
3. **Every block names what it refers to.** Loop-backs, breaks, and gotos always quote
   the target's title, never just a number, so reordering can't desync meaning.
4. **Empty/required fields render as explicit placeholders** (`<MISSING: condition>`),
   never silently blank, so the agent never guesses.
5. Keep `Compact` mode available for users who want lean tokens; the toggle is per-export.

## 13. New capabilities — implementation detail

All new container types follow the existing pattern: a `make*()` factory, an entry in
`makeNode()`, a `slotsOf()` case (if it has children), a `getSlotArr()` case, a
`cardBody()`/head renderer, a `buildSlots()` case, and `pseudoNode()`/`mdNode()` +
Explicit-mode output. Migration: bump `SCHEMA` to 3 and default-fill new fields.

### 13.1 PHASE / SECTION  — *keystone, build first*
- Factory: `{ id, type:'section', title:'', goalNote:'', entryGate:false, exitCriteria:'', collapsed:false, children:[] }`.
- Slot: single `children` array (`slotsOf` → `[{key:'children',label:'STEPS',arr:node.children}]`).
- Render: title input + optional goal line; body is a drop-zone like loop body.
- Output (Explicit): `### PHASE n — <title>` then `Goal: <goalNote>`, children numbered
  `n.1, n.2…`; if `exitCriteria` set, append `Exit when: <criteria>`.
- Numbering: `walk()` already produces hierarchical numbers, so phases nest for free.
- GOTO can target a section id (extends P9); `collectReferencableSteps()` also lists sections.

### 13.2 GATE (user-confirmation barrier)
- Factory: `{ id, type:'gate', prompt:'Confirm to continue', onReject:'' }` (leaf node).
- Render: a single line input ("what the user must confirm") + optional "if rejected…" field.
- Output (Explicit): the STOP/Wait block from §12.2, plus `If the user rejects: <onReject>` when set.
- Validation (R4-style): a `gate` with empty prompt is flagged incomplete.

### 13.3 ASK (questionnaire, optionally branching)
- Factory: `{ id, type:'ask', oneMessage:true, questions:[ {id, text, kind:'choice'|'free', options:[], allowOther:true, suggestDefault:false, saveTo:'' } ], branches:[] }`.
- `kind:'choice'` shows options; `saveTo` names a variable to store the answer (ties to R2 interpolation).
- Optional branching: if any question has `branchOn:true`, ASK becomes a container whose
  slots are one child-array per option (like IF's elseifs), enabling "if user picked A → do X".
- Output (Explicit): the ASK block from §12.2; each question lettered, options bulleted,
  with `Other (please specify)` / `Suggest a sensible default` appended per flags.

### 13.4 ROUTE (intent dispatch)
- Factory: `{ id, type:'route', on:'user intent', cases:[ {label, match, children:[]} ], default:[] }`.
- Essentially a labelled multi-branch switch; slots = one per case + `default`.
- Output (Explicit): `DECIDE based on <on>:` then `If the request is "<label>" (<match>): …`
  per case, `Otherwise: …` for default. This cleanly models Prompt 2's "request types 1–4".

### 13.5 MODE + FLAG (top-level)
- Model change: `state.modes = [ {id, name:'/plan', summary:'', flags:[{name:'--bulk', desc:''}], nodes:[] } ]`
  in addition to (or replacing) a single `state.nodes`. Keep a default single mode for
  simple use; reveal the mode tabs only when >1 mode exists (progressive disclosure).
- UI: a mode tab-bar above the step list; switching tabs swaps the rendered tree.
- Output: `## MODE: /name — <summary>` then a `Flags:` list (`--bulk: <desc>`), then the
  mode's tree. Flags are referenceable inside IF conditions (`IF flag --no-subagent set`).

### 13.6 PACKAGE + STRUCTURE (deliverable)
- Factory: `{ id, type:'package', archiveName:'project_${var}.zip', tree:'', filesNote:'' }`.
- `tree` is a multiline textarea holding the literal folder layout (monospace).
- Output (Explicit): the PACKAGE block from §12.2 with the verbatim tree fenced as code.
- STRUCTURE (item 17) is the same primitive used standalone (no zip) to declare a target layout.

### 13.7 PLAN / LOG / SPLIT / VALIDATE / SYNTHESIZE / COMMIT (task sub-types)
These are leaf "directive" nodes — implement as new `action` values on the existing
`task` node (cheapest path; reuse taskFields), each with a tailored field + Explicit output:
- **PLAN**: field = plan filename pattern + auto `Task-ID` note → `CREATE a plan document "<file>" with the next sequential Task-ID (continue from the highest existing).`
- **LOG**: field = worklog filename → `WRITE a worklog "<file>" recording: start/end time, actions taken, problems + resolutions, files changed, test results, deviations.`
- **SPLIT**: field = criteria → `If this task is too large, SPLIT it into smaller sub-tasks, record them in the plan, and do not write code yet — report the breakdown to the user.`
- **VALIDATE**: field = test command → the VALIDATE block from §12.2 with the command shown.
- **SYNTHESIZE**: field = which reports → `READ the listed reports and MERGE them into one consolidated document "<file>", resolving conflicts and noting trade-offs.` (covers items 12 & 15.)
- **COMMIT**: fields = type/scope → `PROVIDE (do not run) a Conventional-Commits message: "type(scope): subject" (≤100 chars) plus a ≤350-char body. Do not run git commit unless the user explicitly asks.`

### 13.8 Field-level additions
- **Loop `maxIterations`** (item 18 / P9): new field on loop → `Repeat at most <N> times` and,
  for revision loops, an exit-condition field → `…until <condition> or <N> cycles, whichever first.`
- **Richer sub-agent** (P7): add `domain`, `rationale`, `outputFile`, `isPrimary` to the agent
  object; render extra inputs; Explicit output lists each agent with role/domain/why/output file;
  enforce/hint "first agent = General Architect" when `isPrimary` unset.
- **Conditional sub-agent** (item 13): no new type — documented template: `IF task is complex → SPAWN sub-agents; ELSE do it directly.` Ship as a built-in template (R6).
- **Memory directive** (P6): prompt-level toggle + filename → top-of-output
  `MEMORY: Save this entire prompt as "<file>" and re-read it at the start of every request.`

## 14. Final priority ordering (implementation roadmap)

Ordered by the user's "highest payoff first" guidance, adjusted so each phase leaves the
app shippable and dependencies come before dependents.

* **Phase 5 — Finish rebuild (prereqs). ✅ DONE (see §16).** R1 depth-CSS, R2 `${var}` interpolation
  (ASK/SYNTHESIZE depend on it), R3 README, R4 break/continue validation. *Small, unblocks the rest.*
* **Phase 6 — Clarity + keystone.** §12 Agent-Clarity Mandate (Compact/Explicit toggle) and
  **PHASE/SECTION** (13.1). Highest structural payoff; everything else nests inside sections.
* **Phase 7 — Interaction barriers.** **GATE** (13.2) then **ASK** (13.3, with answer→variable).
  Unlocks Prompt 1's questionnaire + confirmation gates. User's #1 and #2 priorities.
* **Phase 8 — Delivery & dev directives.** **PACKAGE/STRUCTURE** (13.6), **VALIDATE**, **LOG**,
  **SYNTHESIZE**, **COMMIT**, **PLAN**, **SPLIT** (13.6–13.7) + sub-agent richness (13.8).
  Unlocks Prompt 2 end-to-end. User priorities #3–#7.
* **Phase 9 — Routing & modes (largest change, last).** **ROUTE** (13.4) then **MODE+FLAG**
  (13.5). Unlocks Prompt 3. User priority #8 ("biggest architectural change, do last").
* **Phase 10 — Prove it.** Ship the three benchmark prompts as built-in templates (R6) and
  run the §10.5 acceptance checklist; add keyboard a11y (R5).

## 15. Updated capability scorecard (target after each phase)

| Prompt | Now | After Ph.6 | After Ph.7 | After Ph.8 | After Ph.9 |
|--------|-----|-----------|-----------|-----------|-----------|
| P1 Planning Agent | ~30% | ~50% | ~80% | ~90% | ~100% |
| P2 Development Agent | ~35% | ~55% | ~65% | ~95% | ~100% |
| P3 Project Manager | ~20% | ~40% | ~50% | ~70% | ~100% |

Definition of 100%: the §10.5 acceptance test passes — each benchmark prompt can be
rebuilt in the UI and exported as a structurally equivalent, agent-unambiguous spec.

---

## 16. Changelog — Phase 5 (COMPLETED)

Phase 5 is implemented and verified by headless (jsdom) runtime tests. All four items
done, within the three-file constraint (`index.html`, `style.css`, `script.js`) plus the
README.

- **R1 — Depth indentation (DONE).** Added `.task-card.depth-1…depth-6` rules in
  `style.css`: each nesting level gets a distinct tinted left rail and slight inset, so
  deep trees are visually traceable. Previously these classes were emitted but unstyled.
- **R2 — Variable interpolation (DONE).** Added `varMap()` and `interp()` in `script.js`
  and applied them at every field-emission point in both the pseudo-code and markdown
  generators (`target`, `details`, `condition`, `else-if condition`, loop `source`,
  sub-agent `role`/`task`). `${name}` now resolves to its value; unknown names render as
  `${name:UNDEFINED}` and are highlighted (`.md-var`) so mistakes are visible.
  Verified: `${repo}` → `github.com/acme/shop`; undefined vars marked.
- **R3 — README rewrite (DONE).** Replaced the outdated README that referenced
  `styles.css` / `app.js` / `_v3`. Now documents the real files (`style.css`,
  `script.js`), the `_v5` storage key, the tree model, all block types, variables,
  validation, shortcuts, and migration. (Closes original bug B8.)
- **R4 — break/continue validation (DONE).** Added `collectIssues()`, a validation walk
  that tracks loop-ancestry. A `break`/`continue` outside any loop is counted in the
  preview's incomplete badge and its card gets an `.invalid` warning style; the same
  verbs inside a loop are accepted. Empty required fields (target/condition/source,
  unset goto) are flagged the same way and the offending card is highlighted.
  Verified: break at root flagged + card marked; continue inside a loop not flagged.

Regression: full interaction suite (add all block types, nest 3 levels deep, GOTO
stable reference across reorder, undo/redo, mode toggle, variables, workflow save/load)
passes with zero runtime errors.

**Next up:** Phase 6 — Agent-Clarity Mandate (Compact/Explicit toggle) + the
PHASE/SECTION container (§12, §13.1).
