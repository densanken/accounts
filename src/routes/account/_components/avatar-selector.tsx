import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "../../../components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";

import type { LinkedAccount } from "../../../lib/idp/linked-accounts";
import { providerLabel } from "../../../lib/idp/providers";

export const fieldLabelClassName = "font-medium text-muted-foreground text-sm";

const accountLabel = (account: LinkedAccount): string =>
  account.providerDisplayName
    ? `${account.providerDisplayName} (${providerLabel(account.provider)})`
    : providerLabel(account.provider);

// A string sentinel, since the "no picture" option needs its own selectable
// value distinct from "nothing selected".
const NO_PICTURE = "none";

interface AvatarSelectorProps {
  linkedAccounts: LinkedAccount[];
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}

export const AvatarSelector = ({
  linkedAccounts,
  value,
  onChange,
  disabled,
}: AvatarSelectorProps) => {
  // Only linked accounts with a provider avatar can be a picture source.
  const candidates = linkedAccounts.filter(
    (account): account is LinkedAccount & { providerAvatarUrl: string } =>
      account.providerAvatarUrl !== null
  );

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="profile-picture" className={fieldLabelClassName}>
        プロフィール画像
      </label>
      <Select
        value={value ?? NO_PICTURE}
        onValueChange={(next) => onChange(next === NO_PICTURE ? null : next)}
        disabled={disabled}
      >
        <SelectTrigger id="profile-picture" className="h-11 px-3">
          {/* base-ui only falls back to a placeholder for a null value, not
              an unrecognized one - so a stale saved id is handled here too. */}
          <SelectValue>
            {(current: string) => {
              if (current === NO_PICTURE) return "画像を使用しない";
              const account = candidates.find((a) => a.id === current);
              return account ? accountLabel(account) : "選択してください";
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {candidates.map((account) => (
            <SelectItem key={account.id} value={account.id} className="py-2">
              <Avatar className="size-7">
                <AvatarImage src={account.providerAvatarUrl} alt="" />
                <AvatarFallback className="text-xs">
                  {providerLabel(account.provider).charAt(0)}
                </AvatarFallback>
              </Avatar>
              {accountLabel(account)}
            </SelectItem>
          ))}
          <SelectItem value={NO_PICTURE} className="py-2">
            画像を使用しない
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
