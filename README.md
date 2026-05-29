# Prompt Generator

A visual, browser-based tool for composing **pseudo-code prompts for AI agents**. You
build a tree of steps — tasks, conditionals, loops, sub-agents, parallel blocks — by
clicking and dragging, and the tool generates a clean, structured prompt you can copy or
download. Everything runs client-side with no build step and no dependencies.

## Features

- **Recursive node tree** — every block can contain other blocks. A loop can hold an
  if; an if can hold a loop; a sub-agent can hold its own steps; and so on to any depth.
- **Block types**
  - **Task** — a single action (clone, analyze, implement, refactor, test, deploy,
    create/update/delete/rename a file or folder, custom, and more), plus `goto`,
    `break`, and `continue` control verbs.
  - **If / Else** — a condition with `THEN`, any number of `ELSE IF` branches, and an
    optional `ELSE`.
  - **Loop** — `FOR EACH`, `WHILE`, or `REPEAT N TIMES`, with a nestable body.
  - **Sub-Agent** — one or more sub-agents, each with a role, objective, and its own
    nested steps, run either **in parallel** or **sequentially**.
  - **Parallel** — independent branches meant to run concurrently.
- **Stable step references** — `GOTO` points at a step's identity, not its position, so
  inserting or reordering steps never breaks the reference.
- **Variables** — define `name = value` pairs and reference them anywhere with
  `${name}`; they are substituted into the generated output. Unknown variables are
  marked `${name:UNDEFINED}` so nothing is silently wrong.
- **Two output modes** — compact **Pseudo-code** (token-lean) and **Markdown**
  (human-friendly). Live preview with syntax highlighting, a rough token estimate, and a
  completeness badge.
- **Validation** — empty required fields and misused `break`/`continue` (outside any
  loop) are flagged in the preview badge and highlighted on the card.
- **Workflows** — save, load, export, and import named workflows (stored in your
  browser). Export the whole tree as JSON and re-import it later.
- **Undo / redo**, **dark mode**, **drag-to-reorder and drag-into-container**,
  duplicate/collapse, and keyboard shortcuts.

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
3. Build your **steps**: click the add buttons, or use the inline `+` buttons inside a
   block to nest. Drag the `⋮⋮` handle to reorder or to move a block into another block.
4. Watch the **preview** update live. Switch between Pseudo-code and Markdown.
5. **Copy** or **Download** the prompt, or **Export JSON** to keep the editable tree.

## Project structure

```
PromptGenerator/
├── index.html   # Markup: role, context, variables, step list, preview, sidebar
├── style.css    # Theming (light/dark), layout, nesting cues, responsive rules
├── script.js    # All logic: node tree, rendering, drag & drop, generators, storage
└── README.md
```

| File | Responsibility |
|------|----------------|
| `index.html` | Semantic markup and element IDs the script binds to. |
| `style.css` | CSS custom-property themes, component styles, depth indentation, sidebar, mobile breakpoints, animations. |
| `script.js` | A vanilla-JS IIFE: the recursive node model, tree helpers, schema-driven card rendering, drag & drop into containers, pseudo-code/markdown generators, variable interpolation, validation, undo/redo, persistence, and workflow import/export. |

## Data & persistence

Application state (role, capabilities, context, variables, output mode, and the full
node tree) is auto-saved to `localStorage` under the key `prompt_generator_state_v5`.
Saved workflows live under `prompt_generator_workflows`, and the theme under
`prompt_generator_theme`. Older saved data (the previous flat `tasks` model and earlier
keys) is migrated automatically on load. Clearing browser data or clicking **Reset**
clears the current state.

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` / `Ctrl/Cmd + Y` | Redo |
| `Ctrl/Cmd + N` | Add a task (when not typing) |
| `Ctrl/Cmd + Shift + C` | Copy the generated prompt |
| `Esc` | Close the workflows sidebar |

## License

Provided as-is for personal and educational use.
