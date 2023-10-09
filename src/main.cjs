const ioredis = require('ioredis');
const pg = require('pg');
const { loadConfig } = require('./config.cjs');

const batchSize = 100;
const iterations = 10;

async function main(args) {
  const configName = args.length > 0 ? args[0] : 'file:medplum.config.json';

  const config = await loadConfig(configName);

  const db = new pg.Pool({
    host: config.database.host,
    port: config.database.port,
    database: config.database.dbname,
    user: config.database.username,
    password: config.database.password,
  });

  const redis = new ioredis.Redis(config.redis);

  for (let i = 0; i < iterations; i++) {
    // Get a batch of IDs from Postgres
    const result = await db.query(`
      SELECT "id"
      FROM "AuditEvent"
      WHERE "lastUpdated" < NOW() - INTERVAL '30 day'
      ORDER BY "lastUpdated"
      LIMIT ${batchSize}
    `);

    const ids = result.rows.map((row) => row.id);
    if (ids.length === 0) {
      break;
    }

    // Delete the batch of IDs from Postgres
    await db.query(`DELETE FROM "AuditEvent" WHERE "id" = ANY($1)`, [ids]);
    await db.query(`DELETE FROM "AuditEvent_History" WHERE "id" = ANY($1)`, [ids]);

    // Delete the batch of IDs from Redis
    await redis.del(...ids.map((id) => 'AuditEvent/' + id));
  }

  await db.end();
  redis.disconnect();
  console.log('Done');
}

main(process.argv.slice(2)).catch((error) => {
  console.error(error);
  process.exit(1);
});
