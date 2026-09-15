import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { AdminAuthService } from '../services/admin-auth.service';

/**
 * Keeps /admin behind a sign-in.
 *
 * This is a convenience, not the protection. It stops someone wandering into a
 * set of screens whose every request would fail, and sends them somewhere
 * useful instead. What actually protects anything is require_admin on the
 * server: the endpoints refuse a request without a good token however the
 * browser was persuaded to send it.
 *
 * So it asks the server rather than trusting a token being present - a revoked
 * or expired one has to land on the login form, not on a broken dashboard.
 */
export const adminGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AdminAuthService);
  const router = inject(Router);

  return auth.verify().pipe(
    map(ok =>
      ok
        ? true
        : router.createUrlTree(['/admin/login'], {
            // So signing in returns them to the screen they asked for rather
            // than always to the dashboard.
            queryParams: { returnUrl: state.url },
          })
    )
  );
};
