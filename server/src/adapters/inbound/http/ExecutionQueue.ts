/** A single writer for ladder updates and a bounded queue for bot execution. */
export class ExecutionQueue {
  private tail: Promise<unknown> = Promise.resolve();
  private pending = 0;

  public async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.pending >= 10) throw new Error('Đấu trường đang đầy hàng chờ. Vui lòng thử lại sau.');
    this.pending++;
    const result = this.tail.then(work);
    this.tail = result.catch(() => undefined);
    try { return await result; }
    finally { this.pending--; }
  }
}
