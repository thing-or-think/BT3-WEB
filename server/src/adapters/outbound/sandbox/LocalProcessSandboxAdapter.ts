import { ChildProcessWithoutNullStreams, execFile, spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  CompiledArtifact,
  ICodeSandboxPort,
  ISandboxMatchSession
} from '../../../application/ports/outbound/ICodeSandboxPort';
import { ExecutionMetrics } from '../../../domain/evaluation/value-objects/ExecutionMetrics';
import { SupportedLanguage } from '../../../domain/game/types/GameTypes';

const COMPILE_TIMEOUT_MS = 12000;
const DEFAULT_TURN_TIMEOUT_MS = 1500;

const PY_HARNESS_CODE = `import sys
import io

with open("solution.py", "r", encoding="utf-8") as f:
    src = f.read()

code_obj = compile(src, "solution.py", "exec")
real_stdin = sys.stdin
real_stdout = sys.stdout

while True:
    header = real_stdin.readline()
    if not header:
        break
    header_strip = header.strip()
    if not header_strip:
        continue
    if header_strip == "__EXIT__":
        break
    lines = [header]
    for _ in range(9):
        rline = real_stdin.readline()
        if rline:
            lines.append(rline)
    turn_input = "".join(lines)
    sys.stdin = io.StringIO(turn_input)
    out_buf = io.StringIO()
    sys.stdout = out_buf
    try:
        g = {"__name__": "__main__", "__file__": "solution.py"}
        exec(code_obj, g)
    except SystemExit:
        pass
    except Exception as e:
        real_stdout.write(f"__ERR__:{type(e).__name__}: {e}\\n")
        real_stdout.flush()
        continue
    output = out_buf.getvalue().strip()
    first_line = output.splitlines()[0].strip() if output else ""
    real_stdout.write(first_line + "\\n")
    real_stdout.flush()
`;

const JAVA_HARNESS_CODE = `import java.io.*;
import java.nio.charset.StandardCharsets;

public class JavaHarness {
    public static void main(String[] args) throws Exception {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8));
        PrintStream realOut = System.out;
        String line;
        while ((line = br.readLine()) != null) {
            String trimmed = line.trim();
            if (trimmed.isEmpty()) continue;
            if (trimmed.equals("__EXIT__")) break;
            StringBuilder sb = new StringBuilder();
            sb.append(line).append("\\n");
            for (int i = 0; i < 9; i++) {
                String row = br.readLine();
                if (row != null) sb.append(row).append("\\n");
            }
            ByteArrayInputStream bais = new ByteArrayInputStream(sb.toString().getBytes(StandardCharsets.UTF_8));
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            System.setIn(bais);
            System.setOut(new PrintStream(baos, true, "UTF-8"));
            try {
                Main.main(new String[0]);
            } catch (Throwable t) {
                realOut.println("__ERR__:" + t.toString());
                realOut.flush();
                continue;
            }
            String out = baos.toString("UTF-8").trim();
            String firstLine = out.isEmpty() ? "" : out.split("\\\\R")[0].trim();
            realOut.println(firstLine);
            realOut.flush();
        }
    }
}
`;

function execPromise(
  cmd: string,
  args: string[],
  options: { cwd: string; timeout: number }
): Promise<{ ok: boolean; stdout: string; stderr: string; errorMessage?: string }> {
  return new Promise(resolve => {
    execFile(cmd, args, options, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        stdout: stdout ? stdout.toString() : '',
        stderr: stderr ? stderr.toString() : '',
        errorMessage: error ? error.message : undefined
      });
    });
  });
}

class LocalProcessMatchSession implements ISandboxMatchSession {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private lineCallbacks: Array<(res: { ok: boolean; line?: string; reason?: string }) => void> = [];
  private buffer = '';

  constructor(private readonly artifact: CompiledArtifact) {}

