'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useOrganization } from '@/components/providers/organization-provider';
import { Users, UserPlus, Settings, Crown, User } from 'lucide-react';
import { toast } from 'sonner';

export default function OrganizationSettingsPage() {
  const { organization, isOwner, canInviteMembers, loading } = useOrganization();
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  useEffect(() => {
    if (organization) {
      loadOrganizationData();
    }
  }, [organization]);

  const loadOrganizationData = async () => {
    if (!organization) return;

    try {
      const [membersRes, invitationsRes] = await Promise.all([
        fetch('/api/organization/members'),
        fetch('/api/organization/invitations'),
      ]);

      if (membersRes.ok) {
        setMembers(await membersRes.json());
      }

      if (invitationsRes.ok) {
        setInvitations(await invitationsRes.json());
      }
    } catch (error) {
      console.error('Failed to load organization data:', error);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    setIsInviting(true);
    try {
      const response = await fetch('/api/organization/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });

      if (response.ok) {
        toast.success('Invitation sent successfully!');
        setInviteEmail('');
        loadOrganizationData();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to send invitation');
      }
    } catch (error) {
      console.error('Failed to send invitation:', error);
      toast.error('Failed to send invitation');
    } finally {
      setIsInviting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="h-32 bg-gray-200 rounded mb-6"></div>
          <div className="h-48 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold mb-4">Create Your Organization</h2>
            <p className="text-gray-600 mb-6">
              Set up your organization to invite team members and manage shared resources.
            </p>
            <Button onClick={() => window.location.href = '/organization/create'}>
              Create Organization
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">{organization.name}</h1>
        <p className="text-gray-600">{organization.description}</p>
      </div>

      {/* Organization Overview */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Organization Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{organization.usedSeats}</div>
              <div className="text-sm text-gray-600">Active Members</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{organization.maxSeats}</div>
              <div className="text-sm text-gray-600">Total Seats</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {organization.maxSeats - organization.usedSeats}
              </div>
              <div className="text-sm text-gray-600">Available Seats</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Team Members */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Team Members
            </div>
            {canInviteMembers && (
              <div className="flex gap-2">
                <Input
                  placeholder="Enter email address"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-64"
                />
                <Button
                  onClick={handleInvite}
                  disabled={isInviting || !inviteEmail.trim()}
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  {isInviting ? 'Sending...' : 'Invite'}
                </Button>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {members.map((member: any) => (
              <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                    {member.role === 'account_owner' ? (
                      <Crown className="w-4 h-4 text-yellow-600" />
                    ) : (
                      <User className="w-4 h-4 text-gray-600" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium">{member.user?.name || 'Unknown User'}</div>
                    <div className="text-sm text-gray-600">{member.user?.email || 'No email'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={member.role === 'account_owner' ? 'default' : 'secondary'}>
                    {member.role === 'account_owner' ? 'Owner' : 'Member'}
                  </Badge>
                  {isOwner && member.role !== 'account_owner' && (
                    <Button variant="outline" size="sm">
                      Manage
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Invitations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {invitations.map((invitation: any) => (
                <div key={invitation.id} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <div className="font-medium">{invitation.email}</div>
                    <div className="text-sm text-gray-600">
                      Invited {new Date(invitation.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <Badge variant="outline">Pending</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}