"use client";

import Image from "next/image";

type BrandProps = {
  compact?: boolean;
  subtitle?: string;
  className?: string;
};

export function Brand({
  compact = false,
  subtitle = "The CRM built for AI agents",
  className = "",
}: BrandProps) {
  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`.trim()}>
        <Image
          src="/headless-crm-crab.png"
          alt="Headless CRM crab logo"
          width={28}
          height={28}
          className="h-7 w-7 object-contain"
          priority
        />
        <span className="text-sm font-semibold text-foreground">Headless CRM</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`.trim()}>
      <Image
        src="/headless-crm-crab.png"
        alt="Headless CRM crab logo"
        width={40}
        height={40}
        className="h-10 w-10 object-contain"
        priority
      />
      <div className="min-w-0">
        <p className="text-sm leading-none font-semibold text-foreground">
          Headless CRM
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {subtitle}
        </p>
      </div>
    </div>
  );
}
