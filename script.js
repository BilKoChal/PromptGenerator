(function() {
    // ──────────────────────────────────────
    // DOM References
    // ──────────────────────────────────────
    const roleSelect = document.getElementById('roleSelect');
    const customRoleWrap = document.getElementById('customRoleWrap');
    const customRoleInput = document.getElementById('customRoleInput');
    const chkAgentic = document.getElementById('chkAgentic');
    const chkSubagent = document.getElementById('chkSubagent');
    const taskList = document.getElementById('taskList');
    const previewBlock = document.getElementById('previewBlock');
    const btnAddTask = document.getElementById('btnAddTask');
    const btnCopy = document.getElementById('btnCopy');
    const btnDownload = document.getElementById('btnDownload');
    const btnReset = document.getElementById('btnReset');
    const toast = document.getElementById('toast');

    // Sidebar
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebarClose = document.getElementById('sidebarClose');
    const sidebar = document.getElementById('sidebar');
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
        { value: 'create_sub_agent', label: '🤖 Create Sub-Agent', paramPlaceholder: 'analyze the authentication module and report findings' },
        { value: 'implement', label: '🛠️ Implement', paramPlaceholder: 'user authentication with JWT' },
        { value: 'refactor', label: '♻️ Refactor', paramPlaceholder: 'src/legacy/data-processor.js' },
        { value: 'test', label: '🧪 Test', paramPlaceholder: 'the login flow and edge cases' },
        { value: 'document', label: '📝 Document', paramPlaceholder: 'all public API endpoints' },
        { value: 'review', label: '👀 Review', paramPlaceholder: 'PR #42 or src/new-feature/' },
        { value: 'deploy', label: '🚀 Deploy', paramPlaceholder: 'staging server / AWS ECS' },
        { value: 'custom_task', label: '💡 Custom Task', paramPlaceholder: 'describe what needs to be done...' },
    ];

    // ──────────────────────────────────────
    // State
    // ──────────────────────────────────────
    const STORAGE_KEY = 'prompt_generator_state_v3';
    const WORKFLOWS_KEY = 'prompt_generator_workflows';
    let taskIdCounter = Date.now();

    let state = {
        roleSelectValue: 'Senior Software Engineer (full-stack, React/Node.js, writes production-grade code)',
        customRole: '',
        agentic: false,
        subagent: false,
        tasks: [
            { id: taskIdCounter++, type: 'clone', param: '', details: '' },
            { id: taskIdCounter++, type: 'analyze', param: '', details: '' },
        ],
    };

    // ──────────────────────────────────────
    // Persistence (auto-save state)
    // ──────────────────────────────────────
    function saveState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (e) {}
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
        try {
            return JSON.parse(localStorage.getItem(WORKFLOWS_KEY)) || [];
        } catch (e) {
            return [];
        }
    }

    function setSavedWorkflows(workflows) {
        localStorage.setItem(WORKFLOWS_KEY, JSON.stringify(workflows));
    }

    function saveCurrentWorkflow(name) {
        const workflows = getSavedWorkflows();
        const existingIndex = workflows.findIndex(w => w.name === name);
        const snapshot = JSON.parse(JSON.stringify(state)); // deep clone
        if (existingIndex > -1) {
            workflows[existingIndex].state = snapshot;
        } else {
            workflows.push({ name, state: snapshot });
        }
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
            showToast(`📂 Loaded "${name}"`);
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
        a.download = `prompt-workflows-${new Date().toISOString().slice(0,10)}.json`;
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
                        if (index > -1) {
                            merged[index] = imp;
                        } else {
                            merged.push(imp);
                        }
                    });
                    setSavedWorkflows(merged);
                    renderWorkflowList();
                    showToast('📥 Workflows imported');
                } else {
                    showToast('⚠️ Invalid file format');
                }
            } catch (err) {
                showToast('⚠️ Invalid JSON file');
            }
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
            item.innerHTML = `
                <span class="workflow-item-name">${escapeHtml(w.name)}</span>
                <div class="workflow-item-actions">
                    <button class="btn-icon-small" data-action="load" title="Load">📂</button>
                    <button class="btn-icon-small" data-action="delete" title="Delete">🗑️</button>
                </div>
            `;
            item.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                loadWorkflow(w.name);
            });
            item.querySelector('[data-action="load"]').addEventListener('click', (e) => {
                e.stopPropagation();
                loadWorkflow(w.name);
            });
            item.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`Delete workflow "${w.name}"?`)) {
                    deleteWorkflow(w.name);
                }
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
        if (state.roleSelectValue === 'custom') {
            return state.customRole.trim() || 'Assistant';
        }
        return state.roleSelectValue;
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function escapeMd(str) {
        return str.replace(/[\\`*_{}[\]()#+\-.!]/g, '\\$&');
    }

    // ──────────────────────────────────────
    // Generate Markdown
    // ──────────────────────────────────────
    function generateMarkdown() {
        const role = getEffectiveRole();
        let md = `# 🤖 Agent Prompt\n\n## Role\nYou are a **${role}**.\n`;

        if (state.agentic) {
            md += `- You are **agentic** – you can perform iterative, autonomous tasks (run commands, explore code, etc.).\n`;
        }
        if (state.subagent) {
            md += `- You can **spawn sub‑agents** to handle parallel subtasks.\n`;
        }
        md += `\n## Tasks\nPerform the following tasks in the specified order:\n\n`;

        if (state.tasks.length === 0) {
            md += `*(No tasks defined yet.)*\n\n`;
        } else {
            state.tasks.forEach((task, index) => {
                const def = getTaskTypeDef(task.type);
                const paramText = task.param.trim() || '(not specified)';
                const detailsText = task.details.trim();
                md += `### Step ${index + 1}: ${def.label.replace(/^[^\s]+\s/, '')}\n- **${def.label.replace(/^[^\s]+\s/, '')}**: \`${paramText}\`.\n`;
                if (detailsText) {
                    detailsText.split('\n').filter(l => l.trim()).forEach(line => {
                        md += `  - ${line.trim()}\n`;
                    });
                }
                md += `\n`;
            });
        }
        md += `---\n*Generated with Prompt Generator* | ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}\n`;
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
            .replace(/^\*(.+)\*$/gm, '<span class="md-italic">$1</span>');
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
            taskList.innerHTML = '<p>No tasks yet. Click <strong>+ Add Task Step</strong> to start.</p>';
        } else {
            taskList.classList.remove('empty-list');
        }

        state.tasks.forEach((task, index) => {
            const def = getTaskTypeDef(task.type);
            const card = document.createElement('div');
            card.className = 'task-card';
            card.dataset.taskId = task.id;
            card.dataset.index = index;

            card.innerHTML = `
                <span class="task-number">${index + 1}</span>
                <div class="drag-handle" draggable="true" title="Drag to reorder">⋮⋮</div>
                <div class="task-content">
                    <div class="task-top-row">
                        <select class="task-type-select" data-field="type">
                            ${TASK_TYPES.map(t => `<option value="${t.value}" ${task.type === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
                        </select>
                        <input type="text" class="task-param-input" data-field="param" value="${escapeHtml(task.param)}" placeholder="${def.paramPlaceholder}">
                    </div>
                    <textarea class="task-details-input" data-field="details" placeholder="Additional details / notes (optional)" rows="2">${escapeHtml(task.details)}</textarea>
                </div>
                <div class="task-actions">
                    <button class="btn-icon btn-move" data-action="moveUp" title="Move up">▲</button>
                    <button class="btn-icon btn-move" data-action="moveDown" title="Move down">▼</button>
                    <button class="btn-icon btn-remove" data-action="remove" title="Remove task">✕</button>
                </div>
            `;
            taskList.appendChild(card);
        });
        updateTaskNumbers();
        updatePreview();
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
    function addTask() {
        const newTask = { id: taskIdCounter++, type: 'analyze', param: '', details: '' };
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
        updatePreview();
        saveState();
    }

    // ──────────────────────────────────────
    // Drag and Drop (only via drag-handle)
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
        const card = document.querySelector(`.task-card[data-task-id="${draggedTaskId}"]`);
        if (card) card.classList.remove('dragging');
        taskList.querySelectorAll('.task-card').forEach(c => {
            c.classList.remove('drag-over-top', 'drag-over-bottom');
        });
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

    // Attach drag events to task list
    taskList.addEventListener('dragstart', handleDragStart);
    taskList.addEventListener('dragend', handleDragEnd);
    taskList.addEventListener('dragover', handleDragOver);
    taskList.addEventListener('drop', handleDrop);

    // ──────────────────────────────────────
    // Event Delegation for Task List
    // ──────────────────────────────────────
    taskList.addEventListener('change', (e) => {
        const select = e.target.closest('select[data-field="type"]');
        if (!select) return;
        const card = select.closest('.task-card');
        if (!card) return;
        const taskId = parseInt(card.dataset.taskId, 10);
        updateTaskField(taskId, 'type', select.value);
        const def = getTaskTypeDef(select.value);
        const paramInput = card.querySelector('input[data-field="param"]');
        if (paramInput) paramInput.placeholder = def.paramPlaceholder;
    });

    taskList.addEventListener('input', (e) => {
        const input = e.target.closest('input[data-field="param"]');
        const textarea = e.target.closest('textarea[data-field="details"]');
        const target = input || textarea;
        if (!target) return;
        const card = target.closest('.task-card');
        if (!card) return;
        const taskId = parseInt(card.dataset.taskId, 10);
        updateTaskField(taskId, target.dataset.field, target.value);
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
    });

    // ──────────────────────────────────────
    // UI Update from state
    // ──────────────────────────────────────
    function updateAllUI() {
        roleSelect.value = state.roleSelectValue;
        customRoleInput.value = state.customRole;
        chkAgentic.checked = state.agentic;
        chkSubagent.checked = state.subagent;
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
        if (state.roleSelectValue === 'custom') {
            customRoleWrap.classList.add('visible');
        } else {
            customRoleWrap.classList.remove('visible');
        }
        updatePreview();
        saveState();
    });
    customRoleInput.addEventListener('input', () => {
        state.customRole = customRoleInput.value;
        updatePreview();
        saveState();
    });
    chkAgentic.addEventListener('change', () => {
        state.agentic = chkAgentic.checked;
        updatePreview();
        saveState();
    });
    chkSubagent.addEventListener('change', () => {
        state.subagent = chkSubagent.checked;
        updatePreview();
        saveState();
    });

    // ──────────────────────────────────────
    // Buttons
    // ──────────────────────────────────────
    btnAddTask.addEventListener('click', addTask);
    btnCopy.addEventListener('click', () => {
        const md = generateMarkdown();
        navigator.clipboard.writeText(md).then(() => showToast('✅ Copied!')).catch(() => {
            const ta = document.createElement('textarea');
            ta.value = md;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            showToast('✅ Copied!');
        });
    });
    btnDownload.addEventListener('click', () => {
        const md = generateMarkdown();
        const blob = new Blob([md], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `agent-prompt-${new Date().toISOString().slice(0,19).replace(/[:T]/g, '-')}.md`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('💾 Downloaded');
    });
    btnReset.addEventListener('click', () => {
        if (confirm('Reset all? This cannot be undone.')) {
            state = {
                roleSelectValue: 'Senior Software Engineer (full-stack, React/Node.js, writes production-grade code)',
                customRole: '',
                agentic: false,
                subagent: false,
                tasks: [
                    { id: taskIdCounter++, type: 'clone', param: '', details: '' },
                    { id: taskIdCounter++, type: 'analyze', param: '', details: '' },
                ],
            };
            updateAllUI();
            showToast('🔄 Reset');
        }
    });

    // ──────────────────────────────────────
    // Sidebar Logic
    // ──────────────────────────────────────
    const sidebarOverlay = document.getElementById('sidebarOverlay');

    function openSidebar() { document.body.classList.add('sidebar-open'); }
    function closeSidebar() { document.body.classList.remove('sidebar-open'); }
    sidebarToggle.addEventListener('click', openSidebar);
    sidebarClose.addEventListener('click', closeSidebar);
    sidebarOverlay.addEventListener('click', closeSidebar);

    // Escape key to close sidebar
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.body.classList.contains('sidebar-open')) {
            closeSidebar();
        }
    });

    btnSaveWorkflow.addEventListener('click', () => {
        const name = workflowNameInput.value.trim();
        if (!name) { showToast('⚠️ Enter a name'); return; }
        saveCurrentWorkflow(name);
        workflowNameInput.value = '';
        showToast(`💾 Saved "${name}"`);
    });

    btnExportAll.addEventListener('click', exportWorkflows);
    btnImportFile.addEventListener('click', () => importFileInput.click());
    importFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            importWorkflows(e.target.files[0]);
            importFileInput.value = '';
        }
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
                e.preventDefault();
                addTask();
            }
        }
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
            e.preventDefault();
            btnCopy.click();
        }
    });

    // ──────────────────────────────────────
    // Initialize
    // ──────────────────────────────────────
    loadState();
    updateAllUI();
    renderWorkflowList();
    console.log('🚀 Prompt Generator ready');
})();