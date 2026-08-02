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

export type AccountabilityCheckinReply = {
  id: string;
  checkin_id: string;
  user_id: string;
  content: string;
  created_at: string;
  full_name: string | null;
  avatar_url: string | null;
};

export type AccountabilityCheckinAttachment = {
  id: string;
  checkin_id: string;
  uploaded_by: string;
  storage_path: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  created_at: string;
};

export type AccountabilityCheckin = {
  id: string;
  group_id: string;
  user_id: string;
  content: string;
  created_at: string;
  full_name: string | null;
  avatar_url: string | null;
  replies: AccountabilityCheckinReply[];
  attachments: AccountabilityCheckinAttachment[];
};

export type AccountabilityGroupSummary = AccountabilityGroup & {
  member_count: number;
  latest_checkin: string | null;
};
