function getDestinationOrder(tasks, index) {
  if (tasks.length <= 1) return 1000;

  if (index === 0) {
    return tasks[1].order / 2;
  }

  if (index === tasks.length - 1) {
    return tasks[index - 1].order + 1000;
  }

  return (tasks[index - 1].order + tasks[index + 1].order) / 2;
}

export function moveTaskInLists({
  sourceTasks,
  destinationTasks,
  sourceIndex,
  destinationIndex,
  destinationColumnId,
  sameLocation,
}) {
  if (sourceIndex < 0 || sourceIndex >= sourceTasks.length) return null;

  const nextSourceTasks = Array.from(sourceTasks);
  const [sourceTask] = nextSourceTasks.splice(sourceIndex, 1);
  const nextDestinationTasks = sameLocation
    ? nextSourceTasks
    : Array.from(destinationTasks);
  const safeDestinationIndex = Math.min(
    Math.max(destinationIndex, 0),
    nextDestinationTasks.length
  );

  const movedTask = {
    ...sourceTask,
    column_id: destinationColumnId,
  };

  nextDestinationTasks.splice(safeDestinationIndex, 0, movedTask);
  const newOrder = getDestinationOrder(nextDestinationTasks, safeDestinationIndex);
  const orderedMovedTask = {
    ...movedTask,
    order: newOrder,
  };
  nextDestinationTasks[safeDestinationIndex] = orderedMovedTask;

  return {
    sourceTasks: sameLocation ? nextDestinationTasks : nextSourceTasks,
    destinationTasks: nextDestinationTasks,
    movedTask: orderedMovedTask,
    destinationIndex: safeDestinationIndex,
    newOrder,
  };
}
