(function () {
    'use strict';

    // ════════════════════════════════════════════════════════════════
    //  Prompt Generator — tree-based pseudo-code prompt builder
    //  Single source of truth: state.nodes  (recursive node tree)
    // ════════════════════════════════════════════════════════════════

    // ──────────────────────────────────────
    // DOM references (declared first; some listeners attach at load time)
    // ──────────────────────────────────────
    const taskList = document.getElementById('taskList');
    const previewBlock = document.getElementById('previewBlock');
    const tokenBadge = document.getElementById('tokenBadge');
    const validBadge = document.getElementById('validBadge');
    const modeToggle = document.getElementById('modeToggle');
    const toast = document.getElementById('toast');

    // ──────────────────────────────────────
    // Type definitions
    // ──────────────────────────────────────
    const TASK_TYPES = [
        { value: 'clone',       label: '📥 Clone Repo', verb: 'CLONE',     ph: 'https://github.com/user/repo.git' },
        { value: 'analyze',     label: '🔍 Analyze',    verb: 'ANALYZE',   ph: 'entire codebase or src/utils/' },
        { value: 'research',    label: '📚 Research',   verb: 'RESEARCH',  ph: 'best practices for error handling…' },
        { value: 'implement',   label: '🛠️ Implement',  verb: 'IMPLEMENT', ph: 'user authentication with JWT' },
        { value: 'refactor',    label: '♻️ Refactor',   verb: 'REFACTOR',  ph: 'src/legacy/data-processor.js' },
        { value: 'test',        label: '🧪 Test',       verb: 'TEST',      ph: 'the login flow and edge cases' },
        { value: 'document',    label: '📝 Document',   verb: 'DOCUMENT',  ph: 'all public API endpoints' },
        { value: 'review',      label: '👀 Review',     verb: 'REVIEW',    ph: 'PR #42 or src/new-feature/' },
        { value: 'deploy',      label: '🚀 Deploy',     verb: 'DEPLOY',    ph: 'staging server / AWS ECS' },
        { value: 'debug',       label: '🐛 Debug',      verb: 'DEBUG',     ph: 'checkout flow fails on submit…' },
        { value: 'optimize',    label: '⚡ Optimize',   verb: 'OPTIMIZE',  ph: 'DB queries in orders module…' },
        { value: 'migrate',     label: '📦 Migrate',    verb: 'MIGRATE',   ph: 'from REST to GraphQL…' },
        { value: 'configure',   label: '⚙️ Configure',  verb: 'CONFIGURE', ph: 'CI/CD pipeline with GH Actions…' },
        { value: 'monitor',     label: '📊 Monitor',    verb: 'MONITOR',   ph: 'API latency and error rates…' },
        { value: 'create',      label: '✨ Create',     verb: 'CREATE',    ph: 'src/components/Button.tsx' },
        { value: 'update',      label: '✏️ Update',     verb: 'UPDATE',    ph: 'src/api/auth.ts — add refresh token logic' },
        { value: 'delete',      label: '🗑️ Delete',     verb: 'DELETE',    ph: 'src/legacy/old-utils.js' },
        { value: 'rename',      label: '📛 Rename',     verb: 'RENAME',    ph: 'src/old-name.ts → src/new-name.ts' },
        { value: 'goto',        label: '↩️ Go To Step', verb: 'GOTO',      ph: '' },
        { value: 'break',       label: '⛔ Break Loop', verb: 'BREAK',     ph: '' },
        { value: 'continue',    label: '⏭️ Continue',   verb: 'CONTINUE',  ph: '' },
        { value: 'custom_task', label: '💡 Custom',     verb: 'DO',        ph: 'describe what needs to be done…' },
    ];
    const TASK_TYPE_MAP = Object.fromEntries(TASK_TYPES.map(t => [t.value, t]));
    const NO_TARGET = { goto: 1, break: 1, continue: 1 };

    // Actions that support a File / Folder target-type toggle
    const HAS_TARGET_TYPE = { create: 1, update: 1, delete: 1, rename: 1 };
    const TARGET_TYPE_PH = {
        create:  { file: 'src/components/Button.tsx',                    folder: 'src/components/ui' },
        update:  { file: 'src/api/auth.ts — add refresh token logic',   folder: 'src/config/ — update environment settings' },
        delete:  { file: 'src/legacy/old-utils.js',                     folder: 'src/legacy/old-module' },
        rename:  { file: 'src/old-name.ts → src/new-name.ts',           folder: 'src/old-dir → src/new-dir' },
    };

    const LOOP_TYPES = [
        { value: 'for_each', label: 'For Each (iterate items)' },
        { value: 'while',    label: 'While (condition holds)' },
        { value: 'repeat',   label: 'Repeat N times' },
    ];

    const CONTAINER_TYPES = ['if', 'loop', 'subagent', 'parallel'];
    const isContainer = (n) => CONTAINER_TYPES.includes(n.type);

    // ──────────────────────────────────────
    // IDs (stable, collision-resistant)  [fixes B13]
    // ──────────────────────────────────────
    function uid(prefix) {
        const rand = (window.crypto && crypto.getRandomValues)
            ? Array.from(crypto.getRandomValues(new Uint8Array(4))).map(b => b.toString(16).padStart(2, '0')).join('')
            : Math.random().toString(16).slice(2, 10);
        return (prefix || 'n') + '_' + rand;
    }

    // ──────────────────────────────────────
    // Node factories
    // ──────────────────────────────────────
    function makeTask(action) {
        return { id: uid('t'), type: 'task', action: action || 'analyze', target: '', details: '', gotoRef: '', targetType: 'file' };
    }
    function makeIf()       { return { id: uid('if'), type: 'if', condition: '', collapsed: false, then: [], elseifs: [], else: [] }; }
    function makeLoop()     { return { id: uid('lp'), type: 'loop', loopType: 'for_each', source: '', itemVar: 'item', collapsed: false, body: [] }; }
    function makeAgent()    { return { id: uid('ag'), role: '', task: '', agentic: true, verbose: false, children: [] }; }
    function makeSubagent() { return { id: uid('sa'), type: 'subagent', execMode: 'parallel', collapsed: false, agents: [makeAgent()] }; }
    function makeParallel() { return { id: uid('pl'), type: 'parallel', collapsed: false, branches: [[], []] }; }
    function makeNode(kind) {
        if (kind === 'if') return makeIf();
        if (kind === 'loop') return makeLoop();
        if (kind === 'subagent') return makeSubagent();
        if (kind === 'parallel') return makeParallel();
        return makeTask();
    }

    // ──────────────────────────────────────
    // Slots: container child-arrays, uniformly
    // ──────────────────────────────────────
    function slotsOf(node) {
        if (node.type === 'if') {
            const s = [{ key: 'then', label: 'THEN', arr: node.then }];
            (node.elseifs || []).forEach((e, i) => s.push({ key: 'elseif:' + i, label: 'ELSE IF', arr: e.children }));
            s.push({ key: 'else', label: 'ELSE', arr: node.else });
            return s;
        }
        if (node.type === 'loop')     return [{ key: 'body', label: 'BODY', arr: node.body }];
        if (node.type === 'subagent') return (node.agents || []).map((a, i) => ({ key: 'agent:' + i, label: 'AGENT', arr: a.children }));
        if (node.type === 'parallel') return (node.branches || []).map((b, i) => ({ key: 'branch:' + i, label: 'BRANCH', arr: b }));
        return [];
    }
    function getSlotArr(node, slotKey) {
        if (!node) return null;
        if (slotKey === 'then') return node.then;
        if (slotKey === 'else') return node.else;
        if (slotKey === 'body') return node.body;
        if (slotKey.indexOf('elseif:') === 0) { const i = +slotKey.split(':')[1]; return node.elseifs[i] && node.elseifs[i].children; }
        if (slotKey.indexOf('agent:') === 0)  { const i = +slotKey.split(':')[1]; return node.agents[i] && node.agents[i].children; }
        if (slotKey.indexOf('branch:') === 0) { const i = +slotKey.split(':')[1]; return node.branches[i]; }
        return null;
    }

    // ──────────────────────────────────────
    // Tree helpers  [foundation for #3/#4/#6, fixes B14]
    // ──────────────────────────────────────
    function findNode(id, arr) {
        arr = arr || state.nodes;
        for (let i = 0; i < arr.length; i++) {
            const n = arr[i];
            if (n.id === id) return { node: n, parentArr: arr, index: i };
            if (isContainer(n)) {
                for (const slot of slotsOf(n)) {
                    const found = findNode(id, slot.arr);
                    if (found) return found;
                }
            }
        }
        return null;
    }
    function collectAllArrays(node) {
        let out = [];
        slotsOf(node).forEach(s => {
            out.push(s.arr);
            s.arr.forEach(c => { if (isContainer(c)) out = out.concat(collectAllArrays(c)); });
        });
        return out;
    }
    function removeNode(id) {
        const f = findNode(id);
        if (!f) return null;
        return f.parentArr.splice(f.index, 1)[0];
    }
    function moveNode(id, targetArr, idx) {
        const f = findNode(id);
        if (!f) return;
        if (isContainer(f.node) && collectAllArrays(f.node).indexOf(targetArr) !== -1) return; // cycle guard
        const sameArr = (f.parentArr === targetArr);
        const node = removeNode(id);
        if (!node) return;
        let insertAt = idx;
        if (sameArr && f.index < idx) insertAt = idx - 1; // account for removal shift
        if (insertAt < 0) insertAt = 0;
        if (insertAt > targetArr.length) insertAt = targetArr.length;
        targetArr.splice(insertAt, 0, node);
    }
    function walk(arr, fn, depth, prefix) {
        arr = arr || state.nodes; depth = depth || 0; prefix = prefix || '';
        arr.forEach((n, i) => {
            const num = prefix ? prefix + '.' + (i + 1) : String(i + 1);
            fn(n, depth, num, arr, i);
            if (isContainer(n)) slotsOf(n).forEach(s => walk(s.arr, fn, depth + 1, num));
        });
    }
    function collectReferencableSteps() {
        const out = [];
        walk(state.nodes, (n, depth, num) => {
            if (n.type === 'task' && n.action !== 'goto' && n.action !== 'break' && n.action !== 'continue') {
                const verb = getVerb(n);
                out.push({ id: n.id, label: 'Step ' + num + ' — ' + verb + (n.target ? ' ' + n.target.slice(0, 20) : '') });
            }
        });
        return out;
    }
    function stepNumberOf(id) {
        let r = null;
        walk(state.nodes, (n, d, num) => { if (n.id === id) r = num; });
        return r;
    }
    function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }
    function reId(node) {
        node.id = uid(node.type === 'task' ? 't' : node.type.slice(0, 2));
        slotsOf(node).forEach(s => s.arr.forEach(reId));
        if (node.type === 'subagent') (node.agents || []).forEach(a => { a.id = uid('ag'); });
        return node;
    }

    // ──────────────────────────────────────
    // State
    // ──────────────────────────────────────
    const STORAGE_KEY = 'prompt_generator_state_v5';
    const WORKFLOWS_KEY = 'prompt_generator_workflows';
    const THEME_KEY = 'prompt_generator_theme';
    const SCHEMA = 2;

    function defaultState() {
        return {
            schema: SCHEMA,
            roleSelectValue: 'Senior Software Engineer (full-stack, React/Node.js, writes production-grade code)',
            customRole: '',
            agentic: false, subagent: false, verbose: false, strict: false,
            contextProject: '', contextTech: '', contextConstraints: '', contextOutput: '',
            variables: [],
            outputMode: 'pseudocode',
            nodes: [ makeTask('clone'), makeTask('analyze') ],
        };
    }
    let state = defaultState();

    // Undo / redo  [5.4]
    const history = []; let histIndex = -1; let suppressHistory = false;
    function pushHistory() {
        if (suppressHistory) return;
        history.splice(histIndex + 1);
        history.push(JSON.stringify(state));
        if (history.length > 60) history.shift();
        histIndex = history.length - 1;
    }
    function undo() { if (histIndex > 0) { histIndex--; state = JSON.parse(history[histIndex]); afterRestore('Undo'); } }
    function redo() { if (histIndex < history.length - 1) { histIndex++; state = JSON.parse(history[histIndex]); afterRestore('Redo'); } }
    function afterRestore(msg) { suppressHistory = true; updateAllUI(); suppressHistory = false; saveState(); showToast(msg); }

    // ──────────────────────────────────────
    // Persistence  [B7, B18]
    // ──────────────────────────────────────
    let saveTimer;
    function saveState() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {} }, 150);
    }
    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const saved = JSON.parse(raw);
            if (saved.schema === SCHEMA && Array.isArray(saved.nodes)) {
                state = Object.assign(defaultState(), saved);
                migrateOldActions(state.nodes);  // one-time patch for old file/folder action types
            } else {
                const legacy = localStorage.getItem('prompt_generator_state_v4') || localStorage.getItem('prompt_generator_state_v3');
                migrate(saved.tasks ? saved : (legacy ? JSON.parse(legacy) : saved));
                migrateOldActions(state.nodes);
            }
        } catch (e) { state = defaultState(); }
    }

    // Migrate legacy action values (create_file → create + targetType:file, etc.)
    const OLD_ACTION_MAP = { create_file: 'file', update_file: 'file', delete_file: 'file', rename_file: 'file', create_folder: 'folder' };
    function migrateOldActions(nodes) {
        if (!nodes) return;
        let changed = false;
        nodes.forEach(n => {
            if (n.type === 'task' && OLD_ACTION_MAP[n.action]) {
                n.targetType = OLD_ACTION_MAP[n.action];
                n.action = n.action.replace(/_file|_folder/, '');
                changed = true;
            }
            if (isContainer(n)) slotsOf(n).forEach(s => migrateOldActions(s.arr));
        });
        if (changed) saveState();
    }

    // Migration from the old flat string-body model  [3.5]
    function linesToNodes(str) {
        return String(str || '').split('\n').map(l => l.trim()).filter(Boolean)
            .map(line => { const t = makeTask('custom_task'); t.target = line; return t; });
    }
    function migrate(old) {
        const s = defaultState();
        if (old) {
            ['roleSelectValue','customRole','agentic','subagent','verbose','strict',
             'contextProject','contextTech','contextConstraints','contextOutput'].forEach(k => {
                if (old[k] !== undefined) s[k] = old[k];
            });
            if (Array.isArray(old.tasks)) {
                s.nodes = old.tasks.map(t => {
                    if (t.type === 'if') {
                        const n = makeIf(); n.condition = t.condition || '';
                        n.then = linesToNodes(t.thenSteps);
                        n.elseifs = (t.elseIfs || []).map(e => ({ condition: e.condition || '', children: linesToNodes(e.steps) }));
                        n.else = linesToNodes(t.elseSteps);
                        return n;
                    }
                    if (t.type === 'loop') {
                        const n = makeLoop(); n.loopType = t.loopType || 'for_each';
                        n.source = t.loopSource || ''; n.itemVar = t.loopVar || 'item';
                        n.body = linesToNodes(t.loopBody);
                        return n;
                    }
                    const n = makeTask(t.type || 'analyze');
                    n.target = t.param || ''; n.details = t.details || '';
                    return n;
                });
            }
        }
        state = s;
    }

    // ──────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────
    function getEffectiveRole() {
        if (state.roleSelectValue === 'custom') return state.customRole.trim() || 'Assistant';
        return state.roleSelectValue;
    }
    function escapeHtml(str) { const d = document.createElement('div'); d.textContent = str == null ? '' : str; return d.innerHTML; }
    function attr(str) { return escapeHtml(str).replace(/"/g, '&quot;'); }

    // Resolve the full verb for a task node (e.g. "CREATE FILE", "CREATE FOLDER")
    function getVerb(node) {
        const t = TASK_TYPE_MAP[node.action];
        if (!t) return node.action;
        if (HAS_TARGET_TYPE[node.action]) {
            return t.verb + ' ' + (node.targetType || 'file').toUpperCase();
        }
        return t.verb;
    }

    // ──────────────────────────────────────
    // Output generation  [#1, #7, B17]
    // ──────────────────────────────────────
    function generateOutput() {
        return state.outputMode === 'markdown' ? generateMarkdown() : generatePseudo();
    }

    function headerLines() {
        const role = getEffectiveRole();
        const caps = [];
        if (state.agentic) caps.push('agentic');
        if (state.subagent) caps.push('can-spawn-subagents');
        if (state.verbose) caps.push('verbose');
        if (state.strict) caps.push('strict');
        const ctx = [];
        if (state.contextProject.trim()) ctx.push('project=' + state.contextProject.trim());
        if (state.contextTech.trim())    ctx.push('stack=' + state.contextTech.trim());
        if (state.contextConstraints.trim()) ctx.push('rules=' + state.contextConstraints.trim());
        if (state.contextOutput) ctx.push('output=' + state.contextOutput);
        const vars = (state.variables || []).filter(v => v.name.trim());
        return { role, caps, ctx, vars };
    }

    // ---- Pseudo-code (token-lean) ----
    function generatePseudo() {
        const h = headerLines();
        let out = 'ROLE: ' + h.role + (h.caps.length ? '  [' + h.caps.join(', ') + ']' : '') + '\n';
        if (h.vars.length) out += 'VARS: ' + h.vars.map(v => v.name + '=' + (v.value || '?')).join('; ') + '\n';
        if (h.ctx.length) out += 'CONTEXT: ' + h.ctx.join('; ') + '\n';
        out += '\nSTEPS\n';
        if (!state.nodes.length) out += '  (no steps)\n';
        else state.nodes.forEach((n, i) => { out += pseudoNode(n, 0, String(i + 1)); });
        return out.replace(/\n+$/, '') + '\n';
    }
    function pad(d) { return '  '.repeat(d); }
    function pseudoNode(n, depth, num) {
        const ind = pad(depth);
        if (n.type === 'task') {
            const t = TASK_TYPE_MAP[n.action] || { verb: n.action };
            if (n.action === 'goto') {
                const ref = n.gotoRef ? ('Step ' + (stepNumberOf(n.gotoRef) || '?')) : '<step?>';
                return ind + num + '. GOTO ' + ref + '\n';
            }
            if (n.action === 'break' || n.action === 'continue') return ind + num + '. ' + t.verb + '\n';
            const verb = getVerb(n);
            let line = ind + num + '. ' + verb + (n.target ? ' ' + n.target : ' <target?>');
            if (n.details && n.details.trim()) line += '  // ' + n.details.trim().replace(/\n+/g, '; ');
            return line + '\n';
        }
        if (n.type === 'if') {
            let s = ind + num + '. IF ' + (n.condition || '<condition?>') + ':\n';
            s += slotPseudo(n.then, depth + 1, num);
            (n.elseifs || []).forEach(e => {
                s += ind + '   ELSE IF ' + (e.condition || '<condition?>') + ':\n';
                s += slotPseudo(e.children, depth + 1, num);
            });
            if ((n.else || []).length) { s += ind + '   ELSE:\n'; s += slotPseudo(n.else, depth + 1, num); }
            return s;
        }
        if (n.type === 'loop') {
            let head;
            if (n.loopType === 'while') head = 'WHILE ' + (n.source || '<condition?>');
            else if (n.loopType === 'repeat') head = 'REPEAT ' + (n.source || '<n?>') + ' TIMES';
            else head = 'FOR EACH ' + (n.itemVar || 'item') + ' IN ' + (n.source || '<collection?>');
            return ind + num + '. ' + head + ':\n' + slotPseudo(n.body, depth + 1, num);
        }
        if (n.type === 'subagent') {
            let s = ind + num + '. SPAWN sub-agents [' + (n.execMode || 'parallel').toUpperCase() + ']:\n';
            (n.agents || []).forEach((a, ai) => {
                s += ind + '   - agent "' + (a.role || 'unnamed') + '"' +
                     (a.task ? ' → ' + a.task : '') +
                     (a.agentic ? ' (agentic)' : '') + '\n';
                if (a.children && a.children.length) s += slotPseudo(a.children, depth + 2, num + '.' + (ai + 1));
            });
            return s;
        }
        if (n.type === 'parallel') {
            let s = ind + num + '. PARALLEL:\n';
            (n.branches || []).forEach((b, bi) => {
                s += ind + '   ── branch ' + (bi + 1) + ':\n';
                s += slotPseudo(b, depth + 2, num + '.' + (bi + 1));
            });
            return s;
        }
        return '';
    }
    function slotPseudo(arr, depth, parentNum) {
        if (!arr || !arr.length) return pad(depth) + '(empty)\n';
        let s = '';
        arr.forEach((n, i) => { s += pseudoNode(n, depth, parentNum + '.' + (i + 1)); });
        return s;
    }

    // ---- Markdown (human-friendly) ----
    function generateMarkdown() {
        const h = headerLines();
        let md = '# Agent Prompt\n\n## Role\nYou are a **' + h.role + '**.\n';
        if (state.agentic)  md += '- **agentic** — perform iterative, autonomous tasks.\n';
        if (state.subagent) md += '- may **spawn sub-agents** for parallel subtasks.\n';
        if (state.verbose)  md += '- **verbose** — explain reasoning.\n';
        if (state.strict)   md += '- **strict** — follow instructions exactly.\n';
        if (h.vars.length) { md += '\n## Variables\n'; h.vars.forEach(v => md += '- `' + v.name + '` = ' + (v.value || '_(unset)_') + '\n'); }
        if (h.ctx.length)  { md += '\n## Context & Constraints\n'; h.ctx.forEach(c => md += '- ' + c.replace('=', ': ') + '\n'); }
        md += '\n## Tasks\nPerform the following in order:\n\n';
        if (!state.nodes.length) md += '_(no tasks defined)_\n';
        else state.nodes.forEach((n, i) => { md += mdNode(n, 0, String(i + 1)); });
        md += '\n---\n_Generated with Prompt Generator_\n';
        return md;
    }
    function mdNode(n, depth, num) {
        const ind = '  '.repeat(depth);
        if (n.type === 'task') {
            const t = TASK_TYPE_MAP[n.action] || { verb: n.action };
            if (n.action === 'goto') return ind + '- **' + num + '. GOTO** Step ' + (stepNumberOf(n.gotoRef) || '?') + '\n';
            if (NO_TARGET[n.action]) return ind + '- **' + num + '. ' + t.verb + '**\n';
            const verb = getVerb(n);
            let s = ind + '- **' + num + '. ' + verb + '**: `' + (n.target || '(not specified)') + '`\n';
            if (n.details && n.details.trim()) n.details.split('\n').filter(l => l.trim()).forEach(l => s += ind + '  - ' + l.trim() + '\n');
            return s;
        }
        if (n.type === 'if') {
            let s = ind + '- **' + num + '. IF** `' + (n.condition || '?') + '` **THEN:**\n';
            s += slotMd(n.then, depth + 1, num);
            (n.elseifs || []).forEach(e => { s += ind + '  **ELSE IF** `' + (e.condition || '?') + '`:\n'; s += slotMd(e.children, depth + 1, num); });
            if ((n.else || []).length) { s += ind + '  **ELSE:**\n'; s += slotMd(n.else, depth + 1, num); }
            return s;
        }
        if (n.type === 'loop') {
            let head = n.loopType === 'while' ? 'WHILE `' + (n.source || '?') + '`'
                : n.loopType === 'repeat' ? 'REPEAT `' + (n.source || '?') + '` TIMES'
                : 'FOR EACH `' + (n.itemVar || 'item') + '` IN `' + (n.source || '?') + '`';
            return ind + '- **' + num + '. ' + head + ':**\n' + slotMd(n.body, depth + 1, num);
        }
        if (n.type === 'subagent') {
            let s = ind + '- **' + num + '. SPAWN sub-agents** [' + (n.execMode || 'parallel') + ']:\n';
            (n.agents || []).forEach((a, ai) => {
                s += ind + '  - **' + (a.role || 'agent') + '**' + (a.task ? ' — ' + a.task : '') + '\n';
                if (a.children && a.children.length) s += slotMd(a.children, depth + 2, num + '.' + (ai + 1));
            });
            return s;
        }
        if (n.type === 'parallel') {
            let s = ind + '- **' + num + '. PARALLEL:**\n';
            (n.branches || []).forEach((b, bi) => { s += ind + '  - _branch ' + (bi + 1) + ':_\n'; s += slotMd(b, depth + 2, num + '.' + (bi + 1)); });
            return s;
        }
        return '';
    }
    function slotMd(arr, depth, parentNum) {
        if (!arr || !arr.length) return '  '.repeat(depth) + '- _(empty)_\n';
        let s = '';
        arr.forEach((n, i) => { s += mdNode(n, depth, parentNum + '.' + (i + 1)); });
        return s;
    }

    // ──────────────────────────────────────
    // Preview render + token estimate + validation  [B4, B15, 5.2, 5.6]
    // ──────────────────────────────────────
    let previewTimer;
    function updatePreview() {
        clearTimeout(previewTimer);
        previewTimer = setTimeout(renderPreviewNow, 110);
        saveState();
    }
    function renderPreviewNow() {
        const text = generateOutput();
        const html = highlight(text);
        previewBlock.innerHTML = html;
        // token estimate (rough ~4 chars/token)
        if (tokenBadge) tokenBadge.textContent = '~' + Math.max(1, Math.round(text.length / 4)) + ' tok';
        // validation: count empty required fields
        let missing = 0;
        walk(state.nodes, (n) => {
            if (n.type === 'task' && !NO_TARGET[n.action] && !(n.target || '').trim()) missing++;
            if (n.type === 'task' && n.action === 'goto' && !n.gotoRef) missing++;
            if (n.type === 'if' && !(n.condition || '').trim()) missing++;
            if (n.type === 'loop' && !(n.source || '').trim()) missing++;
        });
        if (validBadge) {
            validBadge.textContent = missing ? '⚠ ' + missing + ' incomplete' : '✓ complete';
            validBadge.className = 'valid-badge ' + (missing ? 'is-warn' : 'is-ok');
        }
    }
    function highlight(text) {
        return escapeHtml(text)
            .replace(/^(# .+)$/gm, '<span class="md-h1">$1</span>')
            .replace(/^(## .+)$/gm, '<span class="md-h2">$1</span>')
            .replace(/^(### .+)$/gm, '<span class="md-h3">$1</span>')
            .replace(/^(ROLE:|VARS:|CONTEXT:|STEPS)(.*)$/gm, '<span class="md-h2">$1</span>$2')
            .replace(/\*\*(.+?)\*\*/g, '<span class="md-bold">**$1**</span>')
            .replace(/`([^`]+?)`/g, '<span class="md-code">`$1`</span>')
            .replace(/(\/\/[^\n]*)$/gm, '<span class="md-comment">$1</span>')
            .replace(/&lt;([a-z?]+?)&gt;/g, '<span class="md-missing">&lt;$1&gt;</span>')
            .replace(/\b(IF|ELSE IF|ELSE|THEN|FOR EACH|IN|WHILE|REPEAT|TIMES|SPAWN|PARALLEL|GOTO|BREAK|CONTINUE|DO|CLONE|ANALYZE|RESEARCH|IMPLEMENT|REFACTOR|TEST|DOCUMENT|REVIEW|DEPLOY|DEBUG|OPTIMIZE|MIGRATE|CONFIGURE|MONITOR|CREATE|UPDATE|DELETE|RENAME|FILE|FOLDER)\b/g, '<span class="md-keyword">$1</span>');
    }

    // ──────────────────────────────────────
    // Recursive card rendering  [3.3, 3.6]
    // ──────────────────────────────────────
    function renderTasks() {
        taskList.innerHTML = '';
        if (!state.nodes.length) {
            taskList.classList.add('empty-list');
            taskList.innerHTML = '<p>No steps yet. Add a Task, If/Else, Loop, Sub-Agent, or Parallel block.</p>';
        } else {
            taskList.classList.remove('empty-list');
            renderInto(state.nodes, taskList, 0);
        }
        renderPreviewNow();
    }
    function renderInto(arr, container, depth) {
        arr.forEach((node, i) => {
            container.appendChild(buildCard(node, depth, i + 1, arr));
        });
    }
    function numberFor(node) { return stepNumberOf(node.id) || '•'; }

    function buildCard(node, depth, localIndex, parentArr) {
        const card = document.createElement('div');
        card.dataset.nodeId = node.id;
        card.className = 'task-card depth-' + Math.min(depth, 6) +
            (node.type === 'if' ? ' card-if' : node.type === 'loop' ? ' card-loop' :
             node.type === 'subagent' ? ' card-subagent' : node.type === 'parallel' ? ' card-parallel' : '');

        card.innerHTML =
            '<span class="task-number">' + numberFor(node) + '</span>' +
            '<div class="drag-handle" draggable="true" title="Drag to reorder" aria-label="Drag to reorder">⋮⋮</div>' +
            '<div class="task-content">' + cardBody(node) + '</div>' +
            '<div class="task-actions">' +
                (isContainer(node) ? '<button class="btn-icon btn-collapse" data-action="collapse" title="Collapse" aria-label="Collapse">' + (node.collapsed ? '▸' : '▾') + '</button>' : '') +
                '<button class="btn-icon btn-move" data-action="moveUp" title="Move up" aria-label="Move up">▲</button>' +
                '<button class="btn-icon btn-move" data-action="moveDown" title="Move down" aria-label="Move down">▼</button>' +
                '<button class="btn-icon" data-action="duplicate" title="Duplicate" aria-label="Duplicate">⧉</button>' +
                '<button class="btn-icon btn-remove" data-action="remove" title="Remove" aria-label="Remove">✕</button>' +
            '</div>';

        // nested slots
        if (isContainer(node) && !node.collapsed) {
            const slotsWrap = card.querySelector('.task-content');
            buildSlots(node, slotsWrap, depth);
        }
        return card;
    }

    function cardBody(node) {
        if (node.type === 'task')     return taskFields(node);
        if (node.type === 'if')       return ifHead(node);
        if (node.type === 'loop')     return loopHead(node);
        if (node.type === 'subagent') return subagentHead(node);
        if (node.type === 'parallel') return '<div class="block-label label-parallel">⇉ Parallel block (branches run concurrently)</div>';
        return '';
    }

    function taskFields(node) {
        const t = TASK_TYPE_MAP[node.action] || { ph: '' };
        const tt = node.targetType || 'file';
        const ph = HAS_TARGET_TYPE[node.action] ? (TARGET_TYPE_PH[node.action][tt] || t.ph) : t.ph;
        let html = '<div class="task-top-row">' +
            '<select class="task-type-select" data-field="action" aria-label="Task type">' +
                TASK_TYPES.map(o => '<option value="' + o.value + '"' + (node.action === o.value ? ' selected' : '') + '>' + o.label + '</option>').join('') +
            '</select>';
        if (HAS_TARGET_TYPE[node.action]) {
            html += '<div class="target-type-toggle" role="group" aria-label="Target type">' +
                '<button class="target-type-opt' + (tt === 'file' ? ' active' : '') + '" data-action="targetType" data-type="file">📄 File</button>' +
                '<button class="target-type-opt' + (tt === 'folder' ? ' active' : '') + '" data-action="targetType" data-type="folder">📁 Folder</button>' +
            '</div>';
        }
        if (node.action === 'goto') {
            const steps = collectReferencableSteps().filter(s => s.id !== node.id);
            html += '<select class="task-goto-select" data-field="gotoRef" aria-label="Target step">' +
                '<option value="">— pick a step —</option>' +
                steps.map(s => '<option value="' + s.id + '"' + (node.gotoRef === s.id ? ' selected' : '') + '>' + escapeHtml(s.label) + '</option>').join('') +
                '</select>';
            if (node.gotoRef && !steps.some(s => s.id === node.gotoRef)) html += '<span class="ref-warn">⚠ deleted</span>';
        } else if (!NO_TARGET[node.action]) {
            html += '<input type="text" class="task-param-input" data-field="target" value="' + attr(node.target) + '" placeholder="' + attr(ph) + '">';
        } else {
            html += '<span class="task-noparam">no parameters</span>';
        }
        html += '</div>';
        if (!NO_TARGET[node.action]) {
            html += '<textarea class="task-details-input" data-field="details" placeholder="Notes / acceptance criteria (optional)" rows="2">' + escapeHtml(node.details) + '</textarea>';
        }
        return html;
    }

    function ifHead(node) {
        return '<div class="block-label label-if">❖ Conditional (If / Else)</div>' +
            '<input type="text" class="condition-input" data-field="condition" value="' + attr(node.condition) + '" placeholder="condition, e.g. tests pass, file exists, status==200">';
    }
    function loopHead(node) {
        const lt = node.loopType;
        const srcLabel = lt === 'while' ? 'Condition' : lt === 'repeat' ? 'Count (N)' : 'Collection / source';
        const srcPh = lt === 'while' ? 'errors.length > 0' : lt === 'repeat' ? '3' : 'files in src/';
        return '<div class="block-label label-loop">↻ Loop</div>' +
            '<div class="loop-fields">' +
                '<div class="loop-field"><label>Type</label><select class="loop-type-select" data-field="loopType" aria-label="Loop type">' +
                    LOOP_TYPES.map(o => '<option value="' + o.value + '"' + (lt === o.value ? ' selected' : '') + '>' + o.label + '</option>').join('') +
                '</select></div>' +
                '<div class="loop-field"><label>' + srcLabel + '</label><input type="text" data-field="source" value="' + attr(node.source) + '" placeholder="' + attr(srcPh) + '"></div>' +
                (lt === 'for_each' ? '<div class="loop-field"><label>Item var</label><input type="text" data-field="itemVar" value="' + attr(node.itemVar) + '" placeholder="item"></div>' : '') +
            '</div>';
    }
    function subagentHead(node) {
        return '<div class="block-label label-subagent">🤖 Sub-Agents' +
            '<div class="exec-toggle" role="group" aria-label="Execution mode">' +
                '<button class="exec-opt' + (node.execMode === 'sequential' ? ' active' : '') + '" data-action="execMode" data-mode="sequential">▸ Sequential</button>' +
                '<button class="exec-opt' + (node.execMode === 'parallel' ? ' active' : '') + '" data-action="execMode" data-mode="parallel">⇉ Parallel</button>' +
            '</div></div>';
    }

    // ──────────────────────────────────────
    // Build nested slots (drop-zones + child cards)  [3.3]
    // ──────────────────────────────────────
    function buildSlots(node, contentEl, depth) {
        const wrap = document.createElement('div');
        wrap.className = 'slots-wrap';

        if (node.type === 'if') {
            wrap.appendChild(slotBlock('THEN', 'then', node.then, node, depth, 'branch-then'));
            (node.elseifs || []).forEach((e, i) => {
                const block = document.createElement('div');
                block.className = 'slot-block';
                block.innerHTML = '<div class="slot-head branch-elseif">ELSE IF ' +
                    '<input type="text" class="elseif-cond" data-elseif="' + i + '" value="' + attr(e.condition) + '" placeholder="another condition…">' +
                    '<button class="btn-icon btn-remove" data-action="removeElseIf" data-elseif="' + i + '" title="Remove branch" aria-label="Remove branch">✕</button></div>';
                block.appendChild(dropZone(node, 'elseif:' + i, e.children, depth));
                wrap.appendChild(block);
            });
            const addElse = document.createElement('button');
            addElse.className = 'slot-add'; addElse.dataset.action = 'addElseIf';
            addElse.textContent = '+ Add ELSE IF branch';
            wrap.appendChild(addElse);
            wrap.appendChild(slotBlock('ELSE (optional)', 'else', node.else, node, depth, 'branch-else'));
        }
        else if (node.type === 'loop') {
            wrap.appendChild(slotBlock('LOOP BODY', 'body', node.body, node, depth, 'branch-loop'));
        }
        else if (node.type === 'subagent') {
            (node.agents || []).forEach((a, i) => {
                const block = document.createElement('div');
                block.className = 'slot-block agent-block';
                block.innerHTML =
                    '<div class="slot-head branch-agent">AGENT ' + (i + 1) +
                        '<button class="btn-icon btn-remove" data-action="removeAgent" data-agent="' + i + '" title="Remove agent" aria-label="Remove agent">✕</button>' +
                    '</div>' +
                    '<div class="agent-meta">' +
                        '<input type="text" class="agent-role" data-agent="' + i + '" data-field="role" value="' + attr(a.role) + '" placeholder="Role, e.g. Security Reviewer">' +
                        '<input type="text" class="agent-task" data-agent="' + i + '" data-field="task" value="' + attr(a.task) + '" placeholder="One-line objective">' +
                        '<label class="mini-chk"><input type="checkbox" data-agent="' + i + '" data-field="agentic"' + (a.agentic ? ' checked' : '') + '> agentic</label>' +
                    '</div>' +
                    '<div class="agent-steps-label">Agent steps (optional):</div>';
                block.appendChild(dropZone(node, 'agent:' + i, a.children, depth));
                wrap.appendChild(block);
            });
            const addAgent = document.createElement('button');
            addAgent.className = 'slot-add'; addAgent.dataset.action = 'addAgent';
            addAgent.textContent = '+ Add sub-agent';
            wrap.appendChild(addAgent);
        }
        else if (node.type === 'parallel') {
            (node.branches || []).forEach((b, i) => {
                const block = document.createElement('div');
                block.className = 'slot-block';
                block.innerHTML = '<div class="slot-head branch-parallel">BRANCH ' + (i + 1) +
                    ((node.branches.length > 2) ? '<button class="btn-icon btn-remove" data-action="removeBranch" data-branch="' + i + '" title="Remove branch" aria-label="Remove branch">✕</button>' : '') +
                    '</div>';
                block.appendChild(dropZone(node, 'branch:' + i, b, depth));
                wrap.appendChild(block);
            });
            const addBranch = document.createElement('button');
            addBranch.className = 'slot-add'; addBranch.dataset.action = 'addBranch';
            addBranch.textContent = '+ Add branch';
            wrap.appendChild(addBranch);
        }
        contentEl.appendChild(wrap);
    }

    function slotBlock(label, slotKey, arr, node, depth, cls) {
        const block = document.createElement('div');
        block.className = 'slot-block';
        block.innerHTML = '<div class="slot-head ' + cls + '">' + label + '</div>';
        block.appendChild(dropZone(node, slotKey, arr, depth));
        return block;
    }

    function dropZone(parentNode, slotKey, arr, depth) {
        const dz = document.createElement('div');
        dz.className = 'drop-zone';
        dz.dataset.parentId = parentNode.id;
        dz.dataset.slot = slotKey;
        if (!arr.length) {
            const hint = document.createElement('div');
            hint.className = 'drop-hint';
            hint.textContent = 'Drop a block here, or use the + buttons below';
            dz.appendChild(hint);
        } else {
            renderInto(arr, dz, depth + 1);
        }
        // inline add bar
        const bar = document.createElement('div');
        bar.className = 'inline-add';
        bar.dataset.parentId = parentNode.id;
        bar.dataset.slot = slotKey;
        bar.innerHTML =
            '<button data-add="task">+ Task</button>' +
            '<button data-add="if">+ If</button>' +
            '<button data-add="loop">+ Loop</button>' +
            '<button data-add="subagent">+ Sub-Agent</button>' +
            '<button data-add="parallel">+ Parallel</button>';
        dz.appendChild(bar);
        return dz;
    }

    // ──────────────────────────────────────
    // CRUD
    // ──────────────────────────────────────
    function addNodeTo(parentId, slotKey, kind) {
        const node = makeNode(kind);
        if (!parentId) { state.nodes.push(node); }
        else {
            const f = findNode(parentId);
            const arr = f && getSlotArr(f.node, slotKey);
            if (arr) arr.push(node);
        }
        pushHistory(); renderTasks(); saveState();
        focusCard(node.id);
    }
    function focusCard(id) {
        requestAnimationFrame(() => {
            const card = taskList.querySelector('.task-card[data-node-id="' + id + '"]');
            if (card) { card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                card.classList.add('flash'); setTimeout(() => card.classList.remove('flash'), 800); }
        });
    }
    function removeNodeById(id) { removeNode(id); pushHistory(); renderTasks(); saveState(); }
    function duplicateNode(id) {
        const f = findNode(id);
        if (!f) return;
        const clone = reId(deepClone(f.node));
        f.parentArr.splice(f.index + 1, 0, clone);
        pushHistory(); renderTasks(); saveState();
    }
    function moveWithin(id, dir) {
        const f = findNode(id);
        if (!f) return;
        const ni = f.index + dir;
        if (ni < 0 || ni >= f.parentArr.length) return;
        const tmp = f.parentArr[f.index]; f.parentArr[f.index] = f.parentArr[ni]; f.parentArr[ni] = tmp;
        pushHistory(); renderTasks(); saveState();
    }
    function setField(id, field, value, rerender) {
        const f = findNode(id);
        if (!f) return;
        f.node[field] = value;
        if (rerender) { pushHistory(); renderTasks(); }
        else { updatePreview(); }
        saveState();
    }

    // ──────────────────────────────────────
    // Event delegation
    // ──────────────────────────────────────
    taskList.addEventListener('input', (e) => {
        const card = e.target.closest('.task-card'); if (!card) return;
        const id = card.dataset.nodeId;
        const field = e.target.dataset.field;
        const agentIdx = e.target.dataset.agent;
        const elseifIdx = e.target.dataset.elseif;

        if (agentIdx !== undefined && field) {
            const f = findNode(id);
            if (f && f.node.agents[agentIdx]) {
                f.node.agents[agentIdx][field] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
                updatePreview(); saveState();
            }
            return;
        }
        if (elseifIdx !== undefined && e.target.classList.contains('elseif-cond')) {
            const f = findNode(id);
            if (f && f.node.elseifs[elseifIdx]) { f.node.elseifs[elseifIdx].condition = e.target.value; updatePreview(); saveState(); }
            return;
        }
        if (field) setField(id, field, e.target.value, false);
    });

    taskList.addEventListener('change', (e) => {
        const card = e.target.closest('.task-card'); if (!card) return;
        const id = card.dataset.nodeId;
        const field = e.target.dataset.field;
        const agentIdx = e.target.dataset.agent;

        if (agentIdx !== undefined && field === 'agentic') {
            const f = findNode(id);
            if (f && f.node.agents[agentIdx]) { f.node.agents[agentIdx].agentic = e.target.checked; updatePreview(); saveState(); }
            return;
        }
        // type/loopType/goto changes require re-render (fields differ)  [#5]
        if (field === 'action' || field === 'loopType') setField(id, field, e.target.value, true);
        else if (field === 'gotoRef') setField(id, field, e.target.value, false);
    });

    taskList.addEventListener('click', (e) => {
        // inline add bar
        const addBtn = e.target.closest('.inline-add button[data-add]');
        if (addBtn) {
            const bar = addBtn.closest('.inline-add');
            addNodeTo(bar.dataset.parentId, bar.dataset.slot, addBtn.dataset.add);
            return;
        }
        const slotAdd = e.target.closest('.slot-add');
        if (slotAdd) {
            const card = slotAdd.closest('.task-card'); const id = card.dataset.nodeId; const f = findNode(id);
            if (!f) return;
            if (slotAdd.dataset.action === 'addElseIf') { f.node.elseifs.push({ condition: '', children: [] }); pushHistory(); renderTasks(); }
            if (slotAdd.dataset.action === 'addAgent')  { f.node.agents.push(makeAgent()); pushHistory(); renderTasks(); }
            if (slotAdd.dataset.action === 'addBranch') { f.node.branches.push([]); pushHistory(); renderTasks(); }
            saveState();
            return;
        }
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const card = btn.closest('.task-card'); if (!card) return;
        const id = card.dataset.nodeId;
        const action = btn.dataset.action;
        const f = findNode(id);

        if (action === 'remove') removeNodeById(id);
        else if (action === 'duplicate') duplicateNode(id);
        else if (action === 'moveUp') moveWithin(id, -1);
        else if (action === 'moveDown') moveWithin(id, 1);
        else if (action === 'collapse') { if (f) { f.node.collapsed = !f.node.collapsed; renderTasks(); saveState(); } }
        else if (action === 'execMode') { if (f) { f.node.execMode = btn.dataset.mode; pushHistory(); renderTasks(); saveState(); } }
        else if (action === 'removeElseIf') { if (f) { f.node.elseifs.splice(+btn.dataset.elseif, 1); pushHistory(); renderTasks(); saveState(); } }
        else if (action === 'removeAgent')  { if (f && f.node.agents.length > 1) { f.node.agents.splice(+btn.dataset.agent, 1); pushHistory(); renderTasks(); saveState(); } }
        else if (action === 'removeBranch') { if (f && f.node.branches.length > 2) { f.node.branches.splice(+btn.dataset.branch, 1); pushHistory(); renderTasks(); saveState(); } }
        else if (action === 'targetType') { if (f) { f.node.targetType = btn.dataset.type; pushHistory(); renderTasks(); saveState(); } }
    });

    // ──────────────────────────────────────
    // Drag & drop into containers  [3.3, B14]
    // ──────────────────────────────────────
    let draggedId = null;
    taskList.addEventListener('dragstart', (e) => {
        const handle = e.target.closest('.drag-handle'); if (!handle) return;
        const card = handle.closest('.task-card'); if (!card) return;
        draggedId = card.dataset.nodeId;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', draggedId); } catch (x) {}
    });
    taskList.addEventListener('dragend', () => {
        taskList.querySelectorAll('.dragging,.dz-over').forEach(el => el.classList.remove('dragging', 'dz-over'));
        draggedId = null;
    });
    taskList.addEventListener('dragover', (e) => {
        if (!draggedId) return;
        const dz = e.target.closest('.drop-zone');
        e.preventDefault();
        taskList.querySelectorAll('.dz-over').forEach(el => el.classList.remove('dz-over'));
        if (dz) dz.classList.add('dz-over');
        else taskList.classList.add('dz-over');
    });
    taskList.addEventListener('drop', (e) => {
        if (!draggedId) return;
        e.preventDefault();
        const dz = e.target.closest('.drop-zone');
        let targetArr, insertIdx;
        if (dz) {
            const parent = findNode(dz.dataset.parentId);
            targetArr = parent && getSlotArr(parent.node, dz.dataset.slot);
            if (!targetArr) { draggedId = null; return; }
            insertIdx = computeIndex(dz, e.clientY, targetArr);
        } else {
            // dropped on root list
            targetArr = state.nodes;
            insertIdx = computeIndex(taskList, e.clientY, targetArr, true);
        }
        moveNode(draggedId, targetArr, insertIdx);
        draggedId = null;
        pushHistory(); renderTasks(); saveState();
    });
    function computeIndex(container, y, arr, rootLevel) {
        const cards = Array.from(container.children).filter(c => c.classList && c.classList.contains('task-card'));
        for (let i = 0; i < cards.length; i++) {
            const r = cards[i].getBoundingClientRect();
            if (y < r.top + r.height / 2) return i;
        }
        return cards.length;
    }

    // ──────────────────────────────────────
    // DOM refs (top-level controls)
    // ──────────────────────────────────────
    const roleSelect = document.getElementById('roleSelect');
    const customRoleWrap = document.getElementById('customRoleWrap');
    const customRoleInput = document.getElementById('customRoleInput');
    const chkAgentic = document.getElementById('chkAgentic');
    const chkSubagent = document.getElementById('chkSubagent');
    const chkVerbose = document.getElementById('chkVerbose');
    const chkStrict = document.getElementById('chkStrict');
    const contextProject = document.getElementById('contextProject');
    const contextTech = document.getElementById('contextTech');
    const contextConstraints = document.getElementById('contextConstraints');
    const contextOutput = document.getElementById('contextOutput');
    const varList = document.getElementById('varList');
    const btnAddVar = document.getElementById('btnAddVar');
    const btnCopy = document.getElementById('btnCopy');
    const btnDownload = document.getElementById('btnDownload');
    const btnReset = document.getElementById('btnReset');
    const btnExportJson = document.getElementById('btnExportJson');
    const btnUndo = document.getElementById('btnUndo');
    const btnRedo = document.getElementById('btnRedo');
    const themeToggle = document.getElementById('themeToggle');

    // add-block buttons (root level)
    document.getElementById('btnAddTask').addEventListener('click', () => addNodeTo(null, null, 'task'));
    document.getElementById('btnAddIf').addEventListener('click', () => addNodeTo(null, null, 'if'));
    document.getElementById('btnAddLoop').addEventListener('click', () => addNodeTo(null, null, 'loop'));
    document.getElementById('btnAddSub').addEventListener('click', () => addNodeTo(null, null, 'subagent'));
    document.getElementById('btnAddParallel').addEventListener('click', () => addNodeTo(null, null, 'parallel'));

    // ──────────────────────────────────────
    // Variables  [5.1]
    // ──────────────────────────────────────
    function renderVariables() {
        varList.innerHTML = '';
        (state.variables || []).forEach((v, i) => {
            const row = document.createElement('div');
            row.className = 'var-row';
            row.innerHTML =
                '<input type="text" class="var-name" data-i="' + i + '" value="' + attr(v.name) + '" placeholder="name">' +
                '<input type="text" class="var-val" data-i="' + i + '" value="' + attr(v.value) + '" placeholder="value">' +
                '<button class="btn-icon btn-remove" data-i="' + i + '" data-vremove title="Remove variable" aria-label="Remove variable">✕</button>';
            varList.appendChild(row);
        });
    }
    btnAddVar.addEventListener('click', () => { state.variables.push({ name: '', value: '' }); renderVariables(); pushHistory(); updatePreview(); });
    varList.addEventListener('input', (e) => {
        const i = e.target.dataset.i; if (i === undefined) return;
        if (e.target.classList.contains('var-name')) state.variables[i].name = e.target.value;
        if (e.target.classList.contains('var-val')) state.variables[i].value = e.target.value;
        updatePreview();
    });
    varList.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-vremove]'); if (!btn) return;
        state.variables.splice(+btn.dataset.i, 1); renderVariables(); pushHistory(); updatePreview();
    });

    // ──────────────────────────────────────
    // Top-level listeners
    // ──────────────────────────────────────
    roleSelect.addEventListener('change', () => {
        state.roleSelectValue = roleSelect.value;
        customRoleWrap.classList.toggle('visible', state.roleSelectValue === 'custom');
        updatePreview(); pushHistory();
    });
    customRoleInput.addEventListener('input', () => { state.customRole = customRoleInput.value; updatePreview(); });
    chkAgentic.addEventListener('change', () => { state.agentic = chkAgentic.checked; updatePreview(); pushHistory(); });
    chkSubagent.addEventListener('change', () => { state.subagent = chkSubagent.checked; updatePreview(); pushHistory(); });
    chkVerbose.addEventListener('change', () => { state.verbose = chkVerbose.checked; updatePreview(); pushHistory(); });
    chkStrict.addEventListener('change', () => { state.strict = chkStrict.checked; updatePreview(); pushHistory(); });
    contextProject.addEventListener('input', () => { state.contextProject = contextProject.value; updatePreview(); });
    contextTech.addEventListener('input', () => { state.contextTech = contextTech.value; updatePreview(); });
    contextConstraints.addEventListener('input', () => { state.contextConstraints = contextConstraints.value; updatePreview(); });
    contextOutput.addEventListener('change', () => { state.contextOutput = contextOutput.value; updatePreview(); pushHistory(); });

    modeToggle.addEventListener('click', (e) => {
        const opt = e.target.closest('[data-mode]'); if (!opt) return;
        state.outputMode = opt.dataset.mode;
        modeToggle.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === state.outputMode));
        renderPreviewNow(); saveState();
    });

    // ──────────────────────────────────────
    // UI sync from state
    // ──────────────────────────────────────
    function updateAllUI() {
        roleSelect.value = state.roleSelectValue;
        customRoleInput.value = state.customRole;
        customRoleWrap.classList.toggle('visible', state.roleSelectValue === 'custom');
        chkAgentic.checked = state.agentic; chkSubagent.checked = state.subagent;
        chkVerbose.checked = state.verbose; chkStrict.checked = state.strict;
        contextProject.value = state.contextProject || '';
        contextTech.value = state.contextTech || '';
        contextConstraints.value = state.contextConstraints || '';
        contextOutput.value = state.contextOutput || '';
        modeToggle.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === state.outputMode));
        renderVariables();
        renderTasks();
    }

    // ──────────────────────────────────────
    // Action buttons
    // ──────────────────────────────────────
    btnCopy.addEventListener('click', () => {
        const text = generateOutput();
        navigator.clipboard.writeText(text).then(() => showToast('Copied!')).catch(() => {
            const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta);
            ta.select(); try { document.execCommand('copy'); } catch (x) {} document.body.removeChild(ta); showToast('Copied!');
        });
    });
    btnDownload.addEventListener('click', () => {
        const text = generateOutput();
        const ext = state.outputMode === 'markdown' ? '.md' : '.txt';
        download(text, 'agent-prompt-' + ts() + ext, 'text/markdown');
        showToast('Downloaded');
    });
    btnExportJson.addEventListener('click', () => {
        download(JSON.stringify(state, null, 2), 'prompt-tree-' + ts() + '.json', 'application/json');
        showToast('Exported JSON');
    });
    btnReset.addEventListener('click', () => {
        if (confirm('Reset everything? This cannot be undone.')) {
            state = defaultState(); pushHistory(); updateAllUI(); saveState(); showToast('Reset');
        }
    });
    btnUndo.addEventListener('click', undo);
    btnRedo.addEventListener('click', redo);

    function download(content, filename, mime) {
        const blob = new Blob([content], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
    }
    function ts() { return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-'); }

    // ──────────────────────────────────────
    // Theme  [5.7]
    // ──────────────────────────────────────
    function applyTheme(t) {
        document.documentElement.setAttribute('data-theme', t);
        try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
        themeToggle.textContent = t === 'dark' ? '☀️' : '🌙';
    }
    themeToggle.addEventListener('click', () => {
        const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        applyTheme(cur);
    });

    // ──────────────────────────────────────
    // Workflows sidebar  [B7]
    // ──────────────────────────────────────
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const workflowNameInput = document.getElementById('workflowName');
    const btnSaveWorkflow = document.getElementById('btnSaveWorkflow');
    const workflowListDiv = document.getElementById('workflowList');
    const btnExportAll = document.getElementById('btnExportAll');
    const btnImportFile = document.getElementById('btnImportFile');
    const importFileInput = document.getElementById('importFileInput');

    function getWorkflows() { try { return JSON.parse(localStorage.getItem(WORKFLOWS_KEY)) || []; } catch (e) { return []; } }
    function setWorkflows(w) { try { localStorage.setItem(WORKFLOWS_KEY, JSON.stringify(w)); } catch (e) {} }
    function validWorkflow(w) { return w && typeof w.name === 'string' && w.state && Array.isArray(w.state.nodes); }

    function renderWorkflowList() {
        const ws = getWorkflows();
        workflowListDiv.innerHTML = '';
        if (!ws.length) { workflowListDiv.innerHTML = '<p class="wf-empty">No saved workflows yet.</p>'; return; }
        ws.forEach(w => {
            const item = document.createElement('div'); item.className = 'workflow-item';
            item.innerHTML = '<span class="workflow-item-name">' + escapeHtml(w.name) + '</span>' +
                '<div class="workflow-item-actions">' +
                '<button class="btn-icon-small" data-act="load" title="Load" aria-label="Load">📂</button>' +
                '<button class="btn-icon-small" data-act="del" title="Delete" aria-label="Delete">🗑️</button></div>';
            item.querySelector('[data-act="load"]').addEventListener('click', () => loadWorkflow(w.name));
            item.querySelector('[data-act="del"]').addEventListener('click', () => { if (confirm('Delete "' + w.name + '"?')) { setWorkflows(getWorkflows().filter(x => x.name !== w.name)); renderWorkflowList(); } });
            workflowListDiv.appendChild(item);
        });
    }
    function saveCurrentWorkflow(name) {
        const ws = getWorkflows();
        const snap = deepClone(state);
        const i = ws.findIndex(w => w.name === name);
        if (i > -1) ws[i].state = snap; else ws.push({ name, state: snap });
        setWorkflows(ws); renderWorkflowList();
    }
    function loadWorkflow(name) {
        const w = getWorkflows().find(x => x.name === name);
        if (!validWorkflow(w)) { showToast('⚠️ Workflow is corrupt'); return; }
        state = deepClone(w.state); pushHistory(); updateAllUI(); saveState(); showToast('Loaded "' + name + '"');
    }
    btnSaveWorkflow.addEventListener('click', () => {
        const name = workflowNameInput.value.trim();
        if (!name) { showToast('Enter a name'); return; }
        saveCurrentWorkflow(name); workflowNameInput.value = ''; showToast('Saved "' + name + '"');
    });
    btnExportAll.addEventListener('click', () => { download(JSON.stringify(getWorkflows(), null, 2), 'prompt-workflows-' + ts() + '.json', 'application/json'); showToast('Exported'); });
    btnImportFile.addEventListener('click', () => importFileInput.click());
    importFileInput.addEventListener('change', (e) => {
        if (!e.target.files.length) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const imported = JSON.parse(ev.target.result);
                if (!Array.isArray(imported)) { showToast('⚠️ Invalid file format'); return; }
                const good = imported.filter(validWorkflow);
                if (!good.length) { showToast('⚠️ No valid workflows'); return; }
                const merged = getWorkflows();
                good.forEach(imp => { const i = merged.findIndex(w => w.name === imp.name); if (i > -1) merged[i] = imp; else merged.push(imp); });
                setWorkflows(merged); renderWorkflowList();
                showToast('Imported ' + good.length + (good.length < imported.length ? ' (skipped ' + (imported.length - good.length) + ')' : ''));
            } catch (err) { showToast('⚠️ Invalid JSON file'); }
        };
        reader.readAsText(e.target.files[0]); importFileInput.value = '';
    });

    function openSidebar() { document.body.classList.add('sidebar-open'); }
    function closeSidebar() { document.body.classList.remove('sidebar-open'); }
    sidebarToggle.addEventListener('click', () => document.body.classList.toggle('sidebar-open'));
    sidebarOverlay.addEventListener('click', closeSidebar);

    // ──────────────────────────────────────
    // Toast
    // ──────────────────────────────────────
    let toastTimer;
    function showToast(msg) { clearTimeout(toastTimer); toast.textContent = msg; toast.classList.add('show'); toastTimer = setTimeout(() => toast.classList.remove('show'), 2000); }

    // ──────────────────────────────────────
    // Keyboard shortcuts
    // ──────────────────────────────────────
    document.addEventListener('keydown', (e) => {
        const typing = ['INPUT', 'TEXTAREA', 'SELECT'].indexOf(document.activeElement.tagName) !== -1;
        if (e.key === 'Escape' && document.body.classList.contains('sidebar-open')) closeSidebar();
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
        if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); redo(); }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n' && !typing) { e.preventDefault(); addNodeTo(null, null, 'task'); }
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c') { e.preventDefault(); btnCopy.click(); }
    });

    // ──────────────────────────────────────
    // Init
    // ──────────────────────────────────────
    applyTheme((function () { try { return localStorage.getItem(THEME_KEY) || 'light'; } catch (e) { return 'light'; } })());
    loadState();
    updateAllUI();
    renderWorkflowList();
    pushHistory();
    console.log('Prompt Generator (tree model) ready');
})();