import { Module } from '@nestjs/common';
import { ExperienceControlDiscoveryService } from './experience-control-discovery.service';
import { ProfileRegistryService } from './profile-registry.service';
import { ProfileResolutionService } from './profile-resolution.service';

@Module({
  providers: [
    ProfileRegistryService,
    ProfileResolutionService,
    ExperienceControlDiscoveryService,
  ],
  exports: [
    ProfileRegistryService,
    ProfileResolutionService,
    ExperienceControlDiscoveryService,
  ],
})
export class ProfilesModule {}
