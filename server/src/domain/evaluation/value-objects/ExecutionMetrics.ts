export class ExecutionMetrics {
  constructor(
    public readonly status: 'OK' | 'TLE' | 'RE',
    public readonly stdout: string,
    public readonly execTimeMs: number,
    public readonly errorMessage: string | null = null
  ) {}
}
