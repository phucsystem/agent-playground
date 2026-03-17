"use client";

import { useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { Avatar } from "@/components/ui/avatar";
import { AvatarEditorDialog } from "@/components/profile/avatar-editor-dialog";
import { LogOut, Bell, BellOff, Camera } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { User } from "@/types/database";

interface UserProfileProps {
  currentUser: User;
  onLogout: () => void;
  onAvatarSaved?: () => void;
}

export function UserProfile({ currentUser, onLogout, onAvatarSaved }: UserProfileProps) {
  const [showAvatarEditor, setShowAvatarEditor] = useState(false);
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
    <div className="flex items-center gap-2.5 px-3 py-3 border-b border-accent-100/50 bg-gradient-to-r from-accent-50/60 to-primary-50/60">
      <button
        onClick={() => setShowAvatarEditor(true)}
        className="relative group cursor-pointer shrink-0 rounded-full"
        title="Change avatar"
      >
        <Avatar
          displayName={currentUser.display_name}
          avatarUrl={currentUser.avatar_url}
          size="md"
        />
        <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center">
          <Camera className="w-3 h-3 text-white opacity-0 group-hover:opacity-100 transition" />
        </div>
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-neutral-800 truncate leading-tight">
          {currentUser.display_name}
        </p>
        <p className="text-[11px] text-neutral-400 flex items-center gap-1 mt-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
          Online
        </p>
      </div>
      <div className="flex items-center gap-0">
        <button
          onClick={handleToggleNotification}
          disabled={toggling}
          className={`p-1.5 rounded-lg transition cursor-pointer ${
            notificationEnabled
              ? "text-warm-500 hover:text-warm-600 hover:bg-warm-50"
              : "text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100"
          }`}
          title={notificationEnabled ? "Notifications on" : "Notifications off"}
        >
          <BellIcon className="w-4 h-4" />
        </button>
        <button
          onClick={onLogout}
          className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition cursor-pointer"
          title="Logout"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
      {showAvatarEditor && createPortal(
        <AvatarEditorDialog
          user={currentUser}
          onClose={() => setShowAvatarEditor(false)}
          onSaved={() => onAvatarSaved?.()}
        />,
        document.body,
      )}
    </div>
  );
}
