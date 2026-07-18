export type AccountabilityGroup = {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  invite_code: string;
  created_at: string;
};

export type AccountabilityGroupMember = {
  group_id: string;
  user_id: string;
  joined_at: string;
  full_name: string | null;
  avatar_url: string | null;
};

export type AccountabilityCheckin = {
  id: string;
  group_id: string;
  user_id: string;
  content: string;
  created_at: string;
  full_name: string | null;
  avatar_url: string | null;
};

export type AccountabilityGroupSummary = AccountabilityGroup & {
  member_count: number;
  latest_checkin: string | null;
};
