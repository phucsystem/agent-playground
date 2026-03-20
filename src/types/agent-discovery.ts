import type { AgentCategory } from "./database";

export interface AgentCatalogEntry {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  description: string | null;
  tags: string[] | null;
  category: AgentCategory | null;
  sample_prompts: string[] | null;
  is_featured: boolean;
  is_webhook_active: boolean;
  health_check_url: string | null;
}

export interface AgentStats {
  agent_id: string;
  total_deliveries: number;
  successful_deliveries: number;
  avg_response_ms: number | null;
  uptime_pct: number;
}

export interface CatalogFilters {
  category?: AgentCategory;
  search?: string;
}
