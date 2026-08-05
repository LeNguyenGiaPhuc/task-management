const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth, requireBoardRole, requireTrustedOrigin } = require('../middleware/auth.middleware');
const { generateChatActionProposal, generateSubTaskTitles } = require('../services/ai.service');
const { logBoardActivity } = require('../services/activity.service');
const { cleanText } = require('../utils/text');

const router = express.Router();

router.use(requireAuth, requireTrustedOrigin);

function summarizeTask(task) {
  const subtasks = task.sub_tasks || [];
  return {
    id: task.id,
    title: task.title,
    description: task.description || '',
    type: task.task_type || 'TASK',
    priority: task.priority || 'MEDIUM',
    due_date: task.due_date,
    assignee: task.users?.name || 'Unassigned',
    assignee_email: task.users?.email || null,
    checklist: {
      total: subtasks.length,
      completed: subtasks.filter((item) => item.is_completed).length,
      items: subtasks.slice(0, 8).map((item) => ({
        title: item.title,
        completed: Boolean(item.is_completed),
      })),
    },
  };
}

function getDueStatus(dueDate) {
  if (!dueDate) return 'NO_DUE_DATE';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  const daysUntilDue = Math.ceil((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

  if (daysUntilDue < 0) return 'OVERDUE';
  if (daysUntilDue <= 3) return 'DUE_SOON';
  return 'ON_TRACK';
}

function summarizeBoard(board) {
  const columns = board.columns || [];
  const tasks = columns.flatMap((column) =>
    (column.tasks || []).map((task) => ({
      ...summarizeTask(task),
      column: column.title,
      is_intake: Boolean(column.is_intake),
    }))
  );

  return {
    id: board.id,
    title: board.title,
    description: board.description || '',
    columns: columns.map((column) => ({
      id: column.id,
      title: column.title,
      is_intake: Boolean(column.is_intake),
      task_count: column.tasks?.length || 0,
    })),
    members: (board.board_members || []).map((member) => ({
      name: member.users?.name,
      email: member.users?.email,
      board_role: member.role,
      project_role: member.project_role,
    })),
    tasks: tasks.slice(0, 40),
    activity: (board.activity_logs || []).slice(0, 12).map((log) => ({
      action: log.action_text,
      actor: log.users?.name || 'Unknown',
      created_at: log.created_at,
    })),
  };
}

async function buildWorkspaceContext(userId, boardId) {
  const today = new Date().toISOString().slice(0, 10);
  const boards = await prisma.boards.findMany({
    where: {
      archived_at: null,
      board_members: {
        some: {
          user_id: userId,
        },
      },
    },
    orderBy: { updated_at: 'desc' },
    take: 8,
    include: {
      board_members: {
        include: {
          users: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
      columns: {
        orderBy: { order: 'asc' },
        include: {
          tasks: {
            where: { archived_at: null },
            orderBy: { order: 'asc' },
            take: 15,
            include: {
              users: {
                select: {
                  name: true,
                  email: true,
                },
              },
              sub_tasks: {
                orderBy: { order: 'asc' },
                take: 10,
              },
            },
          },
        },
      },
    },
  });

  const workspaceTasks = boards.flatMap((board) =>
    board.columns.flatMap((column) =>
      column.tasks.map((task) => ({
        ...summarizeTask(task),
        board_id: board.id,
        board: board.title,
        column: column.title,
        is_intake: Boolean(column.is_intake),
        due_status: getDueStatus(task.due_date),
      }))
    )
  );

  const context = {
    current_date: today,
    current_user_id: userId,
    workspace_boards: boards.map((board) => ({
      id: board.id,
      title: board.title,
      description: board.description || '',
      column_count: board.columns.filter((column) => !column.is_intake).length,
      intake_task_count:
        board.columns.find((column) => column.is_intake)?.tasks.length || 0,
      columns: board.columns.map((column) => ({
        id: column.id,
        title: column.title,
        is_intake: Boolean(column.is_intake),
        task_count: column.tasks.length,
      })),
      task_count: board.columns.reduce((total, column) => total + column.tasks.length, 0),
      urgent_count: board.columns.reduce(
        (total, column) => total + column.tasks.filter((task) => task.priority === 'URGENT').length,
        0
      ),
      overdue_count: board.columns.reduce(
        (total, column) => total + column.tasks.filter((task) => getDueStatus(task.due_date) === 'OVERDUE').length,
        0
      ),
      members: board.board_members.map((member) => ({
        name: member.users?.name,
        board_role: member.role,
        project_role: member.project_role,
      })),
    })),
    workspace_task_index: workspaceTasks.slice(0, 80),
    workspace_stats: {
      total_tasks: workspaceTasks.length,
      urgent_tasks: workspaceTasks.filter((task) => task.priority === 'URGENT').length,
      overdue_tasks: workspaceTasks.filter((task) => task.due_status === 'OVERDUE').length,
      due_soon_tasks: workspaceTasks.filter((task) => task.due_status === 'DUE_SOON').length,
      unassigned_tasks: workspaceTasks.filter((task) => task.assignee === 'Unassigned').length,
    },
    selected_board: null,
  };

  if (!boardId) return context;

  const board = await prisma.boards.findFirst({
    where: {
      id: boardId,
      archived_at: null,
    },
    include: {
      board_members: {
        include: {
          users: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
      activity_logs: {
        orderBy: { created_at: 'desc' },
        take: 12,
        include: {
          users: {
            select: {
              name: true,
            },
          },
        },
      },
      columns: {
        orderBy: { order: 'asc' },
        include: {
          tasks: {
            where: { archived_at: null },
            orderBy: { order: 'asc' },
            take: 12,
            include: {
              users: {
                select: {
                  name: true,
                  email: true,
                },
              },
              sub_tasks: {
                orderBy: { order: 'asc' },
              },
            },
          },
        },
      },
    },
  });

  if (board) {
    context.selected_board = summarizeBoard(board);
  }

  return context;
}

router.post('/chat', async (req, res) => {
  try {
    const { message, board_id, history } = req.body;
    const cleanMessage = typeof message === 'string' ? message.trim() : '';

    if (!cleanMessage) {
      return res.status(400).json({ error: 'Missing chat message' });
    }

    if (board_id) {
      const role = await requireBoardRole(req, res, board_id, ['MEMBER', 'ADMIN', 'OWNER']);
      if (!role) return;
    }

    const context = await buildWorkspaceContext(req.user.id, board_id);
    const result = await generateChatActionProposal({
      message: cleanMessage,
      context,
      history: Array.isArray(history) ? history : [],
    });

    res.status(200).json(result);
  } catch (error) {
    console.error('POST /api/ai/chat failed:', error);
    res.status(error.statusCode || 500).json({
      error:
        error.statusCode === 503
          ? 'Gemini API key is not configured'
          : 'Server error while chatting with AI',
    });
  }
});

function normalizeDate(value) {
  if (!value || typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function cleanActionTitle(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, 255);
}

async function applyCreateTaskAction(action, userId, req, res) {
  const payload = action.payload || {};
  const title = cleanActionTitle(payload.title);

  if (!title || !payload.board_id || !payload.column_id) {
    return { ok: false, type: action.type, error: 'Missing task title, board, or column' };
  }

  const column = await prisma.columns.findFirst({
    where: {
      id: payload.column_id,
      board_id: payload.board_id,
      boards: {
        archived_at: null,
      },
    },
    select: {
      id: true,
      board_id: true,
      title: true,
    },
  });

  if (!column) {
    return { ok: false, type: action.type, error: 'Target column was not found' };
  }

  const role = await requireBoardRole(req, res, column.board_id, ['MEMBER', 'ADMIN', 'OWNER']);
  if (!role) return null;

  const lastTask = await prisma.tasks.findFirst({
    where: {
      column_id: column.id,
      archived_at: null,
    },
    orderBy: { order: 'desc' },
  });
  const newOrder = lastTask ? lastTask.order + 1000 : 1000;
  const taskType = ['TASK', 'BUG', 'STORY', 'EPIC'].includes(payload.task_type)
    ? payload.task_type
    : 'TASK';
  const priority = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(payload.priority)
    ? payload.priority
    : 'MEDIUM';

  const task = await prisma.tasks.create({
    data: {
      column_id: column.id,
      title,
      description: cleanText(payload.description),
      task_type: taskType,
      priority,
      due_date: normalizeDate(payload.due_date),
      order: newOrder,
    },
    include: {
      users: {
        select: {
          id: true,
          email: true,
          name: true,
          avatar_url: true,
        },
      },
      sub_tasks: {
        orderBy: { order: 'asc' },
      },
    },
  });

  await logBoardActivity(column.board_id, `AI created task ${task.title}`, userId);

  return {
    ok: true,
    type: action.type,
    message: `Created task ${task.title}`,
    data: task,
  };
}

async function applyCreateSubtasksAction(action, userId, req, res) {
  const payload = action.payload || {};
  const titles = Array.isArray(payload.titles)
    ? payload.titles.map(cleanActionTitle).filter(Boolean).slice(0, 8)
    : [];

  if (!payload.task_id || !titles.length) {
    return { ok: false, type: action.type, error: 'Missing task or checklist item titles' };
  }

  const task = await prisma.tasks.findFirst({
    where: {
      id: payload.task_id,
      archived_at: null,
      columns: {
        boards: {
          archived_at: null,
        },
      },
    },
    include: {
      sub_tasks: {
        orderBy: { order: 'asc' },
      },
      columns: {
        select: {
          board_id: true,
        },
      },
    },
  });

  if (!task) {
    return { ok: false, type: action.type, error: 'Target task was not found' };
  }

  const role = await requireBoardRole(req, res, task.columns.board_id, ['MEMBER', 'ADMIN', 'OWNER']);
  if (!role) return null;

  const existingTitles = new Set(
    (task.sub_tasks || []).map((item) => item.title.trim().toLowerCase())
  );
  const uniqueTitles = [];

  for (const title of titles) {
    const key = title.toLowerCase();
    if (!existingTitles.has(key) && !uniqueTitles.some((item) => item.toLowerCase() === key)) {
      uniqueTitles.push(title);
    }
  }

  if (!uniqueTitles.length) {
    return { ok: false, type: action.type, error: 'Checklist items already exist' };
  }

  const lastOrder = (task.sub_tasks || []).reduce(
    (maxOrder, item) => Math.max(maxOrder, Number(item.order || 0)),
    0
  );
  const createdSubTasks = await prisma.$transaction(
    uniqueTitles.map((title, index) =>
      prisma.sub_tasks.create({
        data: {
          task_id: task.id,
          title,
          order: lastOrder + (index + 1) * 1000,
        },
      })
    )
  );

  await logBoardActivity(
    task.columns.board_id,
    `AI created ${createdSubTasks.length} checklist items for ${task.title}`,
    userId
  );

  return {
    ok: true,
    type: action.type,
    message: `Created ${createdSubTasks.length} checklist items for ${task.title}`,
    data: createdSubTasks,
  };
}

router.post('/actions/apply', async (req, res) => {
  try {
    const actions = Array.isArray(req.body.actions) ? req.body.actions.slice(0, 10) : [];

    if (!actions.length) {
      return res.status(400).json({ error: 'Missing AI actions' });
    }

    const results = [];

    for (const action of actions) {
      if (action?.type === 'CREATE_TASK') {
        const result = await applyCreateTaskAction(action, req.user.id, req, res);
        if (result === null) return;
        results.push(result);
        continue;
      }

      if (action?.type === 'CREATE_SUBTASKS') {
        const result = await applyCreateSubtasksAction(action, req.user.id, req, res);
        if (result === null) return;
        results.push(result);
        continue;
      }

      results.push({
        ok: false,
        type: action?.type || 'UNKNOWN',
        error: 'Unsupported AI action',
      });
    }

    res.status(200).json({ results });
  } catch (error) {
    console.error('POST /api/ai/actions/apply failed:', error);
    res.status(500).json({ error: 'Server error while applying AI actions' });
  }
});

router.post('/tasks/:taskId/subtasks', async (req, res) => {
  try {
    const { taskId } = req.params;

    const task = await prisma.tasks.findFirst({
      where: {
        id: taskId,
        archived_at: null,
        columns: {
          boards: {
            archived_at: null,
          },
        },
      },
      include: {
        sub_tasks: {
          orderBy: { order: 'asc' },
        },
        columns: {
          select: {
            board_id: true,
          },
        },
      },
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const role = await requireBoardRole(req, res, task.columns.board_id, ['MEMBER', 'ADMIN', 'OWNER']);
    if (!role) return;

    const titles = await generateSubTaskTitles({
      task,
      existingSubTasks: task.sub_tasks || [],
    });

    if (!titles.length) {
      return res.status(422).json({ error: 'AI did not generate any new checklist items' });
    }

    const lastOrder = (task.sub_tasks || []).reduce(
      (maxOrder, item) => Math.max(maxOrder, Number(item.order || 0)),
      0
    );

    const createdSubTasks = await prisma.$transaction(
      titles.map((title, index) =>
        prisma.sub_tasks.create({
          data: {
            task_id: taskId,
            title,
            order: lastOrder + (index + 1) * 1000,
          },
        })
      )
    );

    await logBoardActivity(
      task.columns.board_id,
      `Generated ${createdSubTasks.length} AI checklist items for ${task.title}`,
      req.user.id
    );

    res.status(201).json(createdSubTasks);
  } catch (error) {
    console.error('POST /api/ai/tasks/:taskId/subtasks failed:', error);
    res.status(error.statusCode || 500).json({
      error:
        error.statusCode === 503
          ? 'Gemini API key is not configured'
          : 'Server error while generating AI checklist items',
    });
  }
});

module.exports = router;
