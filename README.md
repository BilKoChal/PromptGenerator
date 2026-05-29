# Prompt Generator

A visual, browser-based tool for composing **pseudo-code prompts for AI agents**. You
build a tree of steps — tasks, conditionals, loops, sub-agents, parallel blocks, and
phases — by clicking and dragging, and the tool generates a clean, structured prompt you
can copy or download. Everything runs client-side with no build step and no dependencies.

## Features

### Node Tree

- **Recursive node tree** — every block can contain other blocks. A loop can hold an
  if; an if can hold a loop; a sub-agent can hold its own steps; a phase can hold
  loops and sub-agents; and so on to any depth.
- **Visual depth cues** — nested blocks progressively indent inward with tinted
  left rails and subtle background color shifts, making deep trees easy to read.

### Block Types

- **Task** — a single action (clone, analyze, implement, refactor, test, deploy,
  create/update/delete/rename a file or folder, custom, and more), plus `goto`,
  `break`, and `continue` control verbs. File/folder toggle on create/update/delete/rename.
- **Phase / Section** — a titled group of steps with an optional goal and exit
  criteria. Renders as `=== PHASE N: title ===` in pseudo-code. Nestable like any
  container.
- **If / Else** — a condition with `THEN`, any number of `ELSE IF` branches, and an
  optional `ELSE`.
- **Loop** — `FOR EACH`, `WHILE`, or `REPEAT N TIMES`, with a nestable body.
- **Sub-Agent** — one or more sub-agents, each with a role, objective, and its own
  nested steps, run either **in parallel** or **sequentially**.
- **Parallel** — independent branches meant to run concurrently.

### Stable Step References

- `GOTO` points at a step's **stable ID**, not its position, so inserting or
  reordering steps never breaks the reference. A dropdown selector shows all
  referenceable steps with their live-computed position and title. Deleted targets
  are flagged with `⚠ deleted`.

### Variables & Interpolation

- Define `name = value` pairs and reference them anywhere with `${name}`.
- Variables are substituted into every emitted field (target, details, condition,
  source, agent fields) in both pseudo-code and markdown output.
- Unknown variables are marked `${name:UNDEFINED}` so nothing is silently wrong.

### Resources & Attachments

- Attach resources (text, file, image, zip, link, or other) with a name and
  optional note.
- Reference them with `@name` in any field. Text resources are inlined at the top
  of the generated output.
- Small images (< 200 KB) get inline thumbnails.

### Output Modes

- **Pseudo-code** (default) — token-lean, agent-optimized. Numbered hierarchical
  steps (`1`, `1.1`, `1.1.1`) with uppercase verbs (`CLONE`, `ANALYZE`, `IF`,
  `FOR EACH`, `SPAWN`, `PARALLEL`, `GOTO`).
- **Markdown** — human-friendly prose with headings, bold labels, and code spans.

### Verbosity Levels

- **Explicit** (default) — every control word is expanded into an unmistakable
  instruction. Example: `GOTO Step 3` becomes *"GO BACK TO and re-execute Step 3
  ("title"). This is a loop-back, not a one-time jump."*
- **Compact** — terse, token-efficient output for users who want lean prompts.

### Validation

- Empty required fields and misused `break`/`continue` (outside any loop) are
  flagged in a preview badge (`✓ complete` / `⚠ N incomplete`).
- Invalid cards are highlighted with a yellow border in the editor.

### Token Estimate

- A rough `~N tok` badge (characters / 4) updates live with the preview, helping
  you keep prompts within token limits.

### Workflows

- Save, load, export, and import named workflows (stored in your browser's
  `localStorage`).
- Export the whole tree as JSON and re-import it later. Invalid entries are skipped
  with a warning.

### Other Features

- **Undo / redo** — up to 60 history snapshots. `Ctrl+Z` / `Ctrl+Shift+Z`.
- **Dark mode** — toggle persists in `localStorage`. The dark theme uses a complete
  set of custom-property overrides.
- **Drag-to-reorder and drag-into-container** — drag the `⋮⋮` handle to reorder
  blocks or drop them into container slots.
- **Duplicate / collapse** — deep-clone any node with fresh IDs; collapse
  containers to save space.
- **Keyboard shortcuts** — see below.

## Usage

Open `index.html` in a browser. No server is required, though a static server works too:

```
# any of these
open index.html
python3 -m http.server   # then visit http://localhost:8000
npx serve .
```

Then:

1. Pick a **role** and toggle capabilities (agentic / sub-agent / verbose / strict).
2. Fill in **context** (project, stack, constraints, output format) and any **variables**.
3. Optionally add **resources** (files, links, text snippets) referenced by `@name`.
4. Build your **steps**: click the add buttons, or use the inline `+` buttons inside a
   block to nest. Drag the `⋮⋮` handle to reorder or to move a block into another block.
5. Watch the **preview** update live. Switch between Pseudo-code and Markdown. Toggle
   Explicit or Compact verbosity.
6. **Copy** or **Download** the prompt, or **Export JSON** to keep the editable tree.

## Project Structure

```
PromptGenerator/
├── index.html             # Markup: role, context, variables, resources, steps, preview, sidebar
├── style.css              # Theming (light/dark), layout, depth cues, responsive rules
├── script.js              # All logic: node tree, rendering, drag & drop, generators, storage
├── IMPLEMENTATION_PLAN.md # Detailed rebuild & enhancement plan (3 parts)
├── TODO.md                # Priority-ordered checklist of remaining work
└── README.md              # This file
```

