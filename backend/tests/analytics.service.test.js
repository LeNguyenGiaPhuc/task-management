const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildBoardAnalytics,
  buildWorkspaceAnalytics,
} = require('../services/analytics.service');

function createTask(id, overrides = {}) {
  return {
    id,
    priority: 'MEDIUM',
    task_type: 'TASK',
    assignee_id: null,
    due_date: null,
    sub_tasks: [],
    ...overrides,
  };
}

function createBoard() {
  return {
    id: 'board-1',
    title: 'MartinDesk workspace',
    description: 'Analytics fixture',
    board_members: [],
    columns: [
      {
        id: 'intake',
        title: 'Task Intake',
        is_intake: true,
        tasks: [createTask('task-intake')],
      },
      {
        id: 'todo',
        title: 'To Do',
        is_intake: false,
        tasks: [createTask('task-todo', { priority: 'HIGH' })],
      },
      {
        id: 'done',
        title: 'Done',
        is_intake: false,
        tasks: [createTask('task-done')],
      },
    ],
  };
}

test('board analytics counts Intake tasks without exposing Intake as a desk', () => {
  const analytics = buildBoardAnalytics(createBoard());

  assert.equal(analytics.summary.columns, 2);
  assert.equal(analytics.summary.intake_tasks, 1);
  assert.equal(analytics.summary.total_tasks, 3);
  assert.equal(analytics.summary.done_tasks, 1);
  assert.equal(analytics.summary.open_tasks, 2);
  assert.deepEqual(
    analytics.columns.map((column) => column.id),
    ['todo', 'done']
  );
});

test('workspace analytics aggregates Intake tasks', () => {
  const analytics = buildWorkspaceAnalytics([createBoard()]);

  assert.equal(analytics.summary.boards, 1);
  assert.equal(analytics.summary.columns, 2);
  assert.equal(analytics.summary.intake_tasks, 1);
  assert.equal(analytics.summary.total_tasks, 3);
});
