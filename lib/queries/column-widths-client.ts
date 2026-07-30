export interface ColumnConfig {
  order: string[];
  visible: string[];
  frozen: string[];
  widths: Record<string, number>;
}

export const EMPTY_COLUMN_CONFIG: ColumnConfig = {
  order: [],
  visible: [],
  frozen: [],
  widths: {},
};

export async function fetchColumnConfig(
  tableKey: string,
): Promise<ColumnConfig> {
  const response = await fetch(
    `/api/user/column-widths?tableKey=${encodeURIComponent(tableKey)}`,
    { credentials: "include", cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch column config: ${response.statusText}`);
  }
  const data = (await response.json()) as { columnConfig: ColumnConfig };
  return data.columnConfig ?? EMPTY_COLUMN_CONFIG;
}

export async function saveColumnConfig(
  tableKey: string,
  config: ColumnConfig,
): Promise<void> {
  const response = await fetch("/api/user/column-widths", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tableKey, columnConfig: config }),
  });
  if (!response.ok) {
    throw new Error(`Failed to save column config: ${response.statusText}`);
  }
}

export type ColumnWidths = Record<string, number>;

export async function fetchColumnWidths(
  tableKey: string,
): Promise<ColumnWidths> {
  const config = await fetchColumnConfig(tableKey);
  return config.widths;
}

export async function saveColumnWidths(
  tableKey: string,
  columnWidths: ColumnWidths,
): Promise<void> {
  const config = await fetchColumnConfig(tableKey);
  config.widths = columnWidths;
  await saveColumnConfig(tableKey, config);
}
