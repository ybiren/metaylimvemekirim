import {
  AfterViewChecked,
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BotService, BotTurn } from '../../services/bot.service';

interface BotMessage {
  role: 'user' | 'assistant';
  text: string;
}

const GREETING =
  'שלום! אני העוזר של פגוש אותי. אפשר לשאול אותי כל שאלה על האתר – מה אפשר לעשות בו, האם יש עלות, איך פותחים פרופיל ועוד.';

/** How many earlier turns travel with each question. The server trims to its
 *  own limit as well - this only keeps the request small. */
const HISTORY_TURNS = 6;

@Component({
  selector: 'app-bot-widget',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (open()) {
      <section class="bot-panel" dir="rtl">
        <header class="bot-panel__head">
          <span class="bot-panel__title">שאלו אותנו</span>
          <button
            type="button"
            class="bot-panel__close"
            aria-label="סגירת הצ׳אט"
            (click)="close()">✕</button>
        </header>

        <div class="bot-panel__log" #log>
          @for (m of messages(); track $index) {
            <div class="bot-msg" [class.bot-msg--user]="m.role === 'user'">
              <div class="bot-bubble">{{ m.text }}</div>
            </div>
          }

          @if (pending()) {
            <div class="bot-msg">
              <div class="bot-bubble bot-bubble--typing">
                <span></span><span></span><span></span>
              </div>
            </div>
          }

          @if (error()) {
            <p class="bot-error">{{ error() }}</p>
          }
        </div>

        <form class="bot-panel__form" (ngSubmit)="send()">
          <textarea
            class="bot-input"
            rows="1"
            maxlength="500"
            placeholder="כתבו שאלה..."
            [(ngModel)]="draft"
            [ngModelOptions]="{ standalone: true }"
            (keydown)="onKeydown($event)"></textarea>

          <button
            type="submit"
            class="bot-send"
            [disabled]="pending() || !draft.trim()">שלח</button>
        </form>
      </section>
    }

    <button
      type="button"
      class="bot-fab"
      [attr.aria-label]="open() ? 'סגירת הצ׳אט' : 'פתיחת הצ׳אט'"
      (click)="toggle()">{{ open() ? '✕' : '💬' }}</button>
  `,
  styles: [
    `
      :host {
        position: fixed;
        bottom: 16px;
        inset-inline-start: 16px;
        z-index: 1200;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 10px;
        font: 400 0.92rem/1.5 system-ui, -apple-system, Segoe UI, Roboto, Arial,
          sans-serif;
      }

      /* Floating button */
      .bot-fab {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        border: none;
        background: #24a859;
        color: #fff;
        font-size: 1.5rem;
        line-height: 1;
        cursor: pointer;
        box-shadow: 0 6px 18px rgba(15, 23, 42, 0.25);
        transition: transform 0.15s ease, background 0.2s ease;
      }

      .bot-fab:hover {
        background: #1d8b4a;
        transform: translateY(-2px);
      }

      /* Panel */
      .bot-panel {
        width: 340px;
        max-width: calc(100vw - 32px);
        height: 460px;
        max-height: calc(100vh - 120px);
        display: flex;
        flex-direction: column;
        background: #ffffff;
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 12px 32px rgba(15, 23, 42, 0.22);
      }

      .bot-panel__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 10px 14px;
        background: #e7f0ff;
        border-bottom: 1px solid #d3e0f5;
      }

      .bot-panel__title {
        font-weight: 700;
        color: #173b6c;
      }

      .bot-panel__close {
        border: none;
        background: transparent;
        font-size: 1rem;
        line-height: 1;
        color: #173b6c;
        cursor: pointer;
        padding: 4px;
      }

      .bot-panel__log {
        flex: 1;
        overflow-y: auto;
        padding: 12px 14px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        background: #f7f9fc;
      }

      .bot-msg {
        display: flex;
        justify-content: flex-start;
      }

      .bot-msg--user {
        justify-content: flex-end;
      }

      .bot-bubble {
        max-width: 82%;
        padding: 8px 12px;
        border-radius: 14px;
        background: #ffffff;
        color: #333;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        box-shadow: 0 2px 6px rgba(15, 23, 42, 0.08);
      }

      .bot-msg--user .bot-bubble {
        background: #24a859;
        color: #fff;
      }

      /* Typing dots */
      .bot-bubble--typing {
        display: flex;
        gap: 4px;
        align-items: center;
      }

      .bot-bubble--typing span {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #9aa8bd;
        animation: bot-blink 1.2s infinite ease-in-out;
      }

      .bot-bubble--typing span:nth-child(2) {
        animation-delay: 0.2s;
      }

      .bot-bubble--typing span:nth-child(3) {
        animation-delay: 0.4s;
      }

      @keyframes bot-blink {
        0%,
        80%,
        100% {
          opacity: 0.25;
        }
        40% {
          opacity: 1;
        }
      }

      .bot-error {
        margin: 4px 0 0;
        color: #b3261e;
        font-size: 0.85rem;
        text-align: center;
      }

      .bot-panel__form {
        display: flex;
        align-items: flex-end;
        gap: 8px;
        padding: 10px 12px;
        border-top: 1px solid #e3e9f2;
        background: #ffffff;
      }

      .bot-input {
        flex: 1;
        resize: none;
        max-height: 90px;
        padding: 8px 10px;
        border: 1px solid #c9d6ef;
        border-radius: 12px;
        font: inherit;
        color: #222;
      }

      .bot-input:focus {
        outline: 2px solid rgba(36, 168, 89, 0.35);
        outline-offset: 1px;
      }

      .bot-send {
        border: none;
        border-radius: 999px;
        padding: 9px 16px;
        background: #24a859;
        color: #fff;
        font-weight: 700;
        cursor: pointer;
        white-space: nowrap;
      }

      .bot-send:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      @media (max-width: 600px) {
        :host {
          bottom: 12px;
          inset-inline-start: 12px;
        }

        .bot-panel {
          width: calc(100vw - 24px);
          height: calc(100vh - 140px);
        }
      }
    `,
  ],
})
export class BotWidgetComponent implements AfterViewChecked {

  private bot = inject(BotService);
  private log = viewChild<ElementRef<HTMLDivElement>>('log');

  open = signal(false);
  pending = signal(false);
  error = signal('');
  messages = signal<BotMessage[]>([{ role: 'assistant', text: GREETING }]);

  draft = '';

  private scrollPending = false;

  toggle() {
    this.open.update(v => !v);
    if (this.open()) this.scrollPending = true;
  }

  close() {
    this.open.set(false);
  }

  /** Enter sends, Shift+Enter starts a new line - what every chat box does. */
  onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  send() {
    const question = this.draft.trim();
    if (!question || this.pending()) return;

    // Take the history before the new question is appended, or the bot gets
    // the same question twice.
    const history = this.recentHistory();

    this.messages.update(list => [...list, { role: 'user', text: question }]);
    this.draft = '';
    this.error.set('');
    this.pending.set(true);
    this.scrollPending = true;

    this.bot.ask(question, history).subscribe({
      next: res => {
        this.pending.set(false);
        this.messages.update(list => [
          ...list,
          { role: 'assistant', text: res.answer },
        ]);
        this.scrollPending = true;
      },
      error: err => {
        this.pending.set(false);
        this.error.set(
          err?.error?.detail || 'שירות הבוט אינו זמין כרגע. נסו שוב מאוחר יותר.'
        );
        this.scrollPending = true;
      },
    });
  }

  /** The greeting is ours, not part of the conversation - skip it. */
  private recentHistory(): BotTurn[] {
    return this.messages()
      .slice(1)
      .slice(-HISTORY_TURNS)
      .map(m => ({ role: m.role, content: m.text }));
  }

  ngAfterViewChecked() {
    if (!this.scrollPending) return;
    const el = this.log()?.nativeElement;
    if (!el) return;
    this.scrollPending = false;
    el.scrollTop = el.scrollHeight;
  }
}
