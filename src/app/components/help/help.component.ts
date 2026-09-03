import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { BotService } from '../../services/bot.service';

/** One rendered chunk of the knowledge document. */
interface HelpSection {
  title: string;
  /** Plain paragraphs, in order. */
  paragraphs: string[];
  /** Bullet lines, in order. */
  bullets: string[];
}

/** Written for whoever maintains the bot, not for a visitor reading help. */
const SKIP_SECTIONS = ['1. מטרת המסמך'];

@Component({
  selector: 'app-help',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './help.component.html',
  styleUrls: ['./help.component.scss'],
})
export class HelpComponent {

  private bot = inject(BotService);

  sections = signal<HelpSection[]>([]);
  loading = signal(true);
  failed = signal(false);

  constructor() {
    // The same document the bot answers from, so the two can never disagree.
    this.bot.knowledge().subscribe({
      next: res => {
        this.sections.set(this.parse(res.markdown || ''));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.failed.set(true);
      },
    });
  }

  /** The document is a numbered outline, not general markdown: "7. כותרת"
   *  starts a section, a line opening with • is a bullet, anything else is a
   *  paragraph. A full markdown parser would be more machinery than the shape
   *  of this file needs. */
  private parse(md: string): HelpSection[] {
    const heading = /^(\d+[a-z]?)\.\s+(.+)$/;
    const out: HelpSection[] = [];
    let current: HelpSection | null = null;

    for (const raw of md.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;

      const m = line.match(heading);
      if (m) {
        current = { title: m[2].trim(), paragraphs: [], bullets: [] };
        out.push(current);
        continue;
      }

      if (!current) continue;
      if (line.startsWith('•')) current.bullets.push(line.replace(/^•\s*/, ''));
      else current.paragraphs.push(line);
    }

    return out.filter(
      s => !SKIP_SECTIONS.some(skip => skip.endsWith(s.title))
    );
  }
}
