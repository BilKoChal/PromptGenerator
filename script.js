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
        { value: 'produce_file', label: '📄 Produce File', verb: 'PRODUCE FILE', ph: 'docs/plan/${project}_plan.md' },
        { value: 'plan',       label: '📋 Plan',       verb: 'PLAN',       ph: 'docs/${project}_plan.md' },
        { value: 'log',        label: '📝 Log',        verb: 'LOG',        ph: 'docs/worklog.md' },
        { value: 'split',      label: '✂️ Split',      verb: 'SPLIT',      ph: 'criteria for splitting…' },
        { value: 'validate',   label: '✅ Validate',    verb: 'VALIDATE',   ph: 'npm test' },
        { value: 'synthesize', label: '🔗 Synthesize',  verb: 'SYNTHESIZE', ph: 'reports from sub-agents' },
        { value: 'commit',     label: '📌 Commit',     verb: 'COMMIT',     ph: 'type(scope): subject' },
        { value: 'rules',       label: '📜 Rules / Conventions', verb: 'RULES', ph: 'Naming conventions, commit format…' },
        { value: 'goto',        label: '↩️ Go To Step', verb: 'GOTO',      ph: '' },
        { value: 'break',       label: '⛔ Break Loop', verb: 'BREAK',     ph: '' },
        { value: 'continue',    label: '⏭️ Continue',   verb: 'CONTINUE',  ph: '' },
        { value: 'custom_task', label: '💡 Custom',     verb: 'DO',        ph: 'describe what needs to be done…' },
    ];
    const TASK_TYPE_MAP = Object.fromEntries(TASK_TYPES.map(t => [t.value, t]));
    const NO_TARGET = { goto: 1, break: 1, continue: 1, rules: 1 };

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

    const CONTAINER_TYPES = ['section', 'if', 'loop', 'subagent', 'parallel', 'ask', 'route'];
    const isContainer = (n) => CONTAINER_TYPES.includes(n.type);
    // Leaf-only types (for reference, validation, etc.)
    const LEAF_TYPES = ['task', 'gate', 'package', 'table'];

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
        return { id: uid('t'), type: 'task', action: action || 'analyze', target: '', details: '', gotoRef: '', targetType: 'file', rulesList: '', contentOutline: '' };
    }
    function makeIf()       { return { id: uid('if'), type: 'if', condition: '', collapsed: false, then: [], elseifs: [], else: [] }; }
    function makeSection()  { return { id: uid('sec'), type: 'section', title: '', goalNote: '', exitCriteria: '', collapsed: false, children: [] }; }
    function makeLoop()     { return { id: uid('lp'), type: 'loop', loopType: 'for_each', source: '', itemVar: 'item', maxIterations: '', exitCondition: '', collapsed: false, body: [] }; }
    function makeGate()     { return { id: uid('gt'), type: 'gate', prompt: '', onReject: '' }; }
    function makeAgent()    { return { id: uid('ag'), role: '', task: '', agentic: true, verbose: false, domain: '', rationale: '', outputFile: '', isPrimary: false, children: [] }; }
    function makeSubagent() { return { id: uid('sa'), type: 'subagent', execMode: 'parallel', collapsed: false, agents: [makeAgent()] }; }
    function makeParallel() { return { id: uid('pl'), type: 'parallel', collapsed: false, branches: [[], []] }; }
    function makeAsk() {
        return {
            id: uid('ask'), type: 'ask',
            oneMessage: true,
            questions: [
                { id: uid('q'), text: '', kind: 'choice', options: [], allowOther: true, suggestDefault: false, saveTo: '' }
            ],
            branches: [],
            collapsed: false
        };
    }
    function makePackage() {
        return {
            id: uid('pkg'), type: 'package',
            archiveName: 'project_${var}.zip',
            tree: '',
            filesNote: '',
            collapsed: false
        };
    }
    function makeTable() {
        return {
            id: uid('tbl'), type: 'table',
            caption: '',
            headers: ['Column 1', 'Column 2'],
            rows: [['', '']],
            collapsed: false
        };
    }
    function makeRoute() {
        return {
            id: uid('rt'), type: 'route',
            on: 'user intent',
            cases: [
                { label: '', match: '', children: [] }
            ],
            defaultCase: [],
            collapsed: false
        };
    }
    function makeNode(kind) {
        if (kind === 'section') return makeSection();
        if (kind === 'if') return makeIf();
        if (kind === 'loop') return makeLoop();
        if (kind === 'subagent') return makeSubagent();
        if (kind === 'parallel') return makeParallel();
        if (kind === 'gate') return makeGate();
        if (kind === 'ask') return makeAsk();
        if (kind === 'package') return makePackage();
        if (kind === 'table') return makeTable();
        if (kind === 'route') return makeRoute();
        return makeTask();
    }

    // ──────────────────────────────────────
    // Slots: container child-arrays, uniformly
    // ──────────────────────────────────────
    function slotsOf(node) {
        if (node.type === 'section') return [{ key: 'children', label: 'STEPS', arr: node.children }];
        if (node.type === 'if') {
            const s = [{ key: 'then', label: 'THEN', arr: node.then }];
            (node.elseifs || []).forEach((e, i) => s.push({ key: 'elseif:' + i, label: 'ELSE IF', arr: e.children }));
            s.push({ key: 'else', label: 'ELSE', arr: node.else });
            return s;
        }
        if (node.type === 'loop')     return [{ key: 'body', label: 'BODY', arr: node.body }];
        if (node.type === 'subagent') return (node.agents || []).map((a, i) => ({ key: 'agent:' + i, label: 'AGENT', arr: a.children }));
        if (node.type === 'parallel') return (node.branches || []).map((b, i) => ({ key: 'branch:' + i, label: 'BRANCH', arr: b }));
        if (node.type === 'ask') {
            if ((node.branches || []).length) {
                return (node.branches || []).map((b, i) => ({ key: 'askbranch:' + i, label: 'OPTION', arr: b }));
            }
            return [];
        }
        if (node.type === 'route') {
            const s = (node.cases || []).map((c, i) => ({ key: 'case:' + i, label: 'CASE', arr: c.children }));
            s.push({ key: 'default', label: 'DEFAULT', arr: node.defaultCase });
            return s;
        }
        return [];
    }
    function getSlotArr(node, slotKey) {
        if (!node) return null;
        if (slotKey === 'children') return node.children;
        if (slotKey === 'then') return node.then;
        if (slotKey === 'else') return node.else;
        if (slotKey === 'body') return node.body;
        if (slotKey.indexOf('elseif:') === 0) { const i = +slotKey.split(':')[1]; return node.elseifs[i] && node.elseifs[i].children; }
        if (slotKey.indexOf('agent:') === 0)  { const i = +slotKey.split(':')[1]; return node.agents[i] && node.agents[i].children; }
        if (slotKey.indexOf('branch:') === 0) { const i = +slotKey.split(':')[1]; return node.branches[i]; }
        if (slotKey.indexOf('askbranch:') === 0) { const i = +slotKey.split(':')[1]; return node.branches[i]; }
        if (slotKey.indexOf('case:') === 0) { const i = +slotKey.split(':')[1]; return node.cases && node.cases[i] && node.cases[i].children; }
        if (slotKey === 'default') return node.defaultCase;
        return null;
    }

    // ──────────────────────────────────────
    // Tree helpers  [foundation for #3/#4/#6, fixes B14]
    // ──────────────────────────────────────
    function findNode(id, arr) {
        arr = arr || getActiveModeNodes();
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
        arr = arr || getActiveModeNodes(); depth = depth || 0; prefix = prefix || '';
        arr.forEach((n, i) => {
            const num = prefix ? prefix + '.' + (i + 1) : String(i + 1);
            fn(n, depth, num, arr, i);
            if (isContainer(n)) slotsOf(n).forEach(s => walk(s.arr, fn, depth + 1, num));
        });
    }
    function collectReferencableSteps() {
        const out = [];
        walk(getActiveModeNodes(), (n, depth, num) => {
            if (n.type === 'task' && n.action !== 'goto' && n.action !== 'break' && n.action !== 'continue') {
                const verb = getVerb(n);
                out.push({ id: n.id, label: 'Step ' + num + ' — ' + verb + (n.target ? ' ' + n.target.slice(0, 20) : '') });
            } else if (n.type === 'section') {
                out.push({ id: n.id, label: 'Phase ' + num + ' — ' + (n.title || 'untitled').slice(0, 24) });
            } else if (n.type === 'gate') {
                out.push({ id: n.id, label: 'Step ' + num + ' — GATE ' + (n.prompt || 'confirm').slice(0, 20) });
            } else if (n.type === 'ask') {
                out.push({ id: n.id, label: 'Step ' + num + ' — ASK ' + ((n.questions && n.questions[0] && n.questions[0].text) || '').slice(0, 20) });
            } else if (n.type === 'package') {
                out.push({ id: n.id, label: 'Step ' + num + ' — PACKAGE ' + (n.archiveName || '').slice(0, 20) });
            } else if (n.type === 'table') {
                out.push({ id: n.id, label: 'Step ' + num + ' — TABLE ' + (n.caption || '').slice(0, 20) });
            } else if (n.type === 'route') {
                out.push({ id: n.id, label: 'Step ' + num + ' — ROUTE ' + (n.on || '').slice(0, 20) });
            }
        });
        return out;
    }
    function stepNumberOf(id) {
        let r = null;
        walk(getActiveModeNodes(), (n, d, num) => { if (n.id === id) r = num; });
        return r;
    }
    function gotoTitle(id) {
        const f = findNode(id);
        if (!f) return '';
        const n = f.node;
        if (n.type === 'task') { const v = getVerb(n); return (v + (n.target ? ' ' + n.target : '')).slice(0, 40); }
        if (n.type === 'section') return n.title || 'section';
        if (n.type === 'gate') return 'GATE: ' + (n.prompt || 'confirm');
        if (n.type === 'ask') return 'ASK: ' + ((n.questions && n.questions[0] && n.questions[0].text) || '');
        if (n.type === 'package') return 'PACKAGE: ' + (n.archiveName || '');
        if (n.type === 'table') return 'TABLE: ' + (n.caption || '');
        if (n.type === 'route') return 'ROUTE: ' + (n.on || '');
        return n.type;
    }
    function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }
    function reId(node) {
        node.id = uid(node.type === 'task' ? 't' : node.type === 'gate' ? 'gt' : node.type === 'package' ? 'pkg' : node.type === 'ask' ? 'ask' : node.type === 'table' ? 'tbl' : node.type === 'route' ? 'rt' : node.type.slice(0, 2));
        slotsOf(node).forEach(s => s.arr.forEach(reId));
        if (node.type === 'subagent') (node.agents || []).forEach(a => { a.id = uid('ag'); });
        if (node.type === 'ask') (node.questions || []).forEach(q => { q.id = uid('q'); });
        return node;
    }

    // ──────────────────────────────────────
    // State
    // ──────────────────────────────────────
    const STORAGE_KEY = 'prompt_generator_state_v6';
    const WORKFLOWS_KEY = 'prompt_generator_workflows';
    const TEMPLATES_KEY = 'prompt_generator_templates';
    const THEME_KEY = 'prompt_generator_theme';
    const SETTINGS_KEY = 'prompt_generator_settings';  // [S6] customizable output text overrides (separate from main state)
    const SCHEMA = 6;

    function defaultMode() {
        return { id: uid('mode'), name: '/default', summary: 'Default mode', flags: [], nodes: [ makeTask('clone'), makeTask('analyze') ] };
    }
    function defaultState() {
        const nodes = [ makeTask('clone'), makeTask('analyze') ];
        return {
            schema: SCHEMA,
            roleSelectValue: 'Senior Software Engineer (full-stack, React/Node.js, writes production-grade code)',
            customRole: '',
            agentic: false, subagent: false, verbose: false, strict: false,
            contextProject: '', contextTech: '', contextConstraints: '', contextOutput: '',
            memoryDirective: false, memoryFile: 'AGENT_PROMPT.md',
            variables: [],
            resources: [],
            outputMode: 'pseudocode',
            verbosity: 'explicit',
            modes: [{ id: uid('mode'), name: '/default', summary: 'Default mode', flags: [], nodes: nodes }],
            activeModeId: null,
            multiModeEnabled: false,
            nodes: nodes,  // same reference as modes[0].nodes
            settings: {},  // [S1/S6] per-component output-text overrides; empty = all defaults
        };
    }
    let state = defaultState();

    // ══════════════════════════════════════
    // [S1] Settings data model — single source of truth for every
    // non-user-entered string the output can emit. Strings that vary by
    // verbosity store a `compact`/`explicit` pair where relevant.
    // User overrides live in state.settings; getSetting() falls back here.
    // ══════════════════════════════════════
    const DEFAULT_SETTINGS = {
        role: {
            label: 'ROLE',
            explicitPrefix: 'You are a ',
            explicitSuffix: '.',
            capsStyle: 'brackets',                 // 'brackets' | 'inline' | 'none'
            capWords: { agentic: 'agentic', subagent: 'can-spawn-subagents', verbose: 'verbose', strict: 'strict' },
            // [S4] per-preset full text, keyed by the short label shown in the dropdown
            presets: {
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
        },
        context: { compactLabel: 'CONTEXT', explicitLabel: 'CONTEXT', projectKey: 'project', stackKey: 'stack', rulesKey: 'rules', outputKey: 'output', mdHeading: 'Context & Constraints' },
        vars: { compactLabel: 'VARS', explicitHeading: 'VARIABLES (use ${name} to reference in steps)', mdHeading: 'Variables' },
        resources: { compactLabel: 'RESOURCES (referenced below by @name):', explicitLeadIn: 'The following resources are available; reference them with @name.', mdHeading: 'Resources' },
        memory: { label: 'MEMORY', instruction: 'Save this entire prompt as "{file}" and re-read it at the start of every new request. Never discard or summarize it.' },
        mode: { compactLabel: 'MODE', flagLabel: 'Flag', stepsLabel: 'STEPS', emptyStepsLabel: '(no steps)', mdTasksLead: 'Perform the following in order:', mdEmptyLabel: '(no tasks defined)' },
        // Verbs derived from TASK_TYPES so they never desync; still overridable individually.
        verbs: Object.fromEntries(TASK_TYPES.map(t => [t.value, t.verb])),
        gate: { compactLabel: 'GATE', explicitStopWord: 'STOP', explicitInstruction: 'Wait for explicit user confirmation before continuing. Do NOT proceed past this point until the user replies.', confirmWord: 'Confirm', rejectWord: 'If rejected' },
        loop: { forEach: 'FOR EACH', while: 'WHILE', repeat: 'REPEAT', in: 'IN', times: 'TIMES', maxLabel: 'max', untilLabel: 'until', atMostTpl: 'at most {n} cycles', checkTpl: 'After each iteration, check: "{cond}". If the condition is met, exit the loop early and continue to the next step.' },
        cond: { if: 'IF', elseIf: 'ELSE IF', else: 'ELSE', then: 'THEN' },
        subagent: { compactSpawn: 'SPAWN sub-agents', explicitParallel: 'SPAWN the following sub-agents AT THE SAME TIME (in parallel). Each works independently and returns its own report:', explicitSequential: 'RUN the following sub-agents ONE AT A TIME, in order; each finishes before the next starts:', agentWord: 'Agent', domainLabel: 'domain', rationaleLabel: 'Rationale', reportLabel: 'Write report to', primaryTag: 'PRIMARY', agenticTag: 'agentic', verboseTag: 'verbose' },
        parallel: { label: 'PARALLEL', branchWord: 'branch' },
        route: { compactLabel: 'ROUTE on', caseWord: 'case', defaultWord: 'default', explicitLead: 'DECIDE based on', explicitMatchTpl: 'If the request matches "{label}"{match}:', explicitOtherwise: 'Otherwise:' },
        section: { label: 'PHASE', goalLabel: 'Goal', exitCompact: 'Exit when', exitExplicit: 'Do not leave this phase until' },
        ask: { compactLabel: 'ASK USER', explicitSingle: 'ASK THE USER the following question(s) in a SINGLE message and WAIT for their answer:', explicitSeparate: 'ASK THE USER the following question(s) in separate messages and WAIT for their answer:', optionsLabel: 'Options', orOther: 'or Other', freeText: 'free text answer', saveToLabel: 'Save answer to', suggestDefaultLabel: 'Suggest best-practice default.' },
        table: { rowWord: 'Row' },
        package: { explicitLead: 'PACKAGE — Collect the files listed below and bundle them into a single archive named "{name}", reproducing EXACTLY this folder structure:', noteLabel: 'Note' },
    };

    // [S1] Resolve a dot-path setting: user override wins, else DEFAULT_SETTINGS.
    function getSetting(path) {
        const keys = String(path).split('.');
        const ov = keys.reduce((o, k) => (o == null ? o : o[k]), state.settings);
        if (ov !== undefined && ov !== null) return ov;
        const def = keys.reduce((o, k) => (o == null ? o : o[k]), DEFAULT_SETTINGS);
        return def == null ? '' : def;
    }
    // Template fill: fill('at most {n} cycles', {n:3}) → 'at most 3 cycles'
    function fill(tpl, vars) { return String(tpl).replace(/\{(\w+)\}/g, (_, k) => (vars && vars[k] != null ? vars[k] : '')); }

    // [S6] Settings persistence — separate key for clean import/export.
    function loadSettings() {
        try { const raw = localStorage.getItem(SETTINGS_KEY); if (raw) state.settings = JSON.parse(raw) || {}; } catch (e) { state.settings = {}; }
    }
    let settingsTimer;
    function saveSettings() {
        clearTimeout(settingsTimer);
        settingsTimer = setTimeout(() => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings || {})); } catch (e) {} }, 150);
    }

    // ──────────────────────────────────────
    // Mode helpers
    // ──────────────────────────────────────
    function getActiveMode() {
        if (!state.modes || !state.modes.length) return null;
        if (state.activeModeId) {
            const m = state.modes.find(m => m.id === state.activeModeId);
            if (m) return m;
        }
        return state.modes[0];
    }
    function getActiveModeNodes() {
        if (!state.multiModeEnabled) return state.nodes;
        const mode = getActiveMode();
        return mode ? mode.nodes : state.nodes;
    }
    function isSingleDefaultMode() {
        if (!state.modes || state.modes.length !== 1) return false;
        const m = state.modes[0];
        return m.name === '/default' && !(m.flags && m.flags.length) && !state.multiModeEnabled;
    }

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
            // Also try old v5 key for migration
            const rawV5 = !raw ? localStorage.getItem('prompt_generator_state_v5') : null;
            const dataRaw = raw || rawV5;
            if (!dataRaw) return;
            const saved = JSON.parse(dataRaw);
            // Any tree-model save (schema 2+) loads by merging onto current defaults,
            // which fills in newly-added fields (resources, verbosity, …).
            if (saved.schema >= 2 && Array.isArray(saved.nodes)) {
                state = Object.assign(defaultState(), saved);
                state.schema = SCHEMA;
                migrateOldActions(state.nodes);
                migrateSchema4(state.nodes);
                migrateSchema5(state.nodes);
                migrateSchema6(state);
            } else {
                const legacy = localStorage.getItem('prompt_generator_state_v4') || localStorage.getItem('prompt_generator_state_v3');
                migrate(saved.tasks ? saved : (legacy ? JSON.parse(legacy) : saved));
                migrateOldActions(state.nodes);
                migrateSchema4(state.nodes);
                migrateSchema5(state.nodes);
                migrateSchema6(state);
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

    // Schema 4 migration: add new fields to existing nodes/agents
    function migrateSchema4(nodes) {
        if (!nodes) return;
        nodes.forEach(n => {
            // Task nodes get rulesList
            if (n.type === 'task' && !('rulesList' in n)) { n.rulesList = ''; }
            // Sub-agent nodes: add new fields to agents
            if (n.type === 'subagent' && n.agents) {
                n.agents.forEach(a => {
                    if (!('domain' in a)) a.domain = '';
                    if (!('rationale' in a)) a.rationale = '';
                    if (!('outputFile' in a)) a.outputFile = '';
                    if (!('isPrimary' in a)) a.isPrimary = false;
                });
            }
            if (isContainer(n)) slotsOf(n).forEach(s => migrateSchema4(s.arr));
        });
    }

    // Schema 5 migration: add contentOutline to task nodes, memoryDirective/memoryFile to root
    function migrateSchema5(nodes) {
        if (!nodes) return;
        nodes.forEach(n => {
            if (n.type === 'task' && !('contentOutline' in n)) { n.contentOutline = ''; }
            if (isContainer(n)) slotsOf(n).forEach(s => migrateSchema5(s.arr));
        });
    }

    // Schema 6 migration: modes support, route node support
    function migrateSchema6(st) {
        if (!st) return;
        // Migrate state.nodes to state.modes[0].nodes if modes doesn't exist or is from default state
        if (!st.modes || !st.modes.length) {
            st.modes = [{ id: uid('mode'), name: '/default', summary: 'Default mode', flags: [], nodes: st.nodes || [] }];
        } else {
            // Even if modes[] exists (from Object.assign with defaultState),
            // the modes[0].nodes might be the default placeholder, not the user's actual nodes.
            // Always sync modes[0].nodes with state.nodes when multiMode is off.
            if (!st.multiModeEnabled && st.nodes && Array.isArray(st.nodes)) {
                // Check if modes[0].nodes is the default placeholder (differs from state.nodes)
                if (st.modes[0].nodes !== st.nodes) {
                    st.modes[0].nodes = st.nodes;
                }
            }
        }
        if (!('activeModeId' in st)) st.activeModeId = null;
        if (!('multiModeEnabled' in st)) st.multiModeEnabled = false;
        // Migrate route nodes inside all mode trees
        st.modes.forEach(mode => {
            if (mode.nodes) migrateSchema6Nodes(mode.nodes);
        });
        // Also migrate state.nodes (legacy)
        if (st.nodes) migrateSchema6Nodes(st.nodes);
    }
    function migrateSchema6Nodes(nodes) {
        if (!nodes) return;
        nodes.forEach(n => {
            if (n.type === 'route') {
                if (!n.cases) n.cases = [{ label: '', match: '', children: [] }];
                if (!n.defaultCase) n.defaultCase = [];
                if (!n.on) n.on = 'user intent';
                n.cases.forEach(c => {
                    if (!c.children) c.children = [];
                });
            }
            if (isContainer(n)) slotsOf(n).forEach(s => migrateSchema6Nodes(s.arr));
        });
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
    // Variable interpolation  [R2]
    // Replaces ${name} in any emitted field with the variable's value.
    // Unknown variables are left visibly marked so the agent/user notices.
    // ──────────────────────────────────────
    function varMap() {
        const m = {};
        (state.variables || []).forEach(v => { if (v.name && v.name.trim()) m[v.name.trim()] = v.value || ''; });
        return m;
    }
    function resourceSet() {
        const s = {};
        (state.resources || []).forEach(r => { if (r.name && r.name.trim()) s[r.name.trim()] = r; });
        return s;
    }
    function isExplicit() { return state.verbosity !== 'compact'; }
    function interp(str, map, res) {
        if (str == null) return str;
        map = map || varMap();
        res = res || resourceSet();
        // ${var} → value
        let out = String(str).replace(/\$\{\s*([A-Za-z0-9_]+)\s*\}/g, (full, name) => {
            if (Object.prototype.hasOwnProperty.call(map, name)) {
                return map[name] !== '' ? map[name] : '${' + name + '}';
            }
            return '${' + name + ':UNDEFINED}';
        });
        // @resource → reference (kept as a clear token; Explicit mode expands it)
        out = out.replace(/@([A-Za-z0-9_]+)/g, (full, name) => {
            if (Object.prototype.hasOwnProperty.call(res, name)) {
                if (isExplicit()) {
                    const r = res[name];
                    return 'the resource "' + name + '" (' + RES_LABEL(r.kind) + ', see RESOURCES at top)';
                }
                return '@' + name;
            }
            return '@' + name + ':UNDEFINED';
        });
        return out;
    }
    const RES_KINDS = [
        { value: 'text',  label: 'Text / logs' },
        { value: 'file',  label: 'File' },
        { value: 'image', label: 'Image' },
        { value: 'zip',   label: 'Zip archive' },
        { value: 'link',  label: 'Link / URL' },
        { value: 'other', label: 'Other' },
    ];
    function RES_LABEL(kind) {
        const k = (RES_KINDS.find(x => x.value === kind) || {}).label || kind;
        return k.toLowerCase();
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
        if (state.memoryDirective) {
            out += 'MEMORY: Save this entire prompt as "' + (state.memoryFile || 'AGENT_PROMPT.md') + '" and re-read it at the start of every new request. Never discard or summarize it.\n';
        }
        out += resourcesPseudo();
        // Multi-mode output
        if (state.multiModeEnabled && state.modes && state.modes.length > 0) {
            state.modes.forEach((mode, mi) => {
                out += '\nMODE: ' + mode.name + (mode.summary ? ' — ' + mode.summary : '') + '\n';
                if (mode.flags && mode.flags.length) {
                    mode.flags.forEach(f => {
                        out += '  Flag: ' + f.name + (f.desc ? ': ' + f.desc : '') + '\n';
                    });
                }
                out += 'STEPS\n';
                if (!mode.nodes || !mode.nodes.length) out += '  (no steps)\n';
                else mode.nodes.forEach((n, i) => { out += pseudoNode(n, 0, String(i + 1)); });
            });
        } else {
            out += '\nSTEPS\n';
            const activeNodes = getActiveModeNodes();
            if (!activeNodes.length) out += '  (no steps)\n';
            else activeNodes.forEach((n, i) => { out += pseudoNode(n, 0, String(i + 1)); });
        }
        return out.replace(/\n+$/, '') + '\n';
    }
    function resourcesPseudo() {
        const rs = (state.resources || []).filter(r => r.name && r.name.trim());
        if (!rs.length) return '';
        let out = '\nRESOURCES (referenced below by @name):\n';
        rs.forEach(r => {
            const v = r.kind === 'text' ? '(text inlined below)' : (r.value || '<empty>');
            out += '  @' + r.name.trim() + '  [' + r.kind + ']' + (r.note ? ' — ' + r.note : (r.value && r.kind !== 'text' ? ' — ' + r.value : '')) + '\n';
        });
        const texts = rs.filter(r => r.kind === 'text' && (r.value || '').trim());
        texts.forEach(r => {
            out += '\n--- @' + r.name.trim() + ' ---\n' + r.value.replace(/\n+$/, '') + '\n--- end @' + r.name.trim() + ' ---\n';
        });
        return out;
    }
    function pad(d) { return '  '.repeat(d); }
    function pseudoNode(n, depth, num) {
        const ind = pad(depth);
        if (n.type === 'task') {
            const t = TASK_TYPE_MAP[n.action] || { verb: n.action };
            // Rules action
            if (n.action === 'rules') {
                const rules = (n.rulesList || '').split('\n').map(l => l.trim()).filter(Boolean);
                if (!rules.length) return ind + num + '. RULES: <no rules defined>\n';
                if (isExplicit()) {
                    let s = ind + num + '. RULES — The following conventions are mandatory and must be followed without exception:\n';
                    rules.forEach((r, ri) => { s += ind + '   ' + (ri + 1) + '. ' + interp(r) + '\n'; });
                    return s;
                }
                let s = ind + num + '. RULES:\n';
                rules.forEach(r => { s += ind + '   - ' + interp(r) + '\n'; });
                return s;
            }
            if (n.action === 'goto') {
                if (!n.gotoRef) return ind + num + '. GOTO <step?>\n';
                const refNum = stepNumberOf(n.gotoRef) || '?';
                const refTitle = gotoTitle(n.gotoRef);
                if (isExplicit()) {
                    return ind + num + '. GO BACK TO and re-execute Step ' + refNum +
                        (refTitle ? ' ("' + refTitle + '")' : '') + '. This is a loop-back, not a one-time jump.\n';
                }
                return ind + num + '. GOTO Step ' + refNum + '\n';
            }
            if (n.action === 'break') {
                return ind + num + (isExplicit() ? '. BREAK — exit the current loop entirely.' : '. BREAK') + '\n';
            }
            if (n.action === 'continue') {
                return ind + num + (isExplicit() ? '. CONTINUE — skip the rest of this iteration and start the next one.' : '. CONTINUE') + '\n';
            }
            if (n.action === 'produce_file') {
                const path = n.target ? interp(n.target) : '<path?>';
                const outline = (n.contentOutline || '').trim();
                if (isExplicit()) {
                    let s = ind + num + '. CREATE the file "' + path + '" with the following content outline: ' + (outline || '<no outline>') + '. Ensure the file is complete and follows the format specified.\n';
                    return s;
                }
                let s = ind + num + '. PRODUCE FILE ' + path;
                if (outline) s += '  // ' + outline.replace(/\n+/g, '; ');
                return s + '\n';
            }
            if (n.action === 'plan') {
                const target = n.target ? interp(n.target) : '<target?>';
                if (isExplicit()) {
                    return ind + num + '. CREATE a plan document "' + target + '" with the next sequential Task-ID (continue from the highest existing).\n';
                }
                return ind + num + '. PLAN ' + target + '\n';
            }
            if (n.action === 'log') {
                const target = n.target ? interp(n.target) : '<target?>';
                if (isExplicit()) {
                    return ind + num + '. WRITE a worklog "' + target + '" recording: start/end time, actions taken, problems + resolutions, files changed, test results, deviations.\n';
                }
                return ind + num + '. LOG ' + target + '\n';
            }
            if (n.action === 'split') {
                const target = n.target ? interp(n.target) : '<target?>';
                if (isExplicit()) {
                    return ind + num + '. If this task is too large, SPLIT it into smaller sub-tasks, record them in the plan, and do not write code yet — report the breakdown to the user.\n';
                }
                return ind + num + '. SPLIT ' + target + '\n';
            }
            if (n.action === 'validate') {
                const target = n.target ? interp(n.target) : '<target?>';
                if (isExplicit()) {
                    return ind + num + '. Run the tests ("' + target + '"). If ANY test fails: do NOT mark this step complete — report the failures to the user and wait. Only continue when all tests pass or the user explicitly overrides.\n';
                }
                return ind + num + '. VALIDATE ' + target + '\n';
            }
            if (n.action === 'synthesize') {
                const target = n.target ? interp(n.target) : '<target?>';
                if (isExplicit()) {
                    return ind + num + '. READ the listed reports and MERGE them into one consolidated document "' + target + '", resolving conflicts and noting trade-offs.\n';
                }
                return ind + num + '. SYNTHESIZE ' + target + '\n';
            }
            if (n.action === 'commit') {
                const target = n.target ? interp(n.target) : '<target?>';
                if (isExplicit()) {
                    return ind + num + '. PROVIDE (do not run) a Conventional-Commits message: "type(scope): subject" (≤100 chars) plus a ≤350-char body. Do not run git commit unless the user explicitly asks.\n';
                }
                return ind + num + '. COMMIT ' + target + '\n';
            }
            const verb = getVerb(n);
            let line = ind + num + '. ' + verb + (n.target ? ' ' + interp(n.target) : ' <target?>');
            if (n.details && n.details.trim()) line += '  // ' + interp(n.details).trim().replace(/\n+/g, '; ');
            return line + '\n';
        }
        if (n.type === 'table') {
            const caption = n.caption ? interp(n.caption) : 'Untitled';
            const rows = n.rows || [];
            const cols = (n.headers || []).length;
            if (isExplicit()) {
                let s = ind + num + '. TABLE — ' + caption + ':\n';
                rows.forEach((row, ri) => {
                    s += ind + '   Row ' + (ri + 1) + ': ' + row.map((cell, ci) => (n.headers[ci] || 'Col ' + (ci + 1)) + '=' + (interp(cell) || '(empty)')).join(', ') + '\n';
                });
                return s;
            }
            return ind + num + '. TABLE: ' + caption + ' (' + rows.length + 'x' + cols + ')\n';
        }
        if (n.type === 'gate') {
            const prompt = n.prompt ? interp(n.prompt) : '<confirmation prompt?>';
            if (isExplicit()) {
                let s = ind + '>>> STOP. Wait for explicit user confirmation before continuing. Do NOT proceed past this point until the user replies. <<<\n';
                s += ind + num + '. Confirm: ' + prompt + '\n';
                if (n.onReject && n.onReject.trim()) s += ind + '   If rejected: ' + interp(n.onReject).trim() + '\n';
                return s;
            }
            let s = ind + num + '. GATE — ' + prompt + '\n';
            if (n.onReject && n.onReject.trim()) s += ind + '   If rejected: ' + interp(n.onReject).trim() + '\n';
            return s;
        }
        if (n.type === 'ask') {
            const questions = n.questions || [];
            if (isExplicit()) {
                let s = ind + num + '. ASK THE USER the following question' + (questions.length > 1 ? 's' : '') +
                    ' in a ' + (n.oneMessage ? 'SINGLE' : 'separate') + ' message and WAIT for their answer:\n';
                questions.forEach((q, qi) => {
                    s += ind + '   Q' + (qi + 1) + ': ' + (q.text ? interp(q.text) : '<question?>') + '\n';
                    if (q.kind === 'choice' && (q.options || []).length) {
                        s += ind + '      Options: ' + q.options.map(o => '"' + interp(o) + '"').join(', ');
                        if (q.allowOther) s += ' (or Other)';
                        s += '\n';
                    } else {
                        s += ind + '      (free text answer)\n';
                    }
                    if (q.saveTo && q.saveTo.trim()) s += ind + '      Save answer to: $' + q.saveTo.trim() + '\n';
                    if (q.suggestDefault) s += ind + '      Suggest best-practice default.\n';
                });
                // Branches
                if ((n.branches || []).length) {
                    // Find the choice question that drives branching
                    const choiceQ = questions.find(q => q.kind === 'choice' && (q.options || []).length);
                    if (choiceQ) {
                        (n.branches || []).forEach((b, bi) => {
                            const optLabel = (choiceQ.options && choiceQ.options[bi]) ? choiceQ.options[bi] : 'option ' + (bi + 1);
                            s += ind + '   IF answer is "' + interp(optLabel) + '":\n';
                            s += slotPseudo(b, depth + 2, num);
                        });
                    }
                }
                return s;
            }
            // Compact
            const qSummary = questions.map(q => q.text ? interp(q.text).slice(0, 30) : '?').join('; ');
            let s = ind + num + '. ASK USER: ' + qSummary + '\n';
            if ((n.branches || []).length) {
                const choiceQ = questions.find(q => q.kind === 'choice' && (q.options || []).length);
                if (choiceQ) {
                    (n.branches || []).forEach((b, bi) => {
                        const optLabel = (choiceQ.options && choiceQ.options[bi]) ? choiceQ.options[bi] : 'opt' + (bi + 1);
                        s += ind + '   IF "' + interp(optLabel) + '":\n';
                        s += slotPseudo(b, depth + 2, num);
                    });
                }
            }
            return s;
        }
        if (n.type === 'package') {
            const name = n.archiveName ? interp(n.archiveName) : '<archive name?>';
            const tree = n.tree ? n.tree.trim() : '';
            if (isExplicit()) {
                let s = ind + num + '. PACKAGE — Collect the files listed below and bundle them into a single archive named "' + name + '", reproducing EXACTLY this folder structure:\n';
                if (tree) {
                    s += ind + '```\n';
                    tree.split('\n').forEach(l => { s += ind + '   ' + l + '\n'; });
                    s += ind + '```\n';
                } else {
                    s += ind + '   <no tree structure defined>\n';
                }
                if (n.filesNote && n.filesNote.trim()) s += ind + '   Note: ' + interp(n.filesNote).trim() + '\n';
                return s;
            }
            // Compact
            let s = ind + num + '. PACKAGE → ' + name + ' { ' + (tree ? tree.split('\n')[0].slice(0, 30) + (tree.split('\n').length > 1 ? '…' : '') : '<empty>') + ' }\n';
            return s;
        }
        if (n.type === 'if') {
            let s = ind + num + '. IF ' + (n.condition ? interp(n.condition) : '<condition?>') + ':\n';
            s += slotPseudo(n.then, depth + 1, num);
            (n.elseifs || []).forEach(e => {
                s += ind + '   ELSE IF ' + (e.condition ? interp(e.condition) : '<condition?>') + ':\n';
                s += slotPseudo(e.children, depth + 1, num);
            });
            if ((n.else || []).length) { s += ind + '   ELSE:\n'; s += slotPseudo(n.else, depth + 1, num); }
            return s;
        }
        if (n.type === 'loop') {
            let head;
            if (n.loopType === 'while') head = 'WHILE ' + (n.source ? interp(n.source) : '<condition?>');
            else if (n.loopType === 'repeat') head = 'REPEAT ' + (n.source ? interp(n.source) : '<n?>') + ' TIMES';
            else head = 'FOR EACH ' + (n.itemVar || 'item') + ' IN ' + (n.source ? interp(n.source) : '<collection?>');
            const maxIter = n.maxIterations && n.maxIterations.trim();
            const exitCond = n.exitCondition && n.exitCondition.trim();
            if (isExplicit()) {
                let s = ind + num + '. ' + head;
                if (maxIter) s += '  (at most ' + interp(maxIter) + ' cycles)';
                s += ':\n';
                if (exitCond) s += ind + '   After each iteration, check: "' + interp(exitCond) + '". If the condition is met, exit the loop early and continue to the next step.\n';
                s += slotPseudo(n.body, depth + 1, num);
                return s;
            }
            let s = ind + num + '. ' + head;
            if (maxIter && exitCond) s += ' (until ' + interp(exitCond) + ', max ' + interp(maxIter) + ')';
            else if (maxIter) s += ' (max ' + interp(maxIter) + ')';
            else if (exitCond) s += ' (until ' + interp(exitCond) + ')';
            s += ':\n';
            s += slotPseudo(n.body, depth + 1, num);
            return s;
        }
        if (n.type === 'subagent') {
            const mode = (n.execMode || 'parallel');
            let s;
            if (isExplicit()) {
                s = ind + num + (mode === 'parallel'
                    ? '. SPAWN the following sub-agents AT THE SAME TIME (in parallel). Each works independently and returns its own report:\n'
                    : '. RUN the following sub-agents ONE AT A TIME, in order; each finishes before the next starts:\n');
            } else {
                s = ind + num + '. SPAWN sub-agents [' + mode.toUpperCase() + ']:\n';
            }
            (n.agents || []).forEach((a, ai) => {
                let agentLine = ind + '   - Agent "' + (a.role ? interp(a.role) : 'unnamed') + '"';
                if (a.domain && a.domain.trim()) agentLine += ' (domain: ' + interp(a.domain).trim() + ')';
                agentLine += (a.task ? ' → ' + interp(a.task) : '');
                if (a.agentic) agentLine += ' (agentic)';
                if (a.isPrimary) agentLine += ' [PRIMARY]';
                s += agentLine + '\n';
                if (isExplicit()) {
                    if (a.rationale && a.rationale.trim()) s += ind + '     Rationale: ' + interp(a.rationale).trim() + '\n';
                    if (a.outputFile && a.outputFile.trim()) s += ind + '     Write report to: ' + interp(a.outputFile).trim() + '\n';
                }
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
        if (n.type === 'route') {
            const on = n.on ? interp(n.on) : '<dispatch field?>';
            if (isExplicit()) {
                let s = ind + num + '. DECIDE based on ' + on + ':\n';
                (n.cases || []).forEach((c, ci) => {
                    const label = c.label ? interp(c.label) : 'case ' + (ci + 1);
                    const match = c.match ? interp(c.match) : '';
                    s += ind + '   If the request matches "' + label + '"' + (match ? ' ("' + match + '")' : '') + ':\n';
                    s += slotPseudo(c.children, depth + 2, num + '.' + (ci + 1));
                });
                if ((n.defaultCase || []).length) {
                    s += ind + '   Otherwise:\n';
                    s += slotPseudo(n.defaultCase, depth + 2, num + '.' + ((n.cases || []).length + 1));
                }
                return s;
            }
            let s = ind + num + '. ROUTE on ' + on + ':\n';
            (n.cases || []).forEach((c, ci) => {
                const label = c.label ? interp(c.label) : 'case ' + (ci + 1);
                s += ind + '   case "' + label + '" →\n';
                s += slotPseudo(c.children, depth + 2, num + '.' + (ci + 1));
            });
            if ((n.defaultCase || []).length) {
                s += ind + '   default →\n';
                s += slotPseudo(n.defaultCase, depth + 2, num + '.' + ((n.cases || []).length + 1));
            }
            return s;
        }
        if (n.type === 'section') {
            const title = n.title ? interp(n.title) : 'Untitled phase';
            let s = ind + '=== PHASE ' + num + ': ' + title + ' ===\n';
            if (n.goalNote && n.goalNote.trim()) s += ind + '   Goal: ' + interp(n.goalNote).trim() + '\n';
            s += slotPseudo(n.children, depth + 1, num);
            if (n.exitCriteria && n.exitCriteria.trim()) {
                s += ind + (isExplicit()
                    ? '   Do not leave this phase until: ' + interp(n.exitCriteria).trim() + '\n'
                    : '   Exit when: ' + interp(n.exitCriteria).trim() + '\n');
            }
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
        if (state.memoryDirective) {
            md += '\n## Memory Directive\nSave this entire prompt as `' + (state.memoryFile || 'AGENT_PROMPT.md') + '` and re-read it at the start of every new request. Never discard or summarize it.\n';
        }
        md += resourcesMd();
        // Multi-mode output
        if (state.multiModeEnabled && state.modes && state.modes.length > 0) {
            state.modes.forEach((mode, mi) => {
                md += '\n## Mode: ' + mode.name + (mode.summary ? ' — ' + mode.summary : '') + '\n\n';
                if (mode.flags && mode.flags.length) {
                    md += '**Flags:**\n';
                    mode.flags.forEach(f => {
                        md += '- `' + f.name + '`' + (f.desc ? ': ' + f.desc : '') + '\n';
                    });
                    md += '\n';
                }
                md += 'Perform the following in order:\n\n';
                if (!mode.nodes || !mode.nodes.length) md += '_(no tasks defined)_\n';
                else mode.nodes.forEach((n, i) => { md += mdNode(n, 0, String(i + 1)); });
            });
        } else {
            md += '\n## Tasks\nPerform the following in order:\n\n';
            const activeNodes = getActiveModeNodes();
            if (!activeNodes.length) md += '_(no tasks defined)_\n';
            else activeNodes.forEach((n, i) => { md += mdNode(n, 0, String(i + 1)); });
        }
        md += '\n---\n_Generated with Prompt Generator_\n';
        return md;
    }
    function resourcesMd() {
        const rs = (state.resources || []).filter(r => r.name && r.name.trim());
        if (!rs.length) return '';
        let md = '\n## Resources\nReference these below with `@name`.\n';
        rs.forEach(r => {
            md += '- `@' + r.name.trim() + '` (' + r.kind + ')' +
                  (r.kind !== 'text' && r.value ? ' — ' + r.value : '') +
                  (r.note ? ' — ' + r.note : '') + '\n';
        });
        rs.filter(r => r.kind === 'text' && (r.value || '').trim()).forEach(r => {
            md += '\n**@' + r.name.trim() + ':**\n```\n' + r.value.replace(/\n+$/, '') + '\n```\n';
        });
        return md;
    }
    function mdNode(n, depth, num) {
        const ind = '  '.repeat(depth);
        if (n.type === 'task') {
            const t = TASK_TYPE_MAP[n.action] || { verb: n.action };
            if (n.action === 'rules') {
                const rules = (n.rulesList || '').split('\n').map(l => l.trim()).filter(Boolean);
                let s = ind + '- **' + num + '. RULES:**\n';
                rules.forEach((r, ri) => { s += ind + '  ' + (ri + 1) + '. ' + interp(r) + '\n'; });
                if (!rules.length) s += ind + '  - _(no rules defined)_\n';
                return s;
            }
            if (n.action === 'goto') return ind + '- **' + num + '. GOTO** Step ' + (stepNumberOf(n.gotoRef) || '?') + '\n';
            if (n.action === 'produce_file') {
                const path = n.target ? interp(n.target) : '(not specified)';
                let s = ind + '- **' + num + '. PRODUCE FILE:** `' + path + '`\n';
                const outline = (n.contentOutline || '').trim();
                if (outline) {
                    outline.split('\n').filter(l => l.trim()).forEach(l => s += ind + '  - ' + l.trim() + '\n');
                }
                return s;
            }
            if (n.action === 'plan') {
                let s = ind + '- **' + num + '. PLAN:** `' + (n.target ? interp(n.target) : '(not specified)') + '`\n';
                if (isExplicit()) s += ind + '  - Create a plan document with the next sequential Task-ID\n';
                return s;
            }
            if (n.action === 'log') {
                let s = ind + '- **' + num + '. LOG:** `' + (n.target ? interp(n.target) : '(not specified)') + '`\n';
                if (isExplicit()) s += ind + '  - Record: start/end time, actions, problems + resolutions, files changed, test results\n';
                return s;
            }
            if (n.action === 'split') {
                let s = ind + '- **' + num + '. SPLIT:** `' + (n.target ? interp(n.target) : '(not specified)') + '`\n';
                if (isExplicit()) s += ind + '  - Break into smaller sub-tasks; do not write code yet\n';
                return s;
            }
            if (n.action === 'validate') {
                let s = ind + '- **' + num + '. VALIDATE:** `' + (n.target ? interp(n.target) : '(not specified)') + '`\n';
                if (isExplicit()) s += ind + '  - Run tests; if any fail, report and wait\n';
                return s;
            }
            if (n.action === 'synthesize') {
                let s = ind + '- **' + num + '. SYNTHESIZE:** `' + (n.target ? interp(n.target) : '(not specified)') + '`\n';
                if (isExplicit()) s += ind + '  - Merge reports into one document, resolve conflicts\n';
                return s;
            }
            if (n.action === 'commit') {
                let s = ind + '- **' + num + '. COMMIT:** `' + (n.target ? interp(n.target) : '(not specified)') + '`\n';
                if (isExplicit()) s += ind + '  - Provide Conventional-Commits message (do not run git commit)\n';
                return s;
            }
            if (NO_TARGET[n.action]) return ind + '- **' + num + '. ' + t.verb + '**\n';
            const verb = getVerb(n);
            let s = ind + '- **' + num + '. ' + verb + '**: `' + (n.target ? interp(n.target) : '(not specified)') + '`\n';
            if (n.details && n.details.trim()) interp(n.details).split('\n').filter(l => l.trim()).forEach(l => s += ind + '  - ' + l.trim() + '\n');
            return s;
        }
        if (n.type === 'table') {
            const caption = n.caption ? interp(n.caption) : 'Untitled';
            const headers = n.headers || [];
            const rows = n.rows || [];
            let s = ind + '- **' + num + '. TABLE:** ' + caption + '\n\n';
            if (headers.length) {
                s += ind + '| ' + headers.map(h => interp(h)).join(' | ') + ' |\n';
                s += ind + '| ' + headers.map(() => '---').join(' | ') + ' |\n';
                rows.forEach(row => {
                    s += ind + '| ' + headers.map((_, ci) => interp(row[ci] || '')).join(' | ') + ' |\n';
                });
            }
            return s;
        }
        if (n.type === 'gate') {
            const prompt = n.prompt ? interp(n.prompt) : '(not specified)';
            let s = ind + '- **' + num + '. GATE:** ' + prompt + '\n';
            if (n.onReject && n.onReject.trim()) s += ind + '  - _If rejected:_ ' + interp(n.onReject).trim() + '\n';
            return s;
        }
        if (n.type === 'ask') {
            const questions = n.questions || [];
            let s = ind + '- **' + num + '. ASK USER**' + (n.oneMessage ? ' (all in one message)' : '') + ':\n';
            questions.forEach((q, qi) => {
                s += ind + '  - Q' + (qi + 1) + ': ' + (q.text ? interp(q.text) : '_(not specified)_') + '\n';
                if (q.kind === 'choice' && (q.options || []).length) {
                    s += ind + '    Options: ' + q.options.map(o => '`' + interp(o) + '`').join(', ');
                    if (q.allowOther) s += ' (or Other)';
                    s += '\n';
                }
                if (q.saveTo && q.saveTo.trim()) s += ind + '    → Save to: `$' + q.saveTo.trim() + '`\n';
            });
            if ((n.branches || []).length) {
                const choiceQ = questions.find(q => q.kind === 'choice' && (q.options || []).length);
                if (choiceQ) {
                    (n.branches || []).forEach((b, bi) => {
                        const optLabel = (choiceQ.options && choiceQ.options[bi]) ? choiceQ.options[bi] : 'option ' + (bi + 1);
                        s += ind + '  - IF "' + interp(optLabel) + '":\n';
                        s += slotMd(b, depth + 2, num);
                    });
                }
            }
            return s;
        }
        if (n.type === 'package') {
            const name = n.archiveName ? interp(n.archiveName) : '_(not specified)_';
            let s = ind + '- **' + num + '. PACKAGE:** `' + name + '`\n';
            if (n.tree && n.tree.trim()) {
                s += ind + '  ```\n';
                n.tree.trim().split('\n').forEach(l => { s += ind + '  ' + l + '\n'; });
                s += ind + '  ```\n';
            }
            if (n.filesNote && n.filesNote.trim()) s += ind + '  - _Note:_ ' + interp(n.filesNote).trim() + '\n';
            return s;
        }
        if (n.type === 'section') {
            const hashes = '#'.repeat(Math.min(6, depth + 2));
            let s = '\n' + hashes + ' Phase ' + num + ': ' + (n.title ? interp(n.title) : 'Untitled') + '\n';
            if (n.goalNote && n.goalNote.trim()) s += '_Goal: ' + interp(n.goalNote).trim() + '_\n\n';
            s += slotMd(n.children, depth + 1, num);
            if (n.exitCriteria && n.exitCriteria.trim()) s += ind + '> **Exit when:** ' + interp(n.exitCriteria).trim() + '\n';
            return s;
        }
        if (n.type === 'if') {
            let s = ind + '- **' + num + '. IF** `' + (n.condition ? interp(n.condition) : '?') + '` **THEN:**\n';
            s += slotMd(n.then, depth + 1, num);
            (n.elseifs || []).forEach(e => { s += ind + '  **ELSE IF** `' + (e.condition ? interp(e.condition) : '?') + '`:\n'; s += slotMd(e.children, depth + 1, num); });
            if ((n.else || []).length) { s += ind + '  **ELSE:**\n'; s += slotMd(n.else, depth + 1, num); }
            return s;
        }
        if (n.type === 'loop') {
            let head = n.loopType === 'while' ? 'WHILE `' + (n.source ? interp(n.source) : '?') + '`'
                : n.loopType === 'repeat' ? 'REPEAT `' + (n.source ? interp(n.source) : '?') + '` TIMES'
                : 'FOR EACH `' + (n.itemVar || 'item') + '` IN `' + (n.source ? interp(n.source) : '?') + '`';
            const maxIter = n.maxIterations && n.maxIterations.trim();
            const exitCond = n.exitCondition && n.exitCondition.trim();
            if (maxIter && exitCond) head += ' (until ' + interp(exitCond) + ', max ' + interp(maxIter) + ')';
            else if (maxIter) head += ' (max ' + interp(maxIter) + ')';
            else if (exitCond) head += ' (until ' + interp(exitCond) + ')';
            return ind + '- **' + num + '. ' + head + ':**\n' + slotMd(n.body, depth + 1, num);
        }
        if (n.type === 'subagent') {
            let s = ind + '- **' + num + '. SPAWN sub-agents** [' + (n.execMode || 'parallel') + ']:\n';
            (n.agents || []).forEach((a, ai) => {
                let agentLine = ind + '  - **' + (a.role ? interp(a.role) : 'agent') + '**';
                if (a.domain && a.domain.trim()) agentLine += ' _(' + interp(a.domain).trim() + ')_';
                agentLine += (a.task ? ' — ' + interp(a.task) : '');
                if (a.isPrimary) agentLine += ' ⭐';
                s += agentLine + '\n';
                if (a.rationale && a.rationale.trim()) s += ind + '    - Rationale: ' + interp(a.rationale).trim() + '\n';
                if (a.outputFile && a.outputFile.trim()) s += ind + '    - Report: `' + interp(a.outputFile).trim() + '`\n';
                if (a.children && a.children.length) s += slotMd(a.children, depth + 2, num + '.' + (ai + 1));
            });
            return s;
        }
        if (n.type === 'parallel') {
            let s = ind + '- **' + num + '. PARALLEL:**\n';
            (n.branches || []).forEach((b, bi) => { s += ind + '  - _branch ' + (bi + 1) + ':_\n'; s += slotMd(b, depth + 2, num + '.' + (bi + 1)); });
            return s;
        }
        if (n.type === 'route') {
            const on = n.on ? interp(n.on) : '?';
            let s = ind + '- **' + num + '. ROUTE** on `' + on + '`:\n';
            (n.cases || []).forEach((c, ci) => {
                const label = c.label ? interp(c.label) : 'case ' + (ci + 1);
                const match = c.match ? interp(c.match) : '';
                s += ind + '  - _case "' + label + '"' + (match ? ' (`' + match + '`)' : '') + ':_\n';
                s += slotMd(c.children, depth + 2, num + '.' + (ci + 1));
            });
            if ((n.defaultCase || []).length) {
                s += ind + '  - _otherwise:_\n';
                s += slotMd(n.defaultCase, depth + 2, num + '.' + ((n.cases || []).length + 1));
            }
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
    // Validation walk that knows loop-ancestry  [R4]
    // Returns { missing, badIds } where badIds are nodes flagged invalid.
    function collectIssues() {
        let missing = 0;
        const badIds = {};
        const nodesToValidate = state.multiModeEnabled
            ? state.modes.flatMap(m => m.nodes || [])
            : getActiveModeNodes();
        (function rec(arr, inLoop) {
            arr.forEach(n => {
                if (n.type === 'task') {
                    if (n.action === 'goto' && !n.gotoRef) { missing++; badIds[n.id] = 1; }
                    else if ((n.action === 'break' || n.action === 'continue') && !inLoop) { missing++; badIds[n.id] = 1; }
                    else if (n.action === 'rules' && !(n.rulesList || '').trim()) { missing++; badIds[n.id] = 1; }
                    else if (!NO_TARGET[n.action] && !(n.target || '').trim()) { missing++; badIds[n.id] = 1; }
                }
                if (n.type === 'gate' && !(n.prompt || '').trim()) { missing++; badIds[n.id] = 1; }
                if (n.type === 'if' && !(n.condition || '').trim()) { missing++; badIds[n.id] = 1; }
                if (n.type === 'loop' && !(n.source || '').trim()) { missing++; badIds[n.id] = 1; }
                if (n.type === 'ask') {
                    const questions = n.questions || [];
                    const hasEmptyQ = questions.some(q => !(q.text || '').trim());
                    if (hasEmptyQ || !questions.length) { missing++; badIds[n.id] = 1; }
                }
                if (n.type === 'package' && !(n.archiveName || '').trim()) { missing++; badIds[n.id] = 1; }
                if (n.type === 'table' && !(n.headers || []).length) { missing++; badIds[n.id] = 1; }
                if (n.type === 'route') {
                    if (!(n.on || '').trim()) { missing++; badIds[n.id] = 1; }
                    if (!(n.cases || []).length) { missing++; badIds[n.id] = 1; }
                    else if ((n.cases || []).some(c => !(c.label || '').trim())) { missing++; badIds[n.id] = 1; }
                }
                if (isContainer(n)) {
                    const childInLoop = inLoop || n.type === 'loop';
                    slotsOf(n).forEach(s => rec(s.arr, childInLoop));
                }
            });
        })(nodesToValidate, false);
        return { missing, badIds };
    }

    function renderPreviewNow() {
        const text = generateOutput();
        const html = highlight(text);
        previewBlock.innerHTML = html;
        // token estimate (rough ~4 chars/token)
        if (tokenBadge) tokenBadge.textContent = '~' + Math.max(1, Math.round(text.length / 4)) + ' tok';
        // validation  [R4]
        const issues = collectIssues();
        lastBadIds = issues.badIds;
        if (validBadge) {
            validBadge.textContent = issues.missing ? '⚠ ' + issues.missing + ' incomplete' : '✓ complete';
            validBadge.className = 'valid-badge ' + (issues.missing ? 'is-warn' : 'is-ok');
        }
        // mark invalid cards in the editor
        if (taskList) {
            taskList.querySelectorAll('.task-card.invalid').forEach(c => { c.classList.remove('invalid'); c.removeAttribute('title'); c.querySelectorAll('.ref-warn-inline').forEach(s => s.remove()); });
            Object.keys(issues.badIds).forEach(id => {
                const card = taskList.querySelector('.task-card[data-node-id="' + id + '"]');
                if (card) {
                    card.classList.add('invalid');
                    // R4: Add tooltip for break/continue outside loop
                    const f = findNode(id);
                    if (f && f.node.type === 'task' && (f.node.action === 'break' || f.node.action === 'continue')) {
                        card.title = '⚠ Must be inside a loop';
                        const warn = document.createElement('span');
                        warn.className = 'ref-warn ref-warn-inline';
                        warn.textContent = '⚠ Must be inside a loop';
                        const content = card.querySelector('.task-content');
                        if (content) content.insertBefore(warn, content.firstChild);
                    }
                }
            });
        }
    }
    let lastBadIds = {};
    function highlight(text) {
        return escapeHtml(text)
            .replace(/^(# .+)$/gm, '<span class="md-h1">$1</span>')
            .replace(/^(## .+)$/gm, '<span class="md-h2">$1</span>')
            .replace(/^(### .+)$/gm, '<span class="md-h3">$1</span>')
            .replace(/^(ROLE:|VARS:|CONTEXT:|MEMORY:|STEPS|MODE:|Flag:)(.*)$/gm, '<span class="md-h2">$1</span>$2')
            .replace(/\*\*(.+?)\*\*/g, '<span class="md-bold">**$1**</span>')
            .replace(/`([^`]+?)`/g, '<span class="md-code">`$1`</span>')
            .replace(/(\/\/[^\n]*)$/gm, '<span class="md-comment">$1</span>')
            .replace(/\$\{[A-Za-z0-9_]+(?::UNDEFINED)?\}/g, '<span class="md-var">$&</span>')
            .replace(/(^|[^A-Za-z0-9_@])@([A-Za-z0-9_]+(?::UNDEFINED)?)/g, '$1<span class="md-resource">@$2</span>')
            .replace(/&lt;([a-zA-Z?: ]+?)&gt;/g, '<span class="md-missing">&lt;$1&gt;</span>')
            .replace(/\b(IF|ELSE IF|ELSE|THEN|FOR EACH|IN|WHILE|REPEAT|TIMES|SPAWN|PARALLEL|GOTO|BREAK|CONTINUE|DO|CLONE|ANALYZE|RESEARCH|IMPLEMENT|REFACTOR|TEST|DOCUMENT|REVIEW|DEPLOY|DEBUG|OPTIMIZE|MIGRATE|CONFIGURE|MONITOR|CREATE|UPDATE|DELETE|RENAME|FILE|FOLDER|GATE|STOP|Confirm|ASK|PACKAGE|RULES|PRODUCE FILE|PLAN|LOG|SPLIT|VALIDATE|SYNTHESIZE|COMMIT|TABLE|MEMORY|ROUTE|DECIDE|Otherwise)\b/g, '<span class="md-keyword">$1</span>');
    }

    // ──────────────────────────────────────
    // Recursive card rendering  [3.3, 3.6]
    // ──────────────────────────────────────
    function renderTasks() {
        taskList.innerHTML = '';
        const activeNodes = getActiveModeNodes();
        if (!activeNodes.length) {
            taskList.classList.add('empty-list');
            taskList.innerHTML = '<p>No steps yet. Add a Task, If/Else, Loop, Sub-Agent, Parallel, Ask, Route, or Package block.</p>';
        } else {
            taskList.classList.remove('empty-list');
            renderInto(activeNodes, taskList, 0);
        }
        renderPreviewNow();
    }
    function renderInto(arr, container, depth) {
        arr.forEach((node, i) => {
            container.appendChild(buildCard(node, depth, i + 1, arr));
        });
    }
    function numberFor(node) {
        let result = '?';
        walk(getActiveModeNodes(), (n, d, num) => { if (n.id === node.id) result = num; });
        return result;
    }

    function buildCard(node, depth, localIndex, parentArr) {
        const card = document.createElement('div');
        card.dataset.nodeId = node.id;
        card.className = 'task-card depth-' + Math.min(depth, 6) +
            (node.type === 'section' ? ' card-section' :
             node.type === 'if' ? ' card-if' : node.type === 'loop' ? ' card-loop' :
             node.type === 'subagent' ? ' card-subagent' : node.type === 'parallel' ? ' card-parallel' :
             node.type === 'gate' ? ' card-gate' :
             node.type === 'ask' ? ' card-ask' :
             node.type === 'package' ? ' card-package' :
             node.type === 'table' ? ' card-table' :
             node.type === 'route' ? ' card-route' : '');

        card.innerHTML =
            '<span class="task-number">' + numberFor(node) + '</span>' +
            '<div class="drag-handle" tabindex="0" aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown" draggable="true" title="Drag to reorder" aria-label="Drag to reorder">⋮⋮</div>' +
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
        if (node.type === 'gate')     return gateHead(node);
        if (node.type === 'section')  return sectionHead(node);
        if (node.type === 'if')       return ifHead(node);
        if (node.type === 'loop')     return loopHead(node);
        if (node.type === 'subagent') return subagentHead(node);
        if (node.type === 'parallel') return '<div class="block-label label-parallel">⇉ Parallel block (branches run concurrently)</div>';
        if (node.type === 'ask')      return askHead(node);
        if (node.type === 'package')  return packageHead(node);
        if (node.type === 'table')    return tableHead(node);
        if (node.type === 'route')    return routeHead(node);
        return '';
    }

    function sectionHead(node) {
        return '<div class="block-label label-section">▣ Phase / Section</div>' +
            '<input type="text" class="section-title" data-field="title" value="' + attr(node.title) + '" placeholder="Phase title, e.g. Phase 0 — Rapid Prototype">' +
            '<input type="text" class="section-goal" data-field="goalNote" value="' + attr(node.goalNote) + '" placeholder="Goal of this phase (optional)">' +
            '<input type="text" class="section-exit" data-field="exitCriteria" value="' + attr(node.exitCriteria) + '" placeholder="Exit / done-when criteria (optional)">';
    }

    function gateHead(node) {
        return '<div class="block-label label-gate">🛑 Gate — User Confirmation Barrier</div>' +
            '<input type="text" class="gate-prompt" data-field="prompt" value="' + attr(node.prompt) + '" placeholder="What the user must confirm, e.g. Approve the project name">' +
            '<input type="text" class="gate-onreject" data-field="onReject" value="' + attr(node.onReject) + '" placeholder="If rejected… (optional, e.g. Return to Phase 0)">';
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
        } else if (node.action === 'rules') {
            html += '<span class="task-noparam">rules / conventions</span>';
        } else if (!NO_TARGET[node.action]) {
            html += '<input type="text" class="task-param-input" data-field="target" value="' + attr(node.target) + '" placeholder="' + attr(ph) + '">';
        } else {
            html += '<span class="task-noparam">no parameters</span>';
            if (node.action === 'break' || node.action === 'continue') {
                if (lastBadIds[node.id]) html += '<span class="ref-warn">⚠ Must be inside a loop</span>';
            }
        }
        html += '</div>';
        // Rules textarea
        if (node.action === 'rules') {
            html += '<textarea class="task-details-input rules-textarea" data-field="rulesList" placeholder="Rules (one per line), e.g.:&#10;Use camelCase for variables&#10;All commits must follow Conventional Commits&#10;No any types in TypeScript" rows="4">' + escapeHtml(node.rulesList || '') + '</textarea>';
        } else if (node.action === 'produce_file') {
            html += '<textarea class="task-details-input" data-field="contentOutline" placeholder="Content outline (one point per line), e.g.:&#10;# Project Plan&#10;## Overview&#10;## Architecture&#10;## Timeline" rows="4">' + escapeHtml(node.contentOutline || '') + '</textarea>';
            html += '<textarea class="task-details-input" data-field="details" placeholder="Notes / acceptance criteria (optional)" rows="2">' + escapeHtml(node.details) + '</textarea>';
        } else if (!NO_TARGET[node.action]) {
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
                '<div class="loop-field"><label>Max iterations</label><input type="text" data-field="maxIterations" value="' + attr(node.maxIterations || '') + '" placeholder="optional, e.g. 3"></div>' +
                '<div class="loop-field"><label>Exit condition</label><input type="text" data-field="exitCondition" value="' + attr(node.exitCondition || '') + '" placeholder="optional, e.g. user is satisfied"></div>' +
            '</div>';
    }
    function subagentHead(node) {
        return '<div class="block-label label-subagent">🤖 Sub-Agents' +
            '<div class="exec-toggle" role="group" aria-label="Execution mode">' +
                '<button class="exec-opt' + (node.execMode === 'sequential' ? ' active' : '') + '" data-action="execMode" data-mode="sequential">▸ Sequential</button>' +
                '<button class="exec-opt' + (node.execMode === 'parallel' ? ' active' : '') + '" data-action="execMode" data-mode="parallel">⇉ Parallel</button>' +
            '</div></div>';
    }

    function askHead(node) {
        let html = '<div class="block-label label-ask">❓ Ask User (Questionnaire)</div>' +
            '<label class="mini-chk ask-one-message"><input type="checkbox" data-field="oneMessage"' + (node.oneMessage ? ' checked' : '') + '> Ask all in one message</label>';
        // Questions
        html += '<div class="ask-questions">';
        (node.questions || []).forEach((q, qi) => {
            html += '<div class="ask-question-row" data-qindex="' + qi + '">' +
                '<div class="ask-q-header">Q' + (qi + 1) +
                (node.questions.length > 1 ? '<button class="btn-icon btn-remove" data-action="removeQuestion" data-qindex="' + qi + '" title="Remove question" aria-label="Remove question">✕</button>' : '') +
                '</div>' +
                '<input type="text" class="ask-q-text" data-field="q_text" data-qindex="' + qi + '" value="' + attr(q.text) + '" placeholder="Your question…">' +
                '<div class="ask-q-meta">' +
                    '<select class="ask-q-kind" data-field="q_kind" data-qindex="' + qi + '" aria-label="Question kind">' +
                        '<option value="choice"' + (q.kind === 'choice' ? ' selected' : '') + '>Multiple choice</option>' +
                        '<option value="free"' + (q.kind === 'free' ? ' selected' : '') + '>Free text</option>' +
                    '</select>' +
                    '<label class="mini-chk"><input type="checkbox" data-field="q_allowOther" data-qindex="' + qi + '"' + (q.allowOther ? ' checked' : '') + '> Allow "Other"</label>' +
                    '<label class="mini-chk"><input type="checkbox" data-field="q_suggestDefault" data-qindex="' + qi + '"' + (q.suggestDefault ? ' checked' : '') + '> Suggest best practice</label>' +
                '</div>';
            // Options (for choice type)
            if (q.kind === 'choice') {
                html += '<div class="ask-q-options">';
                (q.options || []).forEach((opt, oi) => {
                    html += '<div class="ask-option-row">' +
                        '<input type="text" class="ask-option-input" data-field="q_option" data-qindex="' + qi + '" data-oindex="' + oi + '" value="' + attr(opt) + '" placeholder="Option ' + (oi + 1) + '">' +
                        '<button class="btn-icon btn-remove" data-action="removeOption" data-qindex="' + qi + '" data-oindex="' + oi + '" title="Remove option" aria-label="Remove option">✕</button>' +
                        '</div>';
                });
                html += '<button class="slot-add ask-add-option" data-action="addOption" data-qindex="' + qi + '">+ Add option</button>';
                html += '</div>';
            }
            html += '<input type="text" class="ask-q-saveto" data-field="q_saveTo" data-qindex="' + qi + '" value="' + attr(q.saveTo) + '" placeholder="Save answer to variable (optional, e.g. userChoice)">';
            html += '</div>';
        });
        html += '</div>';
        html += '<button class="slot-add" data-action="addQuestion">+ Add question</button>';
        // Branching toggle
        const hasBranches = (node.branches || []).length > 0;
        html += '<div class="ask-branch-toggle">' +
            '<label class="mini-chk"><input type="checkbox" data-field="toggleBranches"' + (hasBranches ? ' checked' : '') + '> Enable branching by answer</label>' +
        '</div>';
        return html;
    }

    function packageHead(node) {
        return '<div class="block-label label-package">📦 Package (Deliverable Archive)</div>' +
            '<input type="text" class="pkg-name" data-field="archiveName" value="' + attr(node.archiveName) + '" placeholder="Archive name, e.g. project_${var}.zip">' +
            '<textarea class="pkg-tree" data-field="tree" placeholder="Folder tree layout, e.g.:&#10;project/&#10;├── src/&#10;│   ├── index.ts&#10;│   └── utils.ts&#10;├── tests/&#10;└── README.md" rows="6">' + escapeHtml(node.tree || '') + '</textarea>' +
            '<input type="text" class="pkg-note" data-field="filesNote" value="' + attr(node.filesNote) + '" placeholder="Note about files (optional)">';
    }

    function tableHead(node) {
        const headers = node.headers || ['Column 1', 'Column 2'];
        const rows = node.rows || [['', '']];
        let html = '<div class="block-label label-table">📊 Table</div>' +
            '<input type="text" class="tbl-caption" data-field="caption" value="' + attr(node.caption) + '" placeholder="Table caption (optional)">' +
            '<div class="tbl-wrap"><table class="tbl-edit"><thead><tr>';
        headers.forEach((h, ci) => {
            html += '<th><input class="tbl-header-input" data-field="tbl_header" data-colindex="' + ci + '" value="' + attr(h) + '" placeholder="Col ' + (ci + 1) + '"></th>';
        });
        html += '</tr></thead><tbody>';
        rows.forEach((row, ri) => {
            html += '<tr>';
            headers.forEach((_, ci) => {
                html += '<td><input data-field="tbl_cell" data-rowindex="' + ri + '" data-colindex="' + ci + '" value="' + attr(row[ci] || '') + '" placeholder="…"></td>';
            });
            html += '</tr>';
        });
        html += '</tbody></table></div>';
        html += '<div class="tbl-actions">' +
            '<button data-action="tblAddCol">+ Column</button>' +
            '<button data-action="tblRemCol">− Column</button>' +
            '<button data-action="tblAddRow">+ Row</button>' +
            '<button data-action="tblRemRow">− Row</button>' +
        '</div>';
        return html;
    }

    function routeHead(node) {
        let html = '<div class="block-label label-route">🔀 Route — Intent Dispatch</div>' +
            '<div class="route-on-wrap"><label class="route-on-label">Dispatch based on</label>' +
            '<input type="text" class="route-on-input" data-field="on" value="' + attr(node.on) + '" placeholder="user intent, request type, etc."></div>';
        // Cases
        html += '<div class="route-cases">';
        (node.cases || []).forEach((c, ci) => {
            html += '<div class="route-case" data-caseindex="' + ci + '">' +
                '<div class="route-case-header">' +
                    '<span class="route-case-num">Case ' + (ci + 1) + '</span>' +
                    (node.cases.length > 1 ? '<button class="btn-icon btn-remove" data-action="removeCase" data-caseindex="' + ci + '" title="Remove case" aria-label="Remove case">✕</button>' : '') +
                '</div>' +
                '<div class="route-case-fields">' +
                    '<input type="text" class="route-case-label" data-field="case_label" data-caseindex="' + ci + '" value="' + attr(c.label) + '" placeholder="Label, e.g. Bug Report">' +
                    '<input type="text" class="route-case-match" data-field="case_match" data-caseindex="' + ci + '" value="' + attr(c.match) + '" placeholder="Match pattern, e.g. bug, error, crash">' +
                '</div>' +
            '</div>';
        });
        html += '</div>';
        html += '<button class="slot-add" data-action="addCase">+ Add Case</button>';
        return html;
    }

    // ──────────────────────────────────────
    // Build nested slots (drop-zones + child cards)  [3.3]
    // ──────────────────────────────────────
    function buildSlots(node, contentEl, depth) {
        const wrap = document.createElement('div');
        wrap.className = 'slots-wrap';

        if (node.type === 'section') {
            wrap.appendChild(slotBlock('STEPS IN THIS PHASE', 'children', node.children, node, depth, 'branch-section'));
        }
        else if (node.type === 'if') {
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
                    '<div class="agent-extra-fields">' +
                        '<input type="text" class="agent-domain" data-agent="' + i + '" data-field="domain" value="' + attr(a.domain || '') + '" placeholder="Domain (optional, e.g. Security analysis)">' +
                        '<input type="text" class="agent-rationale" data-agent="' + i + '" data-field="rationale" value="' + attr(a.rationale || '') + '" placeholder="Rationale (optional, e.g. Ensures OWASP coverage)">' +
                        '<input type="text" class="agent-output-file" data-agent="' + i + '" data-field="outputFile" value="' + attr(a.outputFile || '') + '" placeholder="Output file (optional, e.g. ${project}_${role}_report.md)">' +
                        '<label class="mini-chk"><input type="checkbox" data-agent="' + i + '" data-field="isPrimary"' + (a.isPrimary ? ' checked' : '') + '> ⭐ Primary agent</label>' +
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
        else if (node.type === 'ask') {
            if ((node.branches || []).length) {
                const choiceQ = (node.questions || []).find(q => q.kind === 'choice' && (q.options || []).length);
                if (choiceQ) {
                    (node.branches || []).forEach((b, bi) => {
                        const optLabel = (choiceQ.options && choiceQ.options[bi]) ? choiceQ.options[bi] : 'option ' + (bi + 1);
                        const block = document.createElement('div');
                        block.className = 'slot-block ask-branch-block';
                        block.innerHTML = '<div class="slot-head branch-ask">IF "' + escapeHtml(optLabel) + '"' +
                            '<button class="btn-icon btn-remove" data-action="removeAskBranch" data-askbranch="' + bi + '" title="Remove branch" aria-label="Remove branch">✕</button></div>';
                        block.appendChild(dropZone(node, 'askbranch:' + bi, b, depth));
                        wrap.appendChild(block);
                    });
                }
            }
        }
        else if (node.type === 'route') {
            (node.cases || []).forEach((c, ci) => {
                const label = c.label || 'Case ' + (ci + 1);
                const match = c.match || '';
                const block = document.createElement('div');
                block.className = 'slot-block route-case-block';
                block.innerHTML = '<div class="slot-head branch-route">CASE "' + escapeHtml(label) + '"' +
                    (match ? ' <span class="route-match-hint">(' + escapeHtml(match) + ')</span>' : '') +
                    '</div>';
                block.appendChild(dropZone(node, 'case:' + ci, c.children, depth));
                wrap.appendChild(block);
            });
            const defaultBlock = document.createElement('div');
            defaultBlock.className = 'slot-block route-default-block';
            defaultBlock.innerHTML = '<div class="slot-head branch-route-default">OTHERWISE (default)</div>';
            defaultBlock.appendChild(dropZone(node, 'default', node.defaultCase, depth));
            wrap.appendChild(defaultBlock);
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
            '<button data-add="gate">+ Gate</button>' +
            '<button data-add="section">+ Phase</button>' +
            '<button data-add="if">+ If</button>' +
            '<button data-add="loop">+ Loop</button>' +
            '<button data-add="subagent">+ Sub-Agent</button>' +
            '<button data-add="parallel">+ Parallel</button>' +
            '<button data-add="ask">+ Ask</button>' +
            '<button data-add="route">+ Route</button>' +
            '<button data-add="package">+ Package</button>' +
            '<button data-add="table">+ Table</button>';
        dz.appendChild(bar);
        return dz;
    }

    // ──────────────────────────────────────
    // CRUD
    // ──────────────────────────────────────
    function addNodeTo(parentId, slotKey, kind) {
        const node = makeNode(kind);
        if (!parentId) { getActiveModeNodes().push(node); }
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
        const qIdx = e.target.dataset.qindex;

        // Ask node question fields
        if (qIdx !== undefined && field) {
            const f = findNode(id);
            if (!f || !f.node.questions || !f.node.questions[qIdx]) return;
            const q = f.node.questions[qIdx];
            if (field === 'q_text') { q.text = e.target.value; updatePreview(); saveState(); return; }
            if (field === 'q_kind') { q.kind = e.target.value; pushHistory(); renderTasks(); return; }
            if (field === 'q_allowOther') { q.allowOther = e.target.checked; updatePreview(); saveState(); return; }
            if (field === 'q_suggestDefault') { q.suggestDefault = e.target.checked; updatePreview(); saveState(); return; }
            if (field === 'q_saveTo') { q.saveTo = e.target.value; updatePreview(); saveState(); return; }
            if (field === 'q_option') {
                const oIdx = e.target.dataset.oindex;
                if (oIdx !== undefined) { q.options[oIdx] = e.target.value; updatePreview(); saveState(); return; }
            }
            return;
        }

        // Ask node oneMessage checkbox
        if (field === 'oneMessage') {
            const f = findNode(id);
            if (f) { f.node.oneMessage = e.target.checked; updatePreview(); saveState(); }
            return;
        }

        // Ask node branching toggle
        if (field === 'toggleBranches') {
            const f = findNode(id);
            if (f) {
                if (e.target.checked) {
                    // Initialize branches from first choice question's options
                    const choiceQ = (f.node.questions || []).find(q => q.kind === 'choice' && (q.options || []).length);
                    if (choiceQ) {
                        f.node.branches = choiceQ.options.map(() => []);
                    } else {
                        f.node.branches = [[]];
                    }
                } else {
                    f.node.branches = [];
                }
                pushHistory(); renderTasks(); saveState();
            }
            return;
        }

        // Route node case fields
        if (field === 'case_label' || field === 'case_match') {
            const caseIdx = e.target.dataset.caseindex;
            if (caseIdx !== undefined) {
                const f = findNode(id);
                if (f && f.node.cases && f.node.cases[+caseIdx]) {
                    if (field === 'case_label') f.node.cases[+caseIdx].label = e.target.value;
                    if (field === 'case_match') f.node.cases[+caseIdx].match = e.target.value;
                    updatePreview(); saveState();
                }
            }
            return;
        }

        if (agentIdx !== undefined && field) {
            const f = findNode(id);
            if (f && f.node.agents[agentIdx]) {
                const a = f.node.agents[agentIdx];
                if (e.target.type === 'checkbox') {
                    if (field === 'isPrimary') {
                        a.isPrimary = e.target.checked;
                        // Enforce only one primary
                        if (a.isPrimary) {
                            f.node.agents.forEach((ag, idx) => { if (idx !== +agentIdx) ag.isPrimary = false; });
                        }
                        pushHistory(); renderTasks();
                    } else {
                        a[field] = e.target.checked;
                    }
                } else {
                    a[field] = e.target.value;
                }
                updatePreview(); saveState();
            }
            return;
        }
        if (elseifIdx !== undefined && e.target.classList.contains('elseif-cond')) {
            const f = findNode(id);
            if (f && f.node.elseifs[elseifIdx]) { f.node.elseifs[elseifIdx].condition = e.target.value; updatePreview(); saveState(); }
            return;
        }
        // Table node fields
        if (field === 'tbl_header') {
            const f = findNode(id);
            const ci = e.target.dataset.colindex;
            if (f && f.node.type === 'table' && ci !== undefined) {
                f.node.headers[+ci] = e.target.value;
                updatePreview(); saveState();
            }
            return;
        }
        if (field === 'tbl_cell') {
            const f = findNode(id);
            const ri = e.target.dataset.rowindex;
            const ci = e.target.dataset.colindex;
            if (f && f.node.type === 'table' && ri !== undefined && ci !== undefined) {
                if (!f.node.rows[+ri]) f.node.rows[+ri] = [];
                f.node.rows[+ri][+ci] = e.target.value;
                updatePreview(); saveState();
            }
            return;
        }
        if (field) setField(id, field, e.target.value, false);
    });

    taskList.addEventListener('change', (e) => {
        const card = e.target.closest('.task-card'); if (!card) return;
        const id = card.dataset.nodeId;
        const field = e.target.dataset.field;
        const agentIdx = e.target.dataset.agent;
        const qIdx = e.target.dataset.qindex;

        if (agentIdx !== undefined && field === 'agentic') {
            const f = findNode(id);
            if (f && f.node.agents[agentIdx]) { f.node.agents[agentIdx].agentic = e.target.checked; updatePreview(); saveState(); }
            return;
        }
        if (agentIdx !== undefined && field === 'isPrimary') {
            // handled in input handler above
            return;
        }
        // Ask kind change needs re-render
        if (qIdx !== undefined && field === 'q_kind') {
            const f = findNode(id);
            if (f && f.node.questions[qIdx]) { f.node.questions[qIdx].kind = e.target.value; pushHistory(); renderTasks(); saveState(); }
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
            if (slotAdd.dataset.action === 'addQuestion') {
                f.node.questions.push({ id: uid('q'), text: '', kind: 'choice', options: [], allowOther: true, suggestDefault: false, saveTo: '' });
                pushHistory(); renderTasks();
            }
            if (slotAdd.dataset.action === 'addOption') {
                const qi = +slotAdd.dataset.qindex;
                if (f.node.questions[qi]) { f.node.questions[qi].options.push(''); pushHistory(); renderTasks(); }
            }
            if (slotAdd.dataset.action === 'addCase') {
                if (f.node.type === 'route') { f.node.cases.push({ label: '', match: '', children: [] }); pushHistory(); renderTasks(); }
            }
            saveState();
            return;
        }
        // Ask add-option button (inline, not slot-add)
        const askAddOpt = e.target.closest('.ask-add-option');
        if (askAddOpt) {
            const card = askAddOpt.closest('.task-card'); const id = card.dataset.nodeId; const f = findNode(id);
            if (!f) return;
            const qi = +askAddOpt.dataset.qindex;
            if (f.node.questions[qi]) { f.node.questions[qi].options.push(''); pushHistory(); renderTasks(); saveState(); }
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
        else if (action === 'removeQuestion') {
            if (f && f.node.questions.length > 1) {
                f.node.questions.splice(+btn.dataset.qindex, 1);
                pushHistory(); renderTasks(); saveState();
            }
        }
        else if (action === 'removeOption') {
            if (f) {
                const qi = +btn.dataset.qindex;
                const oi = +btn.dataset.oindex;
                if (f.node.questions[qi] && f.node.questions[qi].options.length > 0) {
                    f.node.questions[qi].options.splice(oi, 1);
                    // Also remove corresponding branch if branching is enabled
                    if (f.node.branches && f.node.branches.length > oi) {
                        f.node.branches.splice(oi, 1);
                    }
                    pushHistory(); renderTasks(); saveState();
                }
            }
        }
        else if (action === 'removeAskBranch') {
            if (f && f.node.branches) {
                f.node.branches.splice(+btn.dataset.askbranch, 1);
                // If no branches left, keep branches array empty (branching is still enabled but no options yet)
                pushHistory(); renderTasks(); saveState();
            }
        }
        // Route node actions
        else if (action === 'removeCase') {
            if (f && f.node.type === 'route' && f.node.cases.length > 1) {
                f.node.cases.splice(+btn.dataset.caseindex, 1);
                pushHistory(); renderTasks(); saveState();
            }
        }
        // Table node actions
        else if (action === 'tblAddCol') {
            if (f && f.node.type === 'table') {
                f.node.headers.push('Column ' + (f.node.headers.length + 1));
                f.node.rows.forEach(r => r.push(''));
                pushHistory(); renderTasks(); saveState();
            }
        }
        else if (action === 'tblRemCol') {
            if (f && f.node.type === 'table' && f.node.headers.length > 1) {
                f.node.headers.pop();
                f.node.rows.forEach(r => r.pop());
                pushHistory(); renderTasks(); saveState();
            }
        }
        else if (action === 'tblAddRow') {
            if (f && f.node.type === 'table') {
                f.node.rows.push(new Array(f.node.headers.length).fill(''));
                pushHistory(); renderTasks(); saveState();
            }
        }
        else if (action === 'tblRemRow') {
            if (f && f.node.type === 'table' && f.node.rows.length > 1) {
                f.node.rows.pop();
                pushHistory(); renderTasks(); saveState();
            }
        }
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
            targetArr = getActiveModeNodes();
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
    const chkMemory = document.getElementById('chkMemory');
    const memoryFileInput = document.getElementById('memoryFile');
    const memoryField = chkMemory ? chkMemory.closest('.memory-field') : null;
    const varList = document.getElementById('varList');
    const btnAddVar = document.getElementById('btnAddVar');
    const resList = document.getElementById('resList');
    const btnAddRes = document.getElementById('btnAddRes');
    const verbosityToggle = document.getElementById('verbosityToggle');
    const btnCopy = document.getElementById('btnCopy');
    const btnDownload = document.getElementById('btnDownload');
    const btnReset = document.getElementById('btnReset');
    const btnExportJson = document.getElementById('btnExportJson');
    const btnUndo = document.getElementById('btnUndo');
    const btnRedo = document.getElementById('btnRedo');
    const themeToggle = document.getElementById('themeToggle');

    // add-block buttons (root level)
    document.getElementById('btnAddTask').addEventListener('click', () => addNodeTo(null, null, 'task'));
    document.getElementById('btnAddSection').addEventListener('click', () => addNodeTo(null, null, 'section'));
    document.getElementById('btnAddGate').addEventListener('click', () => addNodeTo(null, null, 'gate'));
    document.getElementById('btnAddIf').addEventListener('click', () => addNodeTo(null, null, 'if'));
    document.getElementById('btnAddLoop').addEventListener('click', () => addNodeTo(null, null, 'loop'));
    document.getElementById('btnAddSub').addEventListener('click', () => addNodeTo(null, null, 'subagent'));
    document.getElementById('btnAddParallel').addEventListener('click', () => addNodeTo(null, null, 'parallel'));
    document.getElementById('btnAddAsk').addEventListener('click', () => addNodeTo(null, null, 'ask'));
    document.getElementById('btnAddPackage').addEventListener('click', () => addNodeTo(null, null, 'package'));
    document.getElementById('btnAddTable').addEventListener('click', () => addNodeTo(null, null, 'table'));
    document.getElementById('btnAddRoute').addEventListener('click', () => addNodeTo(null, null, 'route'));

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
    // Resources / attachments  [§17]
    // ──────────────────────────────────────
    function renderResources() {
        if (!resList) return;
        resList.innerHTML = '';
        (state.resources || []).forEach((r, i) => {
            const row = document.createElement('div');
            row.className = 'res-row';
            const kindSel = '<select class="res-kind" data-i="' + i + '" aria-label="Resource kind">' +
                RES_KINDS.map(k => '<option value="' + k.value + '"' + (r.kind === k.value ? ' selected' : '') + '>' + k.label + '</option>').join('') + '</select>';
            const nameInp = '<input type="text" class="res-name" data-i="' + i + '" value="' + attr(r.name) + '" placeholder="@handle">';
            let valueCtl;
            if (r.kind === 'text') {
                valueCtl = '<textarea class="res-value res-text" data-i="' + i + '" rows="2" placeholder="Paste long text / console errors here…">' + escapeHtml(r.value) + '</textarea>';
            } else if (r.kind === 'link') {
                valueCtl = '<input type="text" class="res-value" data-i="' + i + '" value="' + attr(r.value) + '" placeholder="https://…">';
            } else if (r.kind === 'file' || r.kind === 'image' || r.kind === 'zip') {
                valueCtl = '<div class="res-file-wrap">' +
                    '<input type="file" class="res-file" data-i="' + i + '"' + (r.kind === 'image' ? ' accept="image/*"' : r.kind === 'zip' ? ' accept=".zip"' : '') + '>' +
                    '<input type="text" class="res-value" data-i="' + i + '" value="' + attr(r.value) + '" placeholder="or type a filename to reference">' +
                    (r.thumb ? '<img class="res-thumb" src="' + attr(r.thumb) + '" alt="thumbnail">' : '') +
                    '</div>';
            } else {
                valueCtl = '<input type="text" class="res-value" data-i="' + i + '" value="' + attr(r.value) + '" placeholder="reference / description">';
            }
            row.innerHTML = '<div class="res-top">' + kindSel + nameInp +
                '<button class="btn-icon btn-remove" data-i="' + i + '" data-rremove title="Remove resource" aria-label="Remove resource">✕</button></div>' +
                valueCtl +
                '<input type="text" class="res-note" data-i="' + i + '" value="' + attr(r.note || '') + '" placeholder="short note (optional)">';
            resList.appendChild(row);
        });
    }
    btnAddRes && btnAddRes.addEventListener('click', () => {
        state.resources.push({ id: uid('r'), kind: 'text', name: '', value: '', note: '' });
        renderResources(); pushHistory(); updatePreview();
    });
    resList && resList.addEventListener('input', (e) => {
        const i = e.target.dataset.i; if (i === undefined) return;
        const r = state.resources[i]; if (!r) return;
        if (e.target.classList.contains('res-name')) r.name = e.target.value;
        else if (e.target.classList.contains('res-value')) r.value = e.target.value;
        else if (e.target.classList.contains('res-note')) r.note = e.target.value;
        updatePreview();
    });
    resList && resList.addEventListener('change', (e) => {
        const i = e.target.dataset.i; if (i === undefined) return;
        const r = state.resources[i]; if (!r) return;
        if (e.target.classList.contains('res-kind')) { r.kind = e.target.value; renderResources(); pushHistory(); updatePreview(); return; }
        if (e.target.classList.contains('res-file')) {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            if (!r.name) r.name = file.name.replace(/[^A-Za-z0-9_]/g, '_');
            r.value = file.name;
            if (r.kind === 'image' && file.size < 200 * 1024) {
                const reader = new FileReader();
                reader.onload = ev => { r.thumb = ev.target.result; renderResources(); updatePreview(); saveState(); };
                reader.readAsDataURL(file);
            }
            renderResources(); pushHistory(); updatePreview();
        }
    });
    resList && resList.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-rremove]'); if (!btn) return;
        state.resources.splice(+btn.dataset.i, 1); renderResources(); pushHistory(); updatePreview();
    });

    // ──────────────────────────────────────
    // Modes  [MODE+FLAG]
    // ──────────────────────────────────────
    const modesCard = document.getElementById('modesCard');
    const modeTabs = document.getElementById('modeTabs');
    const modeEditArea = document.getElementById('modeEditArea');
    const btnEnableMultiMode = document.getElementById('btnEnableMultiMode');
    const btnAddMode = document.getElementById('btnAddMode');

    function renderModes() {
        if (!modesCard) return;
        // If single default mode and multi-mode not enabled, show minimal UI
        if (isSingleDefaultMode()) {
            modesCard.classList.add('modes-collapsed');
            if (modeTabs) modeTabs.innerHTML = '';
            if (modeEditArea) modeEditArea.innerHTML = '';
            if (btnEnableMultiMode) btnEnableMultiMode.style.display = '';
            if (btnAddMode) btnAddMode.style.display = 'none';
            return;
        }
        modesCard.classList.remove('modes-collapsed');
        if (btnEnableMultiMode) btnEnableMultiMode.style.display = 'none';
        if (btnAddMode) btnAddMode.style.display = '';

        // Render tabs
        if (modeTabs) {
            modeTabs.innerHTML = '';
            (state.modes || []).forEach((mode, i) => {
                const tab = document.createElement('button');
                tab.className = 'mode-tab' + (mode.id === (getActiveMode() || {}).id ? ' active' : '');
                tab.textContent = mode.name || '/unnamed';
                tab.dataset.modeId = mode.id;
                tab.addEventListener('click', () => switchMode(mode.id));
                modeTabs.appendChild(tab);
            });
        }

        // Render edit area for active mode
        const activeMode = getActiveMode();
        if (modeEditArea && activeMode) {
            let html = '<div class="mode-edit-fields">' +
                '<div class="mode-field"><label>Name</label><input type="text" class="mode-name-input" data-modefield="name" value="' + attr(activeMode.name) + '" placeholder="/plan"></div>' +
                '<div class="mode-field"><label>Summary</label><input type="text" class="mode-summary-input" data-modefield="summary" value="' + attr(activeMode.summary || '') + '" placeholder="Brief description of this mode"></div>' +
            '</div>';
            // Flags
            html += '<div class="mode-flags"><div class="mode-flags-header"><span>Flags</span><button class="slot-add" id="btnAddFlag">+ Add Flag</button></div>';
            (activeMode.flags || []).forEach((f, fi) => {
                html += '<div class="mode-flag-row">' +
                    '<input type="text" class="flag-name-input" data-flagindex="' + fi + '" data-flagfield="name" value="' + attr(f.name) + '" placeholder="--flag-name">' +
                    '<input type="text" class="flag-desc-input" data-flagindex="' + fi + '" data-flagfield="desc" value="' + attr(f.desc || '') + '" placeholder="Description">' +
                    '<button class="btn-icon btn-remove" data-flagremove="' + fi + '" title="Remove flag" aria-label="Remove flag">✕</button>' +
                '</div>';
            });
            html += '</div>';
            // Remove mode button (can't remove last mode)
            if (state.modes.length > 1) {
                html += '<button class="btn btn-remove-mode" id="btnRemoveMode">✕ Remove This Mode</button>';
            }
            // BUG-M1 fix: Add "Disable multi-mode" button when multi-mode is enabled
            html += '<button class="btn btn-disable-multimode" id="btnDisableMultiMode">↩ Disable multi-mode</button>';
            modeEditArea.innerHTML = html;

            // Add event listeners for mode editing
            // BUG-M2 fix: Do NOT call renderModes() on input — only updatePreview + saveState + update tab text
            modeEditArea.querySelectorAll('[data-modefield]').forEach(inp => {
                inp.addEventListener('input', (e) => {
                    const field = e.target.dataset.modefield;
                    const m = getActiveMode();
                    if (m) {
                        m[field] = e.target.value;
                        updatePreview();
                        saveState();
                        // Update the active tab text without re-rendering the whole modes UI
                        if (field === 'name' && modeTabs) {
                            const activeTab = modeTabs.querySelector('.mode-tab.active');
                            if (activeTab) activeTab.textContent = e.target.value || '/unnamed';
                        }
                    }
                });
            });
            modeEditArea.querySelectorAll('[data-flagfield]').forEach(inp => {
                inp.addEventListener('input', (e) => {
                    const fi = +e.target.dataset.flagindex;
                    const field = e.target.dataset.flagfield;
                    const m = getActiveMode();
                    if (m && m.flags && m.flags[fi]) { m.flags[fi][field] = e.target.value; updatePreview(); saveState(); }
                });
            });
            modeEditArea.querySelectorAll('[data-flagremove]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const fi = +e.target.dataset.flagremove;
                    const m = getActiveMode();
                    if (m && m.flags) { m.flags.splice(fi, 1); pushHistory(); renderModes(); saveState(); }
                });
            });
            const addFlagBtn = modeEditArea.querySelector('#btnAddFlag');
            if (addFlagBtn) addFlagBtn.addEventListener('click', () => {
                const m = getActiveMode();
                if (m) { if (!m.flags) m.flags = []; m.flags.push({ name: '', desc: '' }); pushHistory(); renderModes(); saveState(); }
            });
            const removeModeBtn = modeEditArea.querySelector('#btnRemoveMode');
            if (removeModeBtn) removeModeBtn.addEventListener('click', () => {
                if (state.modes.length <= 1) return;
                if (!confirm('Remove mode "' + (getActiveMode().name || 'unnamed') + '"? This will also remove all its steps.')) return;
                removeActiveMode();
            });
            // BUG-M1 fix: Disable multi-mode button handler
            const disableMultiModeBtn = modeEditArea.querySelector('#btnDisableMultiMode');
            if (disableMultiModeBtn) disableMultiModeBtn.addEventListener('click', disableMultiMode);
        }
    }

    function switchMode(modeId) {
        state.activeModeId = modeId;
        renderModes();
        renderTasks();
        saveState();
    }

    function addMode() {
        const newMode = { id: uid('mode'), name: '/new', summary: '', flags: [], nodes: [] };
        state.modes.push(newMode);
        state.activeModeId = newMode.id;
        state.multiModeEnabled = true;
        pushHistory(); renderModes(); renderTasks(); saveState();
    }

    function removeActiveMode() {
        if (state.modes.length <= 1) return;
        const activeMode = getActiveMode();
        const idx = state.modes.indexOf(activeMode);
        if (idx < 0) return;
        state.modes.splice(idx, 1);
        // Switch to first mode
        state.activeModeId = state.modes[0].id;
        pushHistory(); renderModes(); renderTasks(); saveState();
    }

    // Enable multi-mode toggle
    btnEnableMultiMode && btnEnableMultiMode.addEventListener('click', () => {
        state.multiModeEnabled = true;
        // Migrate state.nodes to first mode's nodes if not already done
        if (state.modes && state.modes[0] && state.nodes && state.nodes.length && !state.modes[0].nodes.length) {
            state.modes[0].nodes = state.nodes;
        }
        pushHistory(); renderModes(); renderTasks(); saveState();
    });

    // BUG-M1: Disable multi-mode function (also used by the inline button in renderModes)
    function disableMultiMode() {
        if (state.modes.length > 1) {
            if (!confirm('Disabling multi-mode will keep only the active mode ("' + (getActiveMode().name || '/default') + '") and remove all others. Continue?')) return;
            const active = getActiveMode();
            state.modes = [active];
            state.activeModeId = active.id;
        }
        state.multiModeEnabled = false;
        if (state.modes[0] && state.modes[0].nodes) {
            state.nodes = state.modes[0].nodes;
        }
        pushHistory(); renderModes(); renderTasks(); saveState();
    }
    btnAddMode && btnAddMode.addEventListener('click', addMode);

    // verbosity toggle (Compact / Explicit)  [§12]
    verbosityToggle && verbosityToggle.addEventListener('click', (e) => {
        const opt = e.target.closest('[data-verb]'); if (!opt) return;
        state.verbosity = opt.dataset.verb;
        verbosityToggle.querySelectorAll('[data-verb]').forEach(b => b.classList.toggle('active', b.dataset.verb === state.verbosity));
        renderPreviewNow(); saveState();
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
    chkMemory && chkMemory.addEventListener('change', () => {
        state.memoryDirective = chkMemory.checked;
        if (memoryField) memoryField.classList.toggle('enabled', state.memoryDirective);
        updatePreview(); pushHistory();
    });
    memoryFileInput && memoryFileInput.addEventListener('input', () => { state.memoryFile = memoryFileInput.value; updatePreview(); });

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
        if (chkMemory) chkMemory.checked = state.memoryDirective;
        if (memoryFileInput) memoryFileInput.value = state.memoryFile || 'AGENT_PROMPT.md';
        if (memoryField) memoryField.classList.toggle('enabled', state.memoryDirective);
        modeToggle.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === state.outputMode));
        if (verbosityToggle) verbosityToggle.querySelectorAll('[data-verb]').forEach(b => b.classList.toggle('active', b.dataset.verb === (state.verbosity || 'explicit')));
        renderVariables();
        renderResources();
        renderModes();
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
    // Built-in Starter Templates  [R6 / P2]
    // ──────────────────────────────────────
    function buildTemplateState(overrides) {
        const s = defaultState();
        Object.assign(s, overrides);
        // Re-id all nodes to get fresh unique IDs
        (s.nodes || []).forEach(reId);
        // Re-id mode nodes if present
        if (s.modes) s.modes.forEach(m => { m.id = uid('mode'); (m.nodes || []).forEach(reId); });
        // Ensure modes consistency
        if (!s.modes || !s.modes.length) {
            s.modes = [{ id: uid('mode'), name: '/default', summary: 'Default mode', flags: [], nodes: s.nodes || [] }];
        }
        return s;
    }

    const BUILTIN_TEMPLATES = [
        {
            name: '🐛 Bug Triage',
            desc: 'Reproduce, debug, and fix a reported bug with regression tests',
            state: buildTemplateState({
                roleSelectValue: 'QA Tester (automated testing, edge cases, regression suites)',
                agentic: true, strict: true,
                contextProject: '', contextTech: '', contextOutput: 'step_by_step',
                nodes: [
                    makeTask('clone'),   // 1. CLONE
                    (() => { const t = makeTask('analyze'); t.target = 'the reported bug and related code'; t.details = 'Identify the affected module, function, and code paths'; return t; })(),
                    (() => { const n = makeIf(); n.condition = 'bug is reproducible'; n.then = [
                        (() => { const t = makeTask('debug'); t.target = 'root cause of the bug'; t.details = 'Trace the execution path, identify the exact line/logic causing the issue'; return t; })(),
                        (() => { const t = makeTask('implement'); t.target = 'fix for the bug'; t.details = 'Apply a minimal, targeted fix — do not refactor unrelated code'; return t; })(),
                        (() => { const t = makeTask('test'); t.target = 'the fix and edge cases'; t.details = 'Verify the bug is fixed; test related paths to prevent regression'; return t; })(),
                    ]; n.else = [
                        (() => { const t = makeTask('document'); t.target = 'the bug as non-reproducible'; t.details = 'Record steps attempted, environment details, and reasons it could not be reproduced'; return t; })(),
                    ]; return n; })(),
                    (() => { const g = makeGate(); g.prompt = 'Bug fix verified — ready to deploy?'; g.onReject = 'Continue debugging or request more information'; return g; })(),
                    (() => { const t = makeTask('deploy'); t.target = 'staging for final validation'; return t; })(),
                ],
            })
        },
        {
            name: '👀 Code Review',
            desc: 'Systematic PR review with per-file loop, security and style checks',
            state: buildTemplateState({
                roleSelectValue: 'Code Reviewer (meticulous, checks security, performance & readability)',
                strict: true,
                contextProject: '', contextTech: '', contextOutput: 'bullet_points',
                nodes: [
                    makeTask('clone'),
                    (() => { const t = makeTask('analyze'); t.target = 'the PR diff and changed files'; t.details = 'Get the full list of changed files and understand the PR purpose'; return t; })(),
                    (() => { const lp = makeLoop(); lp.loopType = 'for_each'; lp.itemVar = 'file'; lp.source = 'changed files in PR'; lp.body = [
                        (() => { const t = makeTask('review'); t.target = '${file}'; t.details = 'Check for: bugs, security issues, performance, readability, naming, and style consistency'; return t; })(),
                        (() => { const n = makeIf(); n.condition = 'issues found in ${file}'; n.then = [
                            (() => { const t = makeTask('document'); t.target = 'issues found in ${file}'; t.details = 'List each issue with line number, severity, and suggested fix'; return t; })(),
                        ]; return n; })(),
                    ]; return lp; })(),
                    (() => { const g = makeGate(); g.prompt = 'Review complete — approve the PR?'; g.onReject = 'Request changes from the author'; return g; })(),
                    (() => { const t = makeTask('document'); t.target = 'final review summary'; t.details = 'Include: overall assessment, critical issues, minor suggestions, and approval/rejection decision'; return t; })(),
                ],
            })
        },
        {
            name: '📦 Migration',
            desc: 'Plan and execute a technology migration with approval gates and revision loops',
            state: buildTemplateState({
                roleSelectValue: 'DevOps Engineer (CI/CD, Docker, AWS, infrastructure-as-code)',
                agentic: true,
                contextProject: '', contextTech: '', contextConstraints: 'Backward compatible, no downtime, rollback plan required',
                nodes: [
                    (() => { const sec = makeSection(); sec.title = 'Research & Planning'; sec.goalNote = 'Understand current system and create migration plan'; sec.exitCriteria = 'Migration plan approved by user'; sec.children = [
                        (() => { const t = makeTask('analyze'); t.target = 'current system architecture and dependencies'; t.details = 'Map all services, databases, APIs, and integrations that will be affected'; return t; })(),
                        (() => { const t = makeTask('research'); t.target = 'best practices and migration strategies'; t.details = 'Look for official migration guides, known pitfalls, and recommended tooling'; return t; })(),
                        (() => { const t = makeTask('document'); t.target = 'migration plan with rollback strategy'; t.details = 'Include: step-by-step migration order, rollback procedures, risk assessment, and timeline estimates'; return t; })(),
                    ]; return sec; })(),
                    (() => { const g = makeGate(); g.prompt = 'Migration plan approved — proceed with implementation?'; g.onReject = 'Revise the plan based on feedback'; return g; })(),
                    (() => { const sec = makeSection(); sec.title = 'Implementation & Testing'; sec.goalNote = 'Execute the migration in stages with verification'; sec.children = [
                        (() => { const lp = makeLoop(); lp.loopType = 'for_each'; lp.itemVar = 'step'; lp.source = 'migration plan steps'; lp.maxIterations = '3'; lp.exitCondition = 'user is satisfied with results'; lp.body = [
                            (() => { const t = makeTask('implement'); t.target = '${step}'; t.details = 'Apply the migration step as described in the plan'; return t; })(),
                            (() => { const t = makeTask('test'); t.target = 'system after ${step}'; t.details = 'Run all integration tests, smoke tests, and manual verification'; return t; })(),
                            (() => { const n = makeIf(); n.condition = 'tests pass after ${step}'; n.then = [
                                (() => { const t = makeTask('deploy'); t.target = 'migrated ${step} to staging'; return t; })(),
                            ]; n.else = [
                                (() => { const t = makeTask('debug'); t.target = 'failures after ${step}'; t.details = 'Investigate and fix; if unfixable, rollback this step'; return t; })(),
                            ]; return n; })(),
                        ]; return lp; })(),
                    ]; return sec; })(),
                    (() => { const t = makeTask('deploy'); t.target = 'fully migrated system to production'; t.details = 'Switch traffic, monitor metrics, and confirm stability'; return t; })(),
                ],
            })
        },
        {
            name: '🏗️ Full Project Setup',
            desc: 'Multi-phase project with sub-agents: plan, build, review, and deliver',
            state: buildTemplateState({
                roleSelectValue: 'Senior Software Engineer (full-stack, React/Node.js, writes production-grade code)',
                agentic: true, subagent: true, strict: true,
                contextProject: '', contextTech: 'React, Node.js, PostgreSQL',
                variables: [
                    { name: 'project', value: '' },
                    { name: 'repo', value: '' },
                ],
                nodes: [
                    (() => { const sec = makeSection(); sec.title = 'Phase 0 — Requirements & Architecture'; sec.goalNote = 'Gather requirements and produce an architecture document'; sec.exitCriteria = 'Architecture document approved'; sec.children = [
                        (() => { const t = makeTask('clone'); t.target = '${repo}'; return t; })(),
                        (() => { const t = makeTask('analyze'); t.target = 'existing codebase structure and patterns'; t.details = 'Understand the current project layout, conventions, and technical debt'; return t; })(),
                        (() => { const sa = makeSubagent(); sa.execMode = 'parallel'; sa.agents = [
                            (() => { const a = makeAgent(); a.role = 'Architect'; a.task = 'Design the system architecture and data model'; a.agentic = true; a.isPrimary = true; a.domain = 'System Design'; a.rationale = 'Ensures consistent architecture decisions'; a.outputFile = '${project}_architecture.md'; return a; })(),
                            (() => { const a = makeAgent(); a.role = 'Security Analyst'; a.task = 'Identify security requirements and threat model'; a.agentic = true; a.domain = 'Security'; a.rationale = 'Ensures OWASP top-10 coverage'; a.outputFile = '${project}_security_report.md'; return a; })(),
                        ]; return sa; })(),
                        (() => { const t = makeTask('document'); t.target = 'architecture document at docs/${project}_architecture.md'; t.details = 'Include: ER diagram, API contract, folder structure, and tech decisions with rationale'; return t; })(),
                    ]; return sec; })(),
                    (() => { const g = makeGate(); g.prompt = 'Architecture approved — start implementation?'; g.onReject = 'Revise architecture based on feedback'; return g; })(),
                    (() => { const sec = makeSection(); sec.title = 'Phase 1 — Implementation'; sec.goalNote = 'Build the core features end-to-end'; sec.exitCriteria = 'All features implemented and unit-tested'; sec.children = [
                        (() => { const lp = makeLoop(); lp.loopType = 'for_each'; lp.itemVar = 'feature'; lp.source = 'priority-ordered feature list'; lp.body = [
                            (() => { const t = makeTask('implement'); t.target = '${feature}'; t.details = 'Follow the architecture document; write clean, well-tested code'; return t; })(),
                            (() => { const t = makeTask('test'); t.target = '${feature} unit and integration tests'; t.details = 'Aim for >80% coverage; test edge cases and error paths'; return t; })(),
                        ]; return lp; })(),
                    ]; return sec; })(),
                    (() => { const sec = makeSection(); sec.title = 'Phase 2 — Review & Deliver'; sec.goalNote = 'Quality assurance and final delivery'; sec.exitCriteria = 'All tests pass and code review approved'; sec.children = [
                        (() => { const sa = makeSubagent(); sa.execMode = 'parallel'; sa.agents = [
                            (() => { const a = makeAgent(); a.role = 'Code Reviewer'; a.task = 'Review all code for quality, security, and maintainability'; a.agentic = true; a.domain = 'Code Quality'; return a; })(),
                            (() => { const a = makeAgent(); a.role = 'QA Tester'; a.task = 'Run end-to-end tests and verify all acceptance criteria'; a.agentic = true; a.domain = 'Testing'; return a; })(),
                        ]; return sa; })(),
                        (() => { const n = makeIf(); n.condition = 'all reviews pass and tests green'; n.then = [
                            (() => { const t = makeTask('deploy'); t.target = 'production'; return t; })(),
                        ]; n.else = [
                            (() => { const t = makeTask('debug'); t.target = 'review findings and test failures'; t.details = 'Fix all critical issues; re-test and re-review'; return t; })(),
                        ]; return n; })(),
                        (() => { const pkg = makePackage(); pkg.archiveName = '${project}_deliverable.zip'; pkg.tree = '${project}/\n├── src/\n│   ├── index.ts\n│   ├── api/\n│   └── utils/\n├── tests/\n├── docs/\n│   └── ${project}_architecture.md\n├── README.md\n└── package.json'; return pkg; })(),
                    ]; return sec; })(),
                ],
            })
        },
    ];

    function renderTemplateList() {
        const container = document.getElementById('templateList');
        if (!container) return;
        container.innerHTML = '';
        BUILTIN_TEMPLATES.forEach((tpl, idx) => {
            const item = document.createElement('div');
            item.className = 'template-item';
            item.setAttribute('role', 'button');
            item.setAttribute('tabindex', '0');
            item.setAttribute('aria-label', 'Load template: ' + tpl.name);
            item.innerHTML = '<span class="template-item-name">' + escapeHtml(tpl.name) + '</span>' +
                '<span class="template-item-desc">' + escapeHtml(tpl.desc) + '</span>' +
                '<span class="template-item-role">' + escapeHtml(tpl.state.roleSelectValue.split('(')[0].trim()) + '</span>';
            item.addEventListener('click', () => loadTemplate(idx));
            item.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); loadTemplate(idx); } });
            container.appendChild(item);
        });
        // Also render user-imported templates from localStorage
        const userTemplates = getUserTemplates();
        userTemplates.forEach((tpl, idx) => {
            const item = document.createElement('div');
            item.className = 'template-item template-item-user';
            item.setAttribute('role', 'button');
            item.setAttribute('tabindex', '0');
            item.setAttribute('aria-label', 'Load user template: ' + tpl.name);
            item.innerHTML = '<span class="template-item-name">' + escapeHtml(tpl.name) + '</span>' +
                '<span class="template-item-desc">' + escapeHtml(tpl.desc || '') + '</span>' +
                '<button class="btn-icon-small tpl-delete" data-utidx="' + idx + '" title="Delete template" aria-label="Delete template">🗑️</button>';
            item.addEventListener('click', (e) => {
                if (e.target.closest('.tpl-delete')) return;
                loadUserTemplate(idx);
            });
            item.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); loadUserTemplate(idx); } });
            item.querySelector('.tpl-delete').addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Delete template "' + tpl.name + '"?')) {
                    const tpls = getUserTemplates();
                    tpls.splice(idx, 1);
                    setUserTemplates(tpls);
                    renderTemplateList();
                    showToast('Template deleted');
                }
            });
            container.appendChild(item);
        });
    }

    function loadTemplate(idx) {
        const tpl = BUILTIN_TEMPLATES[idx];
        if (!tpl) return;
        if (!confirm('Load template "' + tpl.name + '"?\nThis will replace your current workflow.')) return;
        state = deepClone(tpl.state);
        (state.nodes || []).forEach(reId);
        state.schema = SCHEMA;
        migrateSchema6(state);
        pushHistory();
        updateAllUI();
        saveState();
        closeSidebar();
        showToast('Loaded template: ' + tpl.name);
    }

    function loadUserTemplate(idx) {
        const tpls = getUserTemplates();
        const tpl = tpls[idx];
        if (!tpl || !tpl.state) { showToast('⚠️ Invalid template'); return; }
        if (!confirm('Load template "' + tpl.name + '"?\nThis will replace your current workflow.')) return;
        state = Object.assign(defaultState(), deepClone(tpl.state));
        (state.nodes || []).forEach(reId);
        state.schema = SCHEMA;
        migrateSchema6(state);
        pushHistory();
        updateAllUI();
        saveState();
        closeSidebar();
        showToast('Loaded template: ' + tpl.name);
    }

    // ──────────────────────────────────────
    // User templates (localStorage)
    // ──────────────────────────────────────
    function getUserTemplates() { try { return JSON.parse(localStorage.getItem(TEMPLATES_KEY)) || []; } catch (e) { return []; } }
    function setUserTemplates(t) { try { localStorage.setItem(TEMPLATES_KEY, JSON.stringify(t)); } catch (e) {} }

    function exportTemplateToFile() {
        const name = prompt('Template name:');
        if (!name || !name.trim()) return;
        const desc = prompt('Template description (optional):') || '';
        const templateData = {
            name: name.trim(),
            desc: desc.trim(),
            state: deepClone(state)
        };
        templateData.state.schema = SCHEMA;
        const json = JSON.stringify(templateData, null, 2);
        download(json, name.trim().replace(/[^A-Za-z0-9_-]/g, '_') + '-template.json', 'application/json');
        showToast('Template exported');
    }

    function importTemplateFromFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.addEventListener('change', (e) => {
            if (!e.target.files.length) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const data = JSON.parse(ev.target.result);
                    if (!data.name || !data.state || (!Array.isArray(data.state.nodes) && !Array.isArray(data.state.modes))) {
                        showToast('⚠️ Invalid template file');
                        return;
                    }
                    const tpls = getUserTemplates();
                    tpls.push({ name: data.name, desc: data.desc || '', state: data.state });
                    setUserTemplates(tpls);
                    renderTemplateList();
                    showToast('Template imported: ' + data.name);
                } catch (err) {
                    showToast('⚠️ Invalid JSON file');
                }
            };
            reader.readAsText(e.target.files[0]);
            input.value = '';
        });
        input.click();
    }

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
    function validWorkflow(w) { return w && typeof w.name === 'string' && w.state && (Array.isArray(w.state.nodes) || Array.isArray(w.state.modes)); }

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
        state = deepClone(w.state);
        migrateSchema6(state);
        pushHistory(); updateAllUI(); saveState(); showToast('Loaded "' + name + '"');
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

    // Template export/import buttons
    const btnExportTemplate = document.getElementById('btnExportTemplate');
    const btnImportTemplate = document.getElementById('btnImportTemplate');
    if (btnExportTemplate) btnExportTemplate.addEventListener('click', exportTemplateToFile);
    if (btnImportTemplate) btnImportTemplate.addEventListener('click', importTemplateFromFile);

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
    // R5: Keyboard reorder — Alt+ArrowUp/Alt+ArrowDown on drag handles
    taskList.addEventListener('keydown', (e) => {
        if (!e.altKey) return;
        const handle = e.target.closest('.drag-handle');
        if (!handle) return;
        const card = handle.closest('.task-card');
        if (!card) return;
        const id = card.dataset.nodeId;
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            moveWithin(id, -1);
            requestAnimationFrame(() => {
                const newCard = taskList.querySelector('.task-card[data-node-id="' + id + '"] .drag-handle');
                if (newCard) newCard.focus();
            });
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            moveWithin(id, 1);
            requestAnimationFrame(() => {
                const newCard = taskList.querySelector('.task-card[data-node-id="' + id + '"] .drag-handle');
                if (newCard) newCard.focus();
            });
        }
    });

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
    loadSettings();   // [S6] load output-text overrides (after loadState so the dedicated key is authoritative)
    updateAllUI();
    renderTemplateList();
    renderWorkflowList();
    pushHistory();
    console.log('Prompt Generator (tree model, schema 6) ready');
})();