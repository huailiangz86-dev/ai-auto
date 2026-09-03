import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm'

export class AddNotifications1788000000000 implements MigrationInterface {
  name = 'AddNotifications1788000000000'

  async up(queryRunner: QueryRunner): Promise<void> {
    // The initial schema migration now creates the notification table and
    // audit enum. Keep this migration for already deployed databases while
    // avoiding duplicate type/table creation on a fresh install.
    if (await queryRunner.hasTable('notifications')) {
      return
    }

    await queryRunner.query(
      "ALTER TYPE audit_logs_action_type_enum ADD VALUE IF NOT EXISTS 'content_moderated'",
    )
    await queryRunner.query(
      "ALTER TYPE audit_logs_action_type_enum ADD VALUE IF NOT EXISTS 'fraud_resolved'",
    )
    await queryRunner.query(
      "CREATE TYPE notifications_recipient_role_enum AS ENUM ('merchant_admin', 'merchant_staff', 'agent', 'customer', 'admin', 'super_admin')",
    )
    await queryRunner.createTable(
      new Table({
        name: 'notifications',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'uuid_generate_v4()' },
          { name: 'createdAt', type: 'timestamptz', default: 'now()' },
          { name: 'updatedAt', type: 'timestamptz', default: 'now()' },
          { name: 'deletedAt', type: 'timestamptz', isNullable: true },
          { name: 'recipient_id', type: 'uuid' },
          { name: 'recipient_role', type: 'notifications_recipient_role_enum' },
          { name: 'type', type: 'varchar', length: '40' },
          { name: 'title', type: 'varchar', length: '160' },
          { name: 'body', type: 'text' },
          { name: 'target_type', type: 'varchar', length: '40', isNullable: true },
          { name: 'target_id', type: 'uuid', isNullable: true },
          { name: 'metadata', type: 'jsonb', isNullable: true },
          { name: 'read_at', type: 'timestamptz', isNullable: true },
        ],
      }),
    )
    await queryRunner.createIndex(
      'notifications',
      new TableIndex({
        name: 'idx_notification_recipient_created',
        columnNames: ['recipient_id', 'recipient_role', 'createdAt'],
      }),
    )
    await queryRunner.createIndex(
      'notifications',
      new TableIndex({
        name: 'idx_notification_recipient_unread',
        columnNames: ['recipient_id', 'recipient_role', 'read_at'],
      }),
    )
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('notifications')
    await queryRunner.query('DROP TYPE notifications_recipient_role_enum')
  }
}
