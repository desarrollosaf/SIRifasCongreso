import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AdminApiService } from '../../../service/admin-api.service';

export const adminGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(AdminApiService).me().pipe(
    map(() => true),
    catchError(() => of(router.createUrlTree(['/admin/login']))),
  );
};
