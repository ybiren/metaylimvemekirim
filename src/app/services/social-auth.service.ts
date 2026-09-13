import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { Observable, of, shareReplay } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface SocialAuthConfig {
  google: boolean;
  googleClientId: string;
  facebook: boolean;
  facebookAppId: string;
}

const GOOGLE_SDK = 'https://accounts.google.com/gsi/client';
const FACEBOOK_SDK = 'https://connect.facebook.net/he_IL/sdk.js';

declare const google: any;
declare const FB: any;

/**
 * Signing in through Google or Facebook.
 *
 * Both providers hand the browser a token; this service does nothing with it
 * except pass it to our own server, which is where it gets checked. Whatever
 * name or address the provider also shows the browser is display material
 * only - the account that gets logged in is decided server-side.
 *
 * Neither SDK is in index.html: they are fetched the first time somebody opens
 * the login page, so a visitor who never signs in this way never loads them.
 */
@Injectable({ providedIn: 'root' })
export class SocialAuthService {
  private http = inject(HttpClient);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private config$?: Observable<SocialAuthConfig>;
  private scripts = new Map<string, Promise<void>>();
  private facebookReady?: Promise<void>;

  /** Which providers this deployment has been configured with. */
  loadConfig(): Observable<SocialAuthConfig> {
    if (!this.config$) {
      this.config$ = this.http
        .get<SocialAuthConfig>(`${environment.apibase}/auth/config`)
        .pipe(
          // An older server, or one that is simply down, means no social
          // buttons - never a login page that fails to render.
          catchError(() =>
            of({ google: false, googleClientId: '', facebook: false, facebookAppId: '' })
          ),
          shareReplay(1)
        );
    }
    return this.config$;
  }

  private loadScript(src: string): Promise<void> {
    if (!this.isBrowser) return Promise.reject(new Error('not a browser'));

    let pending = this.scripts.get(src);
    if (!pending) {
      pending = new Promise<void>((resolve, reject) => {
        const el = document.createElement('script');
        el.src = src;
        el.async = true;
        el.defer = true;
        el.onload = () => resolve();
        el.onerror = () => {
          // Drop the cached promise so a later attempt can retry: the usual
          // reason for this is a blocked tracker list or a dead connection.
          this.scripts.delete(src);
          reject(new Error(`failed to load ${src}`));
        };
        document.head.appendChild(el);
      });
      this.scripts.set(src, pending);
    }
    return pending;
  }

  /**
   * Draw Google's own sign-in button into `host`.
   *
   * Google's button rather than one of ours: the alternatives (One Tap, the
   * popup token flow) get swallowed by popup blockers and by browsers that
   * have not enabled FedCM, and the rendered button is the one path Google
   * supports everywhere. `onCredential` receives the ID token to send on.
   */
  async renderGoogleButton(
    host: HTMLElement,
    clientId: string,
    onCredential: (credential: string) => void
  ): Promise<void> {
    await this.loadScript(GOOGLE_SDK);

    google.accounts.id.initialize({
      client_id: clientId,
      callback: (res: { credential?: string }) => {
        if (res?.credential) onCredential(res.credential);
      },
      // Never sign anyone in without them pressing the button: this page is
      // also reached by members who came to switch accounts.
      auto_select: false,
    });

    google.accounts.id.renderButton(host, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      shape: 'rectangular',
      text: 'signin_with',
      locale: 'he',
      width: host.clientWidth || 280,
    });
  }

  private async initFacebook(appId: string): Promise<void> {
    if (!this.facebookReady) {
      this.facebookReady = this.loadScript(FACEBOOK_SDK).then(() => {
        FB.init({ appId, cookie: false, xfbml: false, version: 'v19.0' });
      });
    }
    return this.facebookReady;
  }

  /**
   * Open Facebook's login popup and return the access token it grants.
   *
   * Resolves to null when the visitor closes the popup or refuses - that is a
   * change of mind, not an error worth showing them.
   */
  async facebookSignIn(appId: string): Promise<string | null> {
    await this.initFacebook(appId);

    return new Promise<string | null>((resolve) => {
      FB.login(
        (res: any) => resolve(res?.authResponse?.accessToken ?? null),
        { scope: 'email' }
      );
    });
  }

  /** Ends the Facebook session this page opened, not the member's site login. */
  facebookSignOut(): void {
    if (!this.isBrowser || typeof FB === 'undefined') return;
    try {
      FB.getLoginStatus((res: any) => {
        if (res?.status === 'connected') FB.logout();
      });
    } catch {
      // The SDK was never loaded, or the popup was blocked - nothing to end.
    }
  }

  loginWithGoogle(credential: string) {
    return this.http.post(`${environment.apibase}/login/google`, { credential });
  }

  loginWithFacebook(accessToken: string) {
    return this.http.post(`${environment.apibase}/login/facebook`, { accessToken });
  }
}
