#!/usr/bin/env node

const http = require('http')
const https = require('https')

const url = process.env.HEALTH_CHECK_URL || 'http://localhost:3000/health'
const timeout = parseInt(process.env.HEALTH_CHECK_TIMEOUT || '10000')

function healthCheck(url, timeout) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https://') ? https : http
    
    const req = client.get(url, { timeout }, (res) => {
      let data = ''
      
      res.on('data', (chunk) => {
        data += chunk
      })
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data)
          resolve({
            statusCode: res.statusCode,
            ...result
          })
        } catch (error) {
          reject(new Error(`Invalid JSON response: ${data}`))
        }
      })
    })
    
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error(`Request timeout after ${timeout}ms`))
    })
  })
}

async function main() {
  try {
    console.log(`Checking health endpoint: ${url}`)
    const result = await healthCheck(url, timeout)
    
    console.log('Health Check Result:')
    console.log(JSON.stringify(result, null, 2))
    
    if (result.statusCode === 200 && result.status === 'healthy') {
      console.log('✅ Application is healthy!')
      process.exit(0)
    } else {
      console.log('❌ Application is unhealthy!')
      process.exit(1)
    }
  } catch (error) {
    console.error('❌ Health check failed:', error.message)
    process.exit(1)
  }
}

main()