import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDownIcon, LogOutIcon } from "lucide-react";
import type { AccountMenuItem } from "@/hooks/use-account-menu";
import { userInitials, type PublicUser } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { t } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";

export interface AvatarDropdownProps {
  user: PublicUser;
  items: AccountMenuItem[];
  extraItems?: ReactNode;
  onSignOut: () => void;
  className?: string;
}

export function AvatarDropdown({
  user,
  items,
  extraItems,
  onSignOut,
  className,
}: AvatarDropdownProps) {
  const {
    Avatar,
    AvatarFallback,
    AvatarImage,
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } = useUI();
  const [open, setOpen] = useState(false);
  const fullName = `${user.firstName} ${user.lastName}`.trim() || user.username;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className={cn(
              "h-auto min-w-0 justify-start gap-2 px-2 py-1.5",
              "group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0",
              className,
            )}
            aria-label="Account menu"
          />
        }
      >
        <Avatar size="sm">
          {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
          <AvatarFallback>{userInitials(user)}</AvatarFallback>
        </Avatar>
        <span className="min-w-0 truncate group-data-[collapsible=icon]:hidden">
          {user.username}
        </span>
        <ChevronDownIcon
          className={cn(
            "ml-auto size-4 shrink-0 transition-transform duration-200 group-data-[collapsible=icon]:hidden",
            open && "rotate-180",
          )}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56 max-w-72">
        <div className="flex items-center gap-2 px-2 py-2">
          <Avatar size="sm">
            {user.avatarUrl ? (
              <AvatarImage src={user.avatarUrl} alt="" />
            ) : null}
            <AvatarFallback>{userInitials(user)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{fullName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {user.email}
            </p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <DropdownMenuItem
                key={`${item.to}-${item.label}`}
                render={<Link to={item.to} />}
              >
                <Icon />
                {item.label}
              </DropdownMenuItem>
            );
          })}
          {extraItems}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onSignOut}>
          <LogOutIcon />
          {t("account.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
