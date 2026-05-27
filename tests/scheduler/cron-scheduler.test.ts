import { CronScheduler } from '../../src/scheduler/cron-scheduler';
import cron from 'node-cron';

jest.mock('node-cron');

describe('CronScheduler', () => {
  let scheduler: CronScheduler;
  let mockTask: jest.Mock;

  beforeEach(() => {
    mockTask = jest.fn().mockResolvedValue(undefined);
    scheduler = new CronScheduler('0 20 * * *', 'Asia/Shanghai');
    jest.clearAllMocks();
  });

  it('should schedule task with cron expression', () => {
    scheduler.schedule(mockTask);

    expect(cron.schedule).toHaveBeenCalledWith(
      '0 20 * * *',
      expect.any(Function),
      { timezone: 'Asia/Shanghai' }
    );
  });

  it('should execute task when triggered', async () => {
    let scheduledCallback: Function;

    (cron.schedule as jest.Mock).mockImplementation((expr, callback, opts) => {
      scheduledCallback = callback;
      return { start: jest.fn(), stop: jest.fn() };
    });

    scheduler.schedule(mockTask);
    await scheduledCallback!();

    expect(mockTask).toHaveBeenCalled();
  });

  it('should handle task errors', async () => {
    const errorTask = jest.fn().mockRejectedValue(new Error('Task failed'));
    let scheduledCallback: Function;

    (cron.schedule as jest.Mock).mockImplementation((expr, callback, opts) => {
      scheduledCallback = callback;
      return { start: jest.fn(), stop: jest.fn() };
    });

    scheduler.schedule(errorTask);
    await scheduledCallback!();

    expect(errorTask).toHaveBeenCalled();
  });
});
