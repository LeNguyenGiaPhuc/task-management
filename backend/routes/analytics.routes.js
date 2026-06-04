const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth, requireBoardRole } = require('../middleware/auth.middleware');
const {
  buildBoardAnalytics,
  buildWorkspaceAnalytics,
} = require('../services/analytics.service');

const router = express.Router();

router.use(requireAuth);

const analyticsBoardInclude = {
  board_members: {
    orderBy: { joined_at: 'asc' },
    include: {
      users: {
        select: {
          id: true,
          email: true,
          name: true,
          avatar_url: true,
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
        include: {
          sub_tasks: {
            orderBy: { order: 'asc' },
          },
        },
      },
    },
  },
};

router.get('/workspace', async (req, res) => {
  try {
    const boards = await prisma.boards.findMany({
      where: {
        archived_at: null,
        board_members: {
          some: {
            user_id: req.user.id,
          },
        },
      },
      orderBy: { updated_at: 'desc' },
      include: analyticsBoardInclude,
    });

    res.status(200).json(buildWorkspaceAnalytics(boards));
  } catch (error) {
    console.error('GET /api/analytics/workspace failed:', error);
    res.status(500).json({ error: 'Server error while loading workspace analytics' });
  }
});

router.get('/boards/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const role = await requireBoardRole(req, res, id, ['MEMBER', 'ADMIN', 'OWNER']);
    if (!role) return;

    const board = await prisma.boards.findFirst({
      where: {
        id,
        archived_at: null,
      },
      include: analyticsBoardInclude,
    });

    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    res.status(200).json(buildBoardAnalytics(board));
  } catch (error) {
    console.error('GET /api/analytics/boards/:id failed:', error);
    res.status(500).json({ error: 'Server error while loading board analytics' });
  }
});

module.exports = router;
