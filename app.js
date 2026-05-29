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
            description: 'Designs and executes test strategies — unit, integration, E2E, and regression. Ensures software meets quality standards before release.'
        },
        technical_writer: {
            name: 'Technical Writer',
            description: 'Crafts clear, accurate documentation — API references, tutorials, architecture guides, and onboarding materials — for both technical and non-technical audiences.'
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
            description: 'Works across the entire stack — from database design and API development to UI implementation and deployment. Comfortable with both frontend and backend concerns.'
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
        } catch (e) { /* storage full or unavailable */ }
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
                    var maxId = Math.max.apply(null, state.tasks.map(function (t) { return t.id; }).concat([0]));
                    taskIdCounter = maxId + 1;
                }
            }
        } catch (e) { /* corrupted data, use defaults */ }
    }

    // ──────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────
    function getTaskTypeDef(type) {
        return TASK_TYPES.find(function (t) { return t.value === type; }) || TASK_TYPES[1];
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

        md += '# \uD83E\uDD16 Agent Prompt\n\n';
        md += '## Role\n';
        md += 'You are a **' + role + '**.\n';

        // Role description
        var desc = getRoleDescription();
        if (desc) {
            md += desc + '\n';
        }

        // Capabilities
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
            // NOT draggable by default — only via drag-handle
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
        var index = state.tasks.findIndex(function (t) { return t.id === taskId; });
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
        var index = state.tasks.findIndex(function (t) { return t.id === taskId; });
        if (index === -1) return;
        var newIndex = index + direction;
        if (newIndex < 0 || newIndex >= state.tasks.length) return;
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
    // Drag and Drop — only from drag-handle
    // ──────────────────────────────────────
    var draggedIndex = null;
    var draggedTaskId = null;
    var isDragging = false;

    // Enable draggable ONLY when mouse is on the drag-handle
    taskList.addEventListener('mousedown', function (e) {
        var handle = e.target.closest('.drag-handle');
        if (!handle) return;
        var card = handle.closest('.task-card');
        if (card) {
            card.setAttribute('draggable', 'true');
        }
    });

    taskList.addEventListener('mouseup', function () {
        // Remove draggable from all cards
        taskList.querySelectorAll('.task-card').forEach(function (c) {
            c.setAttribute('draggable', 'false');
        });
    });

    function handleDragStart(e) {
        // Only allow if the event originated from a drag-handle
        var handle = e.target.closest('.drag-handle');
        if (!handle) {
            e.preventDefault();
            return;
        }
        var card = e.target.closest('.task-card');
        if (!card) { e.preventDefault(); return; }

        draggedIndex = parseInt(card.dataset.index, 10);
        draggedTaskId = parseInt(card.dataset.taskId, 10);
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggedTaskId.toString());
        var rect = card.getBoundingClientRect();
        e.dataTransfer.setDragImage(card, rect.width / 2, rect.height / 2);
        taskList.style.cursor = 'grabbing';
        isDragging = true;
    }

    function handleDragEnd(e) {
        var card = e.target.closest('.task-card');
        if (card) card.classList.remove('dragging');
        taskList.querySelectorAll('.task-card').forEach(function (c) {
            c.classList.remove('drag-over-top', 'drag-over-bottom');
            c.setAttribute('draggable', 'false');
        });
        taskList.style.cursor = '';
        draggedIndex = null;
        draggedTaskId = null;
        isDragging = false;
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        var card = e.target.closest('.task-card');
        if (!card || !draggedTaskId) return;

        var targetId = parseInt(card.dataset.taskId, 10);
        if (targetId === draggedTaskId) {
            taskList.querySelectorAll('.task-card').forEach(function (c) {
                c.classList.remove('drag-over-top', 'drag-over-bottom');
            });
            return;
        }

        var rect = card.getBoundingClientRect();
        var midY = rect.top + rect.height / 2;
        var isTopHalf = e.clientY < midY;

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

        var draggedItem = state.tasks.find(function (t) { return t.id === draggedTaskId; });
        if (!draggedItem) return;
        var sourceIndex = state.tasks.findIndex(function (t) { return t.id === draggedTaskId; });
        state.tasks.splice(sourceIndex, 1);

        var insertIndex = state.tasks.findIndex(function (t) { return t.id === targetId; });
        if (insertIndex === -1) insertIndex = state.tasks.length;
        if (!isTopHalf) insertIndex++;

        state.tasks.splice(insertIndex, 0, draggedItem);
        draggedIndex = null;
        draggedTaskId = null;
        isDragging = false;
        renderTasks();
    }

    function handleDropOnList(e) {
        if (e.target.closest('.task-card')) return;
        e.preventDefault();
        taskList.querySelectorAll('.task-card').forEach(function (c) {
            c.classList.remove('drag-over-top', 'drag-over-bottom', 'dragging');
        });
        taskList.style.cursor = '';
        if (draggedIndex === null || draggedTaskId === null) return;
        var draggedItem = state.tasks.find(function (t) { return t.id === draggedTaskId; });
        if (!draggedItem) return;
        var sourceIndex = state.tasks.findIndex(function (t) { return t.id === draggedTaskId; });
        state.tasks.splice(sourceIndex, 1);
        state.tasks.push(draggedItem);
        draggedIndex = null;
        draggedTaskId = null;
        isDragging = false;
        renderTasks();
    }

    // Attach drag events
    taskList.addEventListener('dragstart', handleDragStart);
    taskList.addEventListener('dragend', handleDragEnd);
    taskList.addEventListener('dragover', handleDragOver);
    taskList.addEventListener('dragleave', handleDragLeave);
    taskList.addEventListener('drop', handleDrop);
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
        // Update description
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
        } catch (e) { /* storage full */ }
    }

    function saveWorkflow(name) {
        if (!name.trim()) {
            showToast('\u26A0\uFE0F Please enter a workflow name.');
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
        showToast('\u2705 Workflow "' + name.trim() + '" saved!');
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

        // Apply to UI
        roleSelect.value = state.roleSelectValue;
        customRoleInput.value = state.customRole;
        chkAgentic.checked = state.agentic;
        chkSubagent.checked = state.subagent;
        updateRoleUI();
        renderTasks();
        closeSidebar();
        showToast('\u2705 Workflow "' + name + '" loaded!');
    }

    function deleteWorkflow(name) {
        var workflows = getWorkflows();
        delete workflows[name];
        setWorkflows(workflows);
        renderWorkflowList();
        showToast('\uD83D\uDDD1\uFE0F Workflow "' + name + '" deleted.');
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
        showToast('\uD83D\uDCE4 Workflow "' + name + '" exported!');
    }

    function importWorkflow(file) {
        var reader = new FileReader();
        reader.onload = function (e) {
            try {
                var data = JSON.parse(e.target.result);
                if (!data.name || !data.workflow) throw new Error('Invalid format');
                var workflows = getWorkflows();
                workflows[data.name] = data.workflow;
                setWorkflows(workflows);
                renderWorkflowList();
                showToast('\uD83D\uDCE5 Workflow "' + data.name + '" imported!');
            } catch (err) {
                showToast('\u26A0\uFE0F Invalid workflow file.');
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
        // Sort by most recent
        names.sort(function (a, b) {
            return (workflows[b].savedAt || '').localeCompare(workflows[a].savedAt || '');
        });
        workflowListEl.innerHTML = names.map(function (name) {
            var wf = workflows[name];
            var dateStr = '';
            if (wf.savedAt) {
                var d = new Date(wf.savedAt);
                dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }
            return '<div class="workflow-item" data-wf-name="' + escapeHtml(name) + '">' +
                '<span class="wf-name" title="' + escapeHtml(name) + '">' + escapeHtml(name) + '</span>' +
                '<span class="wf-date">' + dateStr + '</span>' +
                '<div class="wf-actions">' +
                    '<button class="wf-btn" data-wf-action="load" title="Load">\u25B6</button>' +
                    '<button class="wf-btn" data-wf-action="export" title="Export">\uD83D\uDCE4</button>' +
                    '<button class="wf-btn wf-btn-delete" data-wf-action="delete" title="Delete">\u2715</button>' +
                '</div>' +
            '</div>';
        }).join('');
    }

    // Event delegation for workflow list
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
        // Export current state as a workflow JSON
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
        showToast('\uD83D\uDCE4 Current workflow exported!');
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
        showToast('\uD83D\uDCBE Downloaded as .md file!');
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
            showToast('\uD83D\uDD04 Reset to defaults');
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
        if (message.indexOf('\u2705') !== -1 || message.indexOf('\uD83D\uDCBE') !== -1 || message.indexOf('\uD83D\uDCE4') !== -1 || message.indexOf('\uD83D\uDCE5') !== -1) {
            toastEl.classList.add('success');
        } else {
            toastEl.classList.remove('success');
        }
        toastTimeout = setTimeout(function () {
            toastEl.classList.remove('show');
        }, 2200);
    }

    // ──────────────────────────────────────
    // Keyboard Shortcuts
    // ──────────────────────────────────────
    document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            var activeEl = document.activeElement;
            if (!activeEl || !(activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT')) {
                e.preventDefault();
                addTask();
            }
        }
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
            e.preventDefault();
            btnCopy.click();
        }
        // Escape to close sidebar
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

    console.log('\uD83D\uDE80 Prompt Generator ready!');
    console.log('   Tips:');
    console.log('   - Drag task cards by the \u22EE\u22EE handle only to reorder');
    console.log('   - Use \u25B2\u25BC buttons on each card for fine-tuning order');
    console.log('   - Press Ctrl+N (Cmd+N on Mac) to add a new task');
    console.log('   - Press Ctrl+Shift+C to copy the prompt');
    console.log('   - Click 💾 Workflows to save/load/export/import workflows');
    console.log('   - All changes are auto-saved to localStorage');
});
