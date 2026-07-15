import type { FormState } from "@/app/helpers/dashboard-types";
import { getEffectiveEntityFilterId } from "@/app/helpers/dashboard-entity-filters";
import type { EntityRecord } from "@/types/entities";
import type { FormSubmissionListItem } from "@/types/form-submissions";
import { APPRAISAL_STATUSES, type AppraisalStatus } from "@/types/forms";
import type { StaffCategoryWithSubCategories } from "@/types/staff-categories";

export type SubmissionFilterState = {
  searchQuery: string;
  selectedCategory0EntityId: number | "ALL";
  selectedCategory1EntityId: number | "ALL";
  selectedCategory2EntityId: number | "ALL";
  selectedCategoryId: number | "ALL";
  selectedSubCategoryId: number | "ALL";
  selectedFormState: FormState | "ALL";
  staffCategories: StaffCategoryWithSubCategories[];
  entities: EntityRecord[];
};

export function getEntityDescendantIds(
  rootId: number,
  entities: EntityRecord[],
): Set<number> {
  const descendants = new Set<number>();
  const childrenByParent = new Map<number, number[]>();

  entities.forEach((entity) => {
    if (entity.parentEntityId !== null) {
      const siblings = childrenByParent.get(entity.parentEntityId) ?? [];
      siblings.push(entity.id);
      childrenByParent.set(entity.parentEntityId, siblings);
    }
  });

  const stack = [rootId];

  while (stack.length > 0) {
    const current = stack.pop()!;

    for (const childId of childrenByParent.get(current) ?? []) {
      descendants.add(childId);
      stack.push(childId);
    }
  }

  return descendants;
}

export function matchesSubmissionEntityFilter(
  submission: FormSubmissionListItem,
  selectedEntityId: number | "ALL",
  entities: EntityRecord[],
): boolean {
  if (selectedEntityId === "ALL") {
    return true;
  }

  const selectedEntity = entities.find((entity) => entity.id === selectedEntityId);

  if (!selectedEntity) {
    return false;
  }

  if (submission.entityId === selectedEntityId) {
    return true;
  }

  const descendantIds = getEntityDescendantIds(selectedEntityId, entities);

  if (submission.entityId != null && descendantIds.has(submission.entityId)) {
    return true;
  }

  return (
    submission.entityName === selectedEntity.name ||
    submission.parentEntityName === selectedEntity.name
  );
}

export function matchesAppraisalFormState(
  submissionStatus: AppraisalStatus,
  selectedFormState: FormState | "ALL",
): boolean {
  if (selectedFormState === "ALL") {
    return true;
  }

  return (
    APPRAISAL_STATUSES.includes(selectedFormState as AppraisalStatus) &&
    submissionStatus === selectedFormState
  );
}

export function matchesSubmissionFilters(
  submission: FormSubmissionListItem,
  filters: SubmissionFilterState,
): boolean {
  const query = filters.searchQuery.toLowerCase();
  const matchesSearch =
    !filters.searchQuery ||
    submission.employeeName.toLowerCase().includes(query) ||
    submission.employeeId.toLowerCase().includes(query) ||
    submission.employeeEmail.toLowerCase().includes(query);

  const matchesEntity = matchesSubmissionEntityFilter(
    submission,
    getEffectiveEntityFilterId({
      category0EntityId: filters.selectedCategory0EntityId,
      category1EntityId: filters.selectedCategory1EntityId,
      category2EntityId: filters.selectedCategory2EntityId,
    }),
    filters.entities,
  );

  const selectedCategory =
    filters.selectedCategoryId === "ALL"
      ? null
      : filters.staffCategories.find((category) => category.id === filters.selectedCategoryId);
  const selectedSubCategory =
    filters.selectedSubCategoryId === "ALL"
      ? null
      : filters.staffCategories
          .flatMap((category) =>
            category.subCategories.map((subCategory) => ({
              ...subCategory,
              staffCategoryId: category.id,
            })),
          )
          .find((subCategory) => subCategory.id === filters.selectedSubCategoryId);

  const matchesCategory =
    filters.selectedCategoryId === "ALL" ||
    submission.staffCategoryId === filters.selectedCategoryId ||
    (selectedCategory != null && submission.staffCategoryName === selectedCategory.name);
  const matchesSubCategory =
    filters.selectedSubCategoryId === "ALL" ||
    submission.staffSubCategoryId === filters.selectedSubCategoryId ||
    (selectedSubCategory != null &&
      submission.staffSubCategoryName === selectedSubCategory.name);
  const matchesFormState = matchesAppraisalFormState(
    submission.status,
    filters.selectedFormState,
  );

  return (
    matchesSearch &&
    matchesEntity &&
    matchesCategory &&
    matchesSubCategory &&
    matchesFormState
  );
}
