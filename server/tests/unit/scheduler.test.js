import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createScheduler } from '../../src/core/scheduler.js';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createMockLogger() {
  return {
    info: mock.fn(),
    warn: mock.fn(),
    error: mock.fn(),
  };
}

describe('createScheduler', () => {
  let logger;

  beforeEach(() => {
    logger = createMockLogger();
  });

  it('start and stop lifecycle', async () => {
    const jobFn = mock.fn(async () => 'ok');
    const scheduler = createScheduler({
      jobs: [{ name: 'testJob', execute: jobFn }],
      intervalMs: 50,
      disabled: false,
      logger,
      bootDelayMs: 10,
    });

    scheduler.start();
    assert.equal(scheduler.isRunning(), true);

    // Wait long enough for at least one cycle to fire (bootDelay 10ms + some margin)
    await delay(40);

    const status = scheduler.getStatus();
    assert.ok(status.cycleCount >= 1, `Expected at least 1 cycle, got ${status.cycleCount}`);

    await scheduler.stop();
    assert.equal(scheduler.isRunning(), false);
  });

  it('disabled mode skips execution', async () => {
    const jobFn = mock.fn(async () => 'ok');
    const scheduler = createScheduler({
      jobs: [{ name: 'testJob', execute: jobFn }],
      intervalMs: 50,
      disabled: true,
      logger,
      bootDelayMs: 10,
    });

    scheduler.start();

    await delay(50);

    assert.equal(scheduler.isRunning(), false);
    assert.equal(scheduler.getStatus().cycleCount, 0);

    // Verify the skip log was emitted
    const skipCalls = logger.info.mock.calls.filter(
      (c) => c.arguments[1] && c.arguments[1].operation === 'scheduler:skip'
    );
    assert.equal(skipCalls.length, 1);
  });

  it('error isolation between jobs', async () => {
    const callCounts = { job1: 0, job2: 0, job3: 0 };

    const job1 = {
      name: 'job1',
      execute: async () => {
        callCounts.job1++;
        return 'ok';
      },
    };
    const job2 = {
      name: 'job2',
      execute: async () => {
        callCounts.job2++;
        throw new Error('job2 exploded');
      },
    };
    const job3 = {
      name: 'job3',
      execute: async () => {
        callCounts.job3++;
        return 'ok';
      },
    };

    const scheduler = createScheduler({
      jobs: [job1, job2, job3],
      intervalMs: 50,
      disabled: false,
      logger,
      bootDelayMs: 10,
    });

    scheduler.start();
    await delay(40);
    await scheduler.stop();

    assert.ok(callCounts.job1 >= 1, `job1 should have been called, got ${callCounts.job1}`);
    assert.ok(callCounts.job2 >= 1, `job2 should have been called, got ${callCounts.job2}`);
    assert.ok(callCounts.job3 >= 1, `job3 should have been called, got ${callCounts.job3}`);

    // Verify error was logged for job2
    const errorCalls = logger.error.mock.calls.filter(
      (c) => c.arguments[1] && c.arguments[1].operation === 'scheduler:job:error'
    );
    assert.ok(errorCalls.length >= 1);
    assert.equal(errorCalls[0].arguments[1].jobName, 'job2');
  });

  it('stop waits for in-flight execution', async () => {
    let jobCompleted = false;
    const job = {
      name: 'slowJob',
      execute: async () => {
        await delay(100);
        jobCompleted = true;
        return 'done';
      },
    };

    const scheduler = createScheduler({
      jobs: [job],
      intervalMs: 500,
      disabled: false,
      logger,
      bootDelayMs: 10,
    });

    scheduler.start();

    // Wait for the cycle to begin executing (boot delay 10ms + small margin)
    await delay(20);

    // Stop while job is in-flight — stop() should await the active execution
    await scheduler.stop();

    assert.equal(jobCompleted, true, 'stop() should have waited for the in-flight job to finish');
    assert.equal(scheduler.isRunning(), false);

    // Verify drain log was emitted
    const drainCalls = logger.info.mock.calls.filter(
      (c) => c.arguments[1] && c.arguments[1].operation === 'scheduler:drain'
    );
    assert.equal(drainCalls.length, 1);
  });

  it('getStatus returns correct state', async () => {
    const scheduler = createScheduler({
      jobs: [{ name: 'statusJob', execute: async () => 'ok' }],
      intervalMs: 50,
      disabled: false,
      logger,
      bootDelayMs: 10,
    });

    // Initial state before start
    const initial = scheduler.getStatus();
    assert.equal(initial.running, false);
    assert.equal(initial.disabled, false);
    assert.equal(initial.cycleCount, 0);
    assert.equal(initial.lastCycleAt, null);
    assert.equal(initial.lastCycleDurationMs, null);

    scheduler.start();
    await delay(40);

    const afterCycle = scheduler.getStatus();
    assert.equal(afterCycle.running, true);
    assert.ok(afterCycle.cycleCount >= 1);
    assert.ok(typeof afterCycle.lastCycleAt === 'string', 'lastCycleAt should be an ISO string');
    assert.ok(typeof afterCycle.lastCycleDurationMs === 'number');

    await scheduler.stop();

    const afterStop = scheduler.getStatus();
    assert.equal(afterStop.running, false);
  });
});
