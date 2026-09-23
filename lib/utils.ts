type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | Record<string, boolean | null | undefined>
  | ClassValue[];

const flattenClasses = (input: ClassValue): string[] => {
  if (!input) {
    return [];
  }

  if (typeof input === "string" || typeof input === "number") {
    return [String(input)];
  }

  if (Array.isArray(input)) {
    return input.flatMap(flattenClasses);
  }

  if (typeof input === "object") {
    return Object.entries(input)
      .filter(([, value]) => Boolean(value))
      .map(([key]) => key);
  }

  return [];
};

export function cn(...inputs: ClassValue[]): string {
  return inputs.flatMap(flattenClasses).join(" ");
}

export function formatFormTitleWithCode(
  title: string | null | undefined,
  code: string | null | undefined,
): string {
  const trimmedTitle = title?.trim() ?? "";
  const trimmedCode = code?.trim() ?? "";
  if (trimmedTitle && trimmedCode) return `${trimmedTitle} (${trimmedCode})`;
  return trimmedTitle || trimmedCode;
}
