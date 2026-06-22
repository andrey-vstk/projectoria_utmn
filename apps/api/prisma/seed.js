const { PrismaClient, Role, UserStatus } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function seedDepartments() {
  const departments = [
    {
      code: 'ШКН',
      name: 'Школа компьютерных наук',
      description: 'ИТ, программная инженерия, data science',
      competencies: ['Программная инженерия', 'Data Science', 'Искусственный интеллект'],
      recipients: ['shkn@utmn.local'],
    },
    {
      code: 'ШЕН',
      name: 'Школа естественных наук',
      description: 'Естественно-научные исследования и экспертиза',
      competencies: ['Естественно-научные исследования', 'Лабораторные исследования'],
      recipients: ['shen@utmn.local'],
    },
    {
      code: 'ПИШ',
      name: 'Передовая инженерная школа',
      description: 'Инженерные проекты, прототипирование, индустриальные решения',
      competencies: ['Прототипирование', 'Инженерные решения', 'Промышленная автоматизация'],
      recipients: ['pish@utmn.local'],
    },
    {
      code: 'ФЭИ',
      name: 'Финансово-экономический институт',
      description: 'Экономика, управление, бизнес-процессы',
      competencies: ['Экономика', 'Управление', 'Бизнес-процессы'],
      recipients: ['fei@utmn.local'],
    },
  ];

  for (const dep of departments) {
    const department = await prisma.department.upsert({
      where: { code: dep.code },
      create: {
        code: dep.code,
        name: dep.name,
        description: dep.description,
        competencies: dep.competencies,
      },
      update: {
        name: dep.name,
        description: dep.description,
      },
    });

    if (department.deletedAt) {
      continue;
    }

    for (const email of dep.recipients) {
      const normalizedEmail = email.toLowerCase().trim();
      const existing = await prisma.departmentRecipient.findFirst({
        where: {
          departmentId: department.id,
          email: normalizedEmail,
        },
      });

      if (existing) {
        await prisma.departmentRecipient.update({
          where: { id: existing.id },
          data: { isActive: true },
        });
        continue;
      }

      await prisma.departmentRecipient.create({
        data: {
          departmentId: department.id,
          email: normalizedEmail,
        },
      });
    }
  }
}

async function seedAdmin() {
  const email = (process.env.SEED_ADMIN_EMAIL || 'admin@utmn.local')
    .toLowerCase()
    .trim();
  const password = process.env.SEED_ADMIN_PASSWORD || 'admin12345';
  const fullName = process.env.SEED_ADMIN_NAME || 'Администратор';

  const existingAdmin = await prisma.user.findUnique({ where: { email } });
  if (existingAdmin) {
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      email,
      fullName,
      passwordHash,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
    },
  });
}

async function main() {
  await seedAdmin();
  await seedDepartments();
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('Seed completed');
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
