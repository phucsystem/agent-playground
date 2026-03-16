"use client";

import { useState, useCallback, useEffect } from "react";
import { Avatar } from "@/components/ui/avatar";
import { LogOut, Bell, BellOff } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { User } from "@/types/database";

interface UserProfileProps {
  currentUser: User;
  onLogout: () => void;
}

export function UserProfile({ currentUser, onLogout }: UserProfileProps) {
  const [notificationEnabled, setNotificationEnabled] = useState(
    currentUser.notification_enabled
  );
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    setNotificationEnabled(currentUser.notification_enabled);
  }, [currentUser.notification_enabled]);

  const handleToggleNotification = useCallback(async () => {
    if (toggling) return;

    const newValue = !notificationEnabled;
    setToggling(true);
    setNotificationEnabled(newValue);

    if (newValue && typeof Notification !== "undefined" && Notification.permission === "default") {
      await Notification.requestPermission();
    }

    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase
      .from("users")
      .update({ notification_enabled: newValue })
      .eq("id", currentUser.id);

    if (error) {
      setNotificationEnabled(!newValue);
    }

    setToggling(false);
  }, [notificationEnabled, toggling, currentUser.id]);

  const BellIcon = notificationEnabled ? Bell : BellOff;

  return (
    <div className="flex items-center gap-3 p-4 border-b border-neutral-200">
      <Avatar
        displayName={currentUser.display_name}
        avatarUrl={currentUser.avatar_url}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-neutral-800 truncate">
          {currentUser.display_name}
        </p>
        <p className="text-xs text-neutral-500 flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-success inline-block" />
          Online
        </p>
      </div>
      <button
        onClick={handleToggleNotification}
        disabled={toggling}
        className={`p-1.5 rounded-md transition ${
          notificationEnabled
            ? "text-primary-500 hover:text-primary-700 hover:bg-primary-50"
            : "text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200"
        }`}
        title={notificationEnabled ? "Notifications on" : "Notifications off"}
      >
        <BellIcon className="w-4 h-4" />
      </button>
      <button
        onClick={onLogout}
        className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200 transition"
        title="Logout"
      >
        <LogOut className="w-4 h-4" />
      </button>
    </div>
  );
}
