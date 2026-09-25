import { ChevronsUpDown, Monitor, Moon, Sun } from "lucide-react";
import { useFetcher } from "react-router";
import { Button } from "../../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import { useTheme } from "../../../hooks/use-theme";
import { THEMES, type Theme } from "../../../lib/theme";

const labels: Record<Theme, string> = {
  system: "システム",
  light: "ライト",
  dark: "ダーク",
};

const icons: Record<Theme, typeof Monitor> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

export const ThemeToggle = () => {
  const activeTheme = useTheme();
  const ActiveIcon = icons[activeTheme];
  const fetcher = useFetcher();

  const setTheme = (value: Theme) => {
    fetcher.submit({ theme: value }, { method: "post", action: "/theme" });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" className="h-10 w-full justify-start gap-2">
            <ActiveIcon />
            <span className="flex-1 text-left">{labels[activeTheme]}</span>
            <ChevronsUpDown className="text-muted-foreground" />
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="w-(--anchor-width)">
        <DropdownMenuRadioGroup value={activeTheme} onValueChange={setTheme}>
          {THEMES.map((value) => {
            const Icon = icons[value];
            return (
              <DropdownMenuRadioItem key={value} value={value}>
                <Icon />
                {labels[value]}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
