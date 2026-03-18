import { Skeleton } from "@/components/ui/skeleton";

const BUBBLE_PATTERNS = [
  { align: "left", width: "w-48" },
  { align: "left", width: "w-64" },
  { align: "right", width: "w-56" },
  { align: "left", width: "w-40" },
  { align: "right", width: "w-52" },
  { align: "left", width: "w-60" },
] as const;

export function MessageListSkeleton() {
  return (
    <div className="flex-1 flex flex-col justify-end gap-3 p-4">
      {BUBBLE_PATTERNS.map((pattern, index) => (
        <div
          key={index}
          className={`flex ${pattern.align === "right" ? "justify-end" : "justify-start"}`}
        >
          <div className={`flex items-end gap-2 ${pattern.align === "right" ? "flex-row-reverse" : ""}`}>
            {pattern.align === "left" && (
              <Skeleton className="w-7 h-7 rounded-full shrink-0" />
            )}
            <Skeleton className={`h-10 ${pattern.width} rounded-2xl`} />
          </div>
        </div>
      ))}
    </div>
  );
}
