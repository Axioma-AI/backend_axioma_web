export interface AdminUsersListItem {
  id: number;
  name: string;
  paternal_lastname: string | null;
  maternal_lastname: string | null;
  username: string;
  email: string;
  phone: string | null;
  country_code?: string | null;
  role: {
    name: 'admin' | 'member' | null;
  };
  seats_quota: number;
}

export interface AdminUsersListResponse {
  users: AdminUsersListItem[];
  page: number;
  size: number;
  total: number;
}
