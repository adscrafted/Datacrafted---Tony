import { db } from './db'

async function seed() {
  console.log('Seeding database...')

  // Create a sample user
  const sampleUser = await db.user.create({
    data: {
      name: 'Demo User',
      email: 'demo@datacrafted.com',
    },
  })

  // Create a sample session
  const sampleSession = await db.session.create({
    data: {
      name: 'Sample Dashboard',
      description: 'A sample dashboard with demo data',
      userId: sampleUser.id,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    },
  })

  // Create sample chat messages
  await db.chatMessage.create({
    data: {
      role: 'user',
      content: 'Can you analyze the sales data trends?',
      sessionId: sampleSession.id,
    },
  })

  await db.chatMessage.create({
    data: {
      role: 'assistant',
      content: 'I can see interesting trends in your sales data. The revenue shows a strong upward trend with seasonal peaks in Q4.',
      sessionId: sampleSession.id,
    },
  })

  console.log('Database seeded successfully!')
}

seed()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })