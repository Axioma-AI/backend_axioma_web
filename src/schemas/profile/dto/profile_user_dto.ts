export interface ProfileUserDTO {
  id: number;
  name: string;
  paternal_lastname: string | null;
  maternal_lastname: string | null;
  username: string;
  email: string;
  phone: string | null;
  country_code: string | null;
  avatar_url?: string;
  role: {
    name: string | null;
  };
}
