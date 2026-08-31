import {
  AfterViewChecked,
  Component,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Dialog } from '@angular/cdk/dialog';
import { Subscription } from 'rxjs';
import { BotService, BotTurn } from '../../services/bot.service';

interface BotMessage {
  role: 'user' | 'assistant';
  text: string;
}

const GREETING =
  'שלום! אני העוזר של מטיילים ומכירים. אפשר לשאול אותי כל שאלה על האתר – מה אפשר לעשות בו, האם יש עלות, איך פותחים פרופיל ועוד.';

/** How many earlier turns travel with each question. The server trims to its
 *  own limit as well - this only keeps the request small. */
const HISTORY_TURNS = 6;

/** A transcript lands in the box for the user to check before sending. Hebrew
 *  speech recognition mangles names and slang, and answering the wrong question
 *  confidently is worse than one extra tap. Set true for WhatsApp-style
 *  send-on-release. */
const AUTO_SEND_AFTER_SPEECH = false;

/** Recordings stop themselves here so a forgotten mic cannot upload minutes of
 *  audio. The server refuses anything over 8MB regardless. */
const MAX_RECORDING_MS = 60_000;

/** Under this, a press reads as a tap: recording continues until the next tap,
 *  which is what desktop users expect. Above it, it is a WhatsApp-style hold
 *  and releasing ends the recording. */
const TAP_THRESHOLD_MS = 300;

/** Anything shorter than this holds no speech, and Whisper answers silence by
 *  inventing a sentence rather than returning nothing - so it is discarded
 *  here instead of being uploaded. The usual cause is the first use, where the
 *  permission prompt eats the whole press. */
const MIN_RECORDING_MS = 700;

/** Peak amplitude, 0-127 away from the silent midpoint, that a recording has to
 *  reach to count as speech. Whisper answers silence with a confident stock
 *  phrase - in Hebrew when Hebrew is requested - so silence has to be caught
 *  here rather than filtered out of the transcript afterwards. Deliberately
 *  low: wrongly rejecting a quiet speaker is worse than the odd invented line. */
const SILENCE_PEAK = 5;

/** Movement under this reads as a tap that opens the chat; past it the press is
 *  a drag and must not also toggle the panel. */
const DRAG_SLOP_PX = 6;

/** Where the user parked the button, so it stays put between visits. */
const FAB_POS_KEY = 'bot-fab-offset';

