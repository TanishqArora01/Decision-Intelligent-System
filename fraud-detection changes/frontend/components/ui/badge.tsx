import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
  {
    variants: {
      variant: {
        default: 'border-border-primary bg-surface-glass text-text-secondary',
        cyan: 'border-accent-cyan/30 bg-accent-cyan/10 text-accent-cyan',
        green: 'border-accent-green/30 bg-accent-green/10 text-accent-green',
        danger: 'border-accent-danger/30 bg-accent-danger/10 text-accent-danger',
        warning: 'border-accent-warning/30 bg-accent-warning/10 text-accent-warning',
        purple: 'border-accent-purple/30 bg-accent-purple/10 text-accent-purple',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
