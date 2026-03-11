export interface ProfileUserDTO {
  id: number;
  name: string;
  lastname: string;
  username: string;
  email: string;
  phone: string | null;
  country_code: string | null;
  avatar_url?: string;
  role: {
    id: number | null;
    name: string | null;
  };
}
