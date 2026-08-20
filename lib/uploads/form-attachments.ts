import "server-only";

import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";

export const FORM_ATTACHMENTS_ROOT = path.join(
  process.cwd(),
  "uploads",
  "form-attachments",
);

export const MAX_FORM_ATTACHMENT_BYTES = 2 * 1024 * 1024;

export const ALLOWED_FORM_ATTACHMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

function sanitizeFilename(filename: string): string {
  const base = path.basename(filename).replace(/[^\w.\-()+ ]+/g, "_").trim();
  return base.slice(0, 180) || "attachment";
}

export function resolveFormAttachmentAbsolutePath(relativePath: string): string {
  const normalized = path.normalize(relativePath).replace(/^([/\\])+/, "");
  const absolute = path.join(FORM_ATTACHMENTS_ROOT, normalized);
  if (!absolute.startsWith(FORM_ATTACHMENTS_ROOT)) {
    throw new Error("Invalid attachment path.");
  }
  return absolute;
}

export async function storeFormAttachmentFile(input: {
  appraisalId: number;
  questionId: number;
  originalFilename: string;
  bytes: Buffer;
}): Promise<{ storedFilename: string; relativePath: string }> {
  const safeName = sanitizeFilename(input.originalFilename);
  const storedFilename = `${randomUUID()}-${safeName}`;
  const relativePath = path.join(
    String(input.appraisalId),
    String(input.questionId),
    storedFilename,
  );
  const absoluteDir = path.join(
    FORM_ATTACHMENTS_ROOT,
    String(input.appraisalId),
    String(input.questionId),
  );

  await mkdir(absoluteDir, { recursive: true });
  await writeFile(path.join(absoluteDir, storedFilename), input.bytes);

  return {
    storedFilename,
    relativePath: relativePath.replace(/\\/g, "/"),
  };
}

export async function deleteFormAttachmentFile(
  relativePath: string,
): Promise<void> {
  try {
    await unlink(resolveFormAttachmentAbsolutePath(relativePath));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}
