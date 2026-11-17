-- CreateTable
CREATE TABLE "lesson_attachments" (
    "id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "title_tr" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    CONSTRAINT "lesson_attachments_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "lesson_attachments_lesson_id_position_key" ON "lesson_attachments"("lesson_id", "position");
-- AddForeignKey
ALTER TABLE "lesson_attachments" ADD CONSTRAINT "lesson_attachments_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
