import { Injectable } from '@nestjs/common';
import { CanonicalResume, DiscoveredExperienceBlock } from '../common/types';

@Injectable()
export class ExperienceControlDiscoveryService {
  discover(canonicalResume: CanonicalResume): DiscoveredExperienceBlock[] {
    const clusters = canonicalResume.roleClusters.map<DiscoveredExperienceBlock>((cluster) => ({
      id: cluster.id,
      label: cluster.label,
      type: cluster.type,
      experienceIds: [...cluster.experienceIds],
      bulletIds: [...cluster.bulletIds],
      tags: [...cluster.tags],
      domainTags: [...cluster.domainTags],
      defaultInclude: cluster.defaultInclusion,
      supportedProfiles: [...cluster.inferredSupportProfiles],
    }));

    return clusters.sort((left, right) => {
      if (left.type !== right.type) {
        return left.type.localeCompare(right.type);
      }

      return right.experienceIds.length - left.experienceIds.length;
    });
  }
}
