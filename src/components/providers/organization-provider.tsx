'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { OrganizationEntity, OrganizationMemberEntity } from '@/lib/db/pg/schema.pg';

interface OrganizationContextType {
  organization: OrganizationEntity | null;
  member: OrganizationMemberEntity | null;
  isOwner: boolean;
  canInviteMembers: boolean;
  refreshOrganization: () => Promise<void>;
  loading: boolean;
}

const OrganizationContext = createContext<OrganizationContextType | null>(null);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [organization, setOrganization] = useState<OrganizationEntity | null>(null);
  const [member, setMember] = useState<OrganizationMemberEntity | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshOrganization = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/organization/current');
      if (response.ok) {
        const data = await response.json();
        setOrganization(data.organization);
        setMember(data.member);
      } else {
        setOrganization(null);
        setMember(null);
      }
    } catch (error) {
      console.error('Failed to load organization:', error);
      setOrganization(null);
      setMember(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshOrganization();
  }, []);

  const isOwner = member?.role === 'account_owner';
  const canInviteMembers = isOwner || (member?.permissions as string[])?.includes('invite_members');

  return (
    <OrganizationContext.Provider
      value={{
        organization,
        member,
        isOwner,
        canInviteMembers,
        refreshOrganization,
        loading,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within OrganizationProvider');
  }
  return context;
}