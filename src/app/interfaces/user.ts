export interface IUser {
  userID: number;
  c_name: string;
  c_email: string;
  image_path?: string;
  liked?: boolean; // local like state
  c_gender: number;
  c_birth_day?: number;
  c_birth_month?: number;
  c_birth_year?: number;
  c_country: number;
  c_pcell?: string;
  c_ff: number;
  c_details?: string;
  c_details1?: string;
  sessionID?: string;
  image_content_type?: string;
  image_size?: number;
  block?: number[];
  c_education?: number;
  c_work?: number;
  c_children?: number;
  c_smoking?: number;
  c_url?: string;
  c_fb?: string; 
  filter_height_min?: number;
  filter_height_max: number;
  filter_age_min: number;
  filter_age_max: number;
  filter_family_status: number[];
  filter_smoking_status: number;
  like?: number[];
  [k: string]: any;
}




  