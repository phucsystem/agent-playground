export type ConversationType = "dm" | "group";
export type MemberRole = "admin" | "member";
export type ContentType = "text" | "file" | "image" | "url";

export interface User {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  is_agent: boolean;
  is_active: boolean;
  token: string;
  last_seen_at: string | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  name: string | null;
  created_by: string;
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
    };
    Views: Record<string, never>;
    Functions: {
      find_or_create_dm: { Args: { other_user_id: string }; Returns: string };
      get_unread_counts: { Args: Record<string, never>; Returns: { conversation_id: string; unread_count: number }[] };
      mark_conversation_read: { Args: { conv_id: string }; Returns: void };
      get_my_conversations: { Args: Record<string, never>; Returns: ConversationWithDetails[] };
    };
  };
}
