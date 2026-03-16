"use client";

import { useState, useEffect, useCallback } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { AgentConfig } from "@/types/database";

export function useAgentConfigs() {
  const [configs, setConfigs] = useState<Map<string, AgentConfig>>(new Map());
  const [loading, setLoading] = useState(true);

  const fetchConfigs = useCallback(async () => {
    const supabase = createBrowserSupabaseClient();
    const { data } = await supabase
      .from("agent_configs")
      .select("id, user_id, webhook_url, is_webhook_active, health_check_url, created_at, updated_at")
      .order("created_at", { ascending: true });

    if (data) {
      const configMap = new Map<string, AgentConfig>();
      for (const config of data as AgentConfig[]) {
        configMap.set(config.user_id, config);
      }
      setConfigs(configMap);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  async function createConfig(
    userId: string,
    webhookUrl: string,
    webhookSecret?: string,
    healthCheckUrl?: string,
  ): Promise<{ error: string | null }> {
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.from("agent_configs").insert({
      user_id: userId,
      webhook_url: webhookUrl,
      webhook_secret: webhookSecret || null,
      health_check_url: healthCheckUrl || null,
      is_webhook_active: true,
    });

    if (error) return { error: error.message };
    await fetchConfigs();
    return { error: null };
  }

  async function updateConfig(
    userId: string,
    updates: { webhook_url?: string; webhook_secret?: string; health_check_url?: string | null },
  ): Promise<{ error: string | null }> {
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase
      .from("agent_configs")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("user_id", userId);

    if (error) return { error: error.message };
    await fetchConfigs();
    return { error: null };
  }

  async function toggleWebhook(
    userId: string,
    isActive: boolean,
  ): Promise<{ error: string | null }> {
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase
      .from("agent_configs")
      .update({ is_webhook_active: isActive, updated_at: new Date().toISOString() })
      .eq("user_id", userId);

    if (error) return { error: error.message };
    await fetchConfigs();
    return { error: null };
  }

  async function deleteConfig(userId: string): Promise<{ error: string | null }> {
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase
      .from("agent_configs")
      .delete()
      .eq("user_id", userId);

    if (error) return { error: error.message };
    await fetchConfigs();
    return { error: null };
  }

  return {
    configs,
    loading,
    fetchConfigs,
    createConfig,
    updateConfig,
    toggleWebhook,
    deleteConfig,
  };
}