@Component({
  selector: 'app-bot-widget',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (!dialogOpen()) {
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

              @if (m.role === 'assistant' && canSpeak()) {
                <button
                  type="button"
                  class="bot-speak"
                  [attr.aria-label]="speaking() === $index ? 'עצירת ההקראה' : 'הקראת התשובה'"
                  (click)="toggleSpeak($index, m.text)">{{ speaking() === $index ? '⏹' : '🔊' }}</button>
              }
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

        @if (recording()) {
          <div class="bot-rec">
            <span class="bot-rec__dot"></span>
            <span class="bot-rec__time">{{ elapsedLabel() }}</span>
            <span class="bot-rec__hint">מקליט… שחררו לסיום</span>
            <button
              type="button"
              class="bot-rec__cancel"
              (click)="cancelRecording()">ביטול</button>
          </div>
        }

        <form class="bot-panel__form" (ngSubmit)="send()">
          <textarea
            class="bot-input"
            rows="1"
            maxlength="500"
            [placeholder]="transcribing() ? 'מתמלל…' : 'כתבו שאלה...'"
            [(ngModel)]="draft"
            [ngModelOptions]="{ standalone: true }"
            (keydown)="onKeydown($event)"></textarea>

          @if (canRecord()) {
            <button
              type="button"
              class="bot-mic"
              [class.bot-mic--on]="recording()"
              [disabled]="pending() || transcribing()"
              aria-label="הקלטת שאלה"
              (pointerdown)="onMicDown($event)"
              (pointerup)="onMicUp()"
              (pointercancel)="cancelRecording()">🎤</button>
          }

          <button
            type="submit"
            class="bot-send"
            [disabled]="pending() || transcribing() || !draft.trim()">שלח</button>
        </form>
      </section>
    }

    <button
      type="button"
      class="bot-fab"
      [class.bot-fab--dragging]="dragging()"
      [style.transform]="'translate(' + offset().x + 'px,' + offset().y + 'px)'"
      [attr.aria-label]="open() ? 'סגירת הצ׳אט' : 'פתיחת הצ׳אט'"
      #fab
      (pointerdown)="onFabDown($event)"
      (pointermove)="onFabMove($event)"
      (pointerup)="onFabUp($event)"
      (pointercancel)="onFabUp($event)"
      (click)="onFabClick()">{{ open() ? '✕' : '💬' }}</button>
    }
  `,
  styles: [
    `
      :host {
        position: fixed;
        bottom: 16px;
        inset-inline-start: 16px;
        /* Must stay under the CDK overlay container (1000). Above it, this
           button covers the chat window's send control - which sits in the
           same bottom-start corner in RTL - and swallows the tap. */
        z-index: 900;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 10px;
        font: 400 0.92rem/1.5 system-ui, -apple-system, Segoe UI, Roboto, Arial,
          sans-serif;
      }

      /* Floating button */
      .bot-fab {
        /* the drag is handled in script, so the browser must not treat the
           gesture as a page scroll */
        touch-action: none;
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
      }

      /* no transition while dragging, or the button lags behind the finger */
      .bot-fab--dragging {
        transition: none;
        cursor: grabbing;
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.35);
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
        align-items: flex-end;
        gap: 6px;
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

      /* Read-aloud button next to each answer */
      .bot-speak {
        flex: none;
        border: none;
        background: transparent;
        cursor: pointer;
        font-size: 0.95rem;
        line-height: 1;
        padding: 4px;
        opacity: 0.55;
        transition: opacity 0.15s ease;
      }

      .bot-speak:hover {
        opacity: 1;
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

      /* Recording strip */
      .bot-rec {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        background: #fff4f4;
        border-top: 1px solid #f3d5d5;
        font-size: 0.85rem;
        color: #8a2b2b;
      }

      .bot-rec__dot {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: #d93636;
        animation: bot-pulse 1s infinite ease-in-out;
      }

      @keyframes bot-pulse {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.25;
        }
      }

      .bot-rec__time {
        font-variant-numeric: tabular-nums;
        font-weight: 700;
      }

      .bot-rec__hint {
        flex: 1;
        opacity: 0.8;
      }

      .bot-rec__cancel {
        border: none;
        background: transparent;
        color: #8a2b2b;
        text-decoration: underline;
        cursor: pointer;
        font: inherit;
        padding: 0;
      }

      .bot-panel__form {
        display: flex;
        align-items: flex-end;
        gap: 6px;
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

      .bot-mic {
        flex: none;
        width: 38px;
        height: 38px;
        border-radius: 50%;
        border: 1px solid #c9d6ef;
        background: #ffffff;
        font-size: 1.05rem;
        line-height: 1;
        cursor: pointer;
        /* stop the long-press text selection / callout on mobile */
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
        -webkit-touch-callout: none;
      }

      .bot-mic--on {
        background: #d93636;
        border-color: #d93636;
        transform: scale(1.08);
      }

      .bot-mic:disabled {
        opacity: 0.5;
        cursor: not-allowed;
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
export class BotWidgetComponent implements AfterViewChecked, OnDestroy {

  private bot = inject(BotService);
  private dialog = inject(Dialog);
  private log = viewChild<ElementRef<HTMLDivElement>>('log');
  private fab = viewChild<ElementRef<HTMLButtonElement>>('fab');
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  open = signal(false);
  pending = signal(false);
  error = signal('');
  messages = signal<BotMessage[]>([{ role: 'assistant', text: GREETING }]);

  // voice input
  canRecord = signal(false);
  recording = signal(false);
  transcribing = signal(false);
  elapsedMs = signal(0);

  // voice output
  canSpeak = signal(false);
  speaking = signal<number | null>(null);

  // draggable launcher - it sits where the chat window's send button does
  offset = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  dragging = signal(false);

  /** A chat or profile dialog is modal: nothing of ours belongs on top of it. */
  dialogOpen = signal(false);

  draft = '';

  private scrollPending = false;
  private recorder?: MediaRecorder;
  private stream?: MediaStream;
  private chunks: Blob[] = [];
  private cancelled = false;
  private pressedAt = 0;
  private startedAt = 0;
  private holding = false;
  private timer?: ReturnType<typeof setInterval>;
  private audioCtx?: AudioContext;
  private analyser?: AnalyserNode;
  private peak = 0;
  private stopAt?: ReturnType<typeof setTimeout>;
  private heVoice: SpeechSynthesisVoice | null = null;
  private dragFrom = { x: 0, y: 0 };
  private dragOrigin = { x: 0, y: 0 };
  private dragMoved = false;
  private dialogSubs: Subscription[] = [];

  constructor() {
    if (!this.isBrowser) return;

    // getUserMedia is undefined outside a secure context, so this also covers
    // the case of the site being opened over plain http.
    this.canRecord.set(
      !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'
    );

    this.restoreOffset();

    this.dialogSubs.push(
      this.dialog.afterOpened.subscribe(() => this.dialogOpen.set(true)),
      this.dialog.afterAllClosed.subscribe(() => this.dialogOpen.set(false))
    );
    window.addEventListener('resize', this.reclamp);
    window.addEventListener('orientationchange', this.reclamp);

    if ('speechSynthesis' in window) {
      this.loadVoice();
      // getVoices() is usually empty on the first call - the list arrives
      // asynchronously, so without this the button never appears.
      speechSynthesis.addEventListener('voiceschanged', this.loadVoice);
    }
  }

  private loadVoice = () => {
    this.heVoice =
      speechSynthesis.getVoices().find(v => v.lang?.toLowerCase().startsWith('he')) ?? null;
    this.canSpeak.set(!!this.heVoice);
  };

  elapsedLabel() {
    const s = Math.floor(this.elapsedMs() / 1000);
    return `0:${String(s).padStart(2, '0')}`;
  }

  // ------------------------------------------------------------ moving the FAB

  onFabDown(event: PointerEvent) {
    this.dragFrom = { x: event.clientX, y: event.clientY };
    this.dragOrigin = { ...this.offset() };
    this.dragMoved = false;
    this.dragging.set(true);
    // keeps the moves coming even when the finger leaves the button
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  onFabMove(event: PointerEvent) {
    if (!this.dragging()) return;
    const dx = event.clientX - this.dragFrom.x;
    const dy = event.clientY - this.dragFrom.y;

    if (!this.dragMoved && Math.hypot(dx, dy) < DRAG_SLOP_PX) return;
    this.dragMoved = true;
    event.preventDefault();

    this.offset.set(
      this.clamp(
        event.target as HTMLElement,
        this.dragOrigin.x + dx,
        this.dragOrigin.y + dy
      )
    );
  }

  onFabUp(event: PointerEvent) {
    if (!this.dragging()) return;
    this.dragging.set(false);
    (event.target as HTMLElement).releasePointerCapture?.(event.pointerId);

    if (this.dragMoved) this.saveOffset();
  }

  /** Click also covers Enter and Space, so the button stays usable from a
   *  keyboard - pointerup alone would have broken that. */
  onFabClick() {
    if (this.dragMoved) {
      this.dragMoved = false; // consumed: the next click is a real one
      return;
    }
    this.toggle();
  }

  /** Keeps the button fully on screen, whatever it was dragged over. */
  private clamp(el: HTMLElement, x: number, y: number) {
    const r = el.getBoundingClientRect();
    // where the button sits with the offset currently applied
    const left = r.left - this.offset().x;
    const top = r.top - this.offset().y;
    const margin = 8;
    const minX = margin - left;
    const maxX = window.innerWidth - r.width - margin - left;
    const minY = margin - top;
    const maxY = window.innerHeight - r.height - margin - top;
    return {
      x: Math.min(Math.max(x, minX), maxX),
      y: Math.min(Math.max(y, minY), maxY),
    };
  }

  /** A spot that was on screen in landscape can be outside it in portrait. */
  private reclamp = () => {
    const el = this.fab()?.nativeElement;
    if (!el) return;
    const o = this.offset();
    const next = this.clamp(el, o.x, o.y);
    if (next.x !== o.x || next.y !== o.y) {
      this.offset.set(next);
      this.saveOffset();
    }
  };

  private restoreOffset() {
    try {
      const raw = localStorage.getItem(FAB_POS_KEY);
      if (!raw) return;
      const p = JSON.parse(raw);
      if (typeof p?.x === 'number' && typeof p?.y === 'number') this.offset.set(p);
    } catch {
      // private browsing, or a value from an older build - the default is fine
    }
  }

  private saveOffset() {
    try {
      localStorage.setItem(FAB_POS_KEY, JSON.stringify(this.offset()));
    } catch {
      // not being able to remember the spot is not worth breaking the drag
    }
  }

  // ---------------------------------------------------------------------- chat

  toggle() {
    this.open.update(v => !v);
    if (this.open()) this.scrollPending = true;
    else this.stopSpeaking();
  }

  close() {
    this.open.set(false);
    this.stopSpeaking();
  }

  /** Enter sends, Shift+Enter starts a new line - what every chat box does. */
  onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  // ---------------------------------------------------------------- recording

  onMicDown(event: PointerEvent) {
    event.preventDefault();
    // A press while already recording (tap mode) means "stop".
    if (this.recording()) {
      this.finishRecording();
      return;
    }
    this.pressedAt = Date.now();
    this.holding = true;
    this.startRecording();
  }

  onMicUp() {
    if (!this.holding) return;
    this.holding = false;
    // A quick tap leaves the recorder running until the next tap; a real hold
    // ends when the finger lifts, the way a WhatsApp voice note does.
    if (Date.now() - this.pressedAt < TAP_THRESHOLD_MS) return;
    this.finishRecording();
  }

  private async startRecording() {
    this.error.set('');
    // Starting a recording replaces whatever is in the box - a new question is
    // being asked, not added to the last one.
    this.draft = '';
    this.cancelled = false;
    this.chunks = [];

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      // Denied, dismissed, or no microphone - all look the same here.
      this.holding = false;
      this.error.set('אין גישה למיקרופון. אפשר לכתוב את השאלה במקום.');
      return;
    }

    // The recording never left as a hold - the user let go while the permission
    // prompt was up, so there is nothing to record.
    if (!this.holding && Date.now() - this.pressedAt >= TAP_THRESHOLD_MS) {
      this.releaseStream();
      return;
    }

    const mime = this.pickMimeType();
    // MediaRecorder's default opus bitrate is low enough to blur consonants,
    // which Hebrew recognition is sensitive to. 128kbps of speech is still a
    // few hundred KB a minute, well inside the server's 8MB cap.
    this.recorder = new MediaRecorder(this.stream, {
      ...(mime ? { mimeType: mime } : {}),
      audioBitsPerSecond: 128_000,
    });
    this.recorder.ondataavailable = e => {
      if (e.data.size) this.chunks.push(e.data);
    };
    this.recorder.onstop = () => this.onRecorderStopped();
    this.recorder.start();

    this.watchLevel();

    this.recording.set(true);
    this.elapsedMs.set(0);
    const startedAt = Date.now();
    this.startedAt = startedAt;
    this.timer = setInterval(() => {
      this.elapsedMs.set(Date.now() - startedAt);
      this.sampleLevel();
    }, 100);
    this.stopAt = setTimeout(() => this.finishRecording(), MAX_RECORDING_MS);
  }

  /** Taps the live stream so we can tell speech from an open mic in a quiet
   *  room. Failure here is not fatal - it just means no silence check. */
  private watchLevel() {
    this.peak = 0;
    try {
      this.audioCtx = new AudioContext();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.audioCtx.createMediaStreamSource(this.stream!).connect(this.analyser);
    } catch {
      this.analyser = undefined;
    }
  }

  private sampleLevel() {
    if (!this.analyser) return;
    const buf = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(buf);
    for (const v of buf) {
      const amp = Math.abs(v - 128);
      if (amp > this.peak) this.peak = amp;
    }
  }

  /** Chrome and Android produce webm/opus; iOS Safari only does mp4/aac. */
  private pickMimeType(): string {
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
    return candidates.find(t => MediaRecorder.isTypeSupported?.(t)) ?? '';
  }

  private finishRecording() {
    if (!this.recording()) return;
    this.clearTimers();
    this.recording.set(false);
    this.recorder?.stop();
  }

  cancelRecording() {
    if (!this.recording()) {
      this.releaseStream();
      return;
    }
    this.cancelled = true;
    this.holding = false;
    this.finishRecording();
  }

  private onRecorderStopped() {
    const type = this.recorder?.mimeType || 'audio/webm';
    const blob = new Blob(this.chunks, { type });
    this.releaseStream();

    if (this.cancelled || !blob.size) return;

    if (Date.now() - this.startedAt < MIN_RECORDING_MS) {
      this.error.set('ההקלטה קצרה מדי. החזיקו את הכפתור ודברו.');
      return;
    }

    // analyser undefined means the level check could not run; upload anyway
    // rather than blocking a recording we simply could not measure.
    if (this.analyser && this.peak < SILENCE_PEAK) {
      this.error.set('לא שמענו כלום. בדקו את המיקרופון ונסו שוב.');
      return;
    }

    const ext = type.includes('mp4') ? 'm4a' : 'webm';
    this.transcribing.set(true);

    this.bot.transcribe(blob, `question.${ext}`).subscribe({
      next: res => {
        this.transcribing.set(false);
        const text = (res.text || '').trim();
        if (!text) {
          // The server discards transcriptions with no Hebrew in them - those
          // are Whisper inventing words over silence, not something said.
          this.error.set('לא זיהינו מה נאמר. נסו שוב או כתבו את השאלה.');
          return;
        }
        this.draft = text;
        if (AUTO_SEND_AFTER_SPEECH) this.send();
      },
      error: err => {
        this.transcribing.set(false);
        this.error.set(
          err?.error?.detail || 'לא הצלחנו לתמלל את ההקלטה. נסו שוב.'
        );
      },
    });
  }

  private releaseStream() {
    // Without this the browser keeps showing the "recording" indicator and the
    // microphone stays held open.
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = undefined;
    this.recorder = undefined;
    this.analyser = undefined;
    this.audioCtx?.close().catch(() => {});
    this.audioCtx = undefined;
  }

  private clearTimers() {
    if (this.timer) clearInterval(this.timer);
    if (this.stopAt) clearTimeout(this.stopAt);
    this.timer = undefined;
    this.stopAt = undefined;
  }

  // ------------------------------------------------------------------ speech

  toggleSpeak(index: number, text: string) {
    if (this.speaking() === index) {
      this.stopSpeaking();
      return;
    }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (this.heVoice) u.voice = this.heVoice;
    u.lang = this.heVoice?.lang || 'he-IL';
    u.onend = () => this.speaking.set(null);
    u.onerror = () => this.speaking.set(null);
    this.speaking.set(index);
    speechSynthesis.speak(u);
  }

  private stopSpeaking() {
    if (!this.isBrowser || !('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    this.speaking.set(null);
  }

  // -------------------------------------------------------------------- chat

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

  ngOnDestroy() {
    this.dialogSubs.forEach(s => s.unsubscribe());
    if (this.isBrowser) {
      window.removeEventListener('resize', this.reclamp);
      window.removeEventListener('orientationchange', this.reclamp);
    }
    this.clearTimers();
    this.releaseStream();
    if (this.isBrowser && 'speechSynthesis' in window) {
      speechSynthesis.removeEventListener('voiceschanged', this.loadVoice);
      speechSynthesis.cancel();
    }
  }
}
