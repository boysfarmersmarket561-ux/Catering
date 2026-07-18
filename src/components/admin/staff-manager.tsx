import { useState } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, Trash2 } from "lucide-react";
import { staffQueryOptions } from "@/lib/queries";
import {
  createStaff,
  deleteStaff,
  resetStaffPassword,
  setStaffDisabled,
  type StaffUser,
} from "@/server/admin-users";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MIN_PASSWORD_LENGTH = 12;

function useStaffAction<TInput, TOutput>(fn: (opts: { data: TInput }) => Promise<TOutput>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TInput) => fn({ data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-staff"] }),
    onError: (error: Error) => toast.error(error.message),
  });
}

function AddStaffForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const doCreate = useStaffAction(createStaff);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      toast.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    doCreate.mutate(
      { name: name.trim(), email: email.trim(), password },
      {
        onSuccess: () => {
          toast.success("Staff account created.");
          setName("");
          setEmail("");
          setPassword("");
        },
      },
    );
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-md border p-4">
      <div className="text-sm font-medium">Add a staff account</div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="staff-name">Name</Label>
          <Input id="staff-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="staff-email">Email</Label>
          <Input
            id="staff-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="staff-password">Temporary password</Label>
          <Input
            id="staff-password"
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={MIN_PASSWORD_LENGTH}
            required
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        At least {MIN_PASSWORD_LENGTH} characters, shown in plain text so you can copy it and share
        it directly with the new staff member. They can change it later.
      </p>
      <Button type="submit" disabled={doCreate.isPending}>
        Add staff account
      </Button>
    </form>
  );
}

function StaffRow({ user, currentUserId }: { user: StaffUser; currentUserId: string }) {
  const isSelf = user.id === currentUserId;
  const doSetDisabled = useStaffAction(setStaffDisabled);
  const doDelete = useStaffAction(deleteStaff);
  const doResetPassword = useStaffAction(resetStaffPassword);

  const handleResetPassword = () => {
    const next = window.prompt(
      `New password for ${user.email} (min ${MIN_PASSWORD_LENGTH} chars):`,
    );
    if (next === null) return;
    if (next.length < MIN_PASSWORD_LENGTH) {
      toast.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    doResetPassword.mutate(
      { id: user.id, password: next },
      { onSuccess: () => toast.success("Password reset.") },
    );
  };

  const handleDelete = () => {
    const ok = window.confirm(`Delete staff account ${user.email}? This cannot be undone.`);
    if (ok) doDelete.mutate({ id: user.id });
  };

  return (
    <div className="flex flex-wrap items-center gap-3 p-3 text-sm">
      <div className="flex-1 min-w-[12rem]">
        <div className="flex items-center gap-2 font-medium">
          {user.name || user.email}
          {isSelf && <Badge variant="outline">You</Badge>}
          {user.disabled && <Badge variant="destructive">Disabled</Badge>}
        </div>
        {user.name && <div className="text-xs text-muted-foreground">{user.email}</div>}
      </div>
      <div className="text-xs text-muted-foreground">
        {user.lastSignInAt
          ? `Last signed in ${new Date(user.lastSignInAt).toLocaleString()}`
          : "Never signed in"}
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={isSelf}
        onClick={() => doSetDisabled.mutate({ id: user.id, disabled: !user.disabled })}
      >
        {user.disabled ? "Enable" : "Disable"}
      </Button>
      <Button variant="ghost" size="icon" onClick={handleResetPassword} title="Reset password">
        <KeyRound className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" disabled={isSelf} onClick={handleDelete} title="Delete">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function StaffManager({ currentUserId }: { currentUserId: string }) {
  const { data: staff } = useSuspenseQuery(staffQueryOptions());

  return (
    <div className="space-y-6 py-6">
      <AddStaffForm />
      <div className="divide-y rounded-md border">
        {staff.map((user) => (
          <StaffRow key={user.id} user={user} currentUserId={currentUserId} />
        ))}
      </div>
    </div>
  );
}
