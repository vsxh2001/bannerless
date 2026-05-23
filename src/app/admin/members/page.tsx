import { asc } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { PageHeading } from "@/components/app-shell";
import { Card } from "@/components/ui";
import { AddMemberForm, MemberListRow } from "./members-client";

export default async function MembersPage() {
  const members = db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      role: users.role,
      active: users.active,
    })
    .from(users)
    .orderBy(asc(users.name))
    .all();

  return (
    <>
      <PageHeading title="Members" />
      <div className="space-y-6">
        <AddMemberForm />

        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-gray-400"
                  >
                    No members yet. Add your first one above.
                  </td>
                </tr>
              ) : (
                members.map((m) => <MemberListRow key={m.id} member={m} />)
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
