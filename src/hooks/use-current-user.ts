"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { User } from "@/types/database";

export function useCurrentUser() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();

    async function fetchUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const userId = session.user.id;
      const { data } = await supabase
        .from("users_public")
        .select("*")
        .eq("id", userId)
        .single();
      setCurrentUser(data);
      setLoading(false);
    }

    fetchUser();
  }, []);

  return { currentUser, loading };
}
