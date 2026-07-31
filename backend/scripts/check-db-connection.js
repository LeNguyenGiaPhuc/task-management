require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Dang ket noi den Supabase...');

  await prisma.$queryRaw`SELECT 1`;
  const userCount = await prisma.users.count();
  console.log(`Ket noi thanh cong. Database hien co ${userCount} users.`);
}

main()
  .catch((error) => {
    console.error('Co loi xay ra khi ket noi database:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('Da ngat ket noi database.');
  });
