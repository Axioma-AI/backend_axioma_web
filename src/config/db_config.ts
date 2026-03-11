import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { setupLogger } from "../utils/logger";
import { AppSettings, getAppSettings, getDbSettings, type DbSettings } from "./settings";

const _DB_SETTINGS: DbSettings = getDbSettings();
const _APP_SETTINGS: AppSettings = getAppSettings();

const logger = setupLogger(_APP_SETTINGS.log_level);

const adapter = new PrismaMariaDb({
  host: _DB_SETTINGS.db_host,
  user: _DB_SETTINGS.db_user,
  password: _DB_SETTINGS.db_password,
  database: _DB_SETTINGS.db_name,
  port: _DB_SETTINGS.db_port,
  connectionLimit: 5,
});

export const prisma = new PrismaClient({ adapter });

export async function initDb(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info(`Prisma conectado a MySQL DB=${_DB_SETTINGS.db_name}`);
  } catch (err) {
    logger.error(`Error conectando a MySQL con Prisma: ${(err as Error).message}`);
    throw err;
  }
}

export async function closeDb(): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info("Prisma desconectado de MySQL correctamente");
  } catch (err) {
    logger.error(`Error cerrando conexión Prisma: ${(err as Error).message}`);
  }
}
