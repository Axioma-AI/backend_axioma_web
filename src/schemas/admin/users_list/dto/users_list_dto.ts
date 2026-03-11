export interface AdminUsersListDTO {
  page?: number;
  size?: number;
  q?: string;
  role_name?: 'admin' | 'member';
  created_by_id: number;
}
