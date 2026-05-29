# Plan — Phase 9: Full Compact/Explicit Verbosity + Settings System

> Derived from a hands-on code review of the current `script.js` (executed headlessly to
> confirm real behaviour). Covers two user requests:
>
> - **Item 3** — many fields are editable but don't change the output (or only change
>   Markdown); Compact/Explicit currently only varies the **STEPS** body. Every section
>   needs both a Compact and an Explicit form, and many sections that today emit a single
>   "compact-ish" line need an Explicit expansion added.
> - **Item 5** — build a **Settings** window so every default text in the output can be
>   edited per component, with global **import/export**. Examples: change the Role preset
>   text for `Frontend Developer` from `(React, Vue, CSS, responsive UI, accessibility)` to
>   `(CSS, JS, HTML)`; change the Gate Explicit stop word from `STOP` to `WAIT`; change the
>   Gate Compact label from `GATE` to `STOP GATE`.

---

## 0. Key architectural decision (read first)

Items 3 and 5 touch the **same strings** in the same functions (`generatePseudo`,
`generateMarkdown`, `headerLines`, `pseudoNode`, `mdNode`, `resourcesPseudo`,
`resourcesMd`). Implementing them as two separate passes would mean editing every generator
twice. Instead, do **one** refactor that introduces a single settings-aware text layer, and
let verbosity be one axis of that layer.

**Core idea:** every non-user-entered string the app emits becomes a lookup:

```js
emit('gate.compactLabel')            // → "GATE" (or user override)
emit('gate.explicitStopWord')        // → "STOP" (or user override → "WAIT")
emitV('loop.forEach', { compact, explicit })   // verbosity-aware
```

- `DEFAULT_SETTINGS` is the single source of truth for the defaults (Item 5).
- `getSetting(path)` returns the user override if present, else the default.
- For strings that differ by verbosity, the setting key itself carries a `compact` and an
  `explicit` value; `isExplicit()` chooses which (Item 3).

This makes the two features fall out of one mechanism: **add Explicit variants while you are
already replacing hardcoded strings with `getSetting()` calls.** Do Part B's data model
(S1) *first*, then do Part A (verbosity) and the rest of Part B together, generator by
generator.

Recommended order: **S1 → S6 (persistence) → S3 wiring done section-by-section, folding in
V1–V6 → S2 modal UI → S4 role presets → S5 import/export.**

---

## PART A — Compact/Explicit for every section (Item 3)

### A.0 Current state (verified by running the generators)

| Section | Pseudo Compact | Pseudo Explicit | Markdown (both) |
|---------|----------------|-----------------|-----------------|
| ROLE | identical | identical | identical |
| CONTEXT | identical | identical | identical |
| VARS | identical | identical | identical |
| RESOURCES | identical | identical | identical |
| MEMORY | identical | identical | identical |
| MODE/FLAG | identical | identical | identical |
| STEPS (tasks/containers) | **differs ✅** | **differs ✅** | **identical** (only PLAN/LOG/SPLIT/VALIDATE/SYNTHESIZE/COMMIT add one Explicit bullet) |

So: pseudo-code verbosity works **only inside STEPS**; Markdown verbosity is effectively
absent everywhere; and the header sections (ROLE/CONTEXT/VARS/RESOURCES/MEMORY/MODE) ignore
verbosity in both output modes.

### A.1 Fields that are editable but don't reach the output (fix as part of this work)

Confirmed by running trees through both generators:

- **`agent.agentic`** — emitted in pseudo (`(agentic)`), **missing in Markdown** `mdNode()`.
- **`agent.verbose`** — **dead field**: no checkbox is rendered in `buildSlots()` and it is
  read by neither generator. Either wire it up (UI checkbox + both generators) or remove it
  from `makeAgent()`.
- **`q.suggestDefault`** (ASK) — emitted in pseudo **Explicit only**; missing in pseudo
  Compact and in Markdown.

These three are the concrete instances of "fields that don't change the output." The audit
table in `TODO.md` §9.3 has been corrected; the fix work belongs here.

### A.2 Desired behaviour per section

For each section define `compact` and `explicit` forms. Pseudo and Markdown each get both.

**ROLE**
- Compact (pseudo): `ROLE: <preset-label-only> [agentic, verbose]` — drop the parenthetical
  capability blurb in compact.
