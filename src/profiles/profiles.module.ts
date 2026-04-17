import { Module } from '@nestjs/common';
import { ExperienceControlDiscoveryService } from './experience-control-discovery.service';
import { ProfileRecommendationService } from './profile-recommendation.service';
import { ProfileRegistryService } from './profile-registry.service';
import { ProfileResolutionService } from './profile-resolution.service';

@Module({
  providers: [
    ProfileRegistryService,
    ProfileResolutionService,
    ProfileRecommendationService,
    ExperienceControlDiscoveryService,
  ],
  exports: [
    ProfileRegistryService,
    ProfileResolutionService,
    ProfileRecommendationService,
    ExperienceControlDiscoveryService,
  ],
})
export class ProfilesModule {}
