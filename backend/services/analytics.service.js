const priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const taskTypes = ['TASK', 'BUG', 'STORY', 'EPIC'];

function isDoneColumn(title = '') {
  return ['DONE', 'COMPLETE', 'COMPLETED', 'FINISHED'].includes(title.trim().toUpperCase());
}

function getDueState(dueDate) {
  if (!dueDate) return 'NO_DUE';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  const daysUntilDue = Math.ceil((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

  if (daysUntilDue < 0) return 'OVERDUE';
  if (daysUntilDue <= 3) return 'DUE_SOON';
  return 'SCHEDULED';
}

function getPercent(count, total) {
  return total ? Math.round((count / total) * 100) : 0;
}

function createCountMap(items) {
  return items.reduce((result, item) => {
    result[item] = 0;
    return result;
  }, {});
}

function buildBoardAnalytics(board) {
  const columns = board.columns || [];
  const members = board.board_members || [];
  const tasks = columns.flatMap((column) =>
    (column.tasks || []).map((task) => ({
      ...task,
      column_title: column.title,
      is_done: isDoneColumn(column.title),
    }))
  );

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((task) => task.is_done).length;
  const openTasks = Math.max(totalTasks - doneTasks, 0);
  const overdueTasks = tasks.filter((task) => getDueState(task.due_date) === 'OVERDUE').length;
  const dueSoonTasks = tasks.filter((task) => getDueState(task.due_date) === 'DUE_SOON').length;
  const noDueTasks = tasks.filter((task) => getDueState(task.due_date) === 'NO_DUE').length;
  const scheduledTasks = tasks.filter((task) => getDueState(task.due_date) === 'SCHEDULED').length;
  const urgentTasks = tasks.filter((task) => task.priority === 'URGENT').length;
  const highPriorityTasks = tasks.filter(
    (task) => task.priority === 'HIGH' || task.priority === 'URGENT'
  ).length;
  const unassignedTasks = tasks.filter((task) => !task.assignee_id).length;
  const totalChecklistItems = tasks.reduce(
    (total, task) => total + (task.sub_tasks?.length || 0),
    0
  );
  const completedChecklistItems = tasks.reduce(
    (total, task) =>
      total + (task.sub_tasks || []).filter((subTask) => subTask.is_completed).length,
    0
  );

  const priorityCounts = createCountMap(priorities);
  const typeCounts = createCountMap(taskTypes);
  tasks.forEach((task) => {
    priorityCounts[task.priority || 'MEDIUM'] = (priorityCounts[task.priority || 'MEDIUM'] || 0) + 1;
    typeCounts[task.task_type || 'TASK'] = (typeCounts[task.task_type || 'TASK'] || 0) + 1;
  });

  const memberWorkload = members
    .map((member) => {
      const assignedTasks = tasks.filter((task) => task.assignee_id === member.user_id);

      return {
        user_id: member.user_id,
        name: member.users?.name || 'Unknown user',
        email: member.users?.email || null,
        board_role: member.role || 'MEMBER',
        project_role: member.project_role || member.role || 'MEMBER',
        task_count: assignedTasks.length,
        open_count: assignedTasks.filter((task) => !task.is_done).length,
        done_count: assignedTasks.filter((task) => task.is_done).length,
        urgent_count: assignedTasks.filter((task) => task.priority === 'URGENT').length,
        overdue_count: assignedTasks.filter((task) => getDueState(task.due_date) === 'OVERDUE').length,
        workload_percent: getPercent(assignedTasks.length, totalTasks),
      };
    })
    .sort((a, b) => b.task_count - a.task_count);

  const healthStatus =
    overdueTasks > 0 ? 'NEEDS_ATTENTION' : urgentTasks > 0 ? 'HIGH_PRIORITY' : 'ON_TRACK';

  return {
    generated_at: new Date().toISOString(),
    board: {
      id: board.id,
      title: board.title,
      description: board.description,
    },
    summary: {
      columns: columns.length,
      total_tasks: totalTasks,
      open_tasks: openTasks,
      done_tasks: doneTasks,
      completion_rate: getPercent(doneTasks, totalTasks),
      high_priority_tasks: highPriorityTasks,
      urgent_tasks: urgentTasks,
      overdue_tasks: overdueTasks,
      due_soon_tasks: dueSoonTasks,
      unassigned_tasks: unassignedTasks,
      total_checklist_items: totalChecklistItems,
      completed_checklist_items: completedChecklistItems,
      checklist_completion_rate: getPercent(completedChecklistItems, totalChecklistItems),
      health_status: healthStatus,
      health_label:
        healthStatus === 'NEEDS_ATTENTION'
          ? 'Needs attention'
          : healthStatus === 'HIGH_PRIORITY'
            ? 'High priority'
            : 'On track',
    },
    due: {
      overdue: overdueTasks,
      due_soon: dueSoonTasks,
      scheduled: scheduledTasks,
      no_due: noDueTasks,
    },
    columns: columns.map((column) => ({
      id: column.id,
      title: column.title,
      task_count: column.tasks?.length || 0,
      percent: getPercent(column.tasks?.length || 0, totalTasks),
      is_done: isDoneColumn(column.title),
    })),
    priorities: priorities.map((priority) => ({
      label: priority,
      count: priorityCounts[priority] || 0,
      percent: getPercent(priorityCounts[priority] || 0, totalTasks),
    })),
    task_types: taskTypes.map((taskType) => ({
      label: taskType,
      count: typeCounts[taskType] || 0,
      percent: getPercent(typeCounts[taskType] || 0, totalTasks),
    })),
    member_workload: memberWorkload,
  };
}

function buildWorkspaceAnalytics(boards) {
  const boardAnalytics = boards.map(buildBoardAnalytics);
  const totals = boardAnalytics.reduce(
    (result, item) => {
      result.columns += item.summary.columns;
      result.total_tasks += item.summary.total_tasks;
      result.open_tasks += item.summary.open_tasks;
      result.done_tasks += item.summary.done_tasks;
      result.urgent_tasks += item.summary.urgent_tasks;
      result.overdue_tasks += item.summary.overdue_tasks;
      result.due_soon_tasks += item.summary.due_soon_tasks;
      result.unassigned_tasks += item.summary.unassigned_tasks;
      result.total_checklist_items += item.summary.total_checklist_items;
      result.completed_checklist_items += item.summary.completed_checklist_items;
      return result;
    },
    {
      columns: 0,
      total_tasks: 0,
      open_tasks: 0,
      done_tasks: 0,
      urgent_tasks: 0,
      overdue_tasks: 0,
      due_soon_tasks: 0,
      unassigned_tasks: 0,
      total_checklist_items: 0,
      completed_checklist_items: 0,
    }
  );

  return {
    generated_at: new Date().toISOString(),
    summary: {
      boards: boards.length,
      ...totals,
      completion_rate: getPercent(totals.done_tasks, totals.total_tasks),
      checklist_completion_rate: getPercent(
        totals.completed_checklist_items,
        totals.total_checklist_items
      ),
    },
    boards: boardAnalytics.map((item) => ({
      id: item.board.id,
      title: item.board.title,
      health_status: item.summary.health_status,
      health_label: item.summary.health_label,
      total_tasks: item.summary.total_tasks,
      open_tasks: item.summary.open_tasks,
      done_tasks: item.summary.done_tasks,
      overdue_tasks: item.summary.overdue_tasks,
      urgent_tasks: item.summary.urgent_tasks,
      completion_rate: item.summary.completion_rate,
    })),
  };
}

module.exports = {
  buildBoardAnalytics,
  buildWorkspaceAnalytics,
};
