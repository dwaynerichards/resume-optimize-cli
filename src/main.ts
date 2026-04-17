#!/usr/bin/env node
import 'reflect-metadata';
import { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { CommandRunnerService } from './cli/command-runner.service';
import { runLogger } from './common/logging';

async function bootstrap(): Promise<void> {
  runLogger.configureFromEnv();
  runLogger.beginRun('cli', {
    argvCount: process.argv.slice(2).length,
  });

  let app: INestApplicationContext | undefined;

  try {
    app = await runLogger.measure('bootstrap application context', () =>
      NestFactory.createApplicationContext(AppModule, {
        logger: ['error', 'warn'],
      }),
    );
    const commandRunner = app.get(CommandRunnerService);
    await runLogger.measure('dispatch command', () => commandRunner.run(process.argv.slice(2)));
    runLogger.endRun('ok');
  } catch (error) {
    runLogger.endRun('error', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    await app?.close();
  }
}

bootstrap().catch(() => {
  process.exitCode = 1;
});
