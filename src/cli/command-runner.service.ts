import { Injectable } from '@nestjs/common';
import { ParsedCommand, TailorCommandOptions } from '../common/dto/cli-options.dto';
import { CliService } from './cli.service';

@Injectable()
export class CommandRunnerService {
  constructor(private readonly cliService: CliService) {}

  async run(argv: string[]): Promise<void> {
    const parsed = this.parse(argv);

    switch (parsed.command) {
      case 'interactive':
        await this.cliService.runInteractive();
        return;
      case 'ingest':
        await this.cliService.runIngest(parsed.ingest ?? { resumePaths: [] });
        return;
      case 'tailor':
        await this.cliService.runTailor(parsed.tailor ?? {});
        return;
      default:
        this.cliService.printHelp();
    }
  }

  private parse(argv: string[]): ParsedCommand {
    if (argv.length === 0) {
      return { command: 'interactive' };
    }

    const first = argv[0];

    if (first === 'help' || first === '--help' || first === '-h') {
      return { command: 'help' };
    }

    if (first === 'ingest') {
      const flags = this.parseFlags(argv.slice(1));
      const resumeFlag = flags.resume;
      const resumePaths = Array.isArray(resumeFlag)
        ? resumeFlag.flatMap((value) => value.split(',').map((item) => item.trim()).filter(Boolean))
        : typeof resumeFlag === 'string'
          ? resumeFlag.split(',').map((item) => item.trim()).filter(Boolean)
          : [];

      return {
        command: 'ingest',
        ingest: {
          resumePaths,
          metadataPath: typeof flags.metadata === 'string' ? flags.metadata : undefined,
        },
      };
    }

    const tailorArgs = first === 'tailor' ? argv.slice(1) : argv;
    const flags = this.parseFlags(tailorArgs);

    return {
      command: 'tailor',
      tailor: {
        jobUrl: typeof flags['job-url'] === 'string' ? flags['job-url'] : undefined,
        profileId:
          typeof flags.profile === 'string' ? (flags.profile as TailorCommandOptions['profileId']) : undefined,
        experienceConfigPath:
          typeof flags['experience-config'] === 'string' ? flags['experience-config'] : undefined,
        lengthTarget:
          typeof flags['max-length'] === 'string'
            ? (flags['max-length'] as TailorCommandOptions['lengthTarget'])
            : undefined,
        outputFormat: this.parseOutputFormat(flags.output),
        configPath: typeof flags.config === 'string' ? flags.config : undefined,
        skipValidation: Boolean(flags['skip-validation']),
      },
    };
  }

  private parseFlags(args: string[]): Record<string, string | string[] | boolean> {
    const flags: Record<string, string | string[] | boolean> = {};

    for (let index = 0; index < args.length; index += 1) {
      const token = args[index];

      if (!token.startsWith('--')) {
        continue;
      }

      const key = token.slice(2);
      const next = args[index + 1];

      if (!next || next.startsWith('--')) {
        flags[key] = true;
        continue;
      }

      if (flags[key] === undefined) {
        flags[key] = next;
      } else if (Array.isArray(flags[key])) {
        (flags[key] as string[]).push(next);
      } else {
        flags[key] = [flags[key] as string, next];
      }

      index += 1;
    }

    return flags;
  }

  private parseOutputFormat(value: string | string[] | boolean | undefined): TailorCommandOptions['outputFormat'] {
    if (typeof value !== 'string') {
      return undefined;
    }

    if (value === 'md' || value === 'docx') {
      return value;
    }

    if (value.split(',').map((item) => item.trim()).sort().join(',') === 'docx,md') {
      return 'both';
    }

    return value as TailorCommandOptions['outputFormat'];
  }
}
