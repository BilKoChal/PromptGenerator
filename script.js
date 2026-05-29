(function() {
    // ──────────────────────────────────────
    // DOM References
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
    const taskList = document.getElementById('taskList');
    const previewBlock = document.getElementById('previewBlock');
    const btnAddTask = document.getElementById('btnAddTask');
    const btnAddIf = document.getElementById('btnAddIf');
    const btnAddLoop = document.getElementById('btnAddLoop');
    const btnCopy = document.getElementById('btnCopy');
    const btnDownload = document.getElementById('btnDownload');
    const btnReset = document.getElementById('btnReset');
    const toast = document.getElementById('toast');

    // Sidebar
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const workflowNameInput = document.getElementById('workflowName');
    const btnSaveWorkflow = document.getElementById('btnSaveWorkflow');
    const workflowListDiv = document.getElementById('workflowList');
    const btnExportAll = document.getElementById('btnExportAll');
    const btnImportFile = document.getElementById('btnImportFile');
    const importFileInput = document.getElementById('importFileInput');

    // ──────────────────────────────────────
    // Task Type Definitions
    // ──────────────────────────────────────
    const TASK_TYPES = [
        { value: 'clone', label: '📥 Clone Repo', paramPlaceholder: 'https://github.com/user/repo.git' },
        { value: 'analyze', label: '🔍 Analyze', paramPlaceholder: 'entire codebase or src/utils/' },
        { value: 'research', label: '📚 Research', paramPlaceholder: 'best practices for error handling in Rust...' },
        { value: 'create_sub_agent', label: '🤖 Sub-Agent', paramPlaceholder: 'analyze the authentication module and report findings' },
        { value: 'implement', label: '🛠️ Implement', paramPlaceholder: 'user authentication with JWT' },
        { value: 'refactor', label: '♻️ Refactor', paramPlaceholder: 'src/legacy/data-processor.js' },
        { value: 'test', label: '🧪 Test', paramPlaceholder: 'the login flow and edge cases' },
        { value: 'document', label: '📝 Document', paramPlaceholder: 'all public API endpoints' },
        { value: 'review', label: '👀 Review', paramPlaceholder: 'PR #42 or src/new-feature/' },
        { value: 'deploy', label: '🚀 Deploy', paramPlaceholder: 'staging server / AWS ECS' },
        { value: 'debug', label: '🐛 Debug', paramPlaceholder: 'the payment flow fails on checkout...' },
        { value: 'optimize', label: '⚡ Optimize', paramPlaceholder: 'database queries in the orders module...' },
        { value: 'migrate', label: '📦 Migrate', paramPlaceholder: 'from REST to GraphQL...' },
        { value: 'configure', label: '⚙️ Configure', paramPlaceholder: 'CI/CD pipeline with GitHub Actions...' },
        { value: 'monitor', label: '📊 Monitor', paramPlaceholder: 'API latency and error rates...' },
        { value: 'custom_task', label: '💡 Custom', paramPlaceholder: 'describe what needs to be done...' },
    ];

    // ──────────────────────────────────────
    // State
    // ──────────────────────────────────────
    const STORAGE_KEY = 'prompt_generator_state_v4';
    const WORKFLOWS_KEY = 'prompt_generator_workflows';
    let taskIdCounter = Date.now();

    let state = {
        roleSelectValue: 'Senior Software Engineer (full-stack, React/Node.js, writes production-grade code)',
        customRole: '',
        agentic: false,
        subagent: false,
        verbose: false,
        strict: false,
        contextProject: '',
        contextTech: '',
        contextConstraints: '',
        contextOutput: '',
        tasks: [
            { id: taskIdCounter++, type: 'clone', param: '', details: '' },
            { id: taskIdCounter++, type: 'analyze', param: '', details: '' },
        ],
    };

    // ──────────────────────────────────────
    // Persistence
    // ──────────────────────────────────────
    function saveState() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
    }

    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const saved = JSON.parse(raw);
                if (saved.roleSelectValue) state.roleSelectValue = saved.roleSelectValue;
                if (saved.customRole !== undefined) state.customRole = saved.customRole;
                if (saved.agentic !== undefined) state.agentic = saved.agentic;
                if (saved.subagent !== undefined) state.subagent = saved.subagent;
                if (saved.verbose !== undefined) state.verbose = saved.verbose;
                if (saved.strict !== undefined) state.strict = saved.strict;
                if (saved.contextProject !== undefined) state.contextProject = saved.contextProject;
                if (saved.contextTech !== undefined) state.contextTech = saved.contextTech;
                if (saved.contextConstraints !== undefined) state.contextConstraints = saved.contextConstraints;
                if (saved.contextOutput !== undefined) state.contextOutput = saved.contextOutput;
                if (Array.isArray(saved.tasks) && saved.tasks.length > 0) {
                    state.tasks = saved.tasks;
                    const maxId = Math.max(...state.tasks.map(t => t.id), 0);
                    taskIdCounter = maxId + 1;
                }
            }
        } catch (e) {}
    }

    // ──────────────────────────────────────
    // Workflow Save/Load/Export/Import
    // ──────────────────────────────────────
    function getSavedWorkflows() {
        try { return JSON.parse(localStorage.getItem(WORKFLOWS_KEY)) || []; } catch (e) { return []; }
    }
    function setSavedWorkflows(workflows) {
        localStorage.setItem(WORKFLOWS_KEY, JSON.stringify(workflows));
    }
    function saveCurrentWorkflow(name) {
        const workflows = getSavedWorkflows();
        const existingIndex = workflows.findIndex(w => w.name === name);
        const snapshot = JSON.parse(JSON.stringify(state));
        if (existingIndex > -1) workflows[existingIndex].state = snapshot;
        else workflows.push({ name, state: snapshot });
        setSavedWorkflows(workflows);
        renderWorkflowList();
    }
    function loadWorkflow(name) {
        const workflows = getSavedWorkflows();
        const found = workflows.find(w => w.name === name);
        if (found) {
            state = JSON.parse(JSON.stringify(found.state));
            taskIdCounter = state.tasks.length ? Math.max(...state.tasks.map(t => t.id)) + 1 : 1;
            updateAllUI();
            showToast('📂 Loaded "' + name + '"');
        }
    }
    function deleteWorkflow(name) {
        let workflows = getSavedWorkflows();
        workflows = workflows.filter(w => w.name !== name);
        setSavedWorkflows(workflows);
        renderWorkflowList();
    }
    function exportWorkflows() {
        const workflows = getSavedWorkflows();
        const blob = new Blob([JSON.stringify(workflows, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'prompt-workflows-' + new Date().toISOString().slice(0,10) + '.json';
        a.click();
        URL.revokeObjectURL(url);
        showToast('📤 Workflows exported');
    }
    function importWorkflows(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                if (Array.isArray(imported)) {
                    const existing = getSavedWorkflows();
                    const merged = [...existing];
                    imported.forEach(imp => {
                        const index = merged.findIndex(w => w.name === imp.name);
                        if (index > -1) merged[index] = imp;
                        else merged.push(imp);
                    });
                    setSavedWorkflows(merged);
                    renderWorkflowList();
                    showToast('📥 Workflows imported');
                } else { showToast('⚠️ Invalid file format'); }
            } catch (err) { showToast('⚠️ Invalid JSON file'); }
        };
        reader.readAsText(file);
    }
    function renderWorkflowList() {
        const workflows = getSavedWorkflows();
        workflowListDiv.innerHTML = '';
        if (workflows.length === 0) {
            workflowListDiv.innerHTML = '<p style="color:var(--text-secondary);font-size:0.9rem;text-align:center;">No saved workflows yet.</p>';
            return;
        }
        workflows.forEach(w => {
            const item = document.createElement('div');
            item.className = 'workflow-item';
            item.innerHTML = '<span class="workflow-item-name">' + escapeHtml(w.name) + '</span>' +
                '<div class="workflow-item-actions">' +
                '<button class="btn-icon-small" data-action="load" title="Load">📂</button>' +
                '<button class="btn-icon-small" data-action="delete" title="Delete">🗑️</button>' +
                '</div>';
            item.addEventListener('click', (e) => { if (e.target.closest('button')) return; loadWorkflow(w.name); });
            item.querySelector('[data-action="load"]').addEventListener('click', (e) => { e.stopPropagation(); loadWorkflow(w.name); });
            item.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Delete workflow "' + w.name + '"?')) deleteWorkflow(w.name);
            });
            workflowListDiv.appendChild(item);
        });
    }

    // ──────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────
    function getTaskTypeDef(type) {
        return TASK_TYPES.find(t => t.value === type) || TASK_TYPES[1];
    }
    function getEffectiveRole() {
        if (state.roleSelectValue === 'custom') return state.customRole.trim() || 'Assistant';
        return state.roleSelectValue;
    }
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ──────────────────────────────────────
    // Generate Markdown
    // ──────────────────────────────────────
    function generateMarkdown() {
        const role = getEffectiveRole();
        let md = '# Agent Prompt\n\n## Role\nYou are a **' + role + '**.\n';

        if (state.agentic) md += '- You are **agentic** -- you can perform iterative, autonomous tasks (run commands, explore code, etc.).\n';
        if (state.subagent) md += '- You can **spawn sub-agents** to handle parallel subtasks.\n';
        if (state.verbose) md += '- Respond in **verbose mode** -- explain your reasoning and thought process.\n';
        if (state.strict) md += '- Be **strict** -- follow instructions exactly, do not deviate or make assumptions.\n';

        // Context section
        const ctxProj = state.contextProject.trim();
        const ctxTech = state.contextTech.trim();
        const ctxCon = state.contextConstraints.trim();
        const ctxOut = state.contextOutput;
        if (ctxProj || ctxTech || ctxCon || ctxOut) {
            md += '\n## Context & Constraints\n';
            if (ctxProj) md += '- **Project/Domain**: ' + ctxProj + '\n';
            if (ctxTech) md += '- **Tech Stack**: ' + ctxTech + '\n';
            if (ctxCon) md += '- **Constraints**: ' + ctxCon + '\n';
            if (ctxOut) {
                const outLabels = { code_only: 'Code Only', step_by_step: 'Step-by-Step', json: 'JSON', bullet_points: 'Bullet Points', table: 'Table' };
                md += '- **Output Format**: ' + (outLabels[ctxOut] || ctxOut) + '\n';
            }
        }

        md += '\n## Tasks\nPerform the following tasks in the specified order:\n\n';

        if (state.tasks.length === 0) {
            md += '*(No tasks defined yet.)*\n\n';
        } else {
            state.tasks.forEach((task, index) => {
                if (task.type === 'if') {
                    md += generateIfMarkdown(task, index);
                } else if (task.type === 'loop') {
                    md += generateLoopMarkdown(task, index);
                } else {
                    const def = getTaskTypeDef(task.type);
                    const paramText = task.param.trim() || '(not specified)';
                    const detailsText = task.details.trim();
                    md += '### Step ' + (index + 1) + ': ' + def.label.replace(/^[^\s]+\s/, '') + '\n';
                    md += '- **' + def.label.replace(/^[^\s]+\s/, '') + '**: `' + paramText + '`.\n';
                    if (detailsText) {
                        detailsText.split('\n').filter(l => l.trim()).forEach(line => {
                            md += '  - ' + line.trim() + '\n';
                        });
                    }
                    md += '\n';
                }
            });
        }
        md += '---\n*Generated with Prompt Generator* | ' + new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) + '\n';
        return md;
    }

    function generateIfMarkdown(task, index) {
        const condition = task.condition || '(not specified)';
        let md = '### Step ' + (index + 1) + ': Conditional (If/Else)\n';
        md += '**IF** `' + condition + '` **THEN**:\n';
        if (task.thenSteps && task.thenSteps.trim()) {
            task.thenSteps.split('\n').filter(l => l.trim()).forEach(line => {
                md += '  - ' + line.trim() + '\n';
            });
        } else {
            md += '  *(no steps defined)*\n';
        }
        if (task.elseIfs && task.elseIfs.length > 0) {
            task.elseIfs.forEach((elif, i) => {
                md += '**ELSE IF** `' + (elif.condition || '(not specified)') + '` **THEN**:\n';
                if (elif.steps && elif.steps.trim()) {
                    elif.steps.split('\n').filter(l => l.trim()).forEach(line => {
                        md += '  - ' + line.trim() + '\n';
                    });
                } else {
                    md += '  *(no steps defined)*\n';
                }
            });
        }
        if (task.elseSteps && task.elseSteps.trim()) {
            md += '**ELSE**:\n';
            task.elseSteps.split('\n').filter(l => l.trim()).forEach(line => {
                md += '  - ' + line.trim() + '\n';
            });
        }
        md += '\n';
        return md;
    }

    function generateLoopMarkdown(task, index) {
        const loopType = task.loopType || 'for_each';
        const loopSource = task.loopSource || '(not specified)';
        const loopVar = task.loopVar || 'item';
        let md = '### Step ' + (index + 1) + ': Loop (' + loopType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) + ')\n';
        if (loopType === 'for_each') {
            md += '**FOR EACH** `' + loopVar + '` **IN** `' + loopSource + '`:\n';
        } else if (loopType === 'while') {
            md += '**WHILE** `' + loopSource + '`:\n';
        } else if (loopType === 'repeat') {
            md += '**REPEAT** `' + loopSource + '` **TIMES**:\n';
        }
        if (task.loopBody && task.loopBody.trim()) {
            task.loopBody.split('\n').filter(l => l.trim()).forEach(line => {
                md += '  - ' + line.trim() + '\n';
            });
        } else {
            md += '  *(no steps defined)*\n';
        }
        md += '\n';
        return md;
    }

    function updatePreview() {
        const md = generateMarkdown();
        let html = md
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/^(# .+)$/gm, '<span class="md-h1">$1</span>')
            .replace(/^(## .+)$/gm, '<span class="md-h2">$1</span>')
            .replace(/^(### .+)$/gm, '<span class="md-h2">$1</span>')
            .replace(/\*\*(.+?)\*\*/g, '<span class="md-bold">**$1**</span>')
            .replace(/`(.+?)`/g, '<span class="md-code">`$1`</span>')
            .replace(/^(\s*[-*]\s.+)$/gm, '<span class="md-list">$1</span>')
            .replace(/^(---)$/gm, '<span class="md-hr">$1</span>')
            .replace(/^\*(.+)\*$/gm, '<span class="md-italic">$1</span>')
            .replace(/\b(IF|ELSE IF|ELSE|THEN|FOR EACH|IN|WHILE|REPEAT|TIMES)\b/g, '<span class="md-keyword">$1</span>');
        previewBlock.innerHTML = html;
        saveState();
    }

    // ──────────────────────────────────────
    // Render Task List
    // ──────────────────────────────────────
    function renderTasks() {
        taskList.innerHTML = '';
        if (state.tasks.length === 0) {
            taskList.classList.add('empty-list');
            taskList.innerHTML = '<p>No tasks yet. Click <strong>+ Add Task</strong>, <strong>Add If/Else</strong>, or <strong>Add Loop</strong> to start.</p>';
        } else {
            taskList.classList.remove('empty-list');
        }

        state.tasks.forEach((task, index) => {
            const card = document.createElement('div');
            card.dataset.taskId = task.id;
            card.dataset.index = index;

            if (task.type === 'if') {
                card.className = 'task-card card-if';
                card.innerHTML = renderIfCard(task, index);
            } else if (task.type === 'loop') {
                card.className = 'task-card card-loop';
                card.innerHTML = renderLoopCard(task, index);
            } else {
                card.className = 'task-card';
                card.innerHTML = renderStandardCard(task, index);
            }

            taskList.appendChild(card);
        });
        updateTaskNumbers();
        updatePreview();
    }

    function renderStandardCard(task, index) {
        const def = getTaskTypeDef(task.type);
        return '<span class="task-number">' + (index + 1) + '</span>' +
            '<div class="drag-handle" draggable="true" title="Drag to reorder">\u22EE\u22EE</div>' +
            '<div class="task-content">' +
                '<div class="task-top-row">' +
                    '<select class="task-type-select" data-field="type">' +
                        TASK_TYPES.map(t => '<option value="' + t.value + '"' + (task.type === t.value ? ' selected' : '') + '>' + t.label + '</option>').join('') +
                    '</select>' +
                    '<input type="text" class="task-param-input" data-field="param" value="' + escapeHtml(task.param) + '" placeholder="' + def.paramPlaceholder + '">' +
                '</div>' +
                '<textarea class="task-details-input" data-field="details" placeholder="Additional details / notes (optional)" rows="2">' + escapeHtml(task.details) + '</textarea>' +
            '</div>' +
            '<div class="task-actions">' +
                '<button class="btn-icon btn-move" data-action="moveUp" title="Move up">\u25B2</button>' +
                '<button class="btn-icon btn-move" data-action="moveDown" title="Move down">\u25BC</button>' +
                '<button class="btn-icon btn-remove" data-action="remove" title="Remove">\u2715</button>' +
            '</div>';
    }

    function renderIfCard(task, index) {
        let branchesHtml = '';
        // THEN branch
        branchesHtml += '<div class="if-branch"><div class="if-branch-label branch-then">THEN (do this)</div>' +
            '<textarea class="if-then-input" data-field="thenSteps" placeholder="Steps to execute if condition is true..." rows="2">' + escapeHtml(task.thenSteps || '') + '</textarea></div>';
        // ELSE IF branches
        if (task.elseIfs) {
            task.elseIfs.forEach((elif, i) => {
                branchesHtml += '<div class="if-branch"><div class="if-branch-label branch-elseif">ELSE IF</div>' +
                    '<input type="text" class="elseif-condition-input" data-elseif-index="' + i + '" data-field="condition" value="' + escapeHtml(elif.condition || '') + '" placeholder="Another condition...">' +
                    '<textarea class="elseif-steps-input" data-elseif-index="' + i + '" data-field="steps" placeholder="Steps if this condition is true..." rows="2">' + escapeHtml(elif.steps || '') + '</textarea>' +
                    '<button class="btn-icon btn-remove" data-action="removeElseIf" data-elseif-index="' + i + '" title="Remove ELSE IF" style="margin-top:4px">\u2715 Remove this branch</button>' +
                    '</div>';
            });
        }
        // ELSE branch
        branchesHtml += '<div class="if-branch"><div class="if-branch-label branch-else">ELSE (otherwise)</div>' +
            '<textarea class="if-else-input" data-field="elseSteps" placeholder="Steps to execute if no condition matched (optional)..." rows="2">' + escapeHtml(task.elseSteps || '') + '</textarea></div>';
        // Add ELSE IF button
        branchesHtml += '<button class="if-add-branch" data-action="addElseIf">+ Add ELSE IF branch</button>';

        return '<span class="task-number">' + (index + 1) + '</span>' +
            '<div class="drag-handle" draggable="true" title="Drag to reorder">\u22EE\u22EE</div>' +
            '<div class="task-content">' +
                '<div class="condition-label">\u2756 Conditional (If / Else)</div>' +
                '<input type="text" class="condition-input" data-field="condition" value="' + escapeHtml(task.condition || '') + '" placeholder="Enter condition, e.g.: file exists, tests pass, API responds with 200...">' +
                '<div class="if-branches">' + branchesHtml + '</div>' +
            '</div>' +
            '<div class="task-actions">' +
                '<button class="btn-icon btn-move" data-action="moveUp" title="Move up">\u25B2</button>' +
                '<button class="btn-icon btn-move" data-action="moveDown" title="Move down">\u25BC</button>' +
                '<button class="btn-icon btn-remove" data-action="remove" title="Remove">\u2715</button>' +
            '</div>';
    }

    function renderLoopCard(task, index) {
        return '<span class="task-number">' + (index + 1) + '</span>' +
            '<div class="drag-handle" draggable="true" title="Drag to reorder">\u22EE\u22EE</div>' +
            '<div class="task-content">' +
                '<div class="loop-label">\u27F3 Loop</div>' +
                '<div class="loop-fields">' +
                    '<div class="loop-field"><label>Loop Type</label>' +
                        '<select class="loop-type-select" data-field="loopType">' +
                            '<option value="for_each"' + (task.loopType === 'for_each' ? ' selected' : '') + '>For Each (iterate over items)</option>' +
                            '<option value="while"' + (task.loopType === 'while' ? ' selected' : '') + '>While (condition-based)</option>' +
                            '<option value="repeat"' + (task.loopType === 'repeat' ? ' selected' : '') + '>Repeat N times</option>' +
                        '</select>' +
                    '</div>' +
                    '<div class="loop-field"><label>' + (task.loopType === 'while' ? 'Condition' : task.loopType === 'repeat' ? 'Count / N' : 'Source (collection)') + '</label>' +
                        '<input type="text" class="loop-source-input" data-field="loopSource" value="' + escapeHtml(task.loopSource || '') + '" placeholder="' + (task.loopType === 'while' ? 'e.g., errors.length > 0' : task.loopType === 'repeat' ? 'e.g., 3' : 'e.g., files in src/') + '">' +
                    '</div>' +
                    (task.loopType !== 'while' && task.loopType !== 'repeat' ? '<div class="loop-field"><label>Iterator Variable</label><input type="text" class="loop-var-input" data-field="loopVar" value="' + escapeHtml(task.loopVar || 'item') + '" placeholder="e.g., file, user, item"></div>' : '') +
                '</div>' +
                '<div class="loop-body-section"><div class="loop-body-label">Loop Body (steps to repeat)</div>' +
                    '<textarea class="loop-body-input" data-field="loopBody" placeholder="Steps to execute in each iteration..." rows="3">' + escapeHtml(task.loopBody || '') + '</textarea>' +
                '</div>' +
            '</div>' +
            '<div class="task-actions">' +
                '<button class="btn-icon btn-move" data-action="moveUp" title="Move up">\u25B2</button>' +
                '<button class="btn-icon btn-move" data-action="moveDown" title="Move down">\u25BC</button>' +
                '<button class="btn-icon btn-remove" data-action="remove" title="Remove">\u2715</button>' +
            '</div>';
    }

    function updateTaskNumbers() {
        const cards = taskList.querySelectorAll('.task-card');
        cards.forEach((card, i) => {
            const badge = card.querySelector('.task-number');
            if (badge) badge.textContent = i + 1;
            card.dataset.index = i;
        });
    }

    // ──────────────────────────────────────
    // Task CRUD
    // ──────────────────────────────────────
    function addTask(type) {
        let newTask;
        if (type === 'if') {
            newTask = { id: taskIdCounter++, type: 'if', condition: '', thenSteps: '', elseIfs: [], elseSteps: '' };
        } else if (type === 'loop') {
            newTask = { id: taskIdCounter++, type: 'loop', loopType: 'for_each', loopSource: '', loopVar: 'item', loopBody: '' };
        } else {
            newTask = { id: taskIdCounter++, type: 'analyze', param: '', details: '' };
        }
        state.tasks.push(newTask);
        renderTasks();
        requestAnimationFrame(() => {
            const cards = taskList.querySelectorAll('.task-card');
            const lastCard = cards[cards.length - 1];
            if (lastCard) {
                lastCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                lastCard.style.boxShadow = '0 0 0 3px rgba(79,70,229,0.4)';
                setTimeout(() => { lastCard.style.boxShadow = ''; }, 800);
            }
        });
    }

    function removeTask(taskId) {
        if (state.tasks.length === 1) {
            state.tasks[0] = { id: state.tasks[0].id, type: 'analyze', param: '', details: '' };
        } else {
            state.tasks = state.tasks.filter(t => t.id !== taskId);
        }
        renderTasks();
    }

    function moveTask(taskId, direction) {
        const index = state.tasks.findIndex(t => t.id === taskId);
        if (index === -1) return;
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= state.tasks.length) return;
        [state.tasks[index], state.tasks[newIndex]] = [state.tasks[newIndex], state.tasks[index]];
        renderTasks();
    }

    function updateTaskField(taskId, field, value) {
        const task = state.tasks.find(t => t.id === taskId);
        if (!task) return;
        task[field] = value;
        // If loopType changed, re-render this card to update labels
        if (field === 'loopType') {
            renderTasks();
            return;
        }
        updatePreview();
        saveState();
    }

    function addElseIf(taskId) {
        const task = state.tasks.find(t => t.id === taskId);
        if (!task || task.type !== 'if') return;
        if (!task.elseIfs) task.elseIfs = [];
        task.elseIfs.push({ condition: '', steps: '' });
        renderTasks();
    }

    function removeElseIf(taskId, elseifIndex) {
        const task = state.tasks.find(t => t.id === taskId);
        if (!task || task.type !== 'if' || !task.elseIfs) return;
        task.elseIfs.splice(elseifIndex, 1);
        renderTasks();
    }

    function updateElseIfField(taskId, elseifIndex, field, value) {
        const task = state.tasks.find(t => t.id === taskId);
        if (!task || task.type !== 'if' || !task.elseIfs || !task.elseIfs[elseifIndex]) return;
        task.elseIfs[elseifIndex][field] = value;
        updatePreview();
        saveState();
    }

    // ──────────────────────────────────────
    // Drag and Drop
    // ──────────────────────────────────────
    let draggedTaskId = null;
    let draggedIndex = null;

    function handleDragStart(e) {
        const handle = e.target.closest('.drag-handle');
        if (!handle) return;
        const card = handle.closest('.task-card');
        if (!card) return;
        draggedTaskId = parseInt(card.dataset.taskId, 10);
        draggedIndex = parseInt(card.dataset.index, 10);
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggedTaskId);
    }
    function handleDragEnd(e) {
        const card = document.querySelector('.task-card[data-task-id="' + draggedTaskId + '"]');
        if (card) card.classList.remove('dragging');
        taskList.querySelectorAll('.task-card').forEach(c => c.classList.remove('drag-over-top', 'drag-over-bottom'));
        draggedTaskId = null;
        draggedIndex = null;
    }
    function handleDragOver(e) {
        e.preventDefault();
        const card = e.target.closest('.task-card');
        if (!card || !draggedTaskId) return;
        const targetId = parseInt(card.dataset.taskId, 10);
        if (targetId === draggedTaskId) return;
        const rect = card.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const isTopHalf = e.clientY < midY;
        taskList.querySelectorAll('.task-card').forEach(c => c.classList.remove('drag-over-top', 'drag-over-bottom'));
        if (isTopHalf) card.classList.add('drag-over-top');
        else card.classList.add('drag-over-bottom');
    }
    function handleDrop(e) {
        e.preventDefault();
        const card = e.target.closest('.task-card');
        if (!card || draggedTaskId === null) return;
        const targetId = parseInt(card.dataset.taskId, 10);
        if (targetId === draggedTaskId) return;
        const rect = card.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const isTopHalf = e.clientY < midY;
        const draggedItem = state.tasks.find(t => t.id === draggedTaskId);
        if (!draggedItem) return;
        state.tasks = state.tasks.filter(t => t.id !== draggedTaskId);
        let targetIndex = state.tasks.findIndex(t => t.id === targetId);
        if (targetIndex === -1) targetIndex = state.tasks.length;
        if (!isTopHalf) targetIndex++;
        state.tasks.splice(targetIndex, 0, draggedItem);
        renderTasks();
    }

    taskList.addEventListener('dragstart', handleDragStart);
    taskList.addEventListener('dragend', handleDragEnd);
    taskList.addEventListener('dragover', handleDragOver);
    taskList.addEventListener('drop', handleDrop);

    // ──────────────────────────────────────
    // Event Delegation for Task List
    // ──────────────────────────────────────
    taskList.addEventListener('change', (e) => {
        const card = e.target.closest('.task-card');
        if (!card) return;
        const taskId = parseInt(card.dataset.taskId, 10);

        // Standard task type change
        const select = e.target.closest('select[data-field="type"]');
        if (select) {
            updateTaskField(taskId, 'type', select.value);
            const def = getTaskTypeDef(select.value);
            const paramInput = card.querySelector('input[data-field="param"]');
            if (paramInput) paramInput.placeholder = def.paramPlaceholder;
            return;
        }

        // Loop type change
        const loopTypeSelect = e.target.closest('.loop-type-select');
        if (loopTypeSelect) {
            updateTaskField(taskId, 'loopType', loopTypeSelect.value);
            return;
        }

        // Context output change
        if (e.target.id === 'contextOutput') {
            state.contextOutput = e.target.value;
            updatePreview();
            saveState();
        }
    });

    taskList.addEventListener('input', (e) => {
        const card = e.target.closest('.task-card');
        if (!card) return;
        const taskId = parseInt(card.dataset.taskId, 10);
        const task = state.tasks.find(t => t.id === taskId);
        if (!task) return;

        // Standard task fields
        const paramInput = e.target.closest('input[data-field="param"]');
        const detailsInput = e.target.closest('textarea[data-field="details"]');
        if (paramInput) { updateTaskField(taskId, 'param', paramInput.value); return; }
        if (detailsInput) { updateTaskField(taskId, 'details', detailsInput.value); return; }

        // If card: condition
        const conditionInput = e.target.closest('.condition-input');
        if (conditionInput) { updateTaskField(taskId, 'condition', conditionInput.value); return; }

        // If card: then steps
        const thenInput = e.target.closest('.if-then-input');
        if (thenInput) { updateTaskField(taskId, 'thenSteps', thenInput.value); return; }

        // If card: else steps
        const elseInput = e.target.closest('.if-else-input');
        if (elseInput) { updateTaskField(taskId, 'elseSteps', elseInput.value); return; }

        // Else-if condition
        const elseifCond = e.target.closest('.elseif-condition-input');
        if (elseifCond) {
            updateElseIfField(taskId, parseInt(elseifCond.dataset.elseifIndex), 'condition', elseifCond.value);
            return;
        }
        // Else-if steps
        const elseifSteps = e.target.closest('.elseif-steps-input');
        if (elseifSteps) {
            updateElseIfField(taskId, parseInt(elseifSteps.dataset.elseifIndex), 'steps', elseifSteps.value);
            return;
        }

        // Loop fields
        const loopSource = e.target.closest('.loop-source-input');
        if (loopSource) { updateTaskField(taskId, 'loopSource', loopSource.value); return; }
        const loopVar = e.target.closest('.loop-var-input');
        if (loopVar) { updateTaskField(taskId, 'loopVar', loopVar.value); return; }
        const loopBody = e.target.closest('.loop-body-input');
        if (loopBody) { updateTaskField(taskId, 'loopBody', loopBody.value); return; }
    });

    taskList.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const card = btn.closest('.task-card');
        if (!card) return;
        const taskId = parseInt(card.dataset.taskId, 10);
        const action = btn.dataset.action;

        if (action === 'remove') removeTask(taskId);
        else if (action === 'moveUp') moveTask(taskId, -1);
        else if (action === 'moveDown') moveTask(taskId, 1);
        else if (action === 'addElseIf') addElseIf(taskId);
        else if (action === 'removeElseIf') {
            removeElseIf(taskId, parseInt(btn.dataset.elseifIndex));
        }
    });

    // ──────────────────────────────────────
    // UI Update from state
    // ──────────────────────────────────────
    function updateAllUI() {
        roleSelect.value = state.roleSelectValue;
        customRoleInput.value = state.customRole;
        chkAgentic.checked = state.agentic;
        chkSubagent.checked = state.subagent;
        chkVerbose.checked = state.verbose;
        chkStrict.checked = state.strict;
        contextProject.value = state.contextProject || '';
        contextTech.value = state.contextTech || '';
        contextConstraints.value = state.contextConstraints || '';
        contextOutput.value = state.contextOutput || '';
        if (state.roleSelectValue === 'custom') {
            customRoleWrap.classList.add('visible');
        } else {
            customRoleWrap.classList.remove('visible');
        }
        renderTasks();
    }

    // ──────────────────────────────────────
    // Role & Checkbox Listeners
    // ──────────────────────────────────────
    roleSelect.addEventListener('change', () => {
        state.roleSelectValue = roleSelect.value;
        if (state.roleSelectValue === 'custom') customRoleWrap.classList.add('visible');
        else customRoleWrap.classList.remove('visible');
        updatePreview(); saveState();
    });
    customRoleInput.addEventListener('input', () => {
        state.customRole = customRoleInput.value;
        updatePreview(); saveState();
    });
    chkAgentic.addEventListener('change', () => { state.agentic = chkAgentic.checked; updatePreview(); saveState(); });
    chkSubagent.addEventListener('change', () => { state.subagent = chkSubagent.checked; updatePreview(); saveState(); });
    chkVerbose.addEventListener('change', () => { state.verbose = chkVerbose.checked; updatePreview(); saveState(); });
    chkStrict.addEventListener('change', () => { state.strict = chkStrict.checked; updatePreview(); saveState(); });

    // Context listeners
    contextProject.addEventListener('input', () => { state.contextProject = contextProject.value; updatePreview(); saveState(); });
    contextTech.addEventListener('input', () => { state.contextTech = contextTech.value; updatePreview(); saveState(); });
    contextConstraints.addEventListener('input', () => { state.contextConstraints = contextConstraints.value; updatePreview(); saveState(); });
    contextOutput.addEventListener('change', () => { state.contextOutput = contextOutput.value; updatePreview(); saveState(); });

    // ──────────────────────────────────────
    // Add Task Buttons
    // ──────────────────────────────────────
    btnAddTask.addEventListener('click', () => addTask('task'));
    btnAddIf.addEventListener('click', () => addTask('if'));
    btnAddLoop.addEventListener('click', () => addTask('loop'));

    // ──────────────────────────────────────
    // Action Buttons
    // ──────────────────────────────────────
    btnCopy.addEventListener('click', () => {
        const md = generateMarkdown();
        navigator.clipboard.writeText(md).then(() => showToast('Copied!')).catch(() => {
            const ta = document.createElement('textarea');
            ta.value = md; document.body.appendChild(ta); ta.select();
            document.execCommand('copy'); document.body.removeChild(ta);
            showToast('Copied!');
        });
    });
    btnDownload.addEventListener('click', () => {
        const md = generateMarkdown();
        const blob = new Blob([md], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'agent-prompt-' + new Date().toISOString().slice(0,19).replace(/[:T]/g, '-') + '.md';
        a.click(); URL.revokeObjectURL(url);
        showToast('Downloaded');
    });
    btnReset.addEventListener('click', () => {
        if (confirm('Reset all? This cannot be undone.')) {
            state = {
                roleSelectValue: 'Senior Software Engineer (full-stack, React/Node.js, writes production-grade code)',
                customRole: '', agentic: false, subagent: false, verbose: false, strict: false,
                contextProject: '', contextTech: '', contextConstraints: '', contextOutput: '',
                tasks: [
                    { id: taskIdCounter++, type: 'clone', param: '', details: '' },
                    { id: taskIdCounter++, type: 'analyze', param: '', details: '' },
                ],
            };
            updateAllUI();
            showToast('Reset');
        }
    });

    // ──────────────────────────────────────
    // Sidebar Logic
    // ──────────────────────────────────────
    function openSidebar() { document.body.classList.add('sidebar-open'); }
    function closeSidebar() { document.body.classList.remove('sidebar-open'); }

    // Toggle button: opens when sidebar is closed, closes when open
    sidebarToggle.addEventListener('click', () => {
        if (document.body.classList.contains('sidebar-open')) closeSidebar();
        else openSidebar();
    });
    sidebarOverlay.addEventListener('click', closeSidebar);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.body.classList.contains('sidebar-open')) closeSidebar();
    });

    btnSaveWorkflow.addEventListener('click', () => {
        const name = workflowNameInput.value.trim();
        if (!name) { showToast('Enter a name'); return; }
        saveCurrentWorkflow(name);
        workflowNameInput.value = '';
        showToast('Saved "' + name + '"');
    });
    btnExportAll.addEventListener('click', exportWorkflows);
    btnImportFile.addEventListener('click', () => importFileInput.click());
    importFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) { importWorkflows(e.target.files[0]); importFileInput.value = ''; }
    });

    // ──────────────────────────────────────
    // Toast
    // ──────────────────────────────────────
    let toastTimeout;
    function showToast(msg) {
        clearTimeout(toastTimeout);
        toast.textContent = msg;
        toast.classList.add('show');
        toastTimeout = setTimeout(() => toast.classList.remove('show'), 2200);
    }

    // ──────────────────────────────────────
    // Keyboard Shortcuts
    // ──────────────────────────────────────
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA' && document.activeElement.tagName !== 'SELECT') {
                e.preventDefault(); addTask('task');
            }
        }
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
            e.preventDefault(); btnCopy.click();
        }
    });

    // ──────────────────────────────────────
    // Initialize
    // ──────────────────────────────────────
    loadState();
    updateAllUI();
    renderWorkflowList();
    console.log('Prompt Generator ready');
})();