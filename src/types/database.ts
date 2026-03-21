export type ConversationType = "dm" | "group";
export type MemberRole = "admin" | "member";
export type ContentType = "text" | "file" | "image" | "url";
export type UserRole = "admin" | "user" | "agent";
export type DeliveryStatus = "pending" | "delivered" | "failed";

export interface User {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  role: UserRole;
  is_agent: boolean;
  is_active: boolean;
  is_mock: boolean;
  notification_enabled: boolean;
  token: string;
  last_seen_at: string | null;
  created_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  avatar_url: string | null;
  color: string | null;
  description: string | null;
  is_default: boolean;
  message_retention_days: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  workspace_id: string;
  user_id: string;
  joined_at: string;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  name: string | null;
  created_by: string;
  is_archived: boolean;
  workspace_id: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationMember {
  conversation_id: string;
  user_id: string;
  role: MemberRole;
  joined_at: string;
  last_read_at: string | null;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  content_type: ContentType;
  metadata: Record<string, unknown> | null;
  edited_at: string | null;
  is_deleted: boolean;
  created_at: string;
}

export interface MessageWithSender extends Message {
  sender: Pick<User, "id" | "display_name" | "avatar_url" | "is_agent">;
}

export interface Attachment {
  id: string;
  message_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  created_at: string;
}

export interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface AgentConfig {
  id: string;
  user_id: string;
  webhook_url: string;
  webhook_secret: string | null;
  is_webhook_active: boolean;
  health_check_url: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface WebhookDeliveryLog {
  id: string;
  message_id: string;
  agent_id: string;
  status: DeliveryStatus;
  http_status: number | null;
  attempt_count: number;
  last_error: string | null;
  request_payload: Record<string, unknown> | null;
  response_body: string | null;
  webhook_url: string | null;
  created_at: string;
  delivered_at: string | null;
}

export interface UserSession {
  id: string;
  user_id: string;
  supabase_session_id: string | null;
  device_name: string;
  user_agent: string | null;
  last_active_at: string;
  created_at: string;
}

export interface KickedSession {
  device_name: string;
  last_active_at: string;
}

export interface WebhookLogWithDetails extends WebhookDeliveryLog {
  agent: Pick<User, "id" | "display_name" | "avatar_url">;
  message: Pick<Message, "id" | "content" | "sender_id">;
}

export interface ConversationWithDetails extends Conversation {
  other_user?: Pick<User, "id" | "display_name" | "avatar_url" | "is_agent">;
  member_count?: number;
  last_message?: {
    content: string;
    sender_name: string;
    created_at: string;
  };
  unread_count: number;
}

export interface Database {
  public: {
    Tables: {
      users: { Row: User; Insert: Omit<User, "id" | "created_at">; Update: Partial<User>; Relationships: [] };
      conversations: { Row: Conversation; Insert: Omit<Conversation, "id" | "created_at" | "updated_at">; Update: Partial<Conversation>; Relationships: [] };
      conversation_members: { Row: ConversationMember; Insert: Omit<ConversationMember, "joined_at">; Update: Partial<ConversationMember>; Relationships: [] };
      messages: { Row: Message; Insert: Omit<Message, "id" | "created_at">; Update: Partial<Message>; Relationships: [] };
      attachments: { Row: Attachment; Insert: Omit<Attachment, "id" | "created_at">; Update: Partial<Attachment>; Relationships: [] };
      reactions: { Row: Reaction; Insert: Omit<Reaction, "id" | "created_at">; Update: Partial<Reaction>; Relationships: [] };
      agent_configs: { Row: AgentConfig; Insert: Omit<AgentConfig, "id" | "created_at" | "updated_at">; Update: Partial<AgentConfig>; Relationships: [] };
      webhook_delivery_logs: { Row: WebhookDeliveryLog; Insert: Omit<WebhookDeliveryLog, "id" | "created_at">; Update: Partial<WebhookDeliveryLog>; Relationships: [] };
      user_sessions: { Row: UserSession; Insert: Omit<UserSession, "id" | "created_at">; Update: Partial<UserSession>; Relationships: [] };
      workspaces: { Row: Workspace; Insert: Omit<Workspace, "id" | "created_at" | "updated_at">; Update: Partial<Workspace>; Relationships: [] };
      workspace_members: { Row: WorkspaceMember; Insert: Omit<WorkspaceMember, "joined_at">; Update: Partial<WorkspaceMember>; Relationships: [] };
    };
    Views: Record<string, never>;
    Functions: {
      find_or_create_dm: { Args: { other_user_id: string; ws_id: string }; Returns: string };
      get_unread_counts: { Args: Record<string, never>; Returns: { conversation_id: string; unread_count: number }[] };
      mark_conversation_read: { Args: { conv_id: string }; Returns: void };
      get_my_conversations: { Args: { ws_id?: string }; Returns: ConversationWithDetails[] };
      create_group: { Args: { group_name: string; member_ids: string[]; ws_id: string }; Returns: string };
      edit_message: { Args: { msg_id: string; new_content: string }; Returns: void };
      delete_message: { Args: { msg_id: string }; Returns: void };
    };
  };
}
