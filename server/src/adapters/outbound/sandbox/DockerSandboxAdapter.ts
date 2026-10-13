import { spawn } from 'child_process';
import {
  CompiledArtifact,
  ICodeSandboxPort,
  ISandboxMatchSession
} from '../../../application/ports/outbound/ICodeSandboxPort';
import { ExecutionMetrics } from '../../../domain/evaluation/value-objects/ExecutionMetrics';
import { SupportedLanguage } from '../../../domain/game/types/GameTypes';
import { LocalProcessSandboxAdapter } from './LocalProcessSandboxAdapter';

/**
 * Driven Adapter chạy code người dùng bên trong Docker Container cô lập
 * (--network=none, --memory=256m, --cpus=1.0, --pids-limit=32)
 */
export class DockerSandboxAdapter implements ICodeSandboxPort {
  private readonly fallbackLocal = new LocalProcessSandboxAdapter();

  constructor(private readonly dockerImage = 'rps-arena-sandbox:latest') {}

  public async compile(language: SupportedLanguage, sourceCode: string): Promise<CompiledArtifact> {
    return this.fallbackLocal.compile(language, sourceCode);
  }

  public createSession(artifact: CompiledArtifact): ISandboxMatchSession {
    const image = this.dockerImage;
    return {
      runTurn(stdinPayload: string, timeLimitMs = 1500): Promise<ExecutionMetrics> {
        const startNs = process.hrtime.bigint();
        return new Promise(resolve => {
          let settled = false;
          let stdout = '';
          let stderr = '';

          const runCmd =
            artifact.language === 'python'
              ? ['python3', 'solution.py']
              : artifact.language === 'java'
              ? ['java', '-Xmx256m', 'Main']
              : ['./solution'];

          const dockerArgs = [
            'run',
            '--rm',
            '-i',
            '--network=none',
            '--memory=256m',
            '--cpus=1.0',
            '--pids-limit=32',
            '-v',
            `${artifact.workDir}:/workspace:ro`,
            image,
            ...runCmd
          ];

          const child = spawn('docker', dockerArgs, { stdio: ['pipe', 'pipe', 'pipe'] });
          const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            try {
              child.kill('SIGKILL');
            } catch (_) {}
            resolve(new ExecutionMetrics('TLE', '', timeLimitMs, 'Docker Sandbox Timeout'));
          }, timeLimitMs);

          child.stdout.on('data', d => (stdout += d.toString('utf8')));
          child.stderr.on('data', d => (stderr += d.toString('utf8')));
          child.on('close', code => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            const elapsedMs = Math.max(
              1,
              Math.round(Number(process.hrtime.bigint() - startNs) / 1e6)
            );
            if (code !== 0) {
              resolve(new ExecutionMetrics('RE', '', elapsedMs, stderr.trim() || `Exit ${code}`));
              return;
            }
            const firstLine = stdout.trim().split(/\r?\n/)[0] || '';
            resolve(new ExecutionMetrics('OK', firstLine.trim(), elapsedMs, null));
          });

          child.stdin.write(stdinPayload);
          child.stdin.end();
        });
      },
      dispose(): void {}
    };
  }

  public cleanup(workDir?: string): void {
    this.fallbackLocal.cleanup(workDir);
  }
}
