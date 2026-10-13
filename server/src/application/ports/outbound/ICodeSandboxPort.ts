import { ExecutionMetrics } from '../../../domain/evaluation/value-objects/ExecutionMetrics';
import { SupportedLanguage } from '../../../domain/game/types/GameTypes';

export interface CompiledArtifact {
  readonly ok: boolean;
  readonly language?: SupportedLanguage;
  readonly workDir?: string;
  readonly binPath?: string;
  readonly compileError?: string;
}

export interface ISandboxMatchSession {
  runTurn(stdinPayload: string, timeLimitMs?: number): Promise<ExecutionMetrics>;
  dispose(): void;
}

/**
 * Outbound Port (Driven Port) cho việc biên dịch và thực thi code đa ngôn ngữ
 */
export interface ICodeSandboxPort {
  compile(language: SupportedLanguage, sourceCode: string): Promise<CompiledArtifact>;
  createSession(artifact: CompiledArtifact): ISandboxMatchSession;
  cleanup(workDir?: string): void;
}
