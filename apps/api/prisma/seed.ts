import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient, RoomStatus, UserRole } from '@prisma/client';

const db = new PrismaClient();
const roomTypes = ['Standard','Standard','Standard','Standard','Twin','Twin','Twin','Deluxe','Deluxe','Deluxe','Family','Family'];
async function main() {
  if (process.env.NODE_ENV === 'production' && (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === 'ChangeMe123!')) {
    throw new Error('Set a unique ADMIN_EMAIL and strong ADMIN_PASSWORD before seeding production');
  }
  for (let i = 1; i <= 12; i++) {
    const number = String(i).padStart(3, '0');
    await db.room.upsert({ where: { number }, update: {}, create: { number, type: roomTypes[i - 1]!, floor: i <= 6 ? 1 : 2, capacity: roomTypes[i - 1] === 'Family' ? 4 : 2, baseRate: 0, status: RoomStatus.AVAILABLE } });
  }
  const email = process.env.ADMIN_EMAIL ?? 'admin@local.hotel';
  const password = process.env.ADMIN_PASSWORD ?? 'ChangeMe123!';
  await db.user.upsert({ where: { email }, update: {}, create: { name: process.env.ADMIN_NAME ?? 'Hotel Administrator', email, passwordHash: await bcrypt.hash(password, 12), role: UserRole.ADMIN } });
  console.info(`Seeded 12 rooms and admin account ${email}. Set ADMIN_PASSWORD before production seeding.`);
}
main().finally(() => db.$disconnect());
