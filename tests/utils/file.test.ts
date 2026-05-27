import { readJsonFile, writeJsonFile, ensureDir } from '../../src/utils/file';
import * as fs from 'fs';
import * as path from 'path';

describe('File Utils', () => {
  const testDir = path.join(process.cwd(), 'test-data');
  const testFile = path.join(testDir, 'test.json');

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  it('should create directory if not exists', async () => {
    await ensureDir(testDir);
    expect(fs.existsSync(testDir)).toBe(true);
  });

  it('should write and read JSON file', async () => {
    const data = { test: 'value' };
    await writeJsonFile(testFile, data);
    const result = await readJsonFile(testFile);
    expect(result).toEqual(data);
  });

  it('should throw error when reading non-existent file', async () => {
    await expect(readJsonFile(testFile)).rejects.toThrow();
  });
});
