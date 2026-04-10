import { CommandRunnerService } from '../src/cli/command-runner.service';

describe('CommandRunnerService', () => {
  it('parses ingest resume and folder flags', async () => {
    const cliService = {
      runInteractive: jest.fn(),
      runIngest: jest.fn(),
      runTailor: jest.fn(),
      runInspectCorpus: jest.fn(),
      printHelp: jest.fn(),
    };
    const runner = new CommandRunnerService(cliService as never);

    await runner.run([
      'ingest',
      '--resume',
      'resume-a.md,resume-b.pdf',
      '--resume-dir',
      'team-a',
      '--resume-dir',
      'team-b',
      '--metadata',
      'metadata.yaml',
    ]);

    expect(cliService.runIngest).toHaveBeenCalledWith({
      resumePaths: ['resume-a.md', 'resume-b.pdf'],
      resumeDirPaths: ['team-a', 'team-b'],
      metadataPath: 'metadata.yaml',
    });
  });

  it('runs corpus inspection for inspect corpus', async () => {
    const cliService = {
      runInteractive: jest.fn(),
      runIngest: jest.fn(),
      runTailor: jest.fn(),
      runInspectCorpus: jest.fn(),
      printHelp: jest.fn(),
    };
    const runner = new CommandRunnerService(cliService as never);

    await runner.run(['inspect', 'corpus']);

    expect(cliService.runInspectCorpus).toHaveBeenCalledTimes(1);
  });

  it('prints help for an incomplete inspect command', async () => {
    const cliService = {
      runInteractive: jest.fn(),
      runIngest: jest.fn(),
      runTailor: jest.fn(),
      runInspectCorpus: jest.fn(),
      printHelp: jest.fn(),
    };
    const runner = new CommandRunnerService(cliService as never);

    await runner.run(['inspect']);

    expect(cliService.printHelp).toHaveBeenCalledTimes(1);
  });
});
