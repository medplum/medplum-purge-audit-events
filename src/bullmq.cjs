const { loadConfig } = require('./config.cjs');
const { Queue } = require('bullmq');

const batchSize = 100000;
const iterations = 10;

async function main(args) {
  const configName = args.length > 0 ? args[0] : 'file:medplum.config.json';
  const config = await loadConfig(configName);

  // This must align with how Medplum Server sets up the Subscription Queue.
  // See: https://github.com/medplum/medplum/blob/main/packages/server/src/workers/subscription.ts
  const queue = new Queue('SubscriptionQueue', { connection: config.redis });

  // Get counts by job status
  // See: https://api.docs.bullmq.io/classes/v4.Queue.html#getJobCountByTypes
  const statuses = ['completed', 'failed', 'delayed', 'active', 'waiting'];
  for (const status of statuses) {
    const count = await queue.getJobCountByTypes(status);
    console.log(status, count);
  }

  for (let i = 0; i < iterations; i++) {
    // Delete a batch of completed jobs
    // See: https://docs.bullmq.io/guide/queues/removing-jobs#clean
    const deletedJobIds = await queue.clean(
      60000, // 1 minute
      batchSize // max number of jobs to clean
    );
    console.log('Deleted count', deletedJobIds.length);
  }

  await queue.close();
}

main(process.argv.slice(2)).catch((error) => {
  console.error(error);
  process.exit(1);
});
