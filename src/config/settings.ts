import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env") });

export interface AppSettings {
  service_name: string;
  version: string;
  log_level: string;
  port: number;
  api_base_url: string;
  docs_base_path: string;
}

export interface DbSettings {
  db_host: string;
  db_user: string;
  db_password: string;
  db_port: number;
  db_name: string;
}

export interface JwtSettings {
  jwt_secret: string;
  jwt_algorithm: string;
  jwt_expiration_minutes: number;
  jwt_refresh_expiration_minutes: number;
  jwt_issuer: string;
  jwt_audience: string;
  jwt_private_key?: string;
  jwt_public_key?: string;
}

export interface CorsSettings {
  allowed_origins: string;
}

export interface SwaggerSettings {
  swagger_user: string;
  swagger_password: string;
}

export interface AwsSettings {
  default_region: string;
  access_key_id: string;
  secret_access_key: string;
  bucket_name: string;
  root_prefix: string;
}


export interface Settings {
  app: AppSettings;
  db: DbSettings;
  jwt: JwtSettings;
  cors: CorsSettings;
  swagger: SwaggerSettings;
  aws: AwsSettings;
}

let cachedSettings: Settings | null = null;

function normalizePem(input?: string): string {
  const s = (input ?? "").trim();
  if (!s) return "";
  return s.replace(/\\n/g, "\n").replace(/\r\n/g, "\n");
}

export function getSettings(): Settings {
  if (cachedSettings) return cachedSettings;

  const env = process.env;

  const settings: Settings = {
    app: {
      service_name: env.SERVICE_NAME ?? "Backend Axioma Web",
      version: env.K_REVISION ?? "local",
      log_level: env.LOG_LEVEL ?? "DEBUG",
      port: env.PORT ? Number(env.PORT) : 3000,
      api_base_url: env.API_BASE_URL ?? "http://localhost",
      docs_base_path: (env.DOCS_BASE_PATH ?? "/back-end/axioma-web").replace(/^\/+|\/+$/g, "").length
        ? "/" + (env.DOCS_BASE_PATH ?? "/back-end/axioma-web").replace(/^\/+|\/+$/g, "")
        : "/back-end/axioma-web",
    },
    db: {
      db_host: env.DB_HOST ?? "localhost",
      db_user: env.DB_USER ?? "root",
      db_password: env.DB_PASSWORD ?? "root",
      db_port: env.DB_PORT ? Number(env.DB_PORT) : 3306,
      db_name: env.DB_NAME ?? "dbtest",
    },
    jwt: {
      jwt_secret: env.JWT_SECRET ?? "changeme",
      jwt_algorithm: env.JWT_ALGORITHM ?? "HS256",
      jwt_expiration_minutes: env.JWT_EXPIRATION_MINUTES ? Number(env.JWT_EXPIRATION_MINUTES) : 60,
      jwt_refresh_expiration_minutes: env.JWT_REFRESH_EXPIRATION_MINUTES ? Number(env.JWT_REFRESH_EXPIRATION_MINUTES) : 20160, // 14 días
      jwt_issuer: env.JWT_ISSUER ?? "backend-template-auth-api",
      jwt_audience: env.JWT_AUDIENCE ?? "backend-template-auth-client",
      jwt_private_key: normalizePem(env.JWT_PRIVATE_KEY),
      jwt_public_key: normalizePem(env.JWT_PUBLIC_KEY),
    },
    cors: {
      allowed_origins: env.ALLOWED_ORIGINS ?? "all",
    },
    swagger: {
      swagger_user: env.SWAGGER_USER ?? "admin",
      swagger_password: env.SWAGGER_PASSWORD ?? "admin123",
    },
    aws: {
      default_region: env.AWS_DEFAULT_REGION ?? "",
      access_key_id: env.AWS_ACCESS_KEY_ID ?? "",
      secret_access_key: env.AWS_SECRET_ACCESS_KEY ?? "",
      bucket_name: env.AWS_BUCKET_NAME ?? "",
      root_prefix: (env.AWS_S3_ROOT_PREFIX ?? "axioma").replace(/^\/+|\/+$/g, ""),
    },
  };

  cachedSettings = settings;
  return settings;
}

export function getAppSettings(): AppSettings {
  return getSettings().app;
}

export function getDbSettings(): DbSettings {
  return getSettings().db;
}

export function getJwtSettings(): JwtSettings {
  return getSettings().jwt;
}

export function getCorsSettings(): CorsSettings {
  return getSettings().cors;
}

export function getSwaggerSettings(): SwaggerSettings {
  return getSettings().swagger;
}

export function getAwsSettings(): AwsSettings {
  return getSettings().aws;
}

const settings = getSettings();

export default settings;
