import MyFormsList, {
  type MyFormsUserInfo,
} from "@/app/components/employee-forms/MyFormsList";
import {
  getUserOrgLevel1,
  getUserOrgLevel2,
} from "@/app/helpers/users-table-columns";
import { requireSession } from "@/lib/auth/require-session";
import { getUserById } from "@/lib/queries/users";
import { formatEnumLabel } from "@/types/forms";
import { USER_ROLE_LABELS } from "@/types/users";
import { withDb } from "@/lib/db-context";

export default async function MyFormsPage() {
  return withDb(async () => {
    const session = await requireSession();
    const userId = session.user?.id ? Number(session.user.id) : NaN;
    const user = Number.isFinite(userId) ? await getUserById(userId) : null;

    const userName =
      user != null
        ? `${user.firstName} ${user.lastName}`.trim()
        : (session.user?.name ?? null);

    const userInfo: MyFormsUserInfo | null = user
      ? {
          employeeId: user.employeeId,
          email: user.email,
          designation: user.designation,
          roleCategory: user.roleCategory,
          orgLevel1: getUserOrgLevel1(user),
          orgLevel2: getUserOrgLevel2(user),
          systemRole:
            USER_ROLE_LABELS[user.systemRole] ??
            formatEnumLabel(user.systemRole),
          empCategory: formatEnumLabel(user.empCategory),
          headName: user.headName,
        }
      : null;

    return (
      <div className="space-y-6 text-text-primary">
        <MyFormsList
          userName={userName}
          userRole={session.user?.role ?? null}
          userEmail={session.user?.email ?? user?.email ?? null}
          userInfo={userInfo}
        />
      </div>
    );
  });
}
