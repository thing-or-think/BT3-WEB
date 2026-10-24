import { ArenaApiClient } from '../adapters/arenaApiClient';
import { AuthService } from '../adapters/authService';
import { ArenaStore } from './arenaStore';
import { EditorView } from '../presentation/editorView';
import { LeaderboardView } from '../presentation/leaderboardView';
import { MatchSummary, Side, SubmissionDto } from '../domain/types';

/** Coordinates server results with the existing editor, leaderboard and replay views. */
export class ServerArena {
  private readonly api = new ArenaApiClient();
  private busy = false;
  private ready = false;
  private sessionVersion = 0;
  private currentSubmission: SubmissionDto | null = null;

  constructor(
    private readonly store: ArenaStore,
    private readonly auth: AuthService,
    private readonly editor: EditorView,
    private readonly leaderboard: LeaderboardView,
    private readonly replay: (match: MatchSummary, title?: string) => void,
    private readonly switchTab: (tab: 'studio' | 'ladder') => void,
    private readonly clearReplay: () => void
  ) {}

  private message(text: string, error = false): void {
    const el = document.getElementById('serverStatus');
    if (el) {
      el.textContent = text;
      el.classList.toggle('server-error', error);
      el.setAttribute('role', error ? 'alert' : 'status');
    }
  }

  private setBusy(value: boolean): void {
    this.busy = value;
    document.querySelectorAll<HTMLButtonElement>('#btnSubmitRank, #btnTestMatch').forEach(btn => {
      btn.disabled = value || !this.ready;
    });
    const test = document.getElementById('btnTestMatch');
    const submit = document.getElementById('btnSubmitRank');
    if (test) test.textContent = value ? 'Đang chờ / chạy trên máy chủ…' : '🧪 Chạy thử bot';
    if (submit) submit.textContent = value ? 'Đang chờ / chạy trên máy chủ…' : '⚔️ Nộp bot đấu xếp hạng';
  }

  public async initialize(): Promise<void> {
    this.setBusy(false);
    try {
      const meta = await this.api.fetchMeta();
      this.store.initialBoardTemplate = meta.initialBoard;
      this.store.templatesByLang = meta.templates;
      this.store.userDraftByLang = { ...meta.templates };
      // Avoid overwriting the freshly loaded Python template with an empty initial editor.
      this.store.currentLang = 'javascript';
      this.editor.selectLanguage('python');
      this.ready = true;
      this.setBusy(false);
      this.message('Đã kết nối máy chủ đấu trường.');
      await this.refresh();
    } catch (error) {
      this.message((error as Error).message, true);
    }
  }

  private canRun(): boolean {
    if (this.busy || !this.ready) return false;
    if (!this.auth.getCurrentUser()) {
      this.message('Vui lòng đăng nhập trước khi nộp hoặc chạy thử bot.', true);
      return false;
    }
    return true;
  }

  public async runTest(): Promise<void> {
    if (!this.canRun()) return;
    const userId = this.auth.getCurrentUser()!.id;
    const sessionVersion = this.sessionVersion;
    this.setBusy(true);
    this.message('Đã gửi bot. Máy chủ sẽ biên dịch và chạy thử; vui lòng giữ trang mở.');
    try {
      const result = await this.api.runTestMatch({
        language: this.store.currentLang,
        sourceCode: this.editor.getCurrentCode(),
        botLevel: Number((document.getElementById('testBotSelect') as HTMLSelectElement).value),
        userSide: (document.getElementById('testSideSelect') as HTMLSelectElement).value as Side
      });
      if (this.sessionVersion !== sessionVersion || this.auth.getCurrentUser()?.id !== userId) return;
      if (result.status === 'COMPILE_ERROR') throw new Error(result.compileError || 'Biên dịch thất bại.');
      const matches = result.botMatches || (result.match ? [result.match] : []);
      const count = document.getElementById('botTestCountBadge');
      if (count) count.textContent = String(matches.length);
      this.leaderboard.renderClientBotTestResults(matches, idx => this.replay(matches[idx]));
      if (matches.length) this.replay(matches[matches.length - 1]);
      this.message(`Đã hoàn tất ${matches.length} trận thử trên máy chủ.`);
    } catch (error) {
      if (this.sessionVersion === sessionVersion) this.message((error as Error).message, true);
    } finally { this.setBusy(false); }
  }

  public async submit(): Promise<void> {
    if (!this.canRun()) return;
    const userId = this.auth.getCurrentUser()!.id;
    const sessionVersion = this.sessionVersion;
    this.setBusy(true);
    this.message('Bài nộp đang chờ / được chấm trên máy chủ. Kết quả sẽ được lưu vào lịch sử.');
    try {
      const result = await this.api.submitGauntlet({
        language: this.store.currentLang,
        sourceCode: this.editor.getCurrentCode()
      });
      if (this.sessionVersion !== sessionVersion || this.auth.getCurrentUser()?.id !== userId) return;
      this.showSubmission(result.submission);
      await this.refresh();
      if (this.sessionVersion !== sessionVersion) return;
      if (result.submission.status === 'COMPILE_ERROR') {
        this.message(result.submission.compileError || 'Biên dịch thất bại.', true);
      } else {
        this.message(`Đã lưu bài ${result.submission.id}. Hạng sau lượt nộp: #${result.userRank}.`);
      }
    } catch (error) {
      if (this.sessionVersion === sessionVersion) this.message((error as Error).message, true);
    } finally { this.setBusy(false); }
  }

