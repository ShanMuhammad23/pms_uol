import {
  CATEGORY_COLOR_PALETTE,
} from "@/app/helpers/dashboard-chart-config";
import type { FormSubmissionListItem } from "@/types/form-submissions";
import type { AppraisalStatus } from "@/types/forms";
import type { StaffCategoryWithSubCategories } from "@/types/staff-categories";

export function getStaffCategoryNames(
  submissions: FormSubmissionListItem[],
  staffCategories: StaffCategoryWithSubCategories[],
): string[] {
  if (staffCategories.length > 0) {
    return staffCategories.map((category) => category.name);
  }

  return [...new Set(
    submissions
      .map((submission) => submission.staffCategoryName)
      .filter((name): name is string => Boolean(name)),
  )].sort();
}

export function buildSubmissionCategoryCounts(
  submissions: FormSubmissionListItem[],
  staffCategories: StaffCategoryWithSubCategories[],
  isDarkMode: boolean,
) {
  const categoryNames = getStaffCategoryNames(submissions, staffCategories);

  return categoryNames
    .map((name, index) => {
      const palette = CATEGORY_COLOR_PALETTE[index % CATEGORY_COLOR_PALETTE.length];

      return {
        name,
        value: submissions.filter((submission) => submission.staffCategoryName === name).length,
        color: isDarkMode ? palette.dark : palette.light,
      };
    })
    .filter((entry) => entry.value > 0);
}

export function buildSubmissionCompletionByCategory(
  submissions: FormSubmissionListItem[],
  staffCategories: StaffCategoryWithSubCategories[],
) {
  const categoryNames = getStaffCategoryNames(submissions, staffCategories).filter((name) =>
    submissions.some((submission) => submission.staffCategoryName === name),
  );

  return categoryNames.map((category) => {
    const inCategory = submissions.filter(
      (submission) => submission.staffCategoryName === category,
    );
    const total = inCategory.length || 1;

    const countStatuses = (statuses: AppraisalStatus[]) =>
      inCategory.filter((submission) => statuses.includes(submission.status)).length;

    return {
      category,
      draft: 0,
      selfAssessment: Math.round(
        (countStatuses(["PENDING_SELF_ASSESSMENT"]) / total) * 100,
      ),
      headReview: Math.round((countStatuses(["PENDING_HEAD_REVIEW"]) / total) * 100),
      hrCalibration: Math.round(
        (countStatuses(["PENDING_HR_CALIBRATION"]) / total) * 100,
      ),
      approved: Math.round(
        (countStatuses(["APPROVED", "PENDING_BOARD_APPROVAL", "COMPLETED"]) / total) *
          100,
      ),
      rejected: 0,
    };
  });
}
