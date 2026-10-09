import { HttpInterceptorFn } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { inject } from '@angular/core';
import { Router } from '@angular/router';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const authReq = req.clone({
    withCredentials: true
  });
 
  return next(authReq).pipe(
    catchError(err => {
      if (err.status === 401) {
        // El panel del sorteo tiene su propio inicio de sesión
        if (req.url.includes('api/admin/')) {
          if (!req.url.endsWith('api/admin/login')) router.navigate(['/admin/login']);
        } else {
          router.navigate(['/auth/login']);
        }
      }
      return throwError(() => err);
    })
  );
};