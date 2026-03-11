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
