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
      if (choice === 'facebook') this.shareFacebook(sharedUrl);
      if (choice === 'messenger') this.shareMessenger(sharedUrl);
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
    const text = encodeURIComponent(`${title}\n${sharedUrl}`);
    const waMe = `https://wa.me/?text=${text}`;

    // wa.me is a web page that deep-links on to the app, and the link it
    // builds names the consumer package (com.whatsapp) explicitly. A phone
    // carrying only WhatsApp Business (com.whatsapp.w4b) lands on "WhatsApp
    // is not installed" instead of a chat. The whatsapp:// scheme is
    // registered by both apps, so it reaches whichever one is really there.
    // Desktop keeps wa.me, which resolves to web.whatsapp.com and has no
    // such split.
    if (!this.isMobile()) {
      window.open(waMe, '_blank', 'noopener');
      return;
    }

    // Nothing reports back whether a custom scheme was handled. If an app
    // takes over, the page is hidden well before this fires; if no WhatsApp
    // of either flavour is installed, the page stays put and wa.me gets its
    // turn rather than the tap doing nothing at all.
    const fallback = window.setTimeout(() => {
      window.location.href = waMe;
    }, 1500);
    const cancel = () => window.clearTimeout(fallback);
    window.addEventListener('pagehide', cancel, { once: true });
    document.addEventListener('visibilitychange', cancel, { once: true });

    window.location.href = `whatsapp://send?text=${text}`;
  }

  private shareFacebook(sharedUrl) {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(sharedUrl)}`;
    window.open(url, '_blank', 'noopener,width=600,height=600');
  }

  private shareMessenger(sharedUrl) {
    // Facebook's real Messenger share dialog needs a registered app_id, which
    // this site doesn't have. Best-effort fallback: deep link into the
    // Messenger app on mobile (works if it's installed); on desktop there's
    // no app-id-free equivalent, so fall back to the Facebook sharer.
    if (this.isMobile()) {
      window.location.href = `fb-messenger://share/?link=${encodeURIComponent(sharedUrl)}`;
      return;
    }
    this.shareFacebook(sharedUrl);
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