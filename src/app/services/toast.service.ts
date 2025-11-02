// toast.service.ts
import { Injectable, inject } from '@angular/core';
import { Overlay, OverlayConfig } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { ToastComponent } from '../components/toast/toast.component';

@Injectable({ providedIn: 'root' })
export class ToastService {
  private overlay = inject(Overlay);

  show(message: string, duration = 2200) {
    const positionStrategy = this.overlay.position()
      .global()
      .centerHorizontally()
      .bottom('40px');

    const config = new OverlayConfig({
      hasBackdrop: false,
      positionStrategy,
      panelClass: 'toast-panel'
    });

    const overlayRef = this.overlay.create(config);
    const portal = new ComponentPortal(ToastComponent);
    const componentRef = overlayRef.attach(portal);
    (componentRef.instance as ToastComponent).message = message;
    setTimeout(() => overlayRef.dispose(), duration);
  }
}

