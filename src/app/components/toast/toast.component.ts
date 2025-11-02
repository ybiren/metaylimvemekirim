import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-toast',
  template: `<div class="toast">{{ message }}</div>`,
  styles: [`
    .toast {
      background: #323232;
      color: #fff;
      padding: 12px 18px;
      border-radius: 8px;
      font-size: 14px;
      box-shadow: 0 4px 14px rgba(0,0,0,.3);
      animation: fadein .25s ease-out;
    }
    @keyframes fadein { from { opacity: 0; transform: translateY(10px); } }
  `]
})
export class ToastComponent {
  @Input() message = '';
}