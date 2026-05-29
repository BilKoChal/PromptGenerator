# Prompt Generator

Build structured prompts for AI agents — no AI required.

A clean, client-side web tool that lets you visually construct step-by-step agent prompts and export them as Markdown. Zero dependencies, zero build steps — just open `index.html` in any modern browser.

---

## Features

- **Role Selection** — Choose from 8 pre-built AI/agent roles or define a fully custom one.
- **11 Task Types** — Clone, Analyze, Research, Create Sub-Agent, Implement, Refactor, Test, Document, Review, Deploy, and Custom Task.
- **Drag & Drop Reordering** — Grab the `⋮⋮` handle on any task card and drag to rearrange the execution order.
- **Move Up/Down Buttons** — Fine-tune task ordering with arrow buttons on each card.
- **Live Markdown Preview** — The generated prompt updates in real time with syntax-highlighted Markdown output.
- **Copy to Clipboard** — One-click copy of the full prompt (with clipboard API fallback).
- **Download as .md** — Export the prompt as a timestamped Markdown file.
- **Auto-Save** — All changes persist to `localStorage` so you never lose work.
- **Reset** — Restore everything to factory defaults with a single click (with confirmation).
- **Keyboard Shortcuts** — `Ctrl+N` to add a task, `Ctrl+Shift+C` to copy the prompt.
- **Responsive** — Works on desktop and mobile screens.

---

## Quick Start

1. Clone or download this repository.
2. Open `index.html` in your browser.
3. That's it — no server, no install, no build step needed.

```bash
# Option A: Just open the file
open index.html          # macOS
xdg-open index.html      # Linux
start index.html         # Windows

# Option B: Serve locally (optional, for file:// CORS quirks)
npx serve .
# then visit http://localhost:3000
```

---

## Project Structure

```
PromptGenerator/
├── index.html    # Semantic HTML markup
├── styles.css    # All styling, theming, and responsive rules
├── app.js        # Application logic, state management, drag & drop
└── README.md     # This file
```

| File | Purpose |
|------|---------|
| `index.html` | Page structure and UI layout. Links the stylesheet and script. |
| `styles.css` | CSS custom properties for theming, component styles, animations, and mobile breakpoints. |
| `app.js` | Vanilla JavaScript IIFE — handles state, rendering, persistence, drag & drop, and all interactions. |

---

## How It Works

1. **Select a Role** — Pick an AI persona (e.g., "Senior Software Engineer") or enter a custom role description.
2. **Add Task Steps** — Click **+ Add Task Step** to create ordered tasks. Each task has a type selector, a parameter input, and an optional details textarea.
3. **Reorder Tasks** — Drag the `⋮⋮` handle or use the ▲/▼ buttons to change execution order.
4. **Preview** — The Generated Prompt section renders a live, syntax-highlighted Markdown preview.
5. **Export** — Copy the prompt to your clipboard or download it as a `.md` file.

---

## Task Types

| Type | Parameter Example | Description |
|------|-------------------|-------------|
| Clone Repo | `https://github.com/user/repo.git` | Clone a Git repository |
| Analyze | `entire codebase or src/utils/` | Analyze code or directories |
| Research | `best practices for error handling in Rust...` | Research a topic |
| Create Sub-Agent | `analyze the authentication module...` | Spawn a sub-agent |
| Implement | `user authentication with JWT` | Implement a feature |
| Refactor | `src/legacy/data-processor.js` | Refactor target code |
| Test | `the login flow and edge cases` | Write and run tests |
| Document | `all public API endpoints` | Generate documentation |
| Review | `PR #42 or src/new-feature/` | Code review |
| Deploy | `staging server / AWS ECS` | Deploy to a target |
| Custom Task | `describe what needs to be done...` | Freeform task |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+N` / `Cmd+N` | Add a new task step |
| `Ctrl+Shift+C` / `Cmd+Shift+C` | Copy generated prompt to clipboard |

Shortcuts are ignored when an input, textarea, or select element is focused.

---

## Browser Support

- Chrome 80+
- Firefox 80+
- Safari 14+
- Edge 80+

Requires support for the Clipboard API, Drag & Drop API, and `localStorage`.

---

## Persistence

All application state (selected role, custom role text, and task list) is automatically saved to `localStorage` under the key `prompt_generator_state_v2`. Data is restored on page reload. Clearing browser data or clicking **Reset All** removes saved state.

---

## Credits

- Original project by [BilKoChal](https://github.com/BilKoChal/PromptGenerator)
- Refactored from a single-file HTML into a modular 3-file structure (HTML + CSS + JS)
- Bug fix: corrected `new Blob(d],` → `new Blob([md],` in the download handler

---

## License

This project is provided as-is under the same license as the original repository.
