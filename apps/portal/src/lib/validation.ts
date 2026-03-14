import { z } from "zod";
import { BadRequestError } from "@/lib/errors";

// Reusable field types
const safeNameField = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9-]+$/, "Must contain only alphanumeric characters and hyphens");

// Chat route body
export const chatMessageSchema = z.object({
  message: z.string().min(1).max(10000),
  sessionId: z.string().uuid().optional(),
});

// Admin access route body (POST)
export const accessGrantSchema = z.object({
  email: z.string().email(),
  agentName: safeNameField,
});

// Admin access route body (DELETE)
export const accessRevokeSchema = z.object({
  userId: z.string().min(1).max(200),
  agentName: safeNameField,
});

// Jobs clear / run body
export const jobSchema = z.object({
  agentName: safeNameField,
  jobId: safeNameField,
});

// Integration disconnect PATCH body
export const renameAccountSchema = z.object({
  account: z.string().min(1).max(200),
  newName: z.string().min(1).max(200).trim(),
});

/**
 * Validate that a URL param is safe (alphanumeric + hyphens only).
 * Throws BadRequestError if the value is unsafe.
 */
export function safeParam(value: string, label = "parameter"): string {
  if (!/^[a-zA-Z0-9-]+$/.test(value)) {
    throw new BadRequestError(`Invalid ${label}: must be alphanumeric and hyphens only`);
  }
  return value;
}

/**
 * Sanitize a filename for safe use in filesystem paths.
 * - Strips everything except alphanumeric, hyphens, underscores, and dots
 * - Removes leading dots (hidden files / relative path components)
 * - Rejects filenames with null bytes or path separator characters
 * Returns the sanitized filename, or throws BadRequestError if the result is empty/unsafe.
 */
export function sanitizeFilename(name: string): string {
  // Reject null bytes and path separators immediately
  if (name.includes("\0") || name.includes("/") || name.includes("\\")) {
    throw new BadRequestError("Invalid filename: contains illegal characters");
  }

  // Use path.basename equivalent — strip any directory component
  const base = name.split("/").pop()?.split("\\").pop() ?? "";

  // Strip everything except safe characters
  const sanitized = base.replace(/[^a-zA-Z0-9._-]/g, "");

  // Remove leading dots (prevents hidden files and ".." traversal)
  const stripped = sanitized.replace(/^\.+/, "");

  if (!stripped) {
    throw new BadRequestError("Invalid filename: empty after sanitization");
  }

  // Reject ".." explicitly (also caught above, but be explicit)
  if (stripped === "..") {
    throw new BadRequestError("Invalid filename");
  }

  return stripped;
}

/**
 * Parse and validate a request body against a Zod schema.
 * Returns the parsed data or throws BadRequestError with the first validation message.
 */
export async function parseBody<T>(
  request: Request,
  schema: z.ZodType<T>
): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new BadRequestError("Request body must be valid JSON");
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const first = result.error.errors[0];
    const field = first.path.length > 0 ? `${first.path.join(".")}: ` : "";
    throw new BadRequestError(`${field}${first.message}`);
  }

  return result.data;
}
