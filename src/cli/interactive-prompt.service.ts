import { Injectable } from '@nestjs/common';
import inquirer from 'inquirer';
import { IngestCommandOptions, TailorCommandOptions } from '../common/dto/cli-options.dto';
import {
  DiscoveredExperienceBlock,
  ExperienceControl,
  ProfileRecommendation,
  JobSignalAssessment,
  LengthTarget,
  OutputFormat,
  ProfileDefinition,
} from '../common/types';

@Injectable()
export class InteractivePromptService {
  async promptForJobUrl(): Promise<string> {
    const answers = await inquirer.prompt<{ jobUrl: string }>([
      {
        type: 'input',
        name: 'jobUrl',
        message: 'Job posting URL:',
        validate: (value: string) => (value.startsWith('http') ? true : 'Provide a valid http(s) URL.'),
      },
    ]);

    return answers.jobUrl;
  }

  async promptForInitialIngest(): Promise<IngestCommandOptions> {
    const answers = await inquirer.prompt<{ resumePaths: string; resumeDirPaths: string }>([
      {
        type: 'input',
        name: 'resumePaths',
        message: 'Canonical resume source not found. Enter one or more resume paths (comma-separated):',
      },
      {
        type: 'input',
        name: 'resumeDirPaths',
        message: 'Optional: enter resume folders to expand (comma-separated):',
      },
    ]);

    const resumePaths = answers.resumePaths
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const resumeDirPaths = answers.resumeDirPaths
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (resumePaths.length === 0 && resumeDirPaths.length === 0) {
      throw new Error('Provide at least one resume file or resume folder.');
    }

    return {
      resumePaths,
      resumeDirPaths,
    };
  }

  async promptForTailoring(
    profiles: ProfileDefinition[],
    experienceBlocks: DiscoveredExperienceBlock[],
    recommendation: ProfileRecommendation,
  ): Promise<TailorCommandOptions> {
    let profileId: NonNullable<TailorCommandOptions['profileId']> = recommendation.profileId;

    if (recommendation.shouldPrompt) {
      const profileAnswer = await inquirer.prompt<{ profileId: string }>([
        {
          type: 'list',
          name: 'profileId',
          message: `Recommended profile: ${this.describeRecommendation(profiles, recommendation)} Choose a profile:`,
          choices: profiles.map((profile) => ({
            name: this.buildProfileChoiceLabel(profile, recommendation),
            value: profile.id,
          })),
          default: recommendation.profileId,
        },
      ]);
      profileId = profileAnswer.profileId as NonNullable<TailorCommandOptions['profileId']>;
    } else {
      const overrideAnswer = await inquirer.prompt<{ overrideProfile: boolean }>([
        {
          type: 'confirm',
          name: 'overrideProfile',
          message: `Recommended profile: ${this.describeRecommendation(profiles, recommendation)} Use a different profile?`,
          default: false,
        },
      ]);

      if (overrideAnswer.overrideProfile) {
        const profileAnswer = await inquirer.prompt<{ profileId: string }>([
          {
            type: 'list',
            name: 'profileId',
            message: 'Select a different profile:',
            choices: profiles.map((profile) => ({
              name: this.buildProfileChoiceLabel(profile, recommendation),
              value: profile.id,
            })),
            default: recommendation.profileId,
          },
        ]);
        profileId = profileAnswer.profileId as NonNullable<TailorCommandOptions['profileId']>;
      }
    }

    const baseAnswers = await inquirer.prompt<{
      lengthTarget: LengthTarget;
      outputFormat: OutputFormat;
    }>([
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
      profileId,
      lengthTarget: baseAnswers.lengthTarget,
      outputFormat: baseAnswers.outputFormat,
      experienceControls,
    };
  }

  async promptForLowSignalJob(jobTitle: string, signal: JobSignalAssessment): Promise<boolean> {
    const reasonText =
      signal.reasons.length > 0
        ? `\n${signal.reasons.map((reason) => `- ${reason}`).join('\n')}`
        : '';
    const answers = await inquirer.prompt<{ proceed: boolean }>([
      {
        type: 'confirm',
        name: 'proceed',
        message: `Job page "${jobTitle}" looks ${signal.level} (${Math.round(signal.score * 100)}% signal). Continue anyway?${reasonText}`,
        default: false,
      },
    ]);

    return answers.proceed;
  }

  private describeRecommendation(
    profiles: ProfileDefinition[],
    recommendation: ProfileRecommendation,
  ): string {
    const profile = profiles.find((item) => item.id === recommendation.profileId);
    const label = profile?.label ?? recommendation.profileId;
    return `${label} (${Math.round(recommendation.confidence * 100)}% confidence)`;
  }

  private buildProfileChoiceLabel(
    profile: ProfileDefinition,
    recommendation: ProfileRecommendation,
  ): string {
    const supportSuffix =
      profile.supportScore !== undefined
        ? ` (${Math.round(profile.supportScore * 100)}% support)`
        : '';
    const recommendedSuffix = profile.id === recommendation.profileId ? ' [recommended]' : '';
    return `${profile.label}${supportSuffix}${recommendedSuffix}`;
  }
}
