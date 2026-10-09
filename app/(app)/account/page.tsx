import { getCurrentUser } from "@/lib/dal";
import { Panel } from "@/app/components/ui/panel";
import { Avatar, displayName } from "@/app/components/ui/avatar";
import { PasswordForm } from "./password-form";

export default async function AccountPage() {
  const user = await getCurrentUser();

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <h1 className="text-text text-xl font-bold tracking-tight">บัญชีของฉัน</h1>

      <Panel bodyClassName="flex items-center gap-3">
        <Avatar user={user} size={44} />
        <div className="min-w-0">
          <div className="text-text truncate font-semibold">{displayName(user)}</div>
          <div className="text-muted truncate text-sm">{user.email}</div>
        </div>
      </Panel>

      <Panel title="เปลี่ยนรหัสผ่าน">
        <PasswordForm />
      </Panel>
    </div>
  );
}
