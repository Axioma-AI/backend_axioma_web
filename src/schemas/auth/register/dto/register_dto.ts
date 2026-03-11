export interface RegisterCreateDTO {
  first_name: string;
  last_name_paternal: string;
  last_name_maternal?: string;
  username: string;
  email: string;
  phone: string;
  country_code: string;
  password_hash: string;
  role_id?: number | null;
  change_password?: boolean;
  created_by_id?: number;
}