  private startPersistentIfNeeded(): void {
    if (this.artifact.language === 'cpp') return;
    if (this.proc && !this.proc.killed && this.proc.exitCode === null) return;

    const cmd = this.artifact.language === 'python' ? 'python' : 'java';
    const args =
      this.artifact.language === 'python'
        ? ['-u', 'py_harness.py']
        : ['-Xmx256m', 'JavaHarness'];

    this.buffer = '';
    this.proc = spawn(cmd, args, {
      cwd: this.artifact.workDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });

    this.proc.stdout.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString('utf8');
      if (this.buffer.length > 64 * 1024) {
        this.failPending('Output vượt quá giới hạn 64 KB.');
        this.dispose();
        return;
      }
      let nlIdx: number;
      while ((nlIdx = this.buffer.indexOf('\n')) !== -1) {
        const line = this.buffer.slice(0, nlIdx).trim();
        this.buffer = this.buffer.slice(nlIdx + 1);
        const cb = this.lineCallbacks.shift();
        if (cb) cb({ ok: true, line });
      }
    });

    // Drain stderr so a verbose bot cannot block on a full pipe.
    this.proc.stderr.on('data', () => {});
    this.proc.on('error', error => this.failPending(error.message));
    this.proc.stdin.on('error', error => this.failPending(error.message));
    this.proc.on('exit', code => {
      this.failPending(`Tiến trình thoát bất ngờ (code ${code})`);
    });
  }

  private failPending(reason: string): void {
    const callbacks = this.lineCallbacks.splice(0);
    callbacks.forEach(cb => cb({ ok: false, reason }));
  }

  public async runTurn(
    stdinPayload: string,
    timeLimitMs = DEFAULT_TURN_TIMEOUT_MS
  ): Promise<ExecutionMetrics> {
    if (this.artifact.language === 'cpp') {
      return this.runCppTurn(stdinPayload, timeLimitMs);
    }

    this.startPersistentIfNeeded();
    const startNs = process.hrtime.bigint();

    return new Promise(resolve => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.lineCallbacks = [];
        this.dispose();
        resolve(
          new ExecutionMetrics('TLE', '', timeLimitMs, `Quá giới hạn thời gian (${timeLimitMs}ms)`)
        );
      }, timeLimitMs);

      this.lineCallbacks.push(res => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const elapsedMs = Math.max(1, Math.round(Number(process.hrtime.bigint() - startNs) / 1e6));

        if (!res.ok) {
          resolve(
            new ExecutionMetrics('RE', '', elapsedMs, res.reason || 'Lỗi thực thi (Runtime Error)')
          );
          return;
        }

        const line = res.line || '';
        if (line.startsWith('__ERR__:')) {
          resolve(new ExecutionMetrics('RE', '', elapsedMs, line.replace('__ERR__:', '')));
          return;
        }

        resolve(new ExecutionMetrics('OK', line, elapsedMs, null));
      });

      try {
        this.proc!.stdin.write(stdinPayload);
      } catch (err: any) {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(new ExecutionMetrics('RE', '', 1, err?.message || 'Stdin error'));
        }
      }
    });
  }

  private runCppTurn(stdinPayload: string, timeLimitMs: number): Promise<ExecutionMetrics> {
    const startNs = process.hrtime.bigint();
    return new Promise(resolve => {
      let settled = false;
      let stdout = '';
      let stderr = '';

      const child = spawn(this.artifact.binPath!, [], {
        cwd: this.artifact.workDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      });

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        try {
          child.kill('SIGKILL');
        } catch (_) {}
        resolve(
          new ExecutionMetrics('TLE', '', timeLimitMs, `Quá giới hạn thời gian (${timeLimitMs}ms)`)
        );
      }, timeLimitMs);

      child.stdout.on('data', (d: Buffer) => {
        stdout += d.toString('utf8');
      });
      child.stderr.on('data', (d: Buffer) => {
        stderr += d.toString('utf8');
      });

      child.on('error', err => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(new ExecutionMetrics('RE', '', 1, err.message));
      });

      child.on('close', code => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const elapsedMs = Math.max(1, Math.round(Number(process.hrtime.bigint() - startNs) / 1e6));

        if (code !== 0) {
          resolve(
            new ExecutionMetrics(
              'RE',
              '',
              elapsedMs,
              stderr.trim() || `Tiến trình C++ trả về mã lỗi ${code}`
            )
          );
          return;
        }

        const firstLine = stdout.trim().split(/\r?\n/)[0] || '';
        resolve(new ExecutionMetrics('OK', firstLine.trim(), elapsedMs, null));
      });

      try {
        child.stdin.write(stdinPayload);
        child.stdin.end();
      } catch (_) {}
    });
  }

  public dispose(): void {
    if (this.proc) {
      try {
        this.proc.stdin.write('__EXIT__\n');
      } catch (_) {}
      try {
        this.proc.kill('SIGKILL');
      } catch (_) {}
      this.proc = null;
    }
  }
}

