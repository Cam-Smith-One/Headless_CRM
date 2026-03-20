import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PageHeader({
  title,
  description,
  action,
  onAction,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  onExport,
}: {
  title: string;
  description?: string;
  action?: string;
  onAction?: () => void;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onExport?: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border px-6 py-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        {searchPlaceholder && (
          <Input
            placeholder={searchPlaceholder}
            className="h-8 w-64 text-xs bg-secondary/50"
            value={searchValue ?? ""}
            onChange={(e) => onSearchChange?.(e.target.value)}
          />
        )}
        {onExport && (
          <Button size="sm" variant="secondary" className="h-8 text-xs" onClick={onExport}>
            Export CSV
          </Button>
        )}
        {action && (
          <Button size="sm" className="h-8 text-xs" onClick={onAction}>
            {action}
          </Button>
        )}
      </div>
    </div>
  );
}
