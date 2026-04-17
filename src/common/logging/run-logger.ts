export type RunLogLevel = 'debug' | 'info' | 'warn' | 'error';

type RunLogScalar = string | number | boolean | null | undefined;
type RunLogValue = RunLogScalar | readonly RunLogScalar[];
type RunLogFields = Record<string, RunLogValue>;

interface RunContext {
  runId: string;
  command: string;
  startedAtMs: number;
}

const LEVEL_ORDER: Record<RunLogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const DEFAULT_LEVEL: RunLogLevel = 'info';

class RunLogger {
  private level: RunLogLevel = DEFAULT_LEVEL;
  private currentRun?: RunContext;
  private sequence = 0;

  configureFromEnv(env: NodeJS.ProcessEnv = process.env): void {
    const rawLevel = env.RESUME_TAILOR_LOG_LEVEL ?? env.LOG_LEVEL;
    this.level = this.parseLevel(rawLevel) ?? DEFAULT_LEVEL;
  }

  beginRun(command: string, fields: RunLogFields = {}): RunContext {
    const runId = `run-${String(++this.sequence).padStart(4, '0')}`;
    this.currentRun = {
      runId,
      command,
      startedAtMs: Date.now(),
    };
    process.env.RESUME_TAILOR_RUN_ID = runId;
    this.info('run start', { command, runId, ...fields });
    return this.currentRun;
  }

  endRun(status: 'ok' | 'error' | 'help', fields: RunLogFields = {}): void {
    if (!this.currentRun) {
      return;
    }

    const durationMs = Date.now() - this.currentRun.startedAtMs;
    const level: RunLogLevel = status === 'error' ? 'error' : 'info';
    this.write(level, 'run end', {
      command: this.currentRun.command,
      runId: this.currentRun.runId,
      status,
      durationMs,
      ...fields,
    });
    if (process.env.RESUME_TAILOR_RUN_ID === this.currentRun.runId) {
      delete process.env.RESUME_TAILOR_RUN_ID;
    }
    this.currentRun = undefined;
  }

  debug(message: string, fields: RunLogFields = {}): void {
    this.write('debug', message, fields);
  }

  info(message: string, fields: RunLogFields = {}): void {
    this.write('info', message, fields);
  }

  warn(message: string, fields: RunLogFields = {}): void {
    this.write('warn', message, fields);
  }

  error(message: string, fields: RunLogFields = {}): void {
    this.write('error', message, fields);
  }

  async measure<T>(message: string, task: () => Promise<T> | T, fields: RunLogFields = {}): Promise<T> {
    const startedAtMs = Date.now();
    this.info(`${message} start`, fields);

    try {
      const result = await task();
      this.info(`${message} end`, {
        ...fields,
        durationMs: Date.now() - startedAtMs,
      });
      return result;
    } catch (error) {
      this.error(`${message} failed`, {
        ...fields,
        durationMs: Date.now() - startedAtMs,
        error: this.formatError(error),
      });
      throw error;
    }
  }

  private parseLevel(value: string | undefined): RunLogLevel | undefined {
    if (value === undefined) {
      return undefined;
    }

    const normalized = value.trim().toLowerCase();

    if (normalized === 'debug' || normalized === 'info' || normalized === 'warn' || normalized === 'error') {
      return normalized;
    }

    return undefined;
  }

  private shouldLog(level: RunLogLevel): boolean {
    return LEVEL_ORDER[level] >= LEVEL_ORDER[this.level];
  }

  private write(level: RunLogLevel, message: string, fields: RunLogFields): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const timestamp = new Date().toISOString();
    const runId = this.currentRun?.runId;
    const prefix = [timestamp, level, runId ? `run=${runId}` : undefined].filter(Boolean).join(' ');
    const suffix = this.formatFields(fields);
    const line = suffix ? `${prefix} ${message} ${suffix}` : `${prefix} ${message}`;
    process.stderr.write(`${line}\n`);
  }

  private formatFields(fields: RunLogFields): string {
    const entries = Object.entries(fields)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${key}=${this.formatValue(value)}`);

    return entries.join(' ');
  }

  private formatValue(value: RunLogValue): string {
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.formatValue(item)).join(',')}]`;
    }

    if (typeof value === 'string') {
      return JSON.stringify(value);
    }

    if (value === null) {
      return 'null';
    }

    return String(value);
  }

  private formatError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}

export const runLogger = new RunLogger();
