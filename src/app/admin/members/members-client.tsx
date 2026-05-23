"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Label,
  Select,
} from "@/components/ui";
import {
  createMember,
  updateMember,
  setMemberActive,
  type ActionResult,
} from "./actions";

const initial: ActionResult = { ok: false };

export type MemberRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: "admin" | "member";
  active: boolean;
};

export function AddMemberForm() {
  const [state, action, pending] = useActionState(createMember, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold text-gray-900">Add member</h2>
      </CardHeader>
      <CardBody>
        <form
          ref={formRef}
          action={action}
          className="grid gap-3 sm:grid-cols-5 sm:items-end"
        >
          <div className="space-y-1 sm:col-span-1">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required placeholder="Dana" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              placeholder="dana@example.com"
            />
          </div>
          <div className="space-y-1 sm:col-span-1">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" placeholder="+9725..." />
          </div>
          <div className="space-y-1 sm:col-span-1">
            <Label htmlFor="role">Role</Label>
            <Select id="role" name="role" defaultValue="member" className="w-full">
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </Select>
          </div>
          <div className="sm:col-span-5">
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add member"}
            </Button>
            {state.error && (
              <span className="ml-3 text-sm text-red-600">{state.error}</span>
            )}
            {state.ok && (
              <span className="ml-3 text-sm text-green-600">Member added.</span>
            )}
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

export function MemberListRow({ member }: { member: MemberRow }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(updateMember, initial);
  const [seen, setSeen] = useState<ActionResult>(initial);

  // Close the editor once the server confirms a successful save.
  if (state !== seen) {
    setSeen(state);
    if (state.ok) setEditing(false);
  }

  if (editing) {
    return (
      <tr className="border-t border-gray-100 bg-gray-50">
        <td colSpan={6} className="px-4 py-3">
          <form action={action} className="grid gap-3 sm:grid-cols-6 sm:items-end">
            <input type="hidden" name="id" value={member.id} />
            <div className="space-y-1 sm:col-span-1">
              <Label>Name</Label>
              <Input name="name" defaultValue={member.name ?? ""} required />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Email</Label>
              <Input
                name="email"
                type="email"
                defaultValue={member.email ?? ""}
                required
              />
            </div>
            <div className="space-y-1 sm:col-span-1">
              <Label>Phone</Label>
              <Input name="phone" defaultValue={member.phone ?? ""} />
            </div>
            <div className="space-y-1 sm:col-span-1">
              <Label>Role</Label>
              <Select name="role" defaultValue={member.role} className="w-full">
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </Select>
            </div>
            <div className="flex gap-2 sm:col-span-1">
              <Button type="submit" disabled={pending}>
                Save
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
            </div>
            {state.error && (
              <span className="text-sm text-red-600 sm:col-span-6">
                {state.error}
              </span>
            )}
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-gray-100">
      <td className="px-4 py-3 font-medium text-gray-900">
        {member.name ?? "—"}
      </td>
      <td className="px-4 py-3 text-gray-600">{member.email}</td>
      <td className="px-4 py-3 text-gray-600">{member.phone ?? "—"}</td>
      <td className="px-4 py-3">
        <Badge tone={member.role === "admin" ? "indigo" : "gray"}>
          {member.role}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <Badge tone={member.active ? "green" : "red"}>
          {member.active ? "active" : "inactive"}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <form action={setMemberActive}>
            <input type="hidden" name="id" value={member.id} />
            <input
              type="hidden"
              name="active"
              value={(!member.active).toString()}
            />
            <Button
              type="submit"
              variant={member.active ? "ghost" : "secondary"}
            >
              {member.active ? "Deactivate" : "Reactivate"}
            </Button>
          </form>
        </div>
      </td>
    </tr>
  );
}
