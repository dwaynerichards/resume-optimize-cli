import { Injectable } from '@nestjs/common';
import inquirer from 'inquirer';
import { IngestCommandOptions, TailorCommandOptions } from '../common/dto/cli-options.dto';
import {
  DiscoveredExperienceBlock,
  ExperienceControl,
  LengthTarget,
  OutputFormat,
  ProfileDefinition,
} from '../common/types';

@Injectable()
export class InteractivePromptService {
  async promptForInitialIngest(): Promise<IngestCommandOptions> {
    const { resumePaths } = await inquirer.prompt<{ resumePaths: string }>([
      {
        type: 'input',
        name: 'resumePaths',
        message: 'Canonical resume source not found. Enter one or more resume paths (comma-separated):',
        validate: (value: string) => (value.trim().length > 0 ? true : 'Provide at least one resume path.'),
      },
    ]);

    return {
      resumePaths: resumePaths
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    };
  }

  async promptForTailoring(
    profiles: ProfileDefinition[],
    experienceBlocks: DiscoveredExperienceBlock[],
  ): Promise<TailorCommandOptions> {
    const baseAnswers = await inquirer.prompt<{
      jobUrl: string;
      profileId: string;
      lengthTarget: LengthTarget;
      outputFormat: OutputFormat;
    }>([
      {
        type: 'input',
        name: 'jobUrl',
        message: 'Job posting URL:',
        validate: (value: string) => (value.startsWith('http') ? true : 'Provide a valid http(s) URL.'),
      },
      {
        type: 'list',
        name: 'profileId',
        message: 'Global profile:',
        choices: profiles.map((profile) => ({
          name:
            profile.supportScore !== undefined
              ? `${profile.label} (${Math.round(profile.supportScore * 100)}% support)`
              : profile.label,
          value: profile.id,
        })),
      },
      {
        type: 'list',
        name: 'lengthTarget',
        message: 'Max length target:',
        choices: [
          { name: 'Concise', value: 'concise' },
          { name: 'Standard', value: 'standard' },
          { name: 'Expanded', value: 'expanded' },
        ],
      },
      {
        type: 'list',
        name: 'outputFormat',
        message: 'Output format:',
        choices: [
          { name: 'Markdown', value: 'md' },
          { name: 'DOCX', value: 'docx' },
          { name: 'Both', value: 'both' },
        ],
      },
    ]);

    const experienceControls: ExperienceControl[] = [];

    for (const block of experienceBlocks) {
      const { include } = await inquirer.prompt<{ include: boolean }>([
        {
          type: 'confirm',
          name: 'include',
          message: `Include ${block.label} (${block.type})?`,
          default: block.defaultInclude,
        },
      ]);

      let emphasis: ExperienceControl['emphasis'] = 'medium';
      let orderPriority: number | undefined;

      if (include) {
        const emphasisAnswer = await inquirer.prompt<{ emphasis: ExperienceControl['emphasis'] }>([
          {
            type: 'list',
            name: 'emphasis',
            message: `Emphasis for ${block.label}:`,
            choices: [
              { name: 'Low', value: 'low' },
              { name: 'Medium', value: 'medium' },
              { name: 'High', value: 'high' },
            ],
            default: block.defaultInclude ? 'medium' : 'low',
          },
        ]);
        emphasis = emphasisAnswer.emphasis;

        const priorityAnswer = await inquirer.prompt<{ orderPriority: string }>([
          {
            type: 'input',
            name: 'orderPriority',
            message: `Optional ordering priority for ${block.label} (blank keeps default order):`,
          },
        ]);
        orderPriority =
          priorityAnswer.orderPriority.trim().length > 0
            ? Number(priorityAnswer.orderPriority)
            : undefined;
      }

      experienceControls.push({
        blockId: block.id,
        include,
        emphasis,
        orderPriority,
      });
    }

    return {
      jobUrl: baseAnswers.jobUrl,
      profileId: baseAnswers.profileId as TailorCommandOptions['profileId'],
      lengthTarget: baseAnswers.lengthTarget,
      outputFormat: baseAnswers.outputFormat,
      experienceControls,
    };
  }
}
