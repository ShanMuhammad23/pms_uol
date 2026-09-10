import "server-only";

import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";

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

/**
 * Resolve the on-disk attachments root at runtime.
 *
 * Avoid a statically analyzable `path.join(cwd, "uploads", …)` — Turbopack/NFT
 * would treat it as a glob over the entire uploads tree and warn about
 * over-bundling (tens of thousands of files).
 */
function getFormAttachmentsRoot(): string {
  const configured = process.env.FORM_ATTACHMENTS_DIR?.trim();
  if (configured) {
    return path.resolve(configured);
  }

  // Split literals so bundlers cannot expand uploads/** into the module graph.
  const uploads = ["up", "loads"].join("");
  const formAttachments = ["form", "attachments"].join("-");
  return path.resolve(process.cwd(), uploads, formAttachments);
}

function sanitizeFilename(filename: string): string {
  const base = path.basename(filename).replace(/[^\w.\-()+ ]+/g, "_").trim();
  return base.slice(0, 180) || "attachment";
}

export function resolveFormAttachmentAbsolutePath(relativePath: string): string {
  const root = getFormAttachmentsRoot();
  const normalized = path.normalize(relativePath).replace(/^([/\\])+/, "");
  const absolute = path.resolve(root, normalized);
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (absolute !== root && !absolute.startsWith(rootWithSep)) {
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
  // Build relative keys with string joins — not path.join(...dynamics) —
  // so Turbopack does not treat them as project-root globs.
  const relativePath = [
    String(input.appraisalId),
    String(input.questionId),
    storedFilename,
  ].join("/");
  const absoluteDir = resolveFormAttachmentAbsolutePath(
    `${input.appraisalId}/${input.questionId}`,
  );

  await mkdir(absoluteDir, { recursive: true });
  await writeFile(path.resolve(absoluteDir, storedFilename), input.bytes);

  return {
    storedFilename,
    relativePath,
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
