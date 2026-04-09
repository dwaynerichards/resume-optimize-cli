import { resolve } from 'path';
import YAML from 'yaml';
import { DEFAULT_PROMPTS_DIR } from '../constants';
import { readTextFile } from './file-system.util';

export const loadPrompt = async (promptFileName: string): Promise<string> => {
  const promptsDir = process.env.PROMPTS_DIR ?? DEFAULT_PROMPTS_DIR;
  const path = resolve(process.cwd(), promptsDir, promptFileName);
  return readTextFile(path);
};

export const renderPrompt = (template: string, payload: unknown): string =>
  `${template.trim()}\n\nContext:\n${YAML.stringify(payload)}`;
