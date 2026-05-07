import Image from "next/image";

type BrandProps = {
  compact?: boolean;
  hero?: boolean;
  subtitle?: string;
  className?: string;
};

export function Brand({
  compact = false,
  hero = false,
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

  if (hero) {
    return (
      <div className={`flex flex-col items-center text-center ${className}`.trim()}>
        <Image
          src="/headless-crm-crab.png"
          alt="Headless CRM crab logo"
          width={72}
          height={72}
          className="h-[72px] w-[72px] object-contain"
          priority
        />
        <p className="mt-3 text-xl leading-none font-semibold text-foreground">
          Headless CRM
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {subtitle}
        </p>
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
