import { Injectable, inject } from '@angular/core';
import { ShareProfileDialogComponent } from '../components/user-details/share-profile-dialog.component';
import { Dialog } from '@angular/cdk/dialog';
import { ToastService } from './toast.service';


@Injectable({ providedIn: 'root' })
export class ShareUrlService {
  
  dialog = inject(Dialog);
  toast = inject(ToastService);
  

  openShareDialog(sharedUrl, sharedUserName) {
  
    const isMobile = this.isMobile();
    const title = sharedUserName ? 'שיתוף פרופיל:' : "שיתוף האתר";
    const subject = sharedUserName ? 'שיתוף פרופיל' : "";

    const ref = this.dialog.open(ShareProfileDialogComponent, {
      data: {
        profileUrl: sharedUrl,
        title,
        subject,
        name: sharedUserName,
        isMobile
      },
    panelClass: isMobile ? 'im-sheet' : 'im-dialog',

    hasBackdrop: true,
    backdropClass: 'share-backdrop',   // ⭐ חשוב
  });


    ref.closed.subscribe(async (choice) => {
      if (!choice || choice === 'cancel') return;

      if (choice === 'native') await this.shareNative(title, sharedUrl);
      if (choice === 'whatsapp') this.shareWhatsapp(title, sharedUrl);
      if (choice === 'email') this.shareEmail(subject, title, sharedUrl);
      if (choice === 'copy') this.copyLink(sharedUrl);
    });
  }

  private async shareNative(title: string, sharedUrl) {
    const share = (navigator as any).share;
    if (!share) {
      // fallback אם אין תמיכה
      this.shareWhatsapp(title, sharedUrl);
      return;
    }

    try {
      await share({
        title: 'פרופיל',
        text: `${title} ${sharedUrl}`,
        url: sharedUrl,
      });
    } catch(e) {
      alert(JSON.stringify(e));
      // user canceled / blocked → לא מציגים שגיאה
    }
  }

  private shareWhatsapp(title: string, sharedUrl) {
    const text = `${title}\n${sharedUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  }

  private shareEmail(subject: string, title: string, sharedUrl) {
    const body = `${title}\n${sharedUrl}`;
    window.location.href =
      `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  private async copyLink(sharedUrl) {
    try {
      await navigator.clipboard.writeText(sharedUrl);
      this.toast.show('הקישור הועתק 📋');
    } catch {
      const el = document.createElement('textarea');
      el.value = sharedUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      this.toast.show('הקישור הועתק 📋');
    }
  } 

  private isMobile(): boolean {
    return window.matchMedia('(max-width: 600px)').matches;
  }
 

}