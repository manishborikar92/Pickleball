const BOOT_DELAY_MS_DEFAULT = 5000;

export function createScheduler({ jobs, intervalMs, disabled, logger, bootDelayMs = BOOT_DELAY_MS_DEFAULT }) {
  let timer = null;
  let activeExecution = null;
  let running = false;
  let cycleCount = 0;
  let lastCycleAt = null;
  let lastCycleDurationMs = null;

  async function executeCycle() {
    cycleCount++;
    const cycleId = cycleCount;
    const cycleStart = Date.now();

    logger.info('Cycle started', { operation: 'scheduler:cycle:start', cycleId });

    for (const job of jobs) {
      const jobStart = Date.now();
      logger.info('Job started', { operation: 'scheduler:job:start', jobName: job.name, cycleId });

      try {
        const result = await job.execute();
        logger.info('Job completed', {
          operation: 'scheduler:job:complete',
          jobName: job.name,
          cycleId,
          durationMs: Date.now() - jobStart,
          result,
        });
      } catch (error) {
        logger.error('Job failed', {
          operation: 'scheduler:job:error',
          jobName: job.name,
          cycleId,
          durationMs: Date.now() - jobStart,
          error,
        });
      }
    }

    lastCycleAt = new Date();
    lastCycleDurationMs = Date.now() - cycleStart;

    logger.info('Cycle completed', {
      operation: 'scheduler:cycle:complete',
      cycleId,
      totalDurationMs: lastCycleDurationMs,
    });
  }

  async function cycle() {
    activeExecution = executeCycle();
    await activeExecution;
    activeExecution = null;
    if (running) {
      timer = setTimeout(cycle, intervalMs);
    }
  }

  function start() {
    if (disabled) {
      logger.info('Scheduler disabled, skipping start', { operation: 'scheduler:skip' });
      return;
    }
    if (running) {
      return;
    }
    running = true;
    logger.info('Scheduler started', {
      operation: 'scheduler:start',
      intervalMs,
      jobs: jobs.map((j) => j.name),
    });
    timer = setTimeout(cycle, bootDelayMs);
  }

  async function stop() {
    if (!running) {
      return;
    }
    running = false;
    clearTimeout(timer);
    timer = null;
    if (activeExecution !== null) {
      logger.info('Waiting for in-flight execution to complete', { operation: 'scheduler:drain' });
      await activeExecution;
    }
    logger.info('Scheduler stopped', { operation: 'scheduler:stop' });
  }

  function isRunning() {
    return running;
  }

  function getStatus() {
    return {
      running,
      disabled,
      cycleCount,
      lastCycleAt: lastCycleAt ? lastCycleAt.toISOString() : null,
      lastCycleDurationMs,
    };
  }

  return { start, stop, isRunning, getStatus };
}
