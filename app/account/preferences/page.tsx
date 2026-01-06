'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/lib/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Loader2, Check, Sun, Moon } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// Common timezones
const timezones = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Central European (CET)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'China (CST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
  { value: 'UTC', label: 'UTC' },
]

type ThemeMode = 'light' | 'dark'

interface Preferences {
  theme: ThemeMode
  timezone: string
  emailNotifications: boolean
  weeklyDigest: boolean
}

const defaultPreferences: Preferences = {
  theme: 'light',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
  emailNotifications: true,
  weeklyDigest: false,
}

export default function PreferencesPage() {
  const { user, isDebugMode } = useAuth()
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  // Load preferences from localStorage on mount
  useEffect(() => {
    const savedPrefs = localStorage.getItem('userPreferences')
    if (savedPrefs) {
      try {
        const parsed = JSON.parse(savedPrefs)
        setPreferences({ ...defaultPreferences, ...parsed })
      } catch (e) {
        console.error('Failed to parse preferences:', e)
      }
    }
    setIsLoaded(true)
  }, [])

  // Note: Theme is applied only in dashboard context via ThemeProvider
  // This preference is saved and used when viewing charts/dashboards

  const handleSavePreferences = async () => {
    setIsSaving(true)
    setSaveSuccess(false)

    try {
      // Save to localStorage
      localStorage.setItem('userPreferences', JSON.stringify(preferences))

      // In the future, sync to backend
      if (!isDebugMode && user) {
        // TODO: Sync preferences to database
        // await fetch('/api/user/preferences', { method: 'POST', body: JSON.stringify(preferences) })
      }

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (error) {
      console.error('Failed to save preferences:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const updatePreference = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPreferences(prev => ({ ...prev, [key]: value }))
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div>
      <CardHeader>
        <CardTitle>Preferences</CardTitle>
        <CardDescription>
          Customize your DataCrafted experience
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Debug Mode Notice */}
        {isDebugMode && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <p className="text-sm text-yellow-800">
              Debug Mode Active - Preferences are stored locally only
            </p>
          </div>
        )}

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Appearance</CardTitle>
            <CardDescription>
              Choose how DataCrafted looks to you
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Label>Theme</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => updatePreference('theme', 'light')}
                  className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all ${
                    preferences.theme === 'light'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Sun className="h-6 w-6 mb-2 text-yellow-500" />
                  <span className="text-sm font-medium">Light</span>
                </button>
                <button
                  onClick={() => updatePreference('theme', 'dark')}
                  className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all ${
                    preferences.theme === 'dark'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Moon className="h-6 w-6 mb-2 text-indigo-500" />
                  <span className="text-sm font-medium">Dark</span>
                </button>
              </div>
              <p className="text-xs text-gray-500">
                Theme applies to your dashboard and charts
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Regional */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Regional</CardTitle>
            <CardDescription>
              Set your timezone for accurate data display
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select
                value={preferences.timezone}
                onValueChange={(value) => updatePreference('timezone', value)}
              >
                <SelectTrigger id="timezone">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {timezones.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Times in your charts and reports will display in this timezone
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Notifications</CardTitle>
            <CardDescription>
              Manage how you receive updates
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email-notifications">Email notifications</Label>
                <p className="text-xs text-gray-500">
                  Receive important updates about your account
                </p>
              </div>
              <Switch
                id="email-notifications"
                checked={preferences.emailNotifications}
                onCheckedChange={(checked) => updatePreference('emailNotifications', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="weekly-digest">Weekly digest</Label>
                <p className="text-xs text-gray-500">
                  Get a summary of your data insights every week
                </p>
              </div>
              <Switch
                id="weekly-digest"
                checked={preferences.weeklyDigest}
                onCheckedChange={(checked) => updatePreference('weeklyDigest', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSavePreferences} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : saveSuccess ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Saved
              </>
            ) : (
              'Save Preferences'
            )}
          </Button>
        </div>
      </CardContent>
    </div>
  )
}
