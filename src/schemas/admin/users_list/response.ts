export interface AdminUsersListItem {
  id: number;
  username: string;
  email: string;
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
