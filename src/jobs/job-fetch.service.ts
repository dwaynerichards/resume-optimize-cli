import { Injectable } from '@nestjs/common';

@Injectable()
export class JobFetchService {
  async fetch(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: {
        'user-agent': 'resume-tailor/0.1 (+local CLI job parser)',
        accept: 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch job posting (${response.status} ${response.statusText}).`);
    }

    return response.text();
  }
}
