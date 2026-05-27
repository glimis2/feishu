import { logger } from '../../src/utils/logger';
import * as fs from 'fs';
import * as path from 'path';

describe('Logger', () => {
  const testLogDir = path.join(process.cwd(), 'logs');

  beforeAll(() => {
    if (!fs.existsSync(testLogDir)) {
      fs.mkdirSync(testLogDir, { recursive: true });
    }
  });

  it('should log info messages', () => {
    const spy = jest.spyOn(process.stdout, 'write');
    logger.info('test message');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('should log error messages', () => {
    const spy = jest.spyOn(process.stdout, 'write');
    logger.error('test error');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('should create log file', () => {
    const date = new Date().toISOString().split('T')[0];
    const logFile = path.join(testLogDir, `${date}.log`);
    logger.info('test log file creation');
    expect(fs.existsSync(logFile)).toBe(true);
  });
});