  private showSubmission(sub: SubmissionDto): void {
    this.clearReplay();
    this.currentSubmission = sub;
    this.store.currentGauntletMatches = sub.matches;
    const count = document.getElementById('gauntletCountBadge');
    if (count) count.textContent = String(sub.matches.length);
    const download = document.getElementById('btnDownloadLog') as HTMLButtonElement | null;
    if (download) download.disabled = false;
    this.leaderboard.renderGauntletResults(sub, sub.finalRank ?? null, idx => {
      if (sub.matches[idx]) this.replay(sub.matches[idx], `${sub.username}: ${sub.matches[idx].result} vs ${sub.matches[idx].botName}`);
    });
    if (sub.status === 'COMPILE_ERROR') {
      const banner = document.getElementById('gauntletSummaryBanner');
      if (banner) banner.textContent = `Lỗi biên dịch: ${sub.compileError}`;
    }
    if (sub.matches.length) this.replay(sub.matches[sub.matches.length - 1]);
  }

  public async refresh(): Promise<void> {
    const sessionVersion = this.sessionVersion;
    try {
      const result = await this.api.fetchLeaderboard();
      if (this.sessionVersion !== sessionVersion) return;
      this.leaderboard.renderLeaderboardTable(result.leaderboard, this.auth.getCurrentUser()?.username || '');
      const top = result.leaderboard[0];
      const fields: Record<string, string> = {
        kingNameDisplay: top?.username || 'Chưa có người chơi',
        kingTimeDisplay: top?.updatedAt ? new Date(top.updatedAt).toLocaleString('vi-VN') : '—',
        kingEloDisplay: String(top?.elo || 0)
      };
      for (const [id, value] of Object.entries(fields)) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
      }
      const list = document.getElementById('submissionHistory');
      if (!list) return;
      list.replaceChildren();
      if (!this.auth.getCurrentUser()) return;
      const userId = this.auth.getCurrentUser()!.id;
      const submissions = await this.api.fetchMySubmissions();
      if (this.sessionVersion !== sessionVersion || this.auth.getCurrentUser()?.id !== userId) return;
      list.replaceChildren();
      if (!submissions.length) list.textContent = 'Bạn chưa có bài nộp. Hãy nộp bot ở tab Đấu xếp hạng.';
      for (const sub of submissions) {
        const row = document.createElement('div');
        row.className = 'submission-history-row';
        const label = document.createElement('span');
        label.textContent = `${new Date(sub.createdAt).toLocaleString('vi-VN')} • ${sub.language.toUpperCase()} • ${sub.status} • ${sub.finalRank ? `Hạng #${sub.finalRank}` : 'Chưa xếp hạng'}`;
        const button = document.createElement('button');
        button.className = 'btn-mini';
        button.textContent = 'Mở kết quả / replay';
        button.onclick = async () => {
          try {
            const full = await this.api.fetchSubmission(sub.id);
            if (this.sessionVersion !== sessionVersion || this.auth.getCurrentUser()?.id !== userId) return;
            this.switchTab('ladder');
            this.showSubmission(full);
          } catch (error) {
            if (this.sessionVersion === sessionVersion) this.message((error as Error).message, true);
          }
        };
        row.append(label, button);
        list.append(row);
      }
    } catch (error) {
      if (this.sessionVersion === sessionVersion) this.message((error as Error).message, true);
    }
  }

  public clearPrivateState(): void {
    this.sessionVersion++;
    if (this.ready) this.message('Đã kết nối máy chủ đấu trường.');
    this.clearReplay();
    this.currentSubmission = null;
    this.store.currentGauntletMatches = [];
    for (const id of ['submissionHistory', 'gauntletMatchesGrid', 'botTestMatchesGrid']) {
      document.getElementById(id)?.replaceChildren();
    }
    const labels: Record<string, string> = {
      botTestCountBadge: '0',
      gauntletCountBadge: '0',
      botTestSummaryBanner: 'Chạy thử bot trước khi nộp xếp hạng.',
      gauntletSummaryBanner: 'Nộp bot để thi đấu, hoặc mở một bài nộp cũ từ lịch sử.'
    };
    for (const [id, text] of Object.entries(labels)) {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    }
    const download = document.getElementById('btnDownloadLog') as HTMLButtonElement | null;
    if (download) download.disabled = true;
    const editor = document.getElementById('codeEditor') as HTMLTextAreaElement | null;
    this.store.userDraftByLang = { ...this.store.templatesByLang };
    if (editor) editor.value = this.store.templatesByLang[this.store.currentLang] || '';
  }

  public downloadLog(): void {
    if (!this.currentSubmission) return;
    const { sourceCode: _source, ...log } = this.currentSubmission;
    const blob = new Blob([JSON.stringify({ schemaVersion: 1, ruleset: 'rps-9x9-v1', initialBoard: this.store.initialBoardTemplate, ...log }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${log.id}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
