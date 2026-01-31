import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection, isDevMode, importProvidersFrom
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { appRoutes } from './app.routes';
import {
  provideClientHydration,
  withEventReplay,
} from '@angular/platform-browser';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptors, withInterceptorsFromDi } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
import { provideAnimations } from '@angular/platform-browser/animations';
import { NgxSpinnerModule } from 'ngx-spinner';
import { LoadingInterceptor } from './interceptors/loading.interceptor';
import { REGIONS_TOKEN, regions } from './consts/regions.consts';
import { gender, GENDER_TOKEN } from './consts/gender.consts';
import { FAMILY_STATUS_TOKEN, familyStatus } from './consts/family-status.consts';
import { education, EDUCATION_TOKEN } from './consts/education.consts';
import { work, WORK_TOKEN } from './consts/work.consts';
import { CHILDREN_STATUS_TOKEN, childrenStatus } from './consts/children-status.consts';
import { SMOKING_STATUS_TOKEN, smokingStatus } from './consts/smoking-status.consts';


export const appConfig: ApplicationConfig = {
  providers: [
    provideClientHydration(withEventReplay()),
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(appRoutes),
    provideHttpClient(withInterceptorsFromDi()),   // ⬅️ use FromDi
    provideServiceWorker('custom-sw.js', {
            enabled: !isDevMode(),
            registrationStrategy: 'registerWhenStable:30000'
          }),
    importProvidersFrom(NgxSpinnerModule),
    { provide: HTTP_INTERCEPTORS, useClass: LoadingInterceptor, multi: true },
     provideAnimations(),
     { provide: REGIONS_TOKEN, useValue: regions },
     { provide: GENDER_TOKEN, useValue: gender},
     { provide: FAMILY_STATUS_TOKEN, useValue: familyStatus},
     { provide: EDUCATION_TOKEN, useValue: education},
     { provide: WORK_TOKEN, useValue: work },
     { provide: CHILDREN_STATUS_TOKEN, useValue: childrenStatus },
     { provide: SMOKING_STATUS_TOKEN, useValue: smokingStatus }
   ],
};
