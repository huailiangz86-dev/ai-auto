import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddCreatorStudioContentLink1788700000000 implements MigrationInterface {
  name = 'AddCreatorStudioContentLink1788700000000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "contents" ADD COLUMN "creator_task_id" uuid`)
    await queryRunner.query(
      `CREATE INDEX "idx_content_creator_task" ON "contents" ("creator_task_id")`,
    )
    await queryRunner.query(
      `ALTER TABLE "contents" ADD CONSTRAINT "FK_content_creator_task" FOREIGN KEY ("creator_task_id") REFERENCES "creator_tasks"("id")`,
    )
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "contents" DROP CONSTRAINT "FK_content_creator_task"`)
    await queryRunner.query(`DROP INDEX "idx_content_creator_task"`)
    await queryRunner.query(`ALTER TABLE "contents" DROP COLUMN "creator_task_id"`)
  }
}
