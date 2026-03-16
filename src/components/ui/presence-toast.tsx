import { Avatar } from "./avatar";

interface PresenceToastProps {
  displayName: string;
  avatarUrl: string | null;
}

export function PresenceToast({ displayName, avatarUrl }: PresenceToastProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-lg shadow-lg border border-neutral-200">
      <Avatar displayName={displayName} avatarUrl={avatarUrl} size="sm" showPresence isOnline />
      <div className="flex flex-col">
        <span className="text-sm font-medium text-neutral-800">
          {displayName}
        </span>
        <span className="text-xs text-neutral-500">is now online</span>
      </div>
    </div>
  );
}
