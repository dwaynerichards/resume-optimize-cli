import { Injectable } from '@nestjs/common';
import { TailoredResumeDocument } from '../common/types';
import { writeTextFile } from '../common/utils';

@Injectable()
export class MarkdownExportService {
  renderResume(document: TailoredResumeDocument): string {
    const contactLine = [
      document.contact.email,
      document.contact.phone,
      document.contact.location,
      document.contact.linkedin,
      document.contact.github,
      document.contact.website,
    ]
      .filter(Boolean)
      .join(' | ');

    return [
      `# ${document.identity.fullName}`,
      contactLine,
      '',
      '## Summary',
      document.summary,
      '',
      '## Skills',
      ...document.skills.map((category) => `- **${category.category}:** ${category.items.join(', ')}`),
      '',
      '## Experience',
      ...document.experience.flatMap((experience) => [
        `### ${experience.roleTitle} | ${experience.company}`,
        `${experience.dateRange.start} - ${experience.dateRange.current ? 'Present' : experience.dateRange.end ?? 'Present'}${experience.location ? ` | ${experience.location}` : ''}`,
        ...experience.bullets.map((bullet) => `- ${bullet.text}`),
        '',
      ]),
      '## Education',
      ...document.education.map((entry) =>
        `- ${entry.institution}${entry.degree ? `, ${entry.degree}` : ''}${entry.fieldOfStudy ? `, ${entry.fieldOfStudy}` : ''}${entry.graduationDate ? ` (${entry.graduationDate})` : ''}`,
      ),
      '',
      '## Certifications',
      ...(document.certifications.length > 0
        ? document.certifications.map((entry) =>
            `- ${entry.name}${entry.issuer ? `, ${entry.issuer}` : ''}${entry.issueDate ? ` (${entry.issueDate})` : ''}`,
          )
        : ['- None listed']),
      '',
    ]
      .filter((line, index, array) => !(line === '' && array[index - 1] === ''))
      .join('\n');
  }

  async writeToFile(path: string, document: TailoredResumeDocument): Promise<void> {
    await writeTextFile(path, this.renderResume(document));
  }

  async writeReportToFile(path: string, report: string): Promise<void> {
    await writeTextFile(path, report);
  }
}
