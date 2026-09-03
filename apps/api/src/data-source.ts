import 'reflect-metadata'
import { DataSource } from 'typeorm'
import configuration from './config/configuration'

const config = configuration()

export default new DataSource({
  type: 'postgres',
  host: config.database.host,
  port: config.database.port,
  username: config.database.username,
  password: config.database.password,
  database: config.database.name,
  schema: config.database.schema,
  // Keep the CLI schema metadata aligned with the application so
  // `migration:generate` can reliably detect model changes. Migration *runs*
  // still use QueryRunner and do not create tables from these entities.
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
})
