-- Add one protected Task Intake column to every board.
-- Tasks remain attached to a valid column while Intake is hidden from the desk floor.

ALTER TABLE "columns"
ADD COLUMN "is_intake" BOOLEAN NOT NULL DEFAULT false;

INSERT INTO "columns" (
    "board_id",
    "title",
    "order",
    "is_intake",
    "created_at",
    "updated_at"
)
SELECT
    "boards"."id",
    'Task Intake',
    -1000000,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "boards"
WHERE NOT EXISTS (
    SELECT 1
    FROM "columns"
    WHERE "columns"."board_id" = "boards"."id"
      AND "columns"."is_intake" = true
);

CREATE INDEX "idx_columns_board_intake"
ON "columns"("board_id", "is_intake");

CREATE UNIQUE INDEX "idx_columns_single_intake"
ON "columns"("board_id")
WHERE "is_intake" = true;
