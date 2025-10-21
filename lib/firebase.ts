// Firebase configuration and initialization
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAnalytics, type Analytics } from 'firebase/analytics'

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

// Initialize Firebase (singleton pattern)
let app: FirebaseApp
let analytics: Analytics | null = null

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    // Check if Firebase is already initialized
    const apps = getApps()
    if (apps.length > 0) {
      app = apps[0]
    } else {
      app = initializeApp(firebaseConfig)
    }
  }
  return app
}

export function getFirebaseAnalytics(): Analytics | null {
  if (typeof window === 'undefined') {
    // Analytics only works on client-side
    return null
  }

  if (!analytics) {
    try {
      const app = getFirebaseApp()
      analytics = getAnalytics(app)
    } catch (error) {
      console.warn('Firebase Analytics initialization failed:', error)
      return null
    }
  }
  return analytics
}

// Check if Firebase is properly configured
export function isFirebaseConfigured(): boolean {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId
  )
}

export { firebaseConfig }
