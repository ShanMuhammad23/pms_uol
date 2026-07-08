"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/app/queries/keys";
import { fetchFormSubmissions } from "@/lib/queries/form-submissions-client";

export function useFormSubmissionsQuery() {
  return useQuery({
    queryKey: queryKeys.formSubmissions,
    queryFn: fetchFormSubmissions,
  });
}
