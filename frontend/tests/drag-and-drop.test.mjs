import test from "node:test";
import assert from "node:assert/strict";
import { moveTaskInLists } from "../app/boards/[id]/drag-and-drop.mjs";

const task = (id, order, columnId) => ({
  id,
  order,
  column_id: columnId,
});

test("moves a task from Intake into the middle of a desk", () => {
  const result = moveTaskInLists({
    sourceTasks: [task("intake-1", 1000, "intake")],
    destinationTasks: [
      task("desk-1", 1000, "todo"),
      task("desk-2", 2000, "todo"),
    ],
    sourceIndex: 0,
    destinationIndex: 1,
    destinationColumnId: "todo",
    sameLocation: false,
  });

  assert.ok(result);
  assert.deepEqual(result.sourceTasks, []);
  assert.deepEqual(
    result.destinationTasks.map((item) => item.id),
    ["desk-1", "intake-1", "desk-2"]
  );
  assert.equal(result.movedTask.column_id, "todo");
  assert.equal(result.newOrder, 1500);
});

test("moves a desk task back into an empty Intake", () => {
  const result = moveTaskInLists({
    sourceTasks: [task("desk-1", 1000, "todo")],
    destinationTasks: [],
    sourceIndex: 0,
    destinationIndex: 0,
    destinationColumnId: "intake",
    sameLocation: false,
  });

  assert.ok(result);
  assert.equal(result.destinationTasks[0].column_id, "intake");
  assert.equal(result.newOrder, 1000);
});

test("reorders a task inside the same desk", () => {
  const tasks = [
    task("first", 1000, "todo"),
    task("second", 2000, "todo"),
    task("third", 3000, "todo"),
  ];
  const result = moveTaskInLists({
    sourceTasks: tasks,
    destinationTasks: tasks,
    sourceIndex: 0,
    destinationIndex: 2,
    destinationColumnId: "todo",
    sameLocation: true,
  });

  assert.ok(result);
  assert.deepEqual(
    result.destinationTasks.map((item) => item.id),
    ["second", "third", "first"]
  );
  assert.equal(result.newOrder, 4000);
});

test("rejects a stale source index instead of corrupting task state", () => {
  const result = moveTaskInLists({
    sourceTasks: [task("only", 1000, "todo")],
    destinationTasks: [],
    sourceIndex: 3,
    destinationIndex: 0,
    destinationColumnId: "intake",
    sameLocation: false,
  });

  assert.equal(result, null);
});
