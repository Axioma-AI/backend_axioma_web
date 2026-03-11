import { Prisma } from "@prisma/client";
import { NotFoundError, ValidationError } from "./errors";

type PrismaErrorMessages = {
  unique?: string;
  fk?: string;
  notFound?: string;
  validation?: string;
  unknown?: string;
};

const prismaCodeMap: Record<string, keyof PrismaErrorMessages> = {
  P2002: "unique",
  P2003: "fk",
  P2025: "notFound",
};

type UniqueTarget = string | string[] | undefined;

const normalizeTarget = (target: UniqueTarget): string[] => {
  if (!target) return [];
  if (Array.isArray(target)) return target.map((x) => String(x));
  return [String(target)];
};

const UNIQUE_FRIENDLY_MAP: Record<string, string> = {
  uq_committees_code: "Committee code already exists. Please use a different committee_code.",
  committee_code: "Committee code already exists. Please use a different committee_code.",
};

const getFriendlyUniqueMessage = (target: UniqueTarget): string | null => {
  const parts = normalizeTarget(target);
  if (parts.length === 0) return null;

  for (const p of parts) if (UNIQUE_FRIENDLY_MAP[p]) return UNIQUE_FRIENDLY_MAP[p];

  if (parts.includes("committee_code")) return "Committee code already exists. Please use a different committee_code.";
  if (parts.includes("committee_name")) return "Committee name already exists. Please use a different committee_name.";

  return null;
};

const extractMysqlCode = (msg: string): number | null => {
  const m = msg.match(/MysqlError\s*\{\s*code:\s*(\d+)/i);
  if (m?.[1]) return Number(m[1]);
  return null;
};

export const parsePrismaError = (error: unknown, messages: PrismaErrorMessages = {}): never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const key = prismaCodeMap[error.code];
    const meta: any = (error as any).meta ?? {};

    if (key === "notFound") throw new NotFoundError(messages.notFound ?? "Record not found");

    if (key === "unique") {
      const friendly = getFriendlyUniqueMessage(meta?.target);
      throw new ValidationError(friendly ?? messages.unique ?? "This value is already in use. Please choose a different one.");
    }

    if (key === "fk") {
      throw new ValidationError(messages.fk ?? "A related record was not found. Please verify your IDs and try again.");
    }

    if (key) throw new ValidationError(messages[key] ?? "Database constraint error");

    throw error;
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    throw new ValidationError(messages.validation ?? "Invalid data. Please review your input and try again.");
  }

  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    const msg = error.message ?? "";
    const mysqlCode = extractMysqlCode(msg);

    if (mysqlCode === 1216 || mysqlCode === 1452) throw new ValidationError(messages.fk ?? "A related record was not found. Please verify your IDs and try again.");

    throw new ValidationError(messages.unknown ?? "Unexpected database error. Please try again.");
  }

  throw error;
};
