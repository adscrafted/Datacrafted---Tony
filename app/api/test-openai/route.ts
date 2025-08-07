import { NextResponse } from 'next/server'
import OpenAI from 'openai'

export async function GET() {
  try {
    console.log('Testing OpenAI connection...')
    
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not found' },
        { status: 500 }
      )
    }

    console.log('API key found, length:', process.env.OPENAI_API_KEY.length)
    
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    console.log('OpenAI client created, testing simple call...')
    
    // Test with a very simple call and timeout
    const startTime = Date.now()
    
    const completion = await Promise.race([
      openai.chat.completions.create({
        model: "gpt-4o-mini", // Use faster, cheaper model for testing
        messages: [{ role: "user", content: "Reply with just the word 'test'" }],
        max_tokens: 10,
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 10000)
      )
    ]) as any

    const endTime = Date.now()
    console.log(`OpenAI test completed in ${endTime - startTime}ms`)

    return NextResponse.json({
      success: true,
      response: completion.choices[0]?.message?.content,
      time: endTime - startTime,
      model: completion.model
    })

  } catch (error) {
    console.error('OpenAI test failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}