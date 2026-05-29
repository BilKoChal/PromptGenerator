/* ============================================
   Prompt Generator — Application Logic
   ============================================ */

(function () {
    'use strict';

    // ──────────────────────────────────────
    // DOM References
    // ──────────────────────────────────────
    const roleSelect = document.getElementById('roleSelect');
    const customRoleWrap = document.getElementById('customRoleWrap');
    const customRoleInput = document.getElementById('customRoleInput');
    const taskList = document.getElementById('taskList');
    const previewBlock = document.getElementById('previewBlock');
    const btnAddTask = document.getElementById('btnAddTask');
    const btnCopy = document.getElementById('btnCopy');
    const btnDownload = document.getElementById('btnDownload');
    const btnReset = document.getElementById('btnReset');
    const toast = document.getElementById('toast');

    // ──────────────────────────────────────
    // Task Type Definitions
    // ──────────────────────────────────────
    const TASK_TYPES = [
        { value: 'clone', label: '\uD83D\uDCE5 Clone Repo', paramLabel: 'Repository URL',
            paramPlaceholder: 'https://github.com/user/repo.git' },
        { value: 'analyze', label: '\uD83D\uDD0D Analyze', paramLabel: 'Target Files / Folders',
            paramPlaceholder: 'entire codebase or src/utils/' },
        { value: 'research', label: '\uD83D\uDCDA Research', paramLabel: 'Research Topic',
            paramPlaceholder: 'best practices for error handling in Rust...' },
        { value: 'create_sub_agent', label: '\uD83E\uDD16 Create Sub-Agent', paramLabel: 'Sub-Agent Task',
            paramPlaceholder: 'analyze the authentication module and report findings' },
        { value: 'implement', label: '\uD83D\uDEE0\uFE0F Implement', paramLabel: 'Feature / Task',
            paramPlaceholder: 'user authentication with JWT' },
        { value: 'refactor', label: '\u267B\uFE0F Refactor', paramLabel: 'Target Code',
            paramPlaceholder: 'src/legacy/data-processor.js' },
        { value: 'test', label: '\uD83E\uDDEA Test', paramLabel: 'Test Target',
            paramPlaceholder: 'the login flow and edge cases' },
        { value: 'document', label: '\uD83D\uDCDD Document', paramLabel: 'Documentation Target',
            paramPlaceholder: 'all public API endpoints' },
        { value: 'review', label: '\uD83D\uDC40 Review', paramLabel: 'Review Target',
            paramPlaceholder: 'PR #42 or src/new-feature/' },
        { value: 'deploy', label: '\uD83D\uDE80 Deploy', paramLabel: 'Deployment Target',
            paramPlaceholder: 'staging server / AWS ECS' },
        { value: 'custom_task', label: '\uD83D\uDCA1 Custom Task', paramLabel: 'Task Description',
            paramPlaceholder: 'describe what needs to be done...' },
    ];

    // ──────────────────────────────────────
    // State
    // ──────────────────────────────────────
    const STORAGE_KEY = 'prompt_generator_state_v2';
    let taskIdCounter = Date.now();

    let state = {
        roleSelectValue: 'Senior Software Engineer',
        customRole: '',
        tasks: [
            { id: taskIdCounter++, type: 'clone', param: '', details: '' },
            { id: taskIdCounter++, type: 'analyze', param: '', details: '' },
        ],
    };

    // ──────────────────────────────────────
    // Persistence
    // ──────────────────────────────────────
    function saveState() {
        try {
            const toSave = {
                ...state,
                tasks: state.tasks.map(function (t) {
                    return { id: t.id, type: t.type, param: t.param, details: t.details };
                }),
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
        } catch (e) {
            // storage full or unavailable
        }
    }

    function loadState() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                var saved = JSON.parse(raw);
                if (saved.roleSelectValue) state.roleSelectValue = saved.roleSelectValue;
                if (saved.customRole !== undefined) state.customRole = saved.customRole;
                if (Array.isArray(saved.tasks) && saved.tasks.length > 0) {
                    state.tasks = saved.tasks.map(function (t) {
                        return {
                            id: t.id || taskIdCounter++,
                            type: t.type || 'analyze',
                            param: t.param || '',
                            details: t.details || '',
                        };
                    });
                    // update counter
                    var maxId = Math.max.apply(null, state.tasks.map(function (t) { return t.id; }).concat([0]));
                    taskIdCounter = maxId + 1;
                }
            }
        } catch (e) {
            // corrupted data, use defaults
        }
    }

    // ──────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────
    function getTaskTypeDef(type) {
        return TASK_TYPES.find(function (t) { return t.value === type; }) || TASK_TYPES[1]; // default: analyze
    }

    function getEffectiveRole() {
        if (state.roleSelectValue === 'custom') {
            return state.customRole.trim() || 'Assistant';
        }
        return state.roleSelectValue;
    }

    function escapeMd(str) {
        return str.replace(/[\\`*_{}[\]()#+\-.!]/g, '\\$&');
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ──────────────────────────────────────
    // Generate Markdown
    // ──────────────────────────────────────
    function generateMarkdown() {
        var role = getEffectiveRole();
        var md = '';

        md += '# \uD83E\uDD16 Agent Prompt\n\n';
        md += '## Role\n';
        md += 'You are a **' + role + '**.\n\n';
        md += '## Tasks\n';
        md += 'Perform the following tasks in the specified order:\n\n';

        if (state.tasks.length === 0) {
            md += '*(No tasks defined yet. Click "+ Add Task Step" to begin.)*\n\n';
        } else {
            state.tasks.forEach(function (task, index) {
                var def = getTaskTypeDef(task.type);
                var stepNum = index + 1;
                var paramText = task.param.trim() || '(not specified)';
                var detailsText = task.details.trim();

                md += '### Step ' + stepNum + ': ' + def.label.replace(/^[^\s]+\s/, '') + '\n';
                md += '- **' + def.label.replace(/^[^\s]+\s/, '') + '**: ';

                var actionMap = {
                    clone: 'Clone the repository from',
                    analyze: 'Analyze',
                    research: 'Research about',
                    create_sub_agent: 'Create a sub-agent to handle',
                    implement: 'Implement',
                    refactor: 'Refactor',
                    test: 'Write and run tests for',
                    document: 'Document',
                    review: 'Review',
                    deploy: 'Deploy to',
                };
                var action = actionMap[task.type] || 'Task:';
                md += action + ' `' + paramText + '`.\n';

                if (detailsText) {
                    var lines = detailsText.split('\n').filter(function (l) { return l.trim(); });
                    lines.forEach(function (line) {
                        md += '  - ' + line.trim() + '\n';
                    });
                }
                md += '\n';
            });
        }

        md += '---\n';
        md += '*Generated with Prompt Generator* | ' + new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) + '\n';

        return md;
    }

    // ──────────────────────────────────────
    // Render Preview
    // ──────────────────────────────────────
    function updatePreview() {
        var md = generateMarkdown();
        // Apply syntax highlighting for the preview
        var html = md
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
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
            taskList.innerHTML =
                '<p>No tasks yet. Click <strong>+ Add Task Step</strong> below to start building your prompt.</p>';
        } else {
            taskList.classList.remove('empty-list');
        }

        state.tasks.forEach(function (task, index) {
            var def = getTaskTypeDef(task.type);
            var card = document.createElement('div');
            card.className = 'task-card';
            card.setAttribute('draggable', 'true');
            card.dataset.taskId = task.id;
            card.dataset.index = index;

            card.innerHTML =
                '<span class="task-number">' + (index + 1) + '</span>' +
                '<div class="drag-handle" title="Drag to reorder">\u22EE\u22EE</div>' +
                '<div class="task-content">' +
                    '<div class="task-top-row">' +
                        '<select class="task-type-select" data-field="type">' +
                            TASK_TYPES.map(function (t) {
                                return '<option value="' + t.value + '"' + (task.type === t.value ? ' selected' : '') + '>' + t.label + '</option>';
                            }).join('') +
                        '</select>' +
                        '<input type="text" class="task-param-input" data-field="param" value="' + escapeHtml(task.param) + '" placeholder="' + def.paramPlaceholder + '" title="' + def.paramLabel + '">' +
                    '</div>' +
                    '<textarea class="task-details-input" data-field="details" placeholder="Additional details / notes (optional) \u2014 separate lines for multiple points..." rows="2">' + escapeHtml(task.details) + '</textarea>' +
                '</div>' +
                '<div class="task-actions">' +
                    '<button class="btn-icon btn-move" data-action="moveUp" title="Move up">\u25B2</button>' +
                    '<button class="btn-icon btn-move" data-action="moveDown" title="Move down">\u25BC</button>' +
                    '<button class="btn-icon btn-remove" data-action="remove" title="Remove task">\u2715</button>' +
                '</div>';

            taskList.appendChild(card);
        });

        // Update all task number badges
        updateTaskNumbers();
        updatePreview();
    }

    function updateTaskNumbers() {
        var cards = taskList.querySelectorAll('.task-card');
        cards.forEach(function (card, i) {
            var badge = card.querySelector('.task-number');
            if (badge) badge.textContent = i + 1;
            card.dataset.index = i;
        });
    }

    // ──────────────────────────────────────
    // Task CRUD
    // ──────────────────────────────────────
    function addTask() {
        var newTask = {
            id: taskIdCounter++,
            type: 'analyze',
            param: '',
            details: '',
        };
        state.tasks.push(newTask);
        renderTasks();
        // Scroll to the new task
        requestAnimationFrame(function () {
            var cards = taskList.querySelectorAll('.task-card');
            var lastCard = cards[cards.length - 1];
            if (lastCard) {
                lastCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Briefly highlight
                lastCard.style.boxShadow = '0 0 0 3px rgba(79,70,229,0.4)';
                setTimeout(function () {
                    lastCard.style.boxShadow = '';
                }, 800);
            }
        });
    }

    function removeTask(taskId) {
        var index = state.tasks.findIndex(function (t) { return t.id === taskId; });
        if (index === -1) return;
        if (state.tasks.length === 1) {
            // Don't remove the last task — just clear it
            state.tasks[0].param = '';
            state.tasks[0].details = '';
            state.tasks[0].type = 'analyze';
            renderTasks();
            return;
        }
        state.tasks.splice(index, 1);
        renderTasks();
    }

    function moveTask(taskId, direction) {
        var index = state.tasks.findIndex(function (t) { return t.id === taskId; });
        if (index === -1) return;
        var newIndex = index + direction;
        if (newIndex < 0 || newIndex >= state.tasks.length) return;
        // Swap
        var temp = state.tasks[index];
        state.tasks[index] = state.tasks[newIndex];
        state.tasks[newIndex] = temp;
        renderTasks();
    }

    function updateTaskField(taskId, field, value) {
        var task = state.tasks.find(function (t) { return t.id === taskId; });
        if (!task) return;
        task[field] = value;
        updatePreview();
        saveState();
    }

    // ──────────────────────────────────────
    // Drag and Drop
    // ──────────────────────────────────────
    var draggedIndex = null;
    var draggedTaskId = null;

    function handleDragStart(e) {
        var card = e.target.closest('.task-card');
        if (!card) return;
        draggedIndex = parseInt(card.dataset.index, 10);
        draggedTaskId = parseInt(card.dataset.taskId, 10);
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggedTaskId.toString());
        // Set a semi-transparent drag image
        var rect = card.getBoundingClientRect();
        e.dataTransfer.setDragImage(card, rect.width / 2, rect.height / 2);
        // Allow drop anywhere on the task list
        taskList.style.cursor = 'grabbing';
    }

    function handleDragEnd() {
        var card = event.target.closest('.task-card');
        if (card) card.classList.remove('dragging');
        // Clear all indicators
        taskList.querySelectorAll('.task-card').forEach(function (c) {
            c.classList.remove('drag-over-top', 'drag-over-bottom');
        });
        taskList.style.cursor = '';
        draggedIndex = null;
        draggedTaskId = null;
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        var card = e.target.closest('.task-card');
        if (!card || !draggedTaskId) return;

        var targetId = parseInt(card.dataset.taskId, 10);
        if (targetId === draggedTaskId) {
            // hovering over self — clear indicators
            taskList.querySelectorAll('.task-card').forEach(function (c) {
                c.classList.remove('drag-over-top', 'drag-over-bottom');
            });
            return;
        }

        // Determine if cursor is in top or bottom half of the card
        var rect = card.getBoundingClientRect();
        var midY = rect.top + rect.height / 2;
        var isTopHalf = e.clientY < midY;

        // Clear all indicators
        taskList.querySelectorAll('.task-card').forEach(function (c) {
            c.classList.remove('drag-over-top', 'drag-over-bottom');
        });

        if (isTopHalf) {
            card.classList.add('drag-over-top');
        } else {
            card.classList.add('drag-over-bottom');
        }
    }

    function handleDragLeave(e) {
        var card = e.target.closest('.task-card');
        if (card) {
            card.classList.remove('drag-over-top', 'drag-over-bottom');
        }
    }

    function handleDrop(e) {
        e.preventDefault();
        var card = e.target.closest('.task-card');
        taskList.querySelectorAll('.task-card').forEach(function (c) {
            c.classList.remove('drag-over-top', 'drag-over-bottom', 'dragging');
        });
        taskList.style.cursor = '';

        if (!card || draggedIndex === null || draggedTaskId === null) return;

        var targetId = parseInt(card.dataset.taskId, 10);
        if (targetId === draggedTaskId) return;

        var targetIndex = state.tasks.findIndex(function (t) { return t.id === targetId; });
        if (targetIndex === -1) return;

        var rect = card.getBoundingClientRect();
        var midY = rect.top + rect.height / 2;
        var isTopHalf = e.clientY < midY;

        // Remove dragged item
        var draggedItem = state.tasks.find(function (t) { return t.id === draggedTaskId; });
        if (!draggedItem) return;
        var sourceIndex = state.tasks.findIndex(function (t) { return t.id === draggedTaskId; });
        state.tasks.splice(sourceIndex, 1);

        // Find new insertion index
        var insertIndex = state.tasks.findIndex(function (t) { return t.id === targetId; });
        if (insertIndex === -1) insertIndex = state.tasks.length;
        if (!isTopHalf) insertIndex++;

        state.tasks.splice(insertIndex, 0, draggedItem);
        draggedIndex = null;
        draggedTaskId = null;
        renderTasks();
    }

    // Handle drop on the task list itself (when list is empty or dropping at the end)
    function handleDropOnList(e) {
        if (e.target.closest('.task-card')) return; // handled by card drop
        e.preventDefault();
        taskList.querySelectorAll('.task-card').forEach(function (c) {
            c.classList.remove('drag-over-top', 'drag-over-bottom', 'dragging');
        });
        taskList.style.cursor = '';
        if (draggedIndex === null || draggedTaskId === null) return;
        // Move to end
        var draggedItem = state.tasks.find(function (t) { return t.id === draggedTaskId; });
        if (!draggedItem) return;
        var sourceIndex = state.tasks.findIndex(function (t) { return t.id === draggedTaskId; });
        state.tasks.splice(sourceIndex, 1);
        state.tasks.push(draggedItem);
        draggedIndex = null;
        draggedTaskId = null;
        renderTasks();
    }

    // ──────────────────────────────────────
    // Event Delegation for Task List
    // ──────────────────────────────────────
    taskList.addEventListener('change', function (e) {
        var select = e.target.closest('select[data-field="type"]');
        if (!select) return;
        var card = select.closest('.task-card');
        if (!card) return;
        var taskId = parseInt(card.dataset.taskId, 10);
        updateTaskField(taskId, 'type', select.value);
        // Update the param placeholder
        var def = getTaskTypeDef(select.value);
        var paramInput = card.querySelector('input[data-field="param"]');
        if (paramInput) {
            paramInput.placeholder = def.paramPlaceholder;
            paramInput.title = def.paramLabel;
        }
        updatePreview();
        saveState();
    });

    taskList.addEventListener('input', function (e) {
        var input = e.target.closest('input[data-field="param"]');
        var textarea = e.target.closest('textarea[data-field="details"]');
        var target = input || textarea;
        if (!target) return;
        var card = target.closest('.task-card');
        if (!card) return;
        var taskId = parseInt(card.dataset.taskId, 10);
        var field = target.dataset.field;
        updateTaskField(taskId, field, target.value);
    });

    taskList.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-action]');
        if (!btn) return;
        var card = btn.closest('.task-card');
        if (!card) return;
        var taskId = parseInt(card.dataset.taskId, 10);
        var action = btn.dataset.action;

        if (action === 'remove') {
            removeTask(taskId);
        } else if (action === 'moveUp') {
            moveTask(taskId, -1);
        } else if (action === 'moveDown') {
            moveTask(taskId, 1);
        }
    });

    // Drag events on task list
    taskList.addEventListener('dragstart', handleDragStart);
    taskList.addEventListener('dragend', handleDragEnd);
    taskList.addEventListener('dragover', handleDragOver);
    taskList.addEventListener('dragleave', handleDragLeave);
    taskList.addEventListener('drop', handleDrop);
    // Also handle drop on the list container itself
    taskList.addEventListener('dragover', function (e) {
        if (!e.target.closest('.task-card')) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        }
    });
    taskList.addEventListener('drop', function (e) {
        if (!e.target.closest('.task-card')) {
            handleDropOnList(e);
        }
    });

    // ──────────────────────────────────────
    // Role Handling
    // ──────────────────────────────────────
    function updateRoleUI() {
        if (state.roleSelectValue === 'custom') {
            customRoleWrap.classList.add('visible');
        } else {
            customRoleWrap.classList.remove('visible');
        }
        updatePreview();
        saveState();
    }

    roleSelect.addEventListener('change', function () {
        state.roleSelectValue = roleSelect.value;
        updateRoleUI();
    });

    customRoleInput.addEventListener('input', function () {
        state.customRole = customRoleInput.value;
        updatePreview();
        saveState();
    });

    // ──────────────────────────────────────
    // Buttons
    // ──────────────────────────────────────
    btnAddTask.addEventListener('click', addTask);

    btnCopy.addEventListener('click', function () {
        var md = generateMarkdown();
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(md).then(function () {
                showToast('\u2705 Copied to clipboard!');
            }).catch(function () {
                fallbackCopy(md);
            });
        } else {
            fallbackCopy(md);
        }
    });

    function fallbackCopy(text) {
        var textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            showToast('\u2705 Copied to clipboard!');
        } catch (e) {
            showToast('\u26A0\uFE0F Could not copy. Please select text manually.');
        }
        document.body.removeChild(textarea);
    }

    btnDownload.addEventListener('click', function () {
        var md = generateMarkdown();
        var blob = new Blob([md], { type: 'text/markdown;charset=utf-8' }); // Fix: original had `new Blob(d],`
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        var timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        a.download = 'agent-prompt-' + timestamp + '.md';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('\uD83D\uDCBE Downloaded as .md file!');
    });

    btnReset.addEventListener('click', function () {
        if (confirm('Reset all tasks and role to defaults? This cannot be undone.')) {
            state.roleSelectValue = 'Senior Software Engineer';
            state.customRole = '';
            state.tasks = [
                { id: taskIdCounter++, type: 'clone', param: '', details: '' },
                { id: taskIdCounter++, type: 'analyze', param: '', details: '' },
            ];
            roleSelect.value = 'Senior Software Engineer';
            customRoleInput.value = '';
            updateRoleUI();
            renderTasks();
            showToast('\uD83D\uDD04 Reset to defaults');
        }
    });

    // ──────────────────────────────────────
    // Toast
    // ──────────────────────────────────────
    var toastTimeout;

    function showToast(message) {
        clearTimeout(toastTimeout);
        toast.textContent = message;
        toast.classList.add('show');
        if (message.includes('\u2705') || message.includes('\uD83D\uDCBE')) {
            toast.classList.add('success');
        } else {
            toast.classList.remove('success');
        }
        toastTimeout = setTimeout(function () {
            toast.classList.remove('show');
        }, 2200);
    }

    // ──────────────────────────────────────
    // Keyboard Shortcuts
    // ──────────────────────────────────────
    document.addEventListener('keydown', function (e) {
        // Ctrl/Cmd + N to add task
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            // Only if not focused on an input/textarea
            var activeEl = document.activeElement;
            if (!activeEl || !(activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT')) {
                e.preventDefault();
                addTask();
            }
        }
        // Ctrl/Cmd + Shift + C to copy
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
            e.preventDefault();
            btnCopy.click();
        }
    });

    // ──────────────────────────────────────
    // Initialize
    // ──────────────────────────────────────
    function init() {
        loadState();
        // Apply loaded state to UI
        roleSelect.value = state.roleSelectValue;
        customRoleInput.value = state.customRole;
        updateRoleUI();
        renderTasks();
        updatePreview();
    }

    init();

    console.log('\uD83D\uDE80 Prompt Generator ready!');
    console.log('   Tips:');
    console.log('   - Drag task cards by the \u22EE\u22EE handle to reorder');
    console.log('   - Use \u25B2\u25BC buttons on each card for fine-tuning order');
    console.log('   - Press Ctrl+N (Cmd+N on Mac) to add a new task');
    console.log('   - Press Ctrl+Shift+C to copy the prompt');
    console.log('   - All changes are auto-saved to localStorage');
})();
