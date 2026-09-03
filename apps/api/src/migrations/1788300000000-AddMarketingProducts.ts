import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddMarketingProducts1788300000000 implements MigrationInterface {
  name = 'AddMarketingProducts1788300000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "marketing_products" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "merchant_id" uuid NOT NULL, "product_name" character varying(200) NOT NULL, "category" character varying(100), "description" text, "product_source" character varying(20) NOT NULL DEFAULT 'managed', "external_product_id" character varying(100), "status" character varying(20) NOT NULL DEFAULT 'draft', CONSTRAINT "PK_marketing_products" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_marketing_product_merchant_status" ON "marketing_products" ("merchant_id", "status")`,
    )
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_marketing_product_merchant_external" ON "marketing_products" ("merchant_id", "external_product_id") WHERE external_product_id IS NOT NULL`,
    )
    await queryRunner.query(
      `ALTER TABLE "marketing_products" ADD CONSTRAINT "FK_marketing_product_merchant" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )

    await queryRunner.query(
      `CREATE TABLE "marketing_product_skus" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "product_id" uuid NOT NULL, "sku_name" character varying(200) NOT NULL, "sku_code" character varying(100) NOT NULL, "attributes" jsonb NOT NULL DEFAULT '{}'::jsonb, "price" numeric(12,2) NOT NULL, "market_price" numeric(12,2), "stock" integer, "status" character varying(20) NOT NULL DEFAULT 'on_sale', CONSTRAINT "PK_marketing_product_skus" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_marketing_sku_product" ON "marketing_product_skus" ("product_id")`,
    )
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_marketing_sku_product_code" ON "marketing_product_skus" ("product_id", "sku_code")`,
    )
    await queryRunner.query(
      `ALTER TABLE "marketing_product_skus" ADD CONSTRAINT "FK_marketing_sku_product" FOREIGN KEY ("product_id") REFERENCES "marketing_products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_mapping_merchant_product"`)
    await queryRunner.query(
      `ALTER TABLE "coupon_product_mappings" ADD COLUMN "type" character varying(20) NOT NULL DEFAULT 'legacy_external'`,
    )
    await queryRunner.query(`ALTER TABLE "coupon_product_mappings" ADD COLUMN "product_id" uuid`)
    await queryRunner.query(`ALTER TABLE "coupon_product_mappings" ADD COLUMN "sku_id" uuid`)
    await queryRunner.query(
      `ALTER TABLE "coupon_product_mappings" ALTER COLUMN "external_product_id" DROP NOT NULL`,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_mapping_catalogue_product" ON "coupon_product_mappings" ("product_id")`,
    )
    await queryRunner.query(
      `ALTER TABLE "coupon_product_mappings" ADD CONSTRAINT "FK_mapping_catalogue_product" FOREIGN KEY ("product_id") REFERENCES "marketing_products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "coupon_product_mappings" ADD CONSTRAINT "FK_mapping_catalogue_sku" FOREIGN KEY ("sku_id") REFERENCES "marketing_product_skus"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "coupon_product_mappings" DROP CONSTRAINT "FK_mapping_catalogue_sku"`,
    )
    await queryRunner.query(
      `ALTER TABLE "coupon_product_mappings" DROP CONSTRAINT "FK_mapping_catalogue_product"`,
    )
    await queryRunner.query(`DROP INDEX "idx_mapping_catalogue_product"`)
    await queryRunner.query(`DELETE FROM "coupon_product_mappings" WHERE "type" = 'catalogue'`)
    await queryRunner.query(
      `ALTER TABLE "coupon_product_mappings" ALTER COLUMN "external_product_id" SET NOT NULL`,
    )
    await queryRunner.query(`ALTER TABLE "coupon_product_mappings" DROP COLUMN "sku_id"`)
    await queryRunner.query(`ALTER TABLE "coupon_product_mappings" DROP COLUMN "product_id"`)
    await queryRunner.query(`ALTER TABLE "coupon_product_mappings" DROP COLUMN "type"`)
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_mapping_merchant_product" ON "coupon_product_mappings" ("merchant_id", "external_product_id")`,
    )

    await queryRunner.query(
      `ALTER TABLE "marketing_product_skus" DROP CONSTRAINT "FK_marketing_sku_product"`,
    )
    await queryRunner.query(`DROP INDEX "idx_marketing_sku_product_code"`)
    await queryRunner.query(`DROP INDEX "idx_marketing_sku_product"`)
    await queryRunner.query(`DROP TABLE "marketing_product_skus"`)
    await queryRunner.query(
      `ALTER TABLE "marketing_products" DROP CONSTRAINT "FK_marketing_product_merchant"`,
    )
    await queryRunner.query(`DROP INDEX "idx_marketing_product_merchant_external"`)
    await queryRunner.query(`DROP INDEX "idx_marketing_product_merchant_status"`)
    await queryRunner.query(`DROP TABLE "marketing_products"`)
  }
}
