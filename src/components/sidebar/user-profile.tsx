"use client";

import { useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { Avatar } from "@/components/ui/avatar";
import { AvatarEditorDialog } from "@/components/profile/avatar-editor-dialog";
import { NotificationDebugPanel } from "@/components/ui/notification-debug-panel";
import { LogOut, Bell, BellOff, Camera, Bug } from "lucide-react";
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
  const [showDebugPanel, setShowDebugPanel] = useState(false);

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
    <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-200">
      <button
        onClick={() => setShowAvatarEditor(true)}
        className="relative group cursor-pointer shrink-0 w-9 h-9 rounded-full"
        title="Change avatar"
      >
        <Avatar
          displayName={currentUser.display_name}
          avatarUrl={currentUser.avatar_url}
          size="md"
        />
        <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center">
          <Camera className="w-3.5 h-3.5 text-white opacity-0 group-hover:opacity-100 transition" />
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
      <div className="flex items-center gap-0.5">
        {currentUser.role === "admin" && (
          <button
            onClick={() => setShowDebugPanel(true)}
            className="p-1.5 rounded-md text-neutral-400 hover:text-amber-500 hover:bg-amber-50 transition cursor-pointer"
            title="Debug notifications"
          >
            <Bug className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={handleToggleNotification}
          disabled={toggling}
          className={`p-1.5 rounded-md transition cursor-pointer ${
            notificationEnabled
              ? "text-primary-500 hover:text-primary-700 hover:bg-primary-50"
              : "text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100"
          }`}
          title={notificationEnabled ? "Notifications on" : "Notifications off"}
        >
          <BellIcon className="w-4 h-4" />
        </button>
        <button
          onClick={onLogout}
          className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition cursor-pointer"
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
      {showDebugPanel && createPortal(
        <NotificationDebugPanel
          onClose={() => setShowDebugPanel(false)}
          notificationEnabled={notificationEnabled}
        />,
        document.body,
      )}
    </div>
  );
}
