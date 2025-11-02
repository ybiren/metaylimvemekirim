export interface IUser {
  userID: number;
  c_name: string;
  c_email: string;
  image_path?: string;
  liked?: boolean; // local like state
  c_gender: number;
  c_birth_day?: string;
  c_birth_month?: string;
  c_birth_year?: string;
  c_country: number;
  c_pcell?: string;
  c_ff: number;
  c_details?: string;
  c_details1?: string;
  sessionID?: string;
  image_content_type?: string;
  image_size?: number;
  block?: number[];
  [k: string]: any;
}




  