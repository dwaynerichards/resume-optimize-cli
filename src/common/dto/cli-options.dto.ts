import {
  ExperienceControl,
  JobSignalPolicy,
  LengthTarget,
  OutputFormat,
  NormalizedJobPosting,
  SupportedProfileId,
} from '../types';

export interface IngestCommandOptions {
  resumePaths: string[];
  resumeDirPaths: string[];
  metadataPath?: string;
}

export interface TailorCommandOptions {
  jobUrl?: string;
  job?: NormalizedJobPosting;
  jobSignalPolicy?: JobSignalPolicy;
  profileId?: SupportedProfileId;
  experienceControls?: ExperienceControl[];
  experienceConfigPath?: string;
  lengthTarget?: LengthTarget;
  outputFormat?: OutputFormat;
  configPath?: string;
  skipValidation?: boolean;
}

export interface ParsedCommand {
  command: 'ingest' | 'tailor' | 'interactive' | 'help' | 'inspect';
  ingest?: IngestCommandOptions;
  tailor?: TailorCommandOptions;
  inspect?: {
    target: 'corpus';
  };
}
