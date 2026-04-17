import { Injectable } from '@nestjs/common';
import { ParsedCommand, TailorCommandOptions } from '../common/dto/cli-options.dto';
import { runLogger } from '../common/logging';
import { CliService } from './cli.service';

const MULTI_TOKEN_VALUE_FLAGS = new Set(['resume', 'resume-dir']);
const JOB_SIGNAL_POLICIES = new Set(['warn', 'confirm', 'abort']);

@Injectable()
export class CommandRunnerService {
  constructor(private readonly cliService: CliService) {}

  async run(argv: string[]): Promise<void> {
    const startedAtMs = Date.now();
    const parsed = this.parse(argv);
    runLogger.info('command resolved', {
      command: parsed.command,
      argvCount: argv.length,
    });

    try {
      switch (parsed.command) {
        case 'interactive':
          runLogger.info('dispatching interactive flow');
          await this.cliService.runInteractive();
          break;
        case 'ingest':
          runLogger.info('dispatching ingest command', {
            resumePaths: parsed.ingest?.resumePaths.length ?? 0,
            resumeDirPaths: parsed.ingest?.resumeDirPaths.length ?? 0,
            metadataProvided: Boolean(parsed.ingest?.metadataPath),
          });
          await this.cliService.runIngest(parsed.ingest ?? { resumePaths: [], resumeDirPaths: [] });
          break;
        case 'inspect':
          runLogger.info('dispatching inspect corpus command');
          await this.cliService.runInspectCorpus();
          break;
        case 'tailor':
          runLogger.info('dispatching tailor command', {
            jobUrlProvided: Boolean(parsed.tailor?.jobUrl),
            jobSignalPolicy: parsed.tailor?.jobSignalPolicy ?? undefined,
            profileId: parsed.tailor?.profileId ?? undefined,
            lengthTarget: parsed.tailor?.lengthTarget ?? undefined,
            outputFormat: parsed.tailor?.outputFormat ?? undefined,
            skipValidation: Boolean(parsed.tailor?.skipValidation),
          });
          await this.cliService.runTailor(parsed.tailor ?? {});
          break;
        default:
          this.cliService.printHelp();
      }
    } finally {
      runLogger.info('command complete', {
        command: parsed.command,
        durationMs: Date.now() - startedAtMs,
      });
    }
  }

  private parse(argv: string[]): ParsedCommand {
    if (argv.length === 0) {
      runLogger.debug('no command provided, defaulting to interactive mode');
      return { command: 'interactive' };
    }

    const first = argv[0];

    if (first === 'help' || first === '--help' || first === '-h') {
      runLogger.debug('explicit help requested');
      return { command: 'help' };
    }

    if (first === 'ingest') {
      runLogger.debug('parsing ingest command');
      const flags = this.parseFlags(argv.slice(1));
      const resumePaths = this.parsePathFlags(flags.resume);
      const resumeDirPaths = this.parsePathFlags(flags['resume-dir']);

      return {
        command: 'ingest',
        ingest: {
          resumePaths,
          resumeDirPaths,
          metadataPath: typeof flags.metadata === 'string' ? flags.metadata : undefined,
        },
      };
    }

    if (first === 'inspect') {
      if (argv[1] === 'corpus') {
        runLogger.debug('parsing inspect corpus command');
        return {
          command: 'inspect',
          inspect: {
            target: 'corpus',
          },
        };
      }

      runLogger.warn('inspect command fell back to help', {
        received: argv[1] ?? 'missing-subcommand',
      });
      return { command: 'help' };
    }

    if (first === 'tailor') {
      runLogger.debug('parsing tailor command');
    } else {
      runLogger.info('using bare-argv tailor shorthand', {
        received: first,
      });
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
        jobSignalPolicy: this.parseJobSignalPolicy(flags['job-signal']),
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
      const values: string[] = [];
      const nextIndex = index + 1;

      if (!args[nextIndex] || args[nextIndex].startsWith('--')) {
        flags[key] = true;
        continue;
      }

      for (
        let valueIndex = nextIndex;
        valueIndex < args.length && !args[valueIndex].startsWith('--');
        valueIndex += 1
      ) {
        values.push(args[valueIndex]);

        if (!MULTI_TOKEN_VALUE_FLAGS.has(key)) {
          break;
        }
      }

      values.forEach((value) => {
        if (flags[key] === undefined) {
          flags[key] = value;
        } else if (Array.isArray(flags[key])) {
          (flags[key] as string[]).push(value);
        } else {
          flags[key] = [flags[key] as string, value];
        }
      });

      index += values.length;
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

  private parseJobSignalPolicy(
    value: string | string[] | boolean | undefined,
  ): TailorCommandOptions['jobSignalPolicy'] {
    if (typeof value !== 'string' || !JOB_SIGNAL_POLICIES.has(value)) {
      return undefined;
    }

    return value as TailorCommandOptions['jobSignalPolicy'];
  }

  private parsePathFlags(value: string | string[] | boolean | undefined): string[] {
    if (Array.isArray(value)) {
      return value.flatMap((item) => item.split(',').map((part) => part.trim()).filter(Boolean));
    }

    if (typeof value === 'string') {
      return value.split(',').map((item) => item.trim()).filter(Boolean);
    }

    return [];
  }
}
