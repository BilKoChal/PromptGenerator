# Prompt Generator

Build structured prompts for AI agents — no AI required.

A clean, client-side web tool that lets you visually construct step-by-step agent prompts and export them as Markdown. Zero dependencies, zero build steps — just open `index.html` in any modern browser.

---

## Features

- **Role Selection** — Choose from 16 pre-built AI/agent roles with detailed descriptions, or define a fully custom one.
- **Agent Capabilities** — Toggle **Agentic** (autonomous multi-step execution) and **Sub-agent** (spawn & coordinate sub-agents) checkboxes to declare what the agent is authorized to do.
- **11 Task Types** — Clone, Analyze, Research, Create Sub-Agent, Implement, Refactor, Test, Document, Review, Deploy, and Custom Task.
- **Drag & Drop Reordering** — Grab the `⋮⋮` handle on any task card and drag to rearrange the execution order. Only the handle is draggable — inputs and text areas remain selectable.
- **Move Up/Down Buttons** — Fine-tune task ordering with arrow buttons on each card.
- **Live Markdown Preview** — The generated prompt updates in real time with syntax-highlighted Markdown output.
- **Copy to Clipboard** — One-click copy of the full prompt (with clipboard API fallback).
- **Download as .md** — Export the prompt as a timestamped Markdown file.
- **Workflow Save/Load** — Save your current task configuration with a name and reload it anytime from the sidebar panel.
- **Workflow Export/Import** — Export saved workflows as `.json` files and import them on another machine or share with teammates.
- **Auto-Save** — All changes persist to `localStorage` so you never lose work.
- **Reset** — Restore everything to factory defaults with a single click (with confirmation).
- **Keyboard Shortcuts** — `Ctrl+N` to add a task, `Ctrl+Shift+C` to copy the prompt, `Esc` to close sidebar.
- **Responsive** — Works on desktop and mobile screens.
- **Favicon** — 🤖 emoji favicon for easy tab identification.

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
├── index.html    # Semantic HTML markup with sidebar & capability checkboxes
├── styles.css    # All styling, theming, sidebar, responsive rules
├── app.js        # Application logic, state, drag & drop, workflows
└── README.md     # This file
```

| File | Purpose |
|------|---------|
| `index.html` | Page structure, sidebar panel, role section with capabilities. Links stylesheet and script. |
| `styles.css` | CSS custom properties for theming, component styles, sidebar styles, animations, and mobile breakpoints. |
| `app.js` | Vanilla JavaScript IIFE — handles state, rendering, persistence, drag & drop (handle-only), workflows, and all interactions. |

---

## How It Works

1. **Select a Role** — Pick an AI persona (e.g., "Senior Software Engineer") or enter a custom role description. A description appears below the dropdown.
2. **Set Capabilities** — Check **Agentic** if the agent can autonomously execute multi-step tasks. Check **Sub-agent** if it can spawn sub-agents.
3. **Add Task Steps** — Click **+ Add Task Step** to create ordered tasks. Each task has a type selector, a parameter input, and an optional details textarea.
4. **Reorder Tasks** — Drag the `⋮⋮` handle or use the ▲/▼ buttons to change execution order. Text inside inputs stays selectable.
5. **Save Workflows** — Click **💾 Workflows** to open the sidebar. Name and save your current setup, or load a previously saved one.
6. **Export/Import** — Export workflows as `.json` files for backup or sharing. Import them from the sidebar panel.
7. **Preview** — The Generated Prompt section renders a live, syntax-highlighted Markdown preview.
8. **Export** — Copy the prompt to your clipboard or download it as a `.md` file.

---

## Roles

| Role | Description |
|------|-------------|
| Senior Software Engineer | Designs, builds, and maintains robust software systems. Proficient in architecture decisions, code quality, and cross-team collaboration. |
| Code Reviewer | Focused on code correctness, readability, security, and performance. Provides constructive, actionable feedback on pull requests. |
| DevOps / Platform Engineer | CI/CD pipelines, infrastructure-as-code, container orchestration, and cloud platforms. Bridges development and operations. |
| Security Analyst | Identifies vulnerabilities, performs threat modeling, and recommends mitigations. Expert in OWASP and secure coding practices. |
| QA / Test Engineer | Designs and executes test strategies — unit, integration, E2E, and regression. Ensures quality standards before release. |
| Technical Writer | Crafts clear, accurate documentation — API references, tutorials, and architecture guides — for technical and non-technical audiences. |
| Data Scientist / ML Engineer | Builds and deploys ML models, designs data pipelines, performs statistical analysis, and translates insights into decisions. |
| Product Manager | Defines product vision, prioritizes the backlog, writes specifications, and coordinates cross-functional teams. |
| Frontend Developer | Builds responsive, accessible, and performant UIs. Expert in modern frameworks, component design, and web performance. |
| Backend Developer | Designs and implements server-side logic, APIs, database schemas, authentication, and background job processing. |
| Full-Stack Developer | Works across the entire stack — from database design and API development to UI implementation and deployment. |
| Solutions Architect | Designs end-to-end system architectures, evaluates technology choices, and ensures scalability and cost-efficiency. |
| Database Administrator | Manages database performance, schema design, migrations, backups, and replication for SQL and NoSQL systems. |
| UX / Interaction Designer | Researches user needs, designs wireframes and prototypes, conducts usability testing, and ensures accessible experiences. |
| API Designer | Designs clean, consistent, and versioned RESTful and GraphQL APIs. Focuses on developer experience and backward compatibility. |
| Site Reliability Engineer | Ensures system uptime, defines SLOs/SLAs, builds monitoring and alerting, and automates toil to keep production healthy. |

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
| `Esc` | Close the workflows sidebar |

Shortcuts are ignored when an input, textarea, or select element is focused.

---

## Workflows

Workflows let you save your entire task configuration (role, capabilities, and task steps) under a name and reload it later.

- **Save**: Click 💾 Workflows → enter a name → click 💾
- **Load**: Click the ▶ button next to any saved workflow
- **Delete**: Click the ✕ button to remove a saved workflow
- **Export**: Click 📤 to download a workflow as a `.json` file, or use the sidebar's Export button to export the current session
- **Import**: Click 📥 to load a `.json` workflow file from disk

Workflows are stored in `localStorage` and persist across sessions.

---

## Browser Support

- Chrome 80+
- Firefox 80+
- Safari 14+
- Edge 80+

Requires support for the Clipboard API, Drag & Drop API, and `localStorage`.

---

## Persistence

All application state (selected role, custom role text, capabilities, and task list) is automatically saved to `localStorage` under the key `prompt_generator_state_v3`. Saved workflows are stored under `prompt_generator_workflows`. Data is restored on page reload. Clearing browser data or clicking **Reset All** removes saved state.

---

## Credits

- Original project by [BilKoChal](https://github.com/BilKoChal/PromptGenerator)
- Refactored from a single-file HTML into a modular 3-file structure (HTML + CSS + JS)
- Enhanced with workflow save/load, role descriptions, capability checkboxes, and handle-only drag

---

## License

This project is provided as-is under the same license as the original repository.
