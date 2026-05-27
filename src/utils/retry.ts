import { logger } from './logger';

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 2000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries) {
        logger.error(`Failed after ${maxRetries} attempts: ${lastError.message}`);
        throw lastError;
      }

      logger.warn(`Attempt ${attempt} failed, retrying in ${delayMs}ms: ${lastError.message}`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw lastError!;
}
