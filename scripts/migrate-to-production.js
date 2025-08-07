#!/usr/bin/env node

/**
 * Production Migration Script
 * 
 * This script helps migrate from SQLite (development) to PostgreSQL (production)
 * Run this script when setting up production database
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

async function main() {
  const environment = process.env.NODE_ENV || 'development'
  
  console.log(`🚀 Starting production migration script`)
  console.log(`Environment: ${environment}`)
  
  try {
    // Check if we have production database URL
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('sqlite')) {
      console.error('❌ Production DATABASE_URL is not configured or still pointing to SQLite')
      console.log('Please set DATABASE_URL to your PostgreSQL connection string')
      process.exit(1)
    }
    
    console.log('✅ Production DATABASE_URL detected')
    
    // Backup current schema
    console.log('📦 Backing up current schema...')
    const backupDir = path.join(__dirname, '../prisma/backups')
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true })
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupFile = path.join(backupDir, `schema-backup-${timestamp}.prisma`)
    fs.copyFileSync(
      path.join(__dirname, '../prisma/schema.prisma'),
      backupFile
    )
    console.log(`✅ Schema backed up to: ${backupFile}`)
    
    // Update schema for production
    console.log('🔄 Updating schema for PostgreSQL...')
    const prodSchemaPath = path.join(__dirname, '../prisma/schema.prod.prisma')
    const currentSchemaPath = path.join(__dirname, '../prisma/schema.prisma')
    
    if (fs.existsSync(prodSchemaPath)) {
      fs.copyFileSync(prodSchemaPath, currentSchemaPath)
      console.log('✅ Schema updated for PostgreSQL')
    } else {
      console.log('⚠️  Production schema not found, updating current schema...')
      // Update the datasource in the current schema
      let schema = fs.readFileSync(currentSchemaPath, 'utf8')
      schema = schema.replace(
        /datasource db \{[\s\S]*?\}/,
        `datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}`
      )
      fs.writeFileSync(currentSchemaPath, schema)
      console.log('✅ Schema updated for PostgreSQL')
    }
    
    // Generate Prisma client
    console.log('🔧 Generating Prisma client...')
    execSync('npx prisma generate', { stdio: 'inherit' })
    console.log('✅ Prisma client generated')
    
    // Push schema to database
    console.log('📤 Pushing schema to production database...')
    execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' })
    console.log('✅ Schema pushed to production database')
    
    // Optional: Run seeds if they exist
    const seedPath = path.join(__dirname, '../lib/seed.ts')
    if (fs.existsSync(seedPath)) {
      console.log('🌱 Running database seeds...')
      try {
        execSync('npm run db:seed', { stdio: 'inherit' })
        console.log('✅ Database seeded successfully')
      } catch (error) {
        console.log('⚠️  Seeding failed, but migration was successful')
      }
    }
    
    console.log('🎉 Production migration completed successfully!')
    console.log('🔍 Run health check to verify deployment: npm run health-check')
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}