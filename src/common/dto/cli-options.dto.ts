import {
  ExperienceControl,
  LengthTarget,
  OutputFormat,
  SupportedProfileId,
} from '../types';

export interface IngestCommandOptions {
  resumePaths: string[];
  metadataPath?: string;
}

export interface TailorCommandOptions {
  jobUrl?: string;
  profileId?: SupportedProfileId;
  experienceControls?: ExperienceControl[];
  experienceConfigPath?: string;
  lengthTarget?: LengthTarget;
  outputFormat?: OutputFormat;
  configPath?: string;
  skipValidation?: boolean;
}

export interface ParsedCommand {
  command: 'ingest' | 'tailor' | 'interactive' | 'help';
  ingest?: IngestCommandOptions;
  tailor?: TailorCommandOptions;
}
