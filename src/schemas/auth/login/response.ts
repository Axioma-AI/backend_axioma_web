export interface LoginResponse {
  user_id: number;
  role_id: number | null;
  access_token: string;
  refresh_token?: string;
  requires_two_factor?: boolean;
  requires_password_change?: boolean;
}
