import { Module } from '@nestjs/common';
import { DocxExportService } from './docx-export.service';
import { MarkdownExportService } from './markdown-export.service';

@Module({
  providers: [MarkdownExportService, DocxExportService],
  exports: [MarkdownExportService, DocxExportService],
})
export class ExportModule {}
