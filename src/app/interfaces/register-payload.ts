export interface IRegisterPayload {
  c_name: string;
  c_gender: number;
  c_birth_day: number | string;
  c_birth_month: number | string;
  c_birth_year: number | string;
  c_country: number;        // ✅ add this
  c_pcell?: string;         // optional
  c_email: string;
  c_ff: number;            // family status
  c_details?: string;
  c_details1?: string;
  password: string;
  password2: string;
  sessionID?: string;
}