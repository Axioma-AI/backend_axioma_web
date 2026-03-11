export interface AdminUsersListItem {
  id: number;
  name: string;
  lastname: string;
  username: string;
  email: string;
  phone: string | null;
  country_code?: string | null;
  role: {
    id: number | null;
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
