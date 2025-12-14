import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

type HelpLink = { text: string; href: string; external?: boolean };

@Component({
  selector: 'app-help',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './help.component.html',
  styleUrls: ['./help.component.scss'],
})

export class HelpComponent {
  leftTitle = 'עזרה בהגדרות הפרופיל האישי';

  leftLinks: HelpLink[] = [
    { text: 'שינוי הגדרות הפרופיל', href: '/profile/settings' },
    { text: 'להוסיף/לבטל אתר', href: '/profile/website' },
    { text: 'העלאת תמונה ראשית לפרופיל', href: '/register' },
    { text: 'עדכון פרטי הפרופיל', href: '/register' },
    { text: 'יצירת חברים בפרופיל', href: '/home' },
    { text: 'איך נראה הפרופיל שלי?', href: '/me' },
  ];

  rightTitle = 'עזרה באפליקציות השונות באתר';

  rightTopLinks: HelpLink[] = [
    { text: 'שאלות למערכת', href: '/help/faq' },
    { text: 'כניסה למערכת', href: '/login' },
  ];

  rightBottomLinks: HelpLink[] = [
    { text: 'להוסיף מודעות בעמוד הראשי', href: '/help/home-ads' },
    { text: 'העלאת מדיה לפרופיל האישי', href: '/help/media' },
    { text: 'פילטר אירועים/יוזים באתר', href: '/search' },
  ];

  // שים כאן כל תמונה שתרצה (assets או URL מלא)
  previewImageUrl = 'assets/help/help-preview.png';

  // טקסט מרכזי כמו בתמונה
  rightNotice =
    'כדי להיכנס למערכת על מנת להשתמש באפליקציות\nהשונות של האתר יש להירשם גם כמשתמש, לתופס הרשמה\nשמופיע בצד ימין למעלה.';
}
