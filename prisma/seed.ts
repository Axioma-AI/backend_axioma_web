import { prisma } from '../src/config/db_config';
import { hashPassword } from '../src/utils/password_utils';
import { RoleName, ROLE_DESCRIPTIONS } from '../src/schemas/roles';

type SeedUserParams = {
  email: string;
  username: string;
  firstName: string;
  lastNamePaternal: string;
  lastNameMaternal?: string;
  phone?: string;
  countryCode?: string;
  roleId: number;
  passwordHash: string;
  historyHashes: string[];
  createdById?: number;
  seatsQuota?: number;
};

async function getOrCreateUserWithProfile(params: SeedUserParams): Promise<number> {
  const existing = await prisma.users.findUnique({
    where: { email: params.email },
    select: { id: true, created_by_id: true, seats_quota: true, role_id: true },
  });
  if (existing) {
    const updates: any = {};
    if (typeof params.createdById === 'number' && existing.created_by_id == null) {
      updates.created_by_id = params.createdById;
    }
    if (typeof params.seatsQuota === 'number' && (existing.seats_quota ?? 0) === 0) {
      updates.seats_quota = params.seatsQuota;
    }
    if (typeof params.roleId === 'number' && existing.role_id == null) {
      updates.role_id = params.roleId;
    }
    if (Object.keys(updates).length > 0) {
      await prisma.users.update({ where: { id: existing.id }, data: updates });
    }
    return existing.id;
  }

  const user = await prisma.users.create({
    data: {
      email: params.email,
      username: params.username,
      password: params.passwordHash,
      change_password: false,
      twoFA: false,
      first_name: params.firstName,
      last_name_paternal: params.lastNamePaternal,
      last_name_maternal: params.lastNameMaternal ?? null,
      phone: params.phone ?? null,
      country_code: params.countryCode ?? null,
      role_id: params.roleId,
      created_by_id: params.createdById ?? null,
      seats_quota: params.seatsQuota ?? 0,
    },
  });

  for (const h of params.historyHashes) {
    await prisma.user_password_history.create({
      data: {
        user_id: user.id,
        password: h,
      },
    });
  }

  return user.id;
}

async function seedRoles(): Promise<void> {
  for (const [name, description] of Object.entries(ROLE_DESCRIPTIONS)) {
    await prisma.roles.upsert({
      where: { name: name as RoleName },
      update: { description },
      create: { name: name as RoleName, description },
    });
  }
}

async function ensureInterest(userId: number, name: string) {
  const existing = await prisma.interests.findFirst({
    where: { user_id: userId, name },
  });
  if (existing) return existing;
  return prisma.interests.create({ data: { user_id: userId, name } });
}

async function ensureInterestGroup(userId: number, name: string) {
  const existing = await prisma.interest_groups.findFirst({
    where: { user_id: userId, name },
  });
  if (existing) return existing;
  return prisma.interest_groups.create({ data: { user_id: userId, name } });
}

async function ensureGroupItem(groupId: number, interestId: number) {
  const existing = await prisma.interest_group_items.findFirst({
    where: { group_id: groupId, interest_id: interestId },
  });
  if (existing) return existing;
  return prisma.interest_group_items.create({ data: { group_id: groupId, interest_id: interestId } });
}

async function main(): Promise<void> {
  await seedRoles();
  const existingUsers = await prisma.users.findMany({
    where: {
      email: {
        in: ['admin@example.com', 'member@example.com'],
      },
    },
    select: { email: true },
  });
  if (existingUsers.length > 0) {
    console.log('Seed users detected; ensuring data stays consistent with current features...');
  }

  const currentPasswordHash = await hashPassword('MyPassw0rd!');
  const historyHashes = await Promise.all([
    hashPassword('MyPassw0rd!-1'),
    hashPassword('MyPassw0rd!-2'),
    hashPassword('MyPassw0rd!-3'),
    hashPassword('MyPassw0rd!-4'),
  ]);

  

  const adminRole = await prisma.roles.findUnique({
    where: { name: RoleName.ADMIN },
  });

  const memberRole = await prisma.roles.findUnique({
    where: { name: RoleName.MEMBER },
  });

  const adminId = await getOrCreateUserWithProfile({
    email: 'admin@example.com',
    username: 'admin',
    firstName: 'Admin',
    lastNamePaternal: 'User',
    phone: '5551110001',
    countryCode: '52',
    roleId: adminRole!.id,
    passwordHash: currentPasswordHash,
    historyHashes,
    seatsQuota: 10,
  });

  const memberId = await getOrCreateUserWithProfile({
    email: 'member@example.com',
    username: 'member',
    firstName: 'Member',
    lastNamePaternal: 'User',
    phone: '5551110002',
    countryCode: '52',
    roleId: memberRole!.id,
    passwordHash: currentPasswordHash,
    historyHashes,
    createdById: adminId,
    seatsQuota: 5,
  });

  // Seed sample interests and a group for the member to reflect current seats/flows
  const iCryptos = await ensureInterest(memberId, 'cryptos');
  const iBitcoin = await ensureInterest(memberId, 'bitcoin');
  const iEthereum = await ensureInterest(memberId, 'ethereum');
  const gFavorites = await ensureInterestGroup(memberId, 'Favorites');
  await ensureGroupItem(gFavorites.id, iBitcoin.id);
  await ensureGroupItem(gFavorites.id, iEthereum.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
