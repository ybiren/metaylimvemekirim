import { Component, signal, computed, effect, inject } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.scss']
})
export class ForgotPasswordComponent {

  private fb = new FormBuilder();
  http = inject(HttpClient);

  // --- FORM ---
  form = this.fb.group({
    email: ['', [Validators.email,Validators.required]]
  });
    
  // --- LOADING SIGNAL ---
  loading = signal(false);
  userMsg = signal("");

  // --- SUCCESS / ERROR SIGNALS ---
  successMessage = signal<string | null>(null);
  errorMessage = signal<string | null>(null);

  get canSubmit() {
    return this.form.valid && !this.loading();
  } 
  // --- SUBMIT ---
  async onSubmit() {
    if (!this.canSubmit) return;

    this.loading.set(true);
    this.successMessage.set(null);
    this.errorMessage.set(null);
   
    const email = this.form.value.email;
    this.forgotPass(email);
    
  }

   forgotPass(email) {
       const formData = new FormData();
       formData.append('c_email', email);
       this.http.post(`${environment.apibase}/forgotPass`, formData).subscribe({
         next: (res: any) => {
          if (res && res.ok) {
            this.userMsg.set("נשלח מייל לאיפוס סיסמא");        
          } else {
            this.userMsg.set(res.message);
          }
          this.loading.set(false);
         },
         error: (err) => {
           this.userMsg.set("דואל לא קיים");
           this.loading.set(false);
         },
         complete: () => { this.loading.set(false)} 
        });
   }

}
