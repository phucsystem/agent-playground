"use client";

interface FlipLoaderProps {
  size?: "sm" | "md" | "lg";
  label?: string;
}

const sizeMap = {
  sm: { box: "w-8 h-8", icon: "w-4 h-4", text: "text-xs" },
  md: { box: "w-12 h-12", icon: "w-6 h-6", text: "text-sm" },
  lg: { box: "w-20 h-20", icon: "w-10 h-10", text: "text-base" },
};

export function FlipLoader({ size = "lg", label }: FlipLoaderProps) {
  const { box, icon, text } = sizeMap[size];

  return (
    <div className="flex flex-col items-center gap-3">
      <div className={`${box} [perspective:600px]`}>
        <div className="w-full h-full animate-flip [transform-style:preserve-3d]">
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-primary-500 shadow-lg shadow-primary-500/20 [backface-visibility:hidden]">
            <svg
              className={`${icon} text-white`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 8V4H8" />
              <rect width="16" height="12" x="4" y="8" rx="2" />
              <path d="M2 14h2" />
              <path d="M20 14h2" />
              <path d="M15 13v2" />
              <path d="M9 13v2" />
            </svg>
          </div>
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-primary-600 shadow-lg shadow-primary-600/20 [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <svg
              className={`${icon} text-white`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 8V4H8" />
              <rect width="16" height="12" x="4" y="8" rx="2" />
              <path d="M2 14h2" />
              <path d="M20 14h2" />
              <path d="M15 13v2" />
              <path d="M9 13v2" />
            </svg>
          </div>
        </div>
      </div>
      {label && (
        <p className={`${text} text-neutral-400 font-medium animate-pulse`}>
          {label}
        </p>
      )}
    </div>
  );
}