- Explicit (pseudo): `ROLE: You are a <full preset text>. You operate in agentic mode … You
  must explain your reasoning (verbose) …` — expand each capability flag to a sentence.
- Markdown mirrors the same two forms (compact = short bold name; explicit = full sentences,
  which is roughly today's Markdown output).

**CONTEXT**
- Compact: `CONTEXT: project=X; stack=Y; rules=Z; output=W` (today's line).
- Explicit (pseudo): a labelled block —
  ```
  CONTEXT:
    Project: X
    Tech Stack: Y
    Constraints & Rules: Z
    Output Format: W
  ```
- Markdown explicit keeps the `## Context & Constraints` list; compact collapses to one line.

**VARS**
- Compact: `VARS: a=1; b=2`.
- Explicit: labelled list with the `${name}` usage hint.

**RESOURCES**
- Compact: today's brief `@name [kind] — value`.
- Explicit: add the lead-in "The following resources are available; reference them with
  @name." and keep inlined text bodies.

**MEMORY**
- Compact: one-line `MEMORY: save as "<file>" …`.
- Explicit: full multi-sentence directive (today's text).

**MODE / FLAG**
- Compact: `MODE: /name`, flags as bare `--flag`.
- Explicit: `MODE: /name — summary` plus per-flag descriptions.

**STEPS / node types** — pseudo already differentiates; the gap is **Markdown**. Add Explicit
prose to `mdNode()` for: IF ("Evaluate the condition and follow the matching branch"), LOOP
("Iterate through the collection" / "Repeat until …"), SUBAGENT ("Spawn the following agents
…"), PARALLEL ("Execute the following branches concurrently"), ROUTE ("Analyze the request
and route to the matching case"), SECTION (full goal/exit prose), GATE (full stop-and-wait
instruction — currently pseudo-only), ASK ("Before proceeding, ask the user …").

### A.3 Mapping to existing TODO V-items

`V1`=ROLE, `V2`=CONTEXT, `V3`=VARS, `V4`=RESOURCES, `V5`=MODE, `V6`=all node types in
Markdown. This plan keeps those IDs; the work is the union of V1–V6 **plus** the A.1 field
fixes, all delivered through the settings layer (Part B) so it is done once.

---

## PART B — Settings system (Item 5)

### B.1 (S1) Settings data model — `DEFAULT_SETTINGS`

A nested object holding every customizable string. Strings that vary by verbosity store both
forms. New top-level state field: `state.settings = {}` (overrides only; empty = all
defaults).

```js
const DEFAULT_SETTINGS = {
  role: {
    label: 'ROLE',
    explicitPrefix: 'You are a ',
    explicitSuffix: '.',
    capsStyle: 'brackets',          // 'brackets' | 'inline' | 'none'
    capWords: { agentic:'agentic', subagent:'can-spawn-subagents',
                verbose:'verbose', strict:'strict' },
    // S4: per-preset full text, keyed by the short label
    presets: {
      'Frontend Developer': 'Frontend Developer (React, Vue, CSS, responsive UI, accessibility)',
      'Backend Developer' : 'Backend Developer (APIs, databases, auth, server-side logic)',
      /* … all 16 from index.html lines 69–84 … */
    },
  },
  context: { compactLabel:'CONTEXT', explicitLabel:'CONTEXT',
             projectKey:'project', stackKey:'stack', rulesKey:'rules', outputKey:'output',
             mdHeading:'Context & Constraints' },
  vars:    { compactLabel:'VARS', explicitHeading:'VARIABLES (use ${name} to reference)',
             mdHeading:'Variables' },
  resources:{ compactLabel:'RESOURCES (referenced below by @name):',
              explicitLeadIn:'The following resources are available; reference them with @name.',
              mdHeading:'Resources' },
  memory:  { label:'MEMORY',
             instruction:'Save this entire prompt as "{file}" and re-read it at the start of every new request. Never discard or summarize it.' },
  mode:    { compactLabel:'MODE', flagLabel:'Flag', stepsLabel:'STEPS',
             emptyStepsLabel:'(no steps)', mdTasksLead:'Perform the following in order:' },

  // Task verbs — every entry in TASK_TYPES, overridable
  verbs: { clone:'CLONE', analyze:'ANALYZE', research:'RESEARCH', implement:'IMPLEMENT',
           refactor:'REFACTOR', test:'TEST', document:'DOCUMENT', review:'REVIEW',
           deploy:'DEPLOY', debug:'DEBUG', optimize:'OPTIMIZE', migrate:'MIGRATE',
           configure:'CONFIGURE', monitor:'MONITOR', create:'CREATE', update:'UPDATE',
           delete:'DELETE', rename:'RENAME', produce_file:'PRODUCE FILE', plan:'PLAN',
           log:'LOG', split:'SPLIT', validate:'VALIDATE', synthesize:'SYNTHESIZE',
           commit:'COMMIT', rules:'RULES', goto:'GOTO', break:'BREAK', continue:'CONTINUE',
           custom_task:'DO' },
  // Explicit expansions for the directive tasks (kept editable too)
  taskExplicit: {
    goto:'GO BACK TO and re-execute Step {n}{title}. This is a loop-back, not a one-time jump.',
    break:'BREAK — exit the current loop entirely.',
    continue:'CONTINUE — skip the rest of this iteration and start the next one.',
    /* produce_file, plan, log, split, validate, synthesize, commit, rules … */
  },

  gate: { compactLabel:'GATE', explicitStopWord:'STOP',
          explicitInstruction:'Wait for explicit user confirmation before continuing. Do NOT proceed past this point until the user replies.',
          confirmWord:'Confirm', rejectWord:'If rejected' },

  loop: { forEach:'FOR EACH', while:'WHILE', repeat:'REPEAT', in:'IN', times:'TIMES',
          maxLabel:'max', untilLabel:'until', atMostTpl:'at most {n} cycles',
          checkTpl:'After each iteration, check: "{cond}". If met, exit the loop early and continue.' },

  cond: { if:'IF', elseIf:'ELSE IF', else:'ELSE', then:'THEN' },

  subagent: { compactSpawn:'SPAWN sub-agents',
              explicitParallel:'SPAWN the following sub-agents AT THE SAME TIME (in parallel). Each works independently and returns its own report:',
              explicitSequential:'RUN the following sub-agents ONE AT A TIME, in order; each finishes before the next starts:',
              agentWord:'Agent', domainLabel:'domain', rationaleLabel:'Rationale',
              reportLabel:'Write report to', primaryTag:'[PRIMARY]',
              agenticTag:'agentic', verboseTag:'verbose' },

  parallel: { label:'PARALLEL', branchWord:'branch' },

  route: { compactLabel:'ROUTE on', caseArrow:'→', defaultArrow:'default →',
           explicitLead:'DECIDE based on', explicitMatchTpl:'If the request matches "{label}"{match}:',
           explicitOtherwise:'Otherwise:' },

  section: { label:'PHASE', goalLabel:'Goal', exitCompact:'Exit when',
             exitExplicit:'Do not leave this phase until' },

  ask: { compactLabel:'ASK USER', explicitSingle:'ASK THE USER the following question(s) in a SINGLE message and WAIT for their answer:',
         explicitSeparate:'ASK THE USER the following question(s) in separate messages and WAIT for their answer:',
         optionsLabel:'Options', orOther:'or Other', freeText:'free text answer',
         saveToLabel:'Save answer to', suggestDefaultLabel:'Suggest best-practice default.' },

  table:   { compactTpl:'TABLE: {caption} ({r}x{c})', explicitTpl:'TABLE — {caption}:', rowWord:'Row' },
  package: { compactArrow:'→', explicitLead:'PACKAGE — Collect the files listed below and bundle them into a single archive named "{name}", reproducing EXACTLY this folder structure:', noteLabel:'Note' },
};
```

`getSetting(path)`:

```js
function getSetting(path) {
  const ov = path.split('.').reduce((o,k)=> (o==null?o:o[k]), state.settings);
  if (ov !== undefined && ov !== null) return ov;
  return path.split('.').reduce((o,k)=> (o==null?o:o[k]), DEFAULT_SETTINGS);
}
```

Helper for verbosity-aware emit, used in generators:

```js
const L = (path) => getSetting(path);                 // plain label
const fill = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (_,k)=> vars[k] ?? '');
```

**Priority HIGH. Files:** `script.js`.

### B.2 (S6) Persistence + migration (do early, right after S1)

- Store overrides under their own key `prompt_generator_settings` (separate from main state →
  clean import/export). Load on boot, merge over `DEFAULT_SETTINGS` at read time via
  `getSetting` (so newly-added default keys never break old saves — no schema bump needed).
- On boot: `state.settings = JSON.parse(localStorage.getItem('prompt_generator_settings')||'{}')`.
- Save settings whenever changed (debounced, like `saveState`).

**Priority HIGH (foundation). Files:** `script.js`.

### B.3 (S3 + V1–V6) Connect settings to the generators, adding Explicit forms as you go

Replace **every** hardcoded string in `headerLines`, `generatePseudo`, `resourcesPseudo`,
`generateMarkdown`, `resourcesMd`, `pseudoNode`, `mdNode`, `getVerb`, `getEffectiveRole` with
`getSetting(...)`/`fill(...)`. While editing each block, add the missing Explicit/Compact
branch from Part A. Suggested sub-order (each shippable independently):

1. Header: ROLE (V1) → CONTEXT (V2) → VARS (V3) → RESOURCES (V4) → MEMORY → MODE (V5).
2. `getVerb()` and the verb table (drives every task line in both generators).
3. Leaf nodes: gate, table, package; directive tasks (goto/break/continue/plan/…).
4. Containers: if/loop/subagent/parallel/route/section/ask — add Markdown Explicit prose
   (V6) and the field fixes (agentic→MD, verbose→wire-or-remove, suggestDefault→compact+MD).

Acceptance per block: in the jsdom harness, Compact ≠ Explicit where Part A says it should,
and overriding the matching setting changes the output.

**Priority HIGH. Files:** `script.js`.

### B.4 (S4) Role-preset customization (the explicit user example)

- Move the 16 option **values** out of `index.html` and the `DEFAULT_SETTINGS.role.presets`
  map into the single source of truth. The `<select>` keeps showing the short label
  (`Frontend Developer`); `getEffectiveRole()` resolves the full text via
  `getSetting('role.presets.' + shortLabel)`.
- `getEffectiveRole()` change: store `roleSelectValue` as the **short key** (or keep current
  value but look up by derived key). Add a migration that maps existing long values back to
  their short key on load.
- Settings modal Role section lists each preset with an editable text field, so
  `Frontend Developer (React, Vue, CSS, responsive UI, accessibility)` can become
  `Frontend Developer (CSS, JS, HTML)`.

**Priority MEDIUM. Files:** `script.js`, `index.html`.

### B.5 (S2) Settings modal UI

- ⚙️ gear button in the header next to `#themeToggle` (`index.html` line 59).
- Overlay modal (reuse `.sidebar-overlay` pattern). Accordion or tabbed categories matching
  the `DEFAULT_SETTINGS` top-level keys (Role, Context, Vars, Resources, Memory, Mode, Verbs,
  Gate, Loop, Cond, Sub-agent, Parallel, Route, Section, Ask, Table, Package).
- Each row: label + input bound to a setting path + per-row "Reset" (deletes the override).
- Global "Reset all", "Export", "Import" buttons; a search/filter box.
- Live preview: every change calls `saveSettings()` + `updatePreview()`.
- Close via ✕ or backdrop click; keyboard accessible (focus trap, Esc to close).

**Priority HIGH (the visible feature). Files:** `script.js`, `index.html`, `style.css`.

### B.6 (S5) Import / Export settings

- **Export:** `download(JSON.stringify(state.settings, null, 2), 'settings-'+ts()+'.json')`.
- **Import:** file picker → parse → shallow-validate it's a plain object → deep-merge into
  `state.settings` → `saveSettings()` → re-render. Reject non-objects with a toast.
- **Reset all:** `state.settings = {}` → save → re-render.
- Expose all three in the modal (and optionally the sidebar footer).

**Priority MEDIUM. Files:** `script.js`.

---

## Settings inventory — what becomes editable, by component

| Component | Editable strings (examples) | Verbosity-split? |
|-----------|------------------------------|------------------|
| Role | `label`, `explicitPrefix/Suffix`, caps style, cap words, **16 preset texts** | yes (compact = label only) |
| Context | section label, the 4 keys, MD heading | yes (one-line vs labelled block) |
| Variables | label, MD heading, usage hint | yes |
| Resources | label, MD heading, explicit lead-in | yes |
| Memory | label, full directive template `{file}` | one-line vs full |
| Mode/Flag | `MODE`, `Flag`, `STEPS`, empty label, MD lead | yes |
| Task verbs | all 30 verbs + FILE/FOLDER suffix | n/a (verb) / explicit expansions editable |
| Gate | **compact `GATE`**, **explicit `STOP`**, instruction, `Confirm`, `If rejected` | yes (the user's STOP→WAIT / GATE→STOP GATE example) |
| Loop | FOR EACH/WHILE/REPEAT/IN/TIMES, max/until, "at most {n} cycles", check template | yes |
| If/Cond | IF / ELSE IF / ELSE / THEN | yes |
| Sub-agent | compact spawn, explicit parallel/sequential leads, Agent/domain/Rationale/report/PRIMARY/agentic/verbose tags | yes |
| Parallel | `PARALLEL`, branch word | yes |
| Route | compact `ROUTE on`/arrows, explicit `DECIDE based on`/match/otherwise | yes |
| Section | `PHASE`, Goal, Exit (compact vs explicit) | yes |
| Ask | compact/explicit leads, Options, or-Other, free-text, Save-to, suggest-default | yes |
| Table | compact/explicit templates, Row word | yes |
| Package | compact arrow, explicit lead `{name}`, Note | yes |

---

## Implementation sequence & dependencies

1. **S1** data model + `getSetting` + `fill` helpers. *(blocks everything)*
2. **S6** load/save of `state.settings`. *(needed before UI is useful)*
3. **S3 + V1–V6 + A.1 field fixes** — refactor generators block-by-block, adding Explicit
   forms while wiring settings. Largest chunk; ship section by section.
4. **S4** role presets (depends on S1 presets map + a small migration).
5. **S2** modal UI (depends on S1 to enumerate fields).
6. **S5** import/export/reset (depends on S2 for buttons).

Estimated effort: S1+S6 small–medium; S3+V medium–large (the bulk); S2 large; S4/S5 medium.

---

## Testing plan

Extend the existing jsdom harness (the one used for this review):

1. **Verbosity matrix:** for a tree exercising every node type, assert pseudo Compact ≠
   pseudo Explicit, and Markdown Compact ≠ Markdown Explicit, in every section (not just
   STEPS). Lock with snapshot files.
2. **Settings override:** set `state.settings.gate.explicitStopWord = 'WAIT'` and
   `state.settings.gate.compactLabel = 'STOP GATE'`; assert the Explicit output contains
   `WAIT` not `STOP`, and Compact contains `STOP GATE` not `GATE`.
3. **Role preset override:** set `role.presets['Frontend Developer'] = 'Frontend Developer (CSS, JS, HTML)'`;
   select that role; assert output uses the new text.
4. **Field-fix regression:** assert `agent.agentic`/`agent.verbose`/`q.suggestDefault` now
   appear in both generators and both verbosity modes as specified in A.1/A.2.
5. **Import/export round-trip:** export → clear → import → deep-equal the settings object.
6. **Migration:** load an old save with long `roleSelectValue`; assert it still resolves and
   renders.

---

## Risks / notes

- **Don't double-escape.** Settings values flow into the same `escapeHtml`/`attr` path as
  user data in the editor, but the **output preview** uses `highlight()` on raw text — keep
  settings substitution on the text side, before highlighting.
- **`highlight()` keyword regex** hardcodes verbs (GATE, ROUTE, FOR EACH, …). If a verb/label
  is renamed via settings, syntax highlighting won't match it. Either (a) accept that custom
  labels aren't highlighted, or (b) rebuild the highlight regex from current settings.
  Decide explicitly; document the choice.
- **Templates / saved workflows** persist `roleSelectValue`; the S4 short-key change needs the
  load-time migration so the 4 bundled templates in `/templates/*.json` still resolve.
- Keep `state.settings` **separate** from `state` so existing undo/redo snapshots and workflow
  JSON stay unchanged, and settings export stays clean.
- Two pre-existing bugs found during review interact with this work and are worth fixing in
  the same pass: **BUG-F5** (IF/ELSE-IF/ELSE branches reuse the same step number) and
  **BUG-F6** (`${itemVar}` renders `:UNDEFINED` inside a loop body). See `TODO.md` §9.3.
