import { Skeleton } from "@/components/ui/skeleton";

export function ConversationListSkeleton({ count = 7 }: { count?: number }) {
  return (
    <div className="space-y-1 px-2">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex items-center gap-2.5 px-2 py-1.5">
          <Skeleton className="w-8 h-8 rounded-full shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
