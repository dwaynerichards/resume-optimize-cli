import { createHash } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname } from 'path';
import YAML from 'yaml';

export const ensureDirectory = async (path: string): Promise<void> => {
  await mkdir(path, { recursive: true });
};

export const ensureParentDirectory = async (path: string): Promise<void> => {
  await ensureDirectory(dirname(path));
};

export const readTextFile = async (path: string): Promise<string> => readFile(path, 'utf8');

export const writeTextFile = async (path: string, contents: string): Promise<void> => {
  await ensureParentDirectory(path);
  await writeFile(path, contents, 'utf8');
};

export const readYamlFile = async <T>(path: string): Promise<T> => {
  const contents = await readTextFile(path);
  return YAML.parse(contents) as T;
};

export const writeYamlFile = async (path: string, value: unknown): Promise<void> => {
  const contents = YAML.stringify(value);
  await writeTextFile(path, contents);
};

export const readStructuredFile = async <T>(path: string): Promise<T> => {
  if (path.endsWith('.json')) {
    const contents = await readTextFile(path);
    return JSON.parse(contents) as T;
  }

  return readYamlFile<T>(path);
};

export const createChecksum = (value: string): string =>
  createHash('sha256').update(value).digest('hex');
