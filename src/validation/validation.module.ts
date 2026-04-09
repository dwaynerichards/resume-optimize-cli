import { Module } from '@nestjs/common';
import { ClaimTraceabilityService } from './claim-traceability.service';
import { ResumeValidationService } from './resume-validation.service';

@Module({
  providers: [ResumeValidationService, ClaimTraceabilityService],
  exports: [ResumeValidationService, ClaimTraceabilityService],
})
export class ValidationModule {}
