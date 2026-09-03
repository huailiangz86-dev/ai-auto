import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm'

export class AddMerchantCrmTables1787919452312 implements MigrationInterface {
  name = 'AddMerchantCrmTables1787919452312'

  async up(queryRunner: QueryRunner): Promise<void> {
    // The initial schema migration now owns these tables. Retain this class
    // for databases that already recorded it, while making fresh installs
    // idempotent after the baseline has run.
    if (await queryRunner.hasTable('merchant_customer_locks')) {
      return
    }

    await queryRunner.createTable(
      new Table({
        name: 'merchant_customer_locks',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'uuid_generate_v4()' },
          { name: 'createdAt', type: 'timestamptz', default: 'now()' },
          { name: 'updatedAt', type: 'timestamptz', default: 'now()' },
          { name: 'deletedAt', type: 'timestamptz', isNullable: true },
          { name: 'merchant_id', type: 'uuid' },
          { name: 'customer_id', type: 'uuid' },
          { name: 'attribution_id', type: 'uuid', isNullable: true },
          { name: 'agent_id', type: 'uuid', isNullable: true },
          { name: 'source', type: 'varchar', length: '20' },
          { name: 'acquired_at', type: 'timestamptz' },
          { name: 'lock_expired_at', type: 'timestamptz' },
          { name: 'is_active', type: 'boolean', default: 'true' },
        ],
        foreignKeys: [
          {
            name: 'FK_ccefd20cc50c904413848ccdfa9',
            columnNames: ['customer_id'],
            referencedTableName: 'customers',
            referencedColumnNames: ['id'],
          },
        ],
      }),
    )
    await queryRunner.createIndex(
      'merchant_customer_locks',
      new TableIndex({
        name: 'idx_mcl_merchant_active_expiry',
        columnNames: ['merchant_id', 'is_active', 'lock_expired_at'],
      }),
    )
    await queryRunner.createIndex(
      'merchant_customer_locks',
      new TableIndex({ name: 'idx_mcl_customer', columnNames: ['customer_id'] }),
    )
    await queryRunner.createIndex(
      'merchant_customer_locks',
      new TableIndex({
        name: 'uq_mcl_merchant_customer',
        columnNames: ['merchant_id', 'customer_id'],
        isUnique: true,
      }),
    )

    await queryRunner.createTable(
      new Table({
        name: 'customer_data_export_requests',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'uuid_generate_v4()' },
          { name: 'createdAt', type: 'timestamptz', default: 'now()' },
          { name: 'updatedAt', type: 'timestamptz', default: 'now()' },
          { name: 'deletedAt', type: 'timestamptz', isNullable: true },
          { name: 'customer_id', type: 'uuid' },
          { name: 'format', type: 'varchar', length: '20', default: "'json'" },
          { name: 'status', type: 'varchar', length: '20', default: "'completed'" },
          { name: 'completed_at', type: 'timestamptz', isNullable: true },
        ],
      }),
    )
    await queryRunner.createIndex(
      'customer_data_export_requests',
      new TableIndex({
        name: 'idx_customer_export_request_customer_created',
        columnNames: ['customer_id', 'createdAt'],
      }),
    )
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('customer_data_export_requests')
    await queryRunner.dropTable('merchant_customer_locks')
  }
}
