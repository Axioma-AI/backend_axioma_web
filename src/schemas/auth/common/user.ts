export interface PublicUser {
  id: number;
  name: string;
  paternal_lastname: string | null;
  maternal_lastname: string | null;
  username: string;
  email: string;
  phone: string | null;
  role: {
    name: string | null;
  };
}
