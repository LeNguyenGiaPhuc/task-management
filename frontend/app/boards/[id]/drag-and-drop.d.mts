export type OrderedTask = {
  id: string;
  column_id?: string;
  order: number;
};

export type TaskMoveResult<T extends OrderedTask> = {
  sourceTasks: T[];
  destinationTasks: T[];
  movedTask: T;
  destinationIndex: number;
  newOrder: number;
};

export function moveTaskInLists<T extends OrderedTask>(options: {
  sourceTasks: T[];
  destinationTasks: T[];
  sourceIndex: number;
  destinationIndex: number;
  destinationColumnId: string;
  sameLocation: boolean;
}): TaskMoveResult<T> | null;
