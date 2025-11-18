import { crawlerWorker } from './crawler';
import { logger } from './services/logger';

async function main() {
  logger.info('Starting crawler worker');

  // Get job ID from command line args or environment
  const jobId = process.argv[2] || process.env.JOB_ID;

  if (!jobId) {
    logger.error('No job ID provided. Usage: npm start <job-id>');
    process.exit(1);
  }

  try {
    await crawlerWorker.processJob(jobId);
    logger.info('Job processing completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Job processing failed', { error });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await crawlerWorker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await crawlerWorker.close();
  process.exit(0);
});

main().catch((error) => {
  logger.error('Fatal error', { error });
  process.exit(1);
});
