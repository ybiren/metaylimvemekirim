import { Component } from '@angular/core';
import { DeviceDetectorService } from 'ngx-device-detector';
import { TopMenuComponent } from '../top-menu/top-menu.component';

@Component({
  selector: 'app-drag-image-kupid',
  standalone: true,
  imports: [TopMenuComponent],
  template: `
    <div style="display:flex;justify-content: center;align-items:center">
    <img
      [src]="currentImage"
      (touchstart)="onTouchStart($event)"
      (touchmove)="onTouchMove($event)"
      (touchend)="onTouchEnd($event)"
      alt="img"
      style="width: 220px; height: 220px; user-select: none; touch-action: none;"
    />
    </div>
  `,
})
export class DragImageKupidComponent {
  currentImage = 'https://scontent.ftlv5-1.fna.fbcdn.net/v/t39.30808-6/557369718_2375189762911292_5399023141928597290_n.jpg?stp=dst-jpg_s600x600_tt6&_nc_cat=111&ccb=1-7&_nc_sid=aa7b47&_nc_ohc=MvgPnsAAaOMQ7kNvwGPFFLy&_nc_oc=Adn0cbvVYe1fNhlQPXYQxCvKkUX00MeOhlflqQX5pNkmW13ezNaRUrzalXKlOonl3Vp989JI5DjfDaQGRVnIC-aO&_nc_zt=23&_nc_ht=scontent.ftlv5-1.fna&_nc_gid=xxy5KlS2ijLlVZLmHf-u1Q&oh=00_AfeURlWS3quNWojJVOEf7l30U-nDUtmmJ1HO4YmyOx7vXQ&oe=68EA6EAE';
  private startX = 0;
  private startY = 0;

  constructor(private device: DeviceDetectorService) {}

  onTouchStart(ev: TouchEvent) {
    if (!this.device.isMobile() && !this.device.isTablet()) return;
    const t = ev.touches[0];
    this.startX = t.clientX;
    this.startY = t.clientY;
  }

  onTouchMove(ev: TouchEvent) {
    if (!this.device.isMobile() && !this.device.isTablet()) return;
    // prevent scroll while dragging across the image
    ev.preventDefault();
  }

  onTouchEnd(ev: TouchEvent) {
    if (!this.device.isMobile() && !this.device.isTablet()) return;
    const t = ev.changedTouches[0];
    const dx = t.clientX - this.startX;
    const dy = t.clientY - this.startY;
    const dist = Math.hypot(dx, dy);
    if (dist > 30) this.swapImage();
  }

  private swapImage() {
    this.currentImage =
      this.currentImage === 'https://scontent.ftlv5-1.fna.fbcdn.net/v/t39.30808-6/557369718_2375189762911292_5399023141928597290_n.jpg?stp=dst-jpg_s600x600_tt6&_nc_cat=111&ccb=1-7&_nc_sid=aa7b47&_nc_ohc=MvgPnsAAaOMQ7kNvwGPFFLy&_nc_oc=Adn0cbvVYe1fNhlQPXYQxCvKkUX00MeOhlflqQX5pNkmW13ezNaRUrzalXKlOonl3Vp989JI5DjfDaQGRVnIC-aO&_nc_zt=23&_nc_ht=scontent.ftlv5-1.fna&_nc_gid=xxy5KlS2ijLlVZLmHf-u1Q&oh=00_AfeURlWS3quNWojJVOEf7l30U-nDUtmmJ1HO4YmyOx7vXQ&oe=68EA6EAE'
        ? 'https://scontent.ftlv5-1.fna.fbcdn.net/v/t39.30808-6/557763537_10163532401831760_8512742338533055008_n.jpg?stp=cp6_dst-jpg_p526x296_tt6&_nc_cat=101&ccb=1-7&_nc_sid=aa7b47&_nc_ohc=HhFjS7bwTVkQ7kNvwHdNMCi&_nc_oc=AdkyYRiiJmoxTBV7FogoxyfIvPKEZSI4gdvQTjOXd9XcAmj90wRPdyQVG9RfH87IxkhHwiKFYTVJ9FhLoBY-oDf0&_nc_zt=23&_nc_ht=scontent.ftlv5-1.fna&_nc_gid=E6hUGD6boZW38W4nAJH4LA&oh=00_AfcZELFZiMqxYoCuYgO61TverVMAIUjR4vv44-as0puqpQ&oe=68EA625A'
        : 'https://scontent.ftlv5-1.fna.fbcdn.net/v/t39.30808-6/557369718_2375189762911292_5399023141928597290_n.jpg?stp=dst-jpg_s600x600_tt6&_nc_cat=111&ccb=1-7&_nc_sid=aa7b47&_nc_ohc=MvgPnsAAaOMQ7kNvwGPFFLy&_nc_oc=Adn0cbvVYe1fNhlQPXYQxCvKkUX00MeOhlflqQX5pNkmW13ezNaRUrzalXKlOonl3Vp989JI5DjfDaQGRVnIC-aO&_nc_zt=23&_nc_ht=scontent.ftlv5-1.fna&_nc_gid=xxy5KlS2ijLlVZLmHf-u1Q&oh=00_AfeURlWS3quNWojJVOEf7l30U-nDUtmmJ1HO4YmyOx7vXQ&oe=68EA6EAE';
  }
}
