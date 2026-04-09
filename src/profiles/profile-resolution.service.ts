import { Injectable } from '@nestjs/common';
import { ProfileDefaultsDocument, ProfileDefinition, SupportedProfileId } from '../common/types';
import { readYamlFile } from '../common/utils';
import { ProfileRegistryService } from './profile-registry.service';

@Injectable()
export class ProfileResolutionService {
  constructor(private readonly profileRegistryService: ProfileRegistryService) {}

  async loadProfileDefaults(path: string): Promise<ProfileDefaultsDocument> {
    try {
      return await readYamlFile<ProfileDefaultsDocument>(path);
    } catch {
      return {
        generatedAt: new Date().toISOString(),
        sourceFiles: [],
        profiles: this.profileRegistryService.getBaseProfiles(),
      };
    }
  }

  resolveProfile(
    profileDefaults: ProfileDefaultsDocument,
    profileId: SupportedProfileId,
  ): ProfileDefinition {
    const profile = profileDefaults.profiles.find((item) => item.id === profileId);

    if (!profile) {
      throw new Error(`Unknown profile: ${profileId}`);
    }

    if (profile.hiddenIfUnsupported && profile.supported === false) {
      throw new Error(`Profile "${profileId}" is marked unsupported by the current resume corpus.`);
    }

    return profile;
  }

  listProfiles(profileDefaults: ProfileDefaultsDocument): ProfileDefinition[] {
    return profileDefaults.profiles.filter(
      (profile) => profile.supported !== false || !profile.hiddenIfUnsupported,
    );
  }
}
