export interface InterestCreatedResponse {
  id: number;
  name: string;
}

export interface GroupCreatedResponse {
  group_id: number;
  name: string;
  interests: { id: number; name: string }[];
}

export interface GroupDeletedResponse {
  deleted_group_id: number;
}

export interface InterestDeletedResponse {
  deleted_interest_id: number;
}

export interface GroupItemAddedResponse {
  group_id: number;
  interest_id: number;
  already?: boolean;
}

export interface GroupItemRemovedResponse {
  group_id: number;
  removed_interest_id: number;
}

export interface InterestsSummaryResponse {
  seats_quota: number;
  seats_used: number;
  seats_remaining: number;
  interests: { id: number; name: string }[];
  groups: { id: number; name: string; interests: { id: number; name: string }[] }[];
}
