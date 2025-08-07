'use client'

import React, { useState } from 'react'
import { useAuth } from '@/lib/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { UserPlus, Mail, Shield, MoreVertical, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface TeamMember {
  id: string
  email: string
  name: string
  role: 'owner' | 'admin' | 'member'
  status: 'active' | 'invited'
  joinedAt?: string
}

export default function TeamPage() {
  const { user, isDebugMode } = useAuth()
  const [inviteEmail, setInviteEmail] = useState('')
  const [isInviting, setIsInviting] = useState(false)
  const [showInviteForm, setShowInviteForm] = useState(false)

  // Mock team data
  const [teamMembers] = useState<TeamMember[]>([
    {
      id: '1',
      email: user?.email || 'owner@example.com',
      name: user?.displayName || 'You',
      role: 'owner',
      status: 'active',
      joinedAt: '2024-01-01'
    }
  ])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail) return

    setIsInviting(true)
    try {
      if (isDebugMode) {
        alert(`Debug Mode: Would invite ${inviteEmail} to team`)
      } else {
        // TODO: Implement actual invite functionality
        console.log('Inviting:', inviteEmail)
      }
      setInviteEmail('')
      setShowInviteForm(false)
    } catch (error) {
      console.error('Failed to invite:', error)
    } finally {
      setIsInviting(false)
    }
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'owner':
        return 'default'
      case 'admin':
        return 'secondary'
      default:
        return 'outline'
    }
  }


  return (
    <div>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>
              Manage your team and collaborate on projects
            </CardDescription>
          </div>
          <Button 
            onClick={() => setShowInviteForm(!showInviteForm)}
            size="sm"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Invite Member
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Debug Mode Notice */}
        {isDebugMode && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <p className="text-sm text-yellow-800">
              Debug Mode Active - Team features are simulated
            </p>
          </div>
        )}

        {/* Invite Form */}
        {showInviteForm && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Invite Team Member</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleInvite} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="colleague@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="flex space-x-2">
                  <Button type="submit" disabled={isInviting}>
                    {isInviting ? 'Sending...' : 'Send Invite'}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowInviteForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Team Members List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Active Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {teamMembers.map((member) => (
                <div key={member.id} className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <p className="font-medium">{member.name}</p>
                      <Badge variant={getRoleBadgeVariant(member.role)}>
                        {member.role}
                      </Badge>
                      {member.status === 'invited' && (
                        <Badge variant="outline">Pending</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{member.email}</p>
                  </div>
                  
                  {member.role !== 'owner' && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Shield className="mr-2 h-4 w-4" />
                          Change Role
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Team Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Team Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-base">Team Name</Label>
              <Input 
                className="mt-2" 
                placeholder="My Team" 
                disabled={!isDebugMode}
              />
            </div>
            
            <div>
              <Label className="text-base">Default Permissions</Label>
              <p className="text-sm text-gray-600 mt-1">
                New members will have these permissions by default
              </p>
              <div className="mt-2 space-y-2">
                <label className="flex items-center space-x-2">
                  <input type="checkbox" className="rounded" defaultChecked />
                  <span className="text-sm">View all projects</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" className="rounded" defaultChecked />
                  <span className="text-sm">Create new projects</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" className="rounded" />
                  <span className="text-sm">Delete projects</span>
                </label>
              </div>
            </div>

            <Button variant="outline" disabled>
              Save Settings
            </Button>
          </CardContent>
        </Card>

        {/* Upgrade Notice */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3">
              <Mail className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-blue-900">
                  Upgrade to Pro for team collaboration
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  Invite up to 5 team members, assign roles, and collaborate on projects in real-time.
                </p>
                <Button className="mt-3" size="sm" variant="default">
                  Upgrade Now
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </CardContent>
    </div>
  )
}