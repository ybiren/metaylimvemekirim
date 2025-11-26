import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'about-us',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="about-shell" dir="rtl">
      <!-- Top row: logo + title + CTA -->
      <header class="about-header">
        <div class="about-header__logo">
          <a routerLink="/home">
            <img src="assets/images/logo.jpg" alt="פגוש אותי" />
          </a>
        </div>

        <div class="about-header__text">
          <h1>אודות פגוש אותי</h1>
          <p>
            פורטל אירועים ורשת חברתית שמחברת בין אנשים, טיולים, מסיבות, קהילות
            ובלוגים – הכול במקום אחד, ללא עלות שימוש.
          </p>
        </div>

        <div class="about-header__cta">
          <a routerLink="/register" class="btn-primary">
            פתיחת פרופיל חדש
          </a>
          <a routerLink="/contact" class="btn-ghost">
            כתבו לנו בכל נושא
          </a>
        </div>
      </header>

      <!-- Main layout: text + feature cards -->
      <div class="about-layout">
        <!-- Long text column -->
        <article class="about-body">
          <p>
            אתר <strong>פגוש אותי</strong> הוא פורטל אירועים ורשת חברתית. השימוש
            באתר <strong>חינמי</strong> – גם לפתיחת פרופיל אישי וגם ליצירת
            אירועים.
          </p>

          <p>
            אפשר ליצור בעצמכם אירועים חברתיים מעניינים – מסיבות, טיולים, חוגים,
            מפגשים ועוד – לכלל האוכלוסייה או לקבוצות ממוקדות (רווקים/ות, משפחות,
            ילדים, נוער ועוד). האירועים מופיעים בדף האירועים בקטגוריות הרלוונטיות.
          </p>

          <p>
            בנוסף, ניתן לחפש חברים ומכרים, להוסיף אותם לרשימת החברים, להצטרף
            לקהילות, לפתוח אלבומי תמונות, לכתוב בלוגים ומאמרים ולהגיב לתוכן של
            אחרים – הכול באווירה קהילתית וחברית.
          </p>

          <p>
            האתר אינו מוגדר כ"<strong>אתר הכרויות</strong>" קלאסי, אלא
            <strong>פורטל אירועים ורשת חברתית</strong> – מקום להכיר, לטייל
            ולהיפגש דרך פעילות משותפת.
          </p>

          <p>
            נודה אם תשתמשו במערכת החברים וההודעות
            <strong>בגבולות הטעם הטוב</strong>, עם שם אמיתי ותמונה, כדי לשמור על
            איכות הקהילה ולמנוע כרטיסים כפולים והטרדות.
          </p>

          <p>
            השימוש באתר חינם, אך ניתן לקדם אירועים ותוכן בעזרת
            <strong>מערכת הקידום</strong> שלנו לקבלת חשיפה גדולה יותר במקומות
            מרכזיים באתר.
          </p>

          <p>
            נשמח לשיתופי פעולה, הצעות לשיפור, רעיונות לאירועים ויוזמות קהילה
            חדשות.
          </p>

          <p>מקווים שתיהנו מהגלישה באתר,</p>
          <p><strong>צוות אתר פגוש אותי</strong></p>
        </article>

        <!-- Feature cards grid -->
        <aside class="about-features">
          <div class="feature-grid">
            <article class="feature-card">
              <h2>יצירת אירועים חברתיים</h2>
              <p>
                יצירת אירועים ללא תשלום: מסיבות, טיולים, סדנאות, מפגשים ועוד.
                בחירת קטגוריות, תיאור, תאריכים ומיקום – והאירוע מיד עולה לאתר.
              </p>
            </article>

            <article class="feature-card">
              <h2>חברים ורשימות היכרות</h2>
              <p>
                מנוע חיפוש נוח למציאת חברים, מכרים ואנשים חדשים. הוספה לרשימת
                החברים, שליחת הודעות וצ׳אטים אחד-על-אחד.
              </p>
            </article>

            <article class="feature-card">
              <h2>חדר צ׳אט וצ׳אט פרטי</h2>
              <p>
                חדר צ׳אט פתוח בשעות הערב לשיחות קבוצתיות, וגם אפשרות לצ׳אטים
                פרטיים בין חברי האתר – פשוט, מהיר וידידותי.
              </p>
            </article>

            <article class="feature-card">
              <h2>אלבומי תמונות אישיים</h2>
              <p>
                פתיחת מספר אלבומים בפרופיל האישי, העלאת תמונות מטיולים, אירועים
                וחוויות משותפות, ושיתוף עם החברים.
              </p>
            </article>

            <article class="feature-card">
              <h2>קהילות לפי עניין</h2>
              <p>
                קהילות סביב תחומי עניין שונים – טיולים, מוזיקה, ספורט, הורות ועוד.
                אפשר להצטרף לקהילות קיימות או לפתוח קהילה משלכם.
              </p>
            </article>

            <article class="feature-card">
              <h2>בלוגים ומאמרים</h2>
              <p>
                כתיבת מאמרים ופוסטים בנושאים שמעניינים אתכם. התוכן מופיע בפרופיל
                האישי ובדף הבלוגים, וחברי האתר יכולים להגיב ולשתף.
              </p>
            </article>

            <article class="feature-card feature-card--highlight">
              <h2>פרסום וקידום באתר</h2>
              <p>
                השימוש הרגיל באתר חינם, אך ניתן לקדם אירועים ותוכן בעזרת מערכת
                קידום ייעודית לקבלת חשיפה מוגברת.
              </p>
              <a routerLink="/contact" class="feature-link">
                לפרטים נוספים על קידום »
              </a>
            </article>
          </div>
        </aside>
      </div>
    </section>
  `,
  styles: [
    `
      .about-shell {
        max-width: 960px;
        margin: 0 auto;
        padding: 24px 16px 40px;
        display: flex;
        flex-direction: column;
        gap: 24px;
      }

      /* Header layout */
      .about-header {
        display: grid;
        grid-template-columns: auto minmax(0, 1.8fr) minmax(0, 1fr);
        align-items: center;
        gap: 16px;
        background: #e7f0ff;
        border-radius: 16px;
        padding: 16px 20px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
      }

      .about-header__logo img {
        display: block;
        width: 72px;
        height: 72px;
        border-radius: 16px;
        object-fit: cover;
      }

      .about-header__text h1 {
        margin: 0 0 6px;
        font-size: 1.6rem;
        font-weight: 700;
      }

      .about-header__text p {
        margin: 0;
        color: #444;
        line-height: 1.5;
        font-size: 0.95rem;
      }

      .about-header__cta {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
        justify-self: flex-end;
      }

      .btn-primary,
      .btn-ghost {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 8px 16px;
        border-radius: 999px;
        font-size: 0.9rem;
        text-decoration: none;
        cursor: pointer;
        border: 1px solid transparent;
        white-space: nowrap;
      }

      .btn-primary {
        background: #24a859;
        color: #fff;
        font-weight: 700;
      }

      .btn-primary:hover {
        background: #1d8b4a;
      }

      .btn-ghost {
        background: #ffffff;
        border-color: #c9d6ef;
        color: #173b6c;
      }

      .btn-ghost:hover {
        background: #f0f3fb;
      }

      /* Main 2-column layout */
      .about-layout {
        display: grid;
        grid-template-columns: minmax(0, 2fr) minmax(0, 1.4fr);
        gap: 24px;
        align-items: flex-start;
      }

      .about-body {
        background: #ffffff;
        border-radius: 16px;
        padding: 18px 20px;
        box-shadow: 0 4px 18px rgba(15, 23, 42, 0.08);
        line-height: 1.7;
        color: #333;
        font-size: 0.95rem;
      }

      .about-body p {
        margin: 0 0 0.8em;
        text-align: justify;
      }

      /* Feature cards grid */
      .about-features {
        width: 100%;
      }

      .feature-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 12px;
      }

      .feature-card {
        background: #ffffff;
        border-radius: 14px;
        padding: 12px 14px;
        box-shadow: 0 3px 10px rgba(15, 23, 42, 0.06);
        font-size: 0.9rem;
      }

      .feature-card h2 {
        margin: 0 0 4px;
        font-size: 1.02rem;
        font-weight: 700;
        color: #173b6c;
      }

      .feature-card p {
        margin: 0;
        color: #444;
        line-height: 1.5;
      }

      .feature-card--highlight {
        border: 1px solid #24a85933;
        background: #f3fff7;
      }

      .feature-link {
        display: inline-block;
        margin-top: 6px;
        font-size: 0.85rem;
        color: #1c7c3f;
        text-decoration: none;
      }

      .feature-link:hover {
        text-decoration: underline;
      }

      /* Responsive */
      @media (max-width: 900px) {
        .about-header {
          grid-template-columns: auto minmax(0, 1fr);
          grid-template-rows: auto auto;
        }

        .about-header__cta {
          grid-column: 1 / -1;
          flex-direction: row;
          justify-content: flex-start;
          flex-wrap: wrap;
        }

        .about-layout {
          grid-template-columns: minmax(0, 1fr);
        }
      }

      @media (max-width: 600px) {
        .about-shell {
          padding-inline: 12px;
        }

        .about-header {
          padding: 12px 14px;
        }

        .about-header__logo img {
          width: 60px;
          height: 60px;
        }
      }
    `,
  ],
})
export class AboutUsComponent {}
