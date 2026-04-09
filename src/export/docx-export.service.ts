import { Injectable } from '@nestjs/common';
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
import { writeFile } from 'fs/promises';
import { TailoredResumeDocument } from '../common/types';
import { ensureParentDirectory } from '../common/utils';

@Injectable()
export class DocxExportService {
  async writeToFile(path: string, document: TailoredResumeDocument): Promise<void> {
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: this.buildParagraphs(document),
        },
      ],
    });
    const buffer = await Packer.toBuffer(doc);
    await ensureParentDirectory(path);
    await writeFile(path, buffer);
  }

  private buildParagraphs(document: TailoredResumeDocument): Paragraph[] {
    const children: Paragraph[] = [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [new TextRun({ text: document.identity.fullName, bold: true, size: 32 })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [
          new TextRun(
            [
              document.contact.email,
              document.contact.phone,
              document.contact.location,
              document.contact.linkedin,
              document.contact.github,
              document.contact.website,
            ]
              .filter(Boolean)
              .join(' | '),
          ),
        ],
      }),
      heading('Summary'),
      paragraph(document.summary),
      heading('Skills'),
      ...document.skills.map((category) => paragraph(`${category.category}: ${category.items.join(', ')}`)),
      heading('Experience'),
      ...document.experience.flatMap((experience) => [
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 140, after: 40 },
          children: [
            new TextRun({ text: `${experience.roleTitle} | ${experience.company}`, bold: true }),
          ],
        }),
        paragraph(
          `${experience.dateRange.start} - ${
            experience.dateRange.current ? 'Present' : experience.dateRange.end ?? 'Present'
          }${experience.location ? ` | ${experience.location}` : ''}`,
        ),
        ...experience.bullets.map(
          (bullet) =>
            new Paragraph({
              text: bullet.text,
              bullet: { level: 0 },
              spacing: { after: 40 },
            }),
        ),
      ]),
      heading('Education'),
      ...document.education.map((entry) =>
        paragraph(
          `${entry.institution}${entry.degree ? `, ${entry.degree}` : ''}${
            entry.fieldOfStudy ? `, ${entry.fieldOfStudy}` : ''
          }${entry.graduationDate ? ` (${entry.graduationDate})` : ''}`,
        ),
      ),
    ];

    if (document.certifications.length > 0) {
      children.push(heading('Certifications'));
      document.certifications.forEach((entry) => {
        children.push(
          paragraph(
            `${entry.name}${entry.issuer ? `, ${entry.issuer}` : ''}${
              entry.issueDate ? ` (${entry.issueDate})` : ''
            }`,
          ),
        );
      });
    }

    return children;
  }
}

const heading = (text: string): Paragraph =>
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, bold: true })],
  });

const paragraph = (text: string): Paragraph =>
  new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun(text)],
  });
