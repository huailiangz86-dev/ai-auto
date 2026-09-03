import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddConsumerEvidenceConsent1789400000000 implements MigrationInterface {
  name = 'AddConsumerEvidenceConsent1789400000000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "customer_coupons" ADD COLUMN "tracking_consent" boolean NOT NULL DEFAULT false`)
    await queryRunner.query(`ALTER TABLE "customer_coupons" ADD COLUMN "tracking_consent_version" character varying(32)`)
    await queryRunner.query(`ALTER TABLE "customer_coupons" ADD COLUMN "tracking_consented_at" TIMESTAMP WITH TIME ZONE`)
    await queryRunner.query(`ALTER TABLE "customer_coupons" ADD COLUMN "tracking_consent_revoked_at" TIMESTAMP WITH TIME ZONE`)
    await queryRunner.query(`CREATE INDEX "idx_customer_coupon_tracking_consent" ON "customer_coupons" ("tracking_consent", "tracking_consented_at")`)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_customer_coupon_tracking_consent"`)
    await queryRunner.query(`ALTER TABLE "customer_coupons" DROP COLUMN "tracking_consent_revoked_at"`)
    await queryRunner.query(`ALTER TABLE "customer_coupons" DROP COLUMN "tracking_consented_at"`)
    await queryRunner.query(`ALTER TABLE "customer_coupons" DROP COLUMN "tracking_consent_version"`)
    await queryRunner.query(`ALTER TABLE "customer_coupons" DROP COLUMN "tracking_consent"`)
  }
}