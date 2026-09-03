import { MigrationInterface, QueryRunner } from 'typeorm'

export class NormalizeMerchantCustomerLockForeignKey1788183457447 implements MigrationInterface {
  name = 'NormalizeMerchantCustomerLockForeignKey1788183457447'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "merchant_customer_locks" DROP CONSTRAINT IF EXISTS "fk_mcl_customer"',
    )
    await queryRunner.query(
      'ALTER TABLE "merchant_customer_locks" DROP CONSTRAINT IF EXISTS "FK_ccefd20cc50c904413848ccdfa9"',
    )
    await queryRunner.query(
      'ALTER TABLE "merchant_customer_locks" ADD CONSTRAINT "FK_ccefd20cc50c904413848ccdfa9" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION',
    )
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "merchant_customer_locks" DROP CONSTRAINT IF EXISTS "FK_ccefd20cc50c904413848ccdfa9"',
    )
    await queryRunner.query(
      'ALTER TABLE "merchant_customer_locks" ADD CONSTRAINT "fk_mcl_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION',
    )
  }
}
