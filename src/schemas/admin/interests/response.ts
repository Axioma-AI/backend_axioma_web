export interface AdminInterestCreateResponse {
  user_id: number;
  interest_id: number;
  name: string;
}

export interface AdminInterestGroupCreateResponse {
  user_id: number;
  group_id: number;
  name: string;
  interests: Array<{ id: number; name: string }>;
}

export interface AdminInterestGroupAddItemResponse {
  group_id: number;
  interest_id: number;
  already?: boolean;
}

export interface AdminInterestDeletedResponse {
  deleted_interest_id: number;
}

export interface AdminGroupDeletedResponse {
  deleted_group_id: number;
}

export interface AdminUsersSummaryResponse {
  user: {
    id: number;
    email: string;
    username: string;
    name: string | null;
    lastname: string | null;
    phone: string | null;
    country_code: string | null;
  };
  seats_quota: number;
  seats_used: number;
  seats_remaining: number;
  interests: { id: number; name: string }[];
  groups: { id: number; name: string; interests: { id: number; name: string }[] }[];
}
