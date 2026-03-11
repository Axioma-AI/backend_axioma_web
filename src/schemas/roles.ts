export enum RoleName {
  ADMIN = 'admin',
  MEMBER = 'member',
}

export const ROLE_DESCRIPTIONS: Record<RoleName, string> = {
  [RoleName.ADMIN]: 'Administrador: control de cuentas y configuración',
  [RoleName.MEMBER]: 'Miembro: acceso regular a funcionalidades asignadas',
};

export const DEFAULT_ROLES: Array<{ name: RoleName; description: string }> = (
  Object.entries(ROLE_DESCRIPTIONS).map(([name, description]) => ({
    name: name as RoleName,
    description,
  }))
);

export function isValidRoleName(value: string): value is RoleName {
  return Object.values(RoleName).includes(value as RoleName);
}

// DB reflection helpers: read roles and descriptions directly from DB
// Inserted roles are returned as-is; if DB access fails, falls back to DEFAULT_ROLES.
import { prisma } from '../config/db_config';

export async function getRolesFromDb(): Promise<Array<{ name: RoleName; description: string }>> {
  try {
    const rows: Array<{ name: string; description: string | null }> = await (prisma as any).roles.findMany({
      select: { name: true, description: true },
    });
    return rows.map((r) => ({ 
      name: r.name as RoleName, 
      description: r.description ?? '' 
    }));
  } catch (_err) {
    return DEFAULT_ROLES;
  }
}

export async function getRoleDescriptionsFromDb(): Promise<Record<RoleName, string>> {
  const list = await getRolesFromDb();
  const map = {} as Record<RoleName, string>;
  for (const r of list) map[r.name] = r.description;
  return map;
}

export async function existsRoleNameInDb(value: string): Promise<boolean> {
  const found = await (prisma as any).roles.findFirst({ where: { name: value as any } });
  return !!found;
}
