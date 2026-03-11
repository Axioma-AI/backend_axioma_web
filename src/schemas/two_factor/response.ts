export interface TwoFactorSetupResponse {
  secret: string;
  qr_code_url: string;
  manual_entry_key: string;
  issuer: string;
  label: string;
  expires_at: string;
}

export interface TwoFactorVerifyResponse {
  success: boolean;
  message: string;
  user_id?: number;
  role_name?: string | null;
  recovery_codes?: string[];
  access_token?: string;
}

export interface TwoFactorStatusResponse {
  is_enabled: boolean;
  confirmed_at: string | null;
  issuer: string | null;
  label: string | null;
}
