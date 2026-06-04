const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth, requireBoardRole } = require('../middleware/auth.middleware');
const { generateChatReply, generateSubTaskTitles } = require('../services/ai.service');
const { logBoardActivity } = require('../services/activity.service');

const router = express.Router();

router.use(requireAuth);

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
    }))
  );

  return {
    id: board.id,
    title: board.title,
    description: board.description || '',
    columns: columns.map((column) => ({
      id: column.id,
      title: column.title,
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
      column_count: board.columns.length,
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
    const reply = await generateChatReply({
      message: cleanMessage,
      context,
      history: Array.isArray(history) ? history : [],
    });

    res.status(200).json({ reply });
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
