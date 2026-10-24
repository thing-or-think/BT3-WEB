import { ArenaStore } from '../application/arenaStore';
import { SupportedLanguage } from '../domain/types';

export class EditorView {
  constructor(private readonly store: ArenaStore) {}

  public bindTabIndentation(): void {
    const editor = document.getElementById('codeEditor') as HTMLTextAreaElement | null;
    if (!editor) return;

    editor.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        editor.value = editor.value.substring(0, start) + '    ' + editor.value.substring(end);
        editor.selectionStart = editor.selectionEnd = start + 4;
      }
    });
  }

  public selectLanguage(lang: SupportedLanguage): void {
    const editor = document.getElementById('codeEditor') as HTMLTextAreaElement | null;
    if (!editor) return;

    this.store.userDraftByLang[this.store.currentLang] = editor.value;
    this.store.currentLang = lang;

    document.querySelectorAll('.lang-tab').forEach(btn => {
      const el = btn as HTMLElement;
      el.classList.toggle('active', el.dataset.lang === lang);
    });

    editor.value = this.store.userDraftByLang[lang] || this.store.templatesByLang[lang] || '';
  }

  public resetTemplateForCurrentLang(): void {
    const editor = document.getElementById('codeEditor') as HTMLTextAreaElement | null;
    if (!editor) return;

    this.store.userDraftByLang[this.store.currentLang] =
      this.store.templatesByLang[this.store.currentLang] || '';
    editor.value = this.store.userDraftByLang[this.store.currentLang];
  }

  public getCurrentCode(): string {
    const editor = document.getElementById('codeEditor') as HTMLTextAreaElement | null;
    return editor ? editor.value : '';
  }

  public getUsername(fallbackUsername?: string): string {
    if (fallbackUsername && fallbackUsername.trim()) {
      return fallbackUsername.trim();
    }
    const input = document.getElementById('usernameInput') as HTMLInputElement | null;
    return (input?.value || 'Khach_ChuaDangNhap').trim();
  }
}
