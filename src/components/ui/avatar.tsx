import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";
import { cn } from "cn";

const Avatar = ({ className, ...props }: AvatarPrimitive.Root.Props) => {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        "relative flex size-10 shrink-0 overflow-hidden rounded-full",
        className
      )}
      {...props}
    />
  );
};

const AvatarImage = ({ className, ...props }: AvatarPrimitive.Image.Props) => {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full", className)}
      {...props}
    />
  );
};

const AvatarFallback = ({
  className,
  ...props
}: AvatarPrimitive.Fallback.Props) => {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-muted text-muted-foreground text-sm",
        className
      )}
      {...props}
    />
  );
};

export { Avatar, AvatarFallback, AvatarImage };