| File | Responsibility |
|------|----------------|
| `index.html` | Semantic markup and element IDs the script binds to. Role selector, context fields, variable list, resource list, step builder, live preview panel, and saved-workflows sidebar. |
| `style.css` | CSS custom-property themes (light + dark), component styles, progressive depth indentation (`.depth-0` through `.depth-6`), container accent colors, sidebar, mobile breakpoints, and animations. |
| `script.js` | A vanilla-JS IIFE: the recursive node model (6 node types), tree helper functions, schema-driven card rendering, drag & drop into containers, pseudo-code/markdown generators with Explicit/Compact verbosity, `${var}` and `@resource` interpolation, validation, undo/redo, persistence, and workflow import/export with migration from legacy formats. |

## Node Model

All application state revolves around a **recursive tree of nodes** stored in
`state.nodes`. Each node has a stable string ID (`t_a1b2c3d4`) and a type:

| Type | Container? | Key Fields | Slots (child arrays) |
|------|-----------|------------|---------------------|
| `task` | No | `action`, `target`, `details`, `targetType`, `gotoRef` | — |
| `section` | Yes | `title`, `goalNote`, `exitCriteria`, `collapsed` | `children` |
| `if` | Yes | `condition`, `collapsed` | `then`, `elseifs[].children`, `else` |
| `loop` | Yes | `loopType`, `source`, `itemVar`, `collapsed` | `body` |
| `subagent` | Yes | `execMode` (parallel/sequential), `collapsed` | `agents[].children` |
| `parallel` | Yes | `collapsed` | `branches[]` |

Container nodes hold **slots** (named child arrays). Any slot can contain any node
type, including more containers, enabling true nesting to arbitrary depth.

## Task Actions

The `task` node supports the following actions, each with a specific verb in the
generated output:

| Action | Verb | Has Target? | Notes |
|--------|------|-------------|-------|
| `clone` | CLONE | Yes | Repository URL |
| `analyze` | ANALYZE | Yes | Codebase or path |
| `research` | RESEARCH | Yes | Topic |
| `implement` | IMPLEMENT | Yes | Feature description |
| `refactor` | REFACTOR | Yes | Path or module |
| `test` | TEST | Yes | What to test |
| `document` | DOCUMENT | Yes | What to document |
| `review` | REVIEW | Yes | PR or path |
| `deploy` | DEPLOY | Yes | Target environment |
| `debug` | DEBUG | Yes | Issue description |
| `optimize` | OPTIMIZE | Yes | What to optimize |
| `migrate` | MIGRATE | Yes | Migration target |
| `configure` | CONFIGURE | Yes | What to configure |
| `monitor` | MONITOR | Yes | What to monitor |
| `create` | CREATE FILE/FOLDER | Yes | Path (toggle file/folder) |
| `update` | UPDATE FILE/FOLDER | Yes | Path (toggle file/folder) |
| `delete` | DELETE FILE/FOLDER | Yes | Path (toggle file/folder) |
| `rename` | RENAME FILE/FOLDER | Yes | Old → new path |
| `goto` | GOTO | No (dropdown) | Step reference by ID |
| `break` | BREAK | No | Must be inside a loop |
| `continue` | CONTINUE | No | Must be inside a loop |
| `custom_task` | DO | Yes | Free-form description |

## Data & Persistence

Application state (role, capabilities, context, variables, resources, output mode,
verbosity, and the full node tree) is auto-saved to `localStorage` under the key
`prompt_generator_state_v5`.

| Key | Contents |
|-----|----------|
| `prompt_generator_state_v5` | Current session: role, context, variables, resources, nodes, output mode, verbosity |
| `prompt_generator_workflows` | Named workflow snapshots (array of `{name, state}`) |
| `prompt_generator_theme` | `"light"` or `"dark"` |

The state includes a `schema` field (currently `3`). Older saved data (the flat
`tasks` model from schema 1, and the early tree model from schema 2) is migrated
automatically on load. Clearing browser data or clicking **Reset** clears the
current state.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` / `Ctrl/Cmd + Y` | Redo |
| `Ctrl/Cmd + N` | Add a task (when not typing) |
| `Ctrl/Cmd + Shift + C` | Copy the generated prompt |
| `Esc` | Close the workflows sidebar |

## Example Output (Pseudo-code, Explicit mode)

```
ROLE: Senior Software Engineer (full-stack, React/Node.js, writes production-grade code)  [agentic, strict]
VARS: repo=prompt-generator; modules=src/core,src/utils
CONTEXT: project=E-commerce; stack=React,Node,Postgres; rules=Backward compatible, no new deps

STEPS
1. CLONE https://github.com/acme/shop
2. ANALYZE src/  → list risky modules
3. FOR EACH mod IN ${modules}:
   3.1 IF mod.has_tests:
       3.1.1 REVIEW mod
       ELSE:
       3.1.2 TEST mod  (write missing tests)
   3.2 SPAWN the following sub-agents AT THE SAME TIME (in parallel). Each works independently and returns its own report:
       - agent "Security" → scan mod for OWASP top-10 (agentic)
       - agent "Perf" → profile hot paths in mod
4. IF all_pass: DEPLOY staging  ELSE: GO BACK TO and re-execute Step 2 ("ANALYZE src/"). This is a loop-back, not a one-time jump.
```

## License

Provided as-is for personal and educational use.
