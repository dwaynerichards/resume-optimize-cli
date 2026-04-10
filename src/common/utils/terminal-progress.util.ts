type OutputWriter = {
  isTTY?: boolean;
  write(chunk: string): unknown;
};

const SPINNER_FRAMES = ['-', '\\', '|', '/'] as const;
const SPINNER_INTERVAL_MS = 80;

export class TerminalProgress {
  private frameIndex = 0;
  private active = false;
  private lastMessage = '';
  private spinner?: NodeJS.Timeout;

  constructor(
    private readonly output: OutputWriter = process.stdout,
    private readonly errorOutput: OutputWriter = process.stderr,
  ) {}

  start(message: string): void {
    if (this.active) {
      this.update(message);
      return;
    }

    this.active = true;
    this.lastMessage = message;

    if (this.output.isTTY) {
      this.render();
      this.spinner = setInterval(() => {
        this.frameIndex = (this.frameIndex + 1) % SPINNER_FRAMES.length;
        this.render();
      }, SPINNER_INTERVAL_MS);
      return;
    }

    this.output.write(`${message}...\n`);
  }

  update(message: string): void {
    if (!this.active) {
      this.start(message);
      return;
    }

    if (message === this.lastMessage) {
      return;
    }

    this.lastMessage = message;

    if (this.output.isTTY) {
      this.render();
      return;
    }

    this.output.write(`${message}...\n`);
  }

  succeed(message?: string): void {
    if (!this.active) {
      return;
    }

    this.finish(this.output, '[done]', message ?? this.lastMessage);
  }

  fail(message?: string): void {
    if (!this.active) {
      return;
    }

    this.finish(this.errorOutput, '[error]', message ?? this.lastMessage);
  }

  private finish(target: OutputWriter, label: string, message: string): void {
    this.stopSpinner();

    if (this.output.isTTY) {
      this.output.write('\r\x1b[2K');
    }

    target.write(`${label} ${message}\n`);
    this.active = false;
    this.lastMessage = '';
    this.frameIndex = 0;
  }

  private render(): void {
    this.output.write(`\r\x1b[2K${SPINNER_FRAMES[this.frameIndex]} ${this.lastMessage}`);
  }

  private stopSpinner(): void {
    if (!this.spinner) {
      return;
    }

    clearInterval(this.spinner);
    this.spinner = undefined;
  }
}
