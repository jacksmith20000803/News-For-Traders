import { cn } from "@/lib/utils";
import { forwardRef, type TextareaHTMLAttributes } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={id}
        className={cn(
          "flex min-h-[120px] w-full rounded-lg border border-border bg-card px-3 py-2 text-sm",
          "placeholder:text-muted-foreground resize-y",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          error && "border-destructive",
          className
        )}
        {...props}
      />
      {error && <p className="text-xs font-semibold text-red-600 dark:text-red-300">{error}</p>}
    </div>
  )
);
Textarea.displayName = "Textarea";
