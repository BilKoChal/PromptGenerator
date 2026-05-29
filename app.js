/* ============================================
   Prompt Generator — Application Logic
   ============================================ */

(function () {
    'use strict';

    // ──────────────────────────────────────
    // Role Definitions
    // ──────────────────────────────────────
    var ROLES = {
        senior_software_engineer: {
            name: 'Senior Software Engineer',
            description: 'A seasoned engineer who designs, builds, and maintains robust software systems. Proficient in architecture decisions, code quality, and cross-team collaboration.'
        },
        code_reviewer: {
            name: 'Code Reviewer',
            description: 'An experienced reviewer focused on code correctness, readability, security, and performance. Provides constructive, actionable feedback on pull requests and patches.'
        },
        devops_engineer: {
            name: 'DevOps / Platform Engineer',
            description: 'Specializes in CI/CD pipelines, infrastructure-as-code, container orchestration, and cloud platforms. Bridges the gap between development and operations.'
        },
        security_analyst: {
            name: 'Security Analyst',
            description: 'Identifies vulnerabilities, performs threat modeling, and recommends mitigations. Expert in OWASP, secure coding practices, and compliance frameworks.'
        },
        qa_tester: {
            name: 'QA / Test Engineer',
            description: 'Designs and executes test strategies \u2014 unit, integration, E2E, and regression. Ensures software meets quality standards before release.'
        },
        technical_writer: {
            name: 'Technical Writer',
            description: 'Crafts clear, accurate documentation \u2014 API references, tutorials, architecture guides, and onboarding materials \u2014 for both technical and non-technical audiences.'
        },
        data_scientist: {
            name: 'Data Scientist / ML Engineer',
            description: 'Builds and deploys machine learning models, designs data pipelines, performs statistical analysis, and translates data insights into product decisions.'
        },
        product_manager: {
            name: 'Product Manager',
            description: 'Defines product vision, prioritizes the backlog, writes specifications, and coordinates cross-functional teams to deliver user-centric features on time.'
        },
        frontend_developer: {
            name: 'Frontend Developer',
            description: 'Builds responsive, accessible, and performant user interfaces. Expert in modern frameworks, component design, state management, and web performance optimization.'
        },
        backend_developer: {
            name: 'Backend Developer',
            description: 'Designs and implements server-side logic, RESTful and GraphQL APIs, database schemas, authentication, and background job processing.'
        },
        fullstack_developer: {
            name: 'Full-Stack Developer',
            description: 'Works across the entire stack \u2014 from database design and API development to UI implementation and deployment. Comfortable with both frontend and backend concerns.'
        },
        solutions_architect: {
            name: 'Solutions Architect',
            description: 'Designs end-to-end system architectures, evaluates technology choices, and ensures scalability, reliability, and cost-efficiency across the platform.'
        },
        database_admin: {
            name: 'Database Administrator',
            description: 'Manages database performance, schema design, migrations, backups, and replication strategies for SQL and NoSQL systems.'
        },
        ux_designer: {
            name: 'UX / Interaction Designer',
            description: 'Researches user needs, designs wireframes and interactive prototypes, conducts usability testing, and ensures intuitive and accessible user experiences.'
        },
        api_designer: {
            name: 'API Designer',
            description: 'Designs clean, consistent, and versioned RESTful and GraphQL APIs. Focuses on developer experience, documentation, and backward compatibility.'
        },
        sre: {
            name: 'Site Reliability Engineer',
            description: 'Ensures system uptime, defines SLOs/SLAs, builds monitoring and alerting, runs incident responses, and automates toil to keep production healthy.'
        }
    };

    // ──────────────────────────────────────
    // Task Type Definitions
    // ──────────────────────────────────────
    var TASK_TYPES = [
        { value: 'clone', label: 'Clone Repo', icon: '\uD83D\uDCE5', paramLabel: 'Repository URL',
            paramPlaceholder: 'https://github.com/user/repo.git' },
        { value: 'analyze', label: 'Analyze', icon: '\uD83D\uDD0D', paramLabel: 'Target Files / Folders',
            paramPlaceholder: 'entire codebase or src/utils/' },
        { value: 'research', label: 'Research', icon: '\uD83D\uDCDA', paramLabel: 'Research Topic',
            paramPlaceholder: 'best practices for error handling in Rust...' },
        { value: 'create_sub_agent', label: 'Create Sub-Agent', icon: '\uD83E\uDD16', paramLabel: 'Sub-Agent Task',
            paramPlaceholder: 'analyze the authentication module and report findings' },
        { value: 'implement', label: 'Implement', icon: '\uD83D\uDEE0\uFE0F', paramLabel: 'Feature / Task',
            paramPlaceholder: 'user authentication with JWT' },
        { value: 'refactor', label: 'Refactor', icon: '\u267B\uFE0F', paramLabel: 'Target Code',
            paramPlaceholder: 'src/legacy/data-processor.js' },
        { value: 'test', label: 'Test', icon: '\uD83E\uDDEA', paramLabel: 'Test Target',
            paramPlaceholder: 'the login flow and edge cases' },
        { value: 'document', label: 'Document', icon: '\uD83D\uDCDD', paramLabel: 'Documentation Target',
            paramPlaceholder: 'all public API endpoints' },
        { value: 'review', label: 'Review', icon: '\uD83D\uDC40', paramLabel: 'Review Target',
            paramPlaceholder: 'PR #42 or src/new-feature/' },
        { value: 'deploy', label: 'Deploy', icon: '\uD83D\uDE80', paramLabel: 'Deployment Target',
            paramPlaceholder: 'staging server / AWS ECS' },
        { value: 'custom_task', label: 'Custom Task', icon: '\uD83D\uDCA1', paramLabel: 'Task Description',
            paramPlaceholder: 'describe what needs to be done...' },
    ];

    // ──────────────────────────────────────
    // DOM References
    // ──────────────────────────────────────
    var roleSelect = document.getElementById('roleSelect');
    var customRoleWrap = document.getElementById('customRoleWrap');
    var customRoleInput = document.getElementById('customRoleInput');
    var roleDescription = document.getElementById('roleDescription');
    var chkAgentic = document.getElementById('chkAgentic');
    var chkSubagent = document.getElementById('chkSubagent');
    var taskList = document.getElementById('taskList');
    var previewBlock = document.getElementById('previewBlock');
    var btnAddTask = document.getElementById('btnAddTask');
    var btnCopy = document.getElementById('btnCopy');
    var btnDownload = document.getElementById('btnDownload');
    var btnReset = document.getElementById('btnReset');
    var toastEl = document.getElementById('toast');

    // Sidebar
    var sidebar = document.getElementById('sidebar');
    var sidebarOverlay = document.getElementById('sidebarOverlay');
    var sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
    var sidebarCloseBtn = document.getElementById('sidebarCloseBtn');
    var workflowNameInput = document.getElementById('workflowNameInput');
    var btnSaveWorkflow = document.getElementById('btnSaveWorkflow');
    var workflowListEl = document.getElementById('workflowList');
    var btnExportWorkflow = document.getElementById('btnExportWorkflow');
    var btnImportWorkflow = document.getElementById('btnImportWorkflow');
    var importFileInput = document.getElementById('importFileInput');

    // ──────────────────────────────────────
    // State
    // ──────────────────────────────────────
    var STORAGE_KEY = 'prompt_generator_state_v3';
    var WORKFLOW_STORAGE_KEY = 'prompt_generator_workflows';
    var taskIdCounter = Date.now();

    var state = {
        roleSelectValue: 'senior_software_engineer',
        customRole: '',
        agentic: false,
        subagent: false,
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
            var toSave = {
                roleSelectValue: state.roleSelectValue,
                customRole: state.customRole,
                agentic: state.agentic,
                subagent: state.subagent,
                tasks: state.tasks.map(function (t) {
                    return { id: t.id, type: t.type, param: t.param, details: t.details };
                }),
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
        } catch (e) {}
    }

    function loadState() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                var saved = JSON.parse(raw);
                if (saved.roleSelectValue) state.roleSelectValue = saved.roleSelectValue;
                if (saved.customRole !== undefined) state.customRole = saved.customRole;
                if (saved.agentic !== undefined) state.agentic = !!saved.agentic;
                if (saved.subagent !== undefined) state.subagent = !!saved.subagent;
                if (Array.isArray(saved.tasks) && saved.tasks.length > 0) {
                    state.tasks = saved.tasks.map(function (t) {
                        return {
                            id: t.id || taskIdCounter++,
                            type: t.type || 'analyze',
                            param: t.param || '',
                            details: t.details || '',
                        };
                    });
                    var maxId = 0;
                    state.tasks.forEach(function (t) { if (t.id > maxId) maxId = t.id; });
                    taskIdCounter = maxId + 1;
                }
            }
        } catch (e) {}
    }

    // ──────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────
    function getTaskTypeDef(type) {
        for (var i = 0; i < TASK_TYPES.length; i++) {
            if (TASK_TYPES[i].value === type) return TASK_TYPES[i];
        }
        return TASK_TYPES[1]; // default: analyze
    }

    function getEffectiveRole() {
        if (state.roleSelectValue === 'custom') {
            return state.customRole.trim() || 'Assistant';
        }
        var def = ROLES[state.roleSelectValue];
        return def ? def.name : state.roleSelectValue;
    }

    function getRoleDescription() {
        if (state.roleSelectValue === 'custom') {
            return state.customRole.trim() ? 'Custom role: ' + state.customRole.trim() : '';
        }
        var def = ROLES[state.roleSelectValue];
        return def ? def.description : '';
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

        md += '# Agent Prompt\n\n';
        md += '## Role\n';
        md += 'You are a **' + role + '**.\n';

        var desc = getRoleDescription();
        if (desc) {
            md += desc + '\n';
        }

        var caps = [];
        if (state.agentic) caps.push('**Agentic**: You are authorized to autonomously plan, decide, and execute multi-step tasks without requiring human approval at each step.');
        if (state.subagent) caps.push('**Sub-agent**: You are authorized to spawn and coordinate sub-agents to handle specialized sub-tasks in parallel.');
        if (caps.length > 0) {
            md += '\n## Capabilities\n';
            caps.forEach(function (c) { md += '- ' + c + '\n'; });
        }

        md += '\n## Tasks\n';
        md += 'Perform the following tasks in the specified order:\n\n';

        if (state.tasks.length === 0) {
            md += '*(No tasks defined yet. Click "+ Add Task Step" to begin.)*\n\n';
        } else {
            state.tasks.forEach(function (task, index) {
                var def = getTaskTypeDef(task.type);
                var stepNum = index + 1;
                var paramText = task.param.trim() || '(not specified)';
                var detailsText = task.details.trim();
                var label = def.icon + ' ' + def.label;

                md += '### Step ' + stepNum + ': ' + def.label + '\n';
                md += '- **' + def.label + '**: ';

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
            card.dragaggable = true; // Always draggable — dragstart checks flag
            card.setAttribute('draggable', 'true');
            card.dataset.taskId = task.id;
            card.dataset.index = index;

            var optionsHtml = '';
            for (var i = 0; i < TASK_TYPES.length; i++) {
                var t = TASK_TYPES[i];
                var sel = (task.type === t.value) ? ' selected' : '';
                optionsHtml += '<option value="' + t.value + '"' + sel + '>' + t.icon + ' ' + t.label + '</option>';
            }

            card.innerHTML =
                '<span class="task-number">' + (index + 1) + '</span>' +
                '<div class="drag-handle" title="Drag to reorder">\u22EE\u22EE</div>' +
                '<div class="task-content">' +
                    '<div class="task-top-row">' +
                        '<select class="task-type-select" data-field="type">' + optionsHtml + '</select>' +
                        '<input type="text" class="task-param-input" data-field="param" value="' + escapeHtml(task.param) + '" placeholder="' + escapeHtml(def.paramPlaceholder) + '" title="' + escapeHtml(def.paramLabel) + '">' +
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

        updateTaskNumbers();
        updatePreview();
    }

    function updateTaskNumbers() {
        var cards = taskList.querySelectorAll('.task-card');
        for (var i = 0; i < cards.length; i++) {
            var badge = cards[i].querySelector('.task-number');
            if (badge) badge.textContent = i + 1;
            cards[i].dataset.index = i;
        }
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
        requestAnimationFrame(function () {
            var cards = taskList.querySelectorAll('.task-card');
            var lastCard = cards[cards.length - 1];
            if (lastCard) {
                lastCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                lastCard.style.boxShadow = '0 0 0 3px rgba(79,70,229,0.4)';
                setTimeout(function () { lastCard.style.boxShadow = ''; }, 800);
            }
        });
    }

    function removeTask(taskId) {
        var index = -1;
        for (var i = 0; i < state.tasks.length; i++) {
            if (state.tasks[i].id === taskId) { index = i; break; }
        }
        if (index === -1) return;
        if (state.tasks.length === 1) {
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
        var index = -1;
        for (var i = 0; i < state.tasks.length; i++) {
            if (state.tasks[i].id === taskId) { index = i; break; }
        }
        if (index === -1) return;
        var newIndex = index + direction;
        if (newIndex < 0 || newIndex >= state.tasks.length) return;
        var temp = state.tasks[index];
        state.tasks[index] = state.tasks[newIndex];
        state.tasks[newIndex] = temp;
        renderTasks();
    }

    function updateTaskField(taskId, field, value) {
        for (var i = 0; i < state.tasks.length; i++) {
            if (state.tasks[i].id === taskId) {
                state.tasks[i][field] = value;
                break;
            }
        }
        updatePreview();
        saveState();
    }

    // ──────────────────────────────────────
    // Drag and Drop — handle-only via flag
    // ──────────────────────────────────────
    var draggedIndex = null;
    var draggedTaskId = null;
    var dragFromHandle = false; // KEY: set true only when mousedown is on a drag-handle

    // On mousedown: check if it started on a drag-handle
    taskList.addEventListener('mousedown', function (e) {
        dragFromHandle = !!e.target.closest('.drag-handle');
    });

    // Also handle touch for mobile
    taskList.addEventListener('touchstart', function (e) {
        dragFromHandle = !!e.target.closest('.drag-handle');
    }, { passive: true });

    function handleDragStart(e) {
        // CRITICAL: Only allow drag if mousedown was on the drag-handle
        if (!dragFromHandle) {
            e.preventDefault();
            return;
        }

        var card = e.target.closest('.task-card');
        if (!card) {
            e.preventDefault();
            return;
        }

        draggedIndex = parseInt(card.dataset.index, 10);
        draggedTaskId = parseInt(card.dataset.taskId, 10);
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(draggedTaskId));
        var rect = card.getBoundingClientRect();
        e.dataTransfer.setDragImage(card, rect.width / 2, rect.height / 2);
        taskList.style.cursor = 'grabbing';
    }

    function handleDragEnd(e) {
        var card = e.target.closest('.task-card');
        if (card) card.classList.remove('dragging');
        var cards = taskList.querySelectorAll('.task-card');
        for (var i = 0; i < cards.length; i++) {
            cards[i].classList.remove('drag-over-top', 'drag-over-bottom');
        }
        taskList.style.cursor = '';
        draggedIndex = null;
        draggedTaskId = null;
        dragFromHandle = false;
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        var card = e.target.closest('.task-card');
        if (!card || draggedTaskId === null) return;

        var targetId = parseInt(card.dataset.taskId, 10);
        if (targetId === draggedTaskId) {
            var cards = taskList.querySelectorAll('.task-card');
            for (var i = 0; i < cards.length; i++) {
                cards[i].classList.remove('drag-over-top', 'drag-over-bottom');
            }
            return;
        }

        var rect = card.getBoundingClientRect();
        var midY = rect.top + rect.height / 2;
        var isTopHalf = e.clientY < midY;

        var allCards = taskList.querySelectorAll('.task-card');
        for (var j = 0; j < allCards.length; j++) {
            allCards[j].classList.remove('drag-over-top', 'drag-over-bottom');
        }

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
        var allCards = taskList.querySelectorAll('.task-card');
        for (var i = 0; i < allCards.length; i++) {
            allCards[i].classList.remove('drag-over-top', 'drag-over-bottom', 'dragging');
        }
        taskList.style.cursor = '';

        if (!card || draggedIndex === null || draggedTaskId === null) return;

        var targetId = parseInt(card.dataset.taskId, 10);
        if (targetId === draggedTaskId) return;

        // Find target index in state
        var targetIdx = -1;
        for (var ti = 0; ti < state.tasks.length; ti++) {
            if (state.tasks[ti].id === targetId) { targetIdx = ti; break; }
        }
        if (targetIdx === -1) return;

        var rect = card.getBoundingClientRect();
        var midY = rect.top + rect.height / 2;
        var isTopHalf = e.clientY < midY;

        // Find and remove dragged item
        var draggedItem = null;
        var sourceIdx = -1;
        for (var si = 0; si < state.tasks.length; si++) {
            if (state.tasks[si].id === draggedTaskId) { draggedItem = state.tasks[si]; sourceIdx = si; break; }
        }
        if (!draggedItem) return;

        state.tasks.splice(sourceIdx, 1);

        // Recalculate insert index after removal
        var insertIdx = -1;
        for (var ii = 0; ii < state.tasks.length; ii++) {
            if (state.tasks[ii].id === targetId) { insertIdx = ii; break; }
        }
        if (insertIdx === -1) insertIdx = state.tasks.length;
        if (!isTopHalf) insertIdx++;

        state.tasks.splice(insertIdx, 0, draggedItem);
        draggedIndex = null;
        draggedTaskId = null;
        dragFromHandle = false;
        renderTasks();
    }

    function handleDropOnList(e) {
        if (e.target.closest('.task-card')) return;
        e.preventDefault();
        var allCards = taskList.querySelectorAll('.task-card');
        for (var i = 0; i < allCards.length; i++) {
            allCards[i].classList.remove('drag-over-top', 'drag-over-bottom', 'dragging');
        }
        taskList.style.cursor = '';
        if (draggedIndex === null || draggedTaskId === null) return;

        var draggedItem = null;
        var sourceIdx = -1;
        for (var si = 0; si < state.tasks.length; si++) {
            if (state.tasks[si].id === draggedTaskId) { draggedItem = state.tasks[si]; sourceIdx = si; break; }
        }
        if (!draggedItem) return;

        state.tasks.splice(sourceIdx, 1);
        state.tasks.push(draggedItem);
        draggedIndex = null;
        draggedTaskId = null;
        dragFromHandle = false;
        renderTasks();
    }

    // Attach drag events
    taskList.addEventListener('dragstart', handleDragStart);
    taskList.addEventListener('dragend', handleDragEnd);
    taskList.addEventListener('dragover', handleDragOver);
    taskList.addEventListener('dragleave', handleDragLeave);
    taskList.addEventListener('drop', handleDrop);

    // Also handle drop on the task list container (when list is empty or dropping at end)
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
    // Event Delegation for Task List
    // ──────────────────────────────────────
    taskList.addEventListener('change', function (e) {
        var select = e.target.closest('select[data-field="type"]');
        if (!select) return;
        var card = select.closest('.task-card');
        if (!card) return;
        var taskId = parseInt(card.dataset.taskId, 10);
        updateTaskField(taskId, 'type', select.value);
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

    // ──────────────────────────────────────
    // Role Handling
    // ──────────────────────────────────────
    function updateRoleUI() {
        if (state.roleSelectValue === 'custom') {
            customRoleWrap.classList.add('visible');
        } else {
            customRoleWrap.classList.remove('visible');
        }
        var desc = getRoleDescription();
        if (desc) {
            roleDescription.textContent = desc;
            roleDescription.classList.add('visible');
        } else {
            roleDescription.textContent = '';
            roleDescription.classList.remove('visible');
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
        updateRoleUI();
    });

    chkAgentic.addEventListener('change', function () {
        state.agentic = chkAgentic.checked;
        updatePreview();
        saveState();
    });

    chkSubagent.addEventListener('change', function () {
        state.subagent = chkSubagent.checked;
        updatePreview();
        saveState();
    });

    // ──────────────────────────────────────
    // Sidebar Toggle
    // ──────────────────────────────────────
    function openSidebar() {
        sidebar.classList.add('open');
        sidebarOverlay.classList.add('active');
        renderWorkflowList();
    }

    function closeSidebar() {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('active');
    }

    sidebarToggleBtn.addEventListener('click', openSidebar);
    sidebarCloseBtn.addEventListener('click', closeSidebar);
    sidebarOverlay.addEventListener('click', closeSidebar);

    // ──────────────────────────────────────
    // Workflow Save / Load / Export / Import
    // ──────────────────────────────────────
    function getWorkflows() {
        try {
            var raw = localStorage.getItem(WORKFLOW_STORAGE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (e) { return {}; }
    }

    function setWorkflows(wf) {
        try {
            localStorage.setItem(WORKFLOW_STORAGE_KEY, JSON.stringify(wf));
        } catch (e) {}
    }

    function saveWorkflow(name) {
        if (!name.trim()) {
            showToast('Please enter a workflow name.');
            return;
        }
        var workflows = getWorkflows();
        workflows[name.trim()] = {
            roleSelectValue: state.roleSelectValue,
            customRole: state.customRole,
            agentic: state.agentic,
            subagent: state.subagent,
            tasks: state.tasks.map(function (t) {
                return { type: t.type, param: t.param, details: t.details };
            }),
            savedAt: new Date().toISOString(),
        };
        setWorkflows(workflows);
        workflowNameInput.value = '';
        renderWorkflowList();
        showToast('Workflow "' + name.trim() + '" saved!');
    }

    function loadWorkflow(name) {
        var workflows = getWorkflows();
        var wf = workflows[name];
        if (!wf) return;

        state.roleSelectValue = wf.roleSelectValue || 'senior_software_engineer';
        state.customRole = wf.customRole || '';
        state.agentic = !!wf.agentic;
        state.subagent = !!wf.subagent;
        state.tasks = (wf.tasks || []).map(function (t) {
            return { id: taskIdCounter++, type: t.type || 'analyze', param: t.param || '', details: t.details || '' };
        });

        roleSelect.value = state.roleSelectValue;
        customRoleInput.value = state.customRole;
        chkAgentic.checked = state.agentic;
        chkSubagent.checked = state.subagent;
        updateRoleUI();
        renderTasks();
        closeSidebar();
        showToast('Workflow "' + name + '" loaded!');
    }

    function deleteWorkflow(name) {
        var workflows = getWorkflows();
        delete workflows[name];
        setWorkflows(workflows);
        renderWorkflowList();
        showToast('Workflow "' + name + '" deleted.');
    }

    function exportWorkflow(name) {
        var workflows = getWorkflows();
        var wf = workflows[name];
        if (!wf) return;
        var data = JSON.stringify({ name: name, workflow: wf }, null, 2);
        var blob = new Blob([data], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'workflow-' + name.replace(/[^a-zA-Z0-9_-]/g, '_') + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Workflow "' + name + '" exported!');
    }

    function importWorkflow(file) {
        var reader = new FileReader();
        reader.onload = function (evt) {
            try {
                var data = JSON.parse(evt.target.result);
                if (!data.name || !data.workflow) throw new Error('Invalid format');
                var workflows = getWorkflows();
                workflows[data.name] = data.workflow;
                setWorkflows(workflows);
                renderWorkflowList();
                showToast('Workflow "' + data.name + '" imported!');
            } catch (err) {
                showToast('Invalid workflow file.');
            }
        };
        reader.readAsText(file);
    }

    function renderWorkflowList() {
        var workflows = getWorkflows();
        var names = Object.keys(workflows);
        if (names.length === 0) {
            workflowListEl.innerHTML = '<p class="empty-msg">No saved workflows yet.</p>';
            return;
        }
        names.sort(function (a, b) {
            return (workflows[b].savedAt || '').localeCompare(workflows[a].savedAt || '');
        });
        var html = '';
        for (var i = 0; i < names.length; i++) {
            var name = names[i];
            var wf = workflows[name];
            var dateStr = '';
            if (wf.savedAt) {
                var d = new Date(wf.savedAt);
                dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }
            html += '<div class="workflow-item" data-wf-name="' + escapeHtml(name) + '">' +
                '<span class="wf-name" title="' + escapeHtml(name) + '">' + escapeHtml(name) + '</span>' +
                '<span class="wf-date">' + dateStr + '</span>' +
                '<div class="wf-actions">' +
                    '<button class="wf-btn" data-wf-action="load" title="Load">\u25B6</button>' +
                    '<button class="wf-btn" data-wf-action="export" title="Export">\u2191</button>' +
                    '<button class="wf-btn wf-btn-delete" data-wf-action="delete" title="Delete">\u2715</button>' +
                '</div>' +
            '</div>';
        }
        workflowListEl.innerHTML = html;
    }

    workflowListEl.addEventListener('click', function (e) {
        var btn = e.target.closest('.wf-btn');
        if (!btn) return;
        var item = btn.closest('.workflow-item');
        if (!item) return;
        var name = item.dataset.wfName;
        var action = btn.dataset.wfAction;
        if (action === 'load') loadWorkflow(name);
        else if (action === 'export') exportWorkflow(name);
        else if (action === 'delete') deleteWorkflow(name);
    });

    btnSaveWorkflow.addEventListener('click', function () {
        saveWorkflow(workflowNameInput.value);
    });

    workflowNameInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveWorkflow(workflowNameInput.value);
        }
    });

    btnExportWorkflow.addEventListener('click', function () {
        var data = JSON.stringify({
            name: 'Current Workflow',
            workflow: {
                roleSelectValue: state.roleSelectValue,
                customRole: state.customRole,
                agentic: state.agentic,
                subagent: state.subagent,
                tasks: state.tasks.map(function (t) {
                    return { type: t.type, param: t.param, details: t.details };
                }),
                savedAt: new Date().toISOString(),
            }
        }, null, 2);
        var blob = new Blob([data], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        var ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        a.download = 'workflow-' + ts + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Current workflow exported!');
    });

    btnImportWorkflow.addEventListener('click', function () {
        importFileInput.click();
    });

    importFileInput.addEventListener('change', function () {
        if (importFileInput.files && importFileInput.files[0]) {
            importWorkflow(importFileInput.files[0]);
            importFileInput.value = '';
        }
    });

    // ──────────────────────────────────────
    // Buttons
    // ──────────────────────────────────────
    btnAddTask.addEventListener('click', addTask);

    btnCopy.addEventListener('click', function () {
        var md = generateMarkdown();
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(md).then(function () {
                showToast('Copied to clipboard!');
            }).catch(function () {
                fallbackCopy(md);
            });
        } else {
            fallbackCopy(md);
        }
    });

    function fallbackCopy(text) {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand('copy');
            showToast('Copied to clipboard!');
        } catch (e) {
            showToast('Could not copy. Please select text manually.');
        }
        document.body.removeChild(ta);
    }

    btnDownload.addEventListener('click', function () {
        var md = generateMarkdown();
        var blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        var timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        a.download = 'agent-prompt-' + timestamp + '.md';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Downloaded as .md file!');
    });

    btnReset.addEventListener('click', function () {
        if (confirm('Reset all tasks and role to defaults? This cannot be undone.')) {
            state.roleSelectValue = 'senior_software_engineer';
            state.customRole = '';
            state.agentic = false;
            state.subagent = false;
            state.tasks = [
                { id: taskIdCounter++, type: 'clone', param: '', details: '' },
                { id: taskIdCounter++, type: 'analyze', param: '', details: '' },
            ];
            roleSelect.value = 'senior_software_engineer';
            customRoleInput.value = '';
            chkAgentic.checked = false;
            chkSubagent.checked = false;
            updateRoleUI();
            renderTasks();
            showToast('Reset to defaults');
        }
    });

    // ──────────────────────────────────────
    // Toast
    // ──────────────────────────────────────
    var toastTimeout;

    function showToast(message) {
        clearTimeout(toastTimeout);
        toastEl.textContent = message;
        toastEl.classList.add('show');
        toastEl.classList.add('success');
        toastTimeout = setTimeout(function () {
            toastEl.classList.remove('show');
            toastEl.classList.remove('success');
        }, 2200);
    }

    // ──────────────────────────────────────
    // Keyboard Shortcuts
    // ──────────────────────────────────────
    document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            var activeEl = document.activeElement;
            if (!activeEl || (activeEl.tagName !== 'INPUT' && activeEl.tagName !== 'TEXTAREA' && activeEl.tagName !== 'SELECT')) {
                e.preventDefault();
                addTask();
            }
        }
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
            e.preventDefault();
            btnCopy.click();
        }
        if (e.key === 'Escape') {
            closeSidebar();
        }
    });

    // ──────────────────────────────────────
    // Initialize
    // ──────────────────────────────────────
    function init() {
        loadState();
        roleSelect.value = state.roleSelectValue;
        customRoleInput.value = state.customRole;
        chkAgentic.checked = state.agentic;
        chkSubagent.checked = state.subagent;
        updateRoleUI();
        renderTasks();
        updatePreview();
    }

    init();

    console.log('Prompt Generator ready!');
});