export class LocalProcessSandboxAdapter implements ICodeSandboxPort {
  public async compile(language: SupportedLanguage, sourceCode: string): Promise<CompiledArtifact> {
    const lang = (language || 'python').toLowerCase() as SupportedLanguage;
    const workDir = path.join(
      os.tmpdir(),
      `rps_arena_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
    );
    fs.mkdirSync(workDir, { recursive: true });

    if (lang === 'python') {
      fs.writeFileSync(path.join(workDir, 'solution.py'), sourceCode, 'utf8');
      fs.writeFileSync(path.join(workDir, 'py_harness.py'), PY_HARNESS_CODE, 'utf8');

      const check = await execPromise('python', ['-m', 'py_compile', 'solution.py'], {
        cwd: workDir,
        timeout: COMPILE_TIMEOUT_MS
      });

      if (!check.ok) {
        this.cleanup(workDir);
        return {
          ok: false,
          compileError: check.stderr || check.errorMessage || 'Lỗi cú pháp Python'
        };
      }

      return { ok: true, language: 'python', workDir };
    }

    if (lang === 'cpp') {
      const binName = process.platform === 'win32' ? 'solution.exe' : 'solution';
      const binPath = path.join(workDir, binName);
      fs.writeFileSync(path.join(workDir, 'solution.cpp'), sourceCode, 'utf8');

      const compileRes = await execPromise(
        'g++',
        ['-O2', '-std=c++17', 'solution.cpp', '-o', binName],
        { cwd: workDir, timeout: COMPILE_TIMEOUT_MS }
      );

      if (!compileRes.ok || !fs.existsSync(binPath)) {
        this.cleanup(workDir);
        return {
          ok: false,
          compileError: compileRes.stderr || compileRes.errorMessage || 'Lỗi biên dịch C++'
        };
      }

      return { ok: true, language: 'cpp', workDir, binPath };
    }

    if (lang === 'java') {
      fs.writeFileSync(path.join(workDir, 'Main.java'), sourceCode, 'utf8');
      fs.writeFileSync(path.join(workDir, 'JavaHarness.java'), JAVA_HARNESS_CODE, 'utf8');

      const compileRes = await execPromise(
        'javac',
        ['-encoding', 'UTF-8', 'Main.java', 'JavaHarness.java'],
        { cwd: workDir, timeout: COMPILE_TIMEOUT_MS }
      );

      if (!compileRes.ok) {
        this.cleanup(workDir);
        return {
          ok: false,
          compileError: compileRes.stderr || compileRes.errorMessage || 'Lỗi biên dịch Java'
        };
      }

      return { ok: true, language: 'java', workDir };
    }

    this.cleanup(workDir);
    return { ok: false, compileError: `Ngôn ngữ không hỗ trợ: ${language}` };
  }

  public createSession(artifact: CompiledArtifact): ISandboxMatchSession {
    return new LocalProcessMatchSession(artifact);
  }

  public cleanup(workDir?: string): void {
    if (!workDir) return;
    try {
      fs.rmSync(workDir, { recursive: true, force: true });
    } catch (_) {}
  }
}
