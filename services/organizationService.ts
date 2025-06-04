/**
 * @fileoverview Organization Service
 * 
 * This service provides business logic for organization operations,
 * including organization CRUD and user membership management.
 * 
 * Key Features:
 * - Create, read, update, delete organizations
 * - Manage user-organization memberships
 * - Enforce "at most one organization per user" constraint
 * - Handle organization ownership and roles
 * 
 * @author Task Manager Team
 * @since 1.0.0
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { 
  Organization, 
  UserOrganization, 
  AppUser,
  UserOrganizationRole,
  OrganizationWithMembers,
  UserWithOrganizations
} from '@/types/database';

/**
 * Interface for organization creation
 */
export interface CreateOrganizationInput {
  name: string;
  slug: string;
  description?: string;
  domain?: string;
  logo_url?: string;
  website_url?: string;
  billing_email?: string;
  phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state_province?: string;
  postal_code?: string;
  country?: string;
  timezone?: string;
}

/**
 * Interface for organization update
 */
export interface UpdateOrganizationInput {
  name?: string;
  slug?: string;
  description?: string;
  domain?: string;
  logo_url?: string;
  website_url?: string;
  billing_email?: string;
  phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state_province?: string;
  postal_code?: string;
  country?: string;
  timezone?: string;
}

/**
 * Interface for service operation results
 */
export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: any;
}

/**
 * Creates a new organization and assigns the creator as owner
 * @param supabase - Authenticated Supabase client
 * @param organizationData - Organization data
 * @param creatorUserId - ID of the user creating the organization
 * @param traceId - Trace ID for logging
 * @returns Result of the organization creation
 */
export async function createOrganization(
  supabase: SupabaseClient,
  organizationData: CreateOrganizationInput,
  creatorUserId: string,
  traceId: string
): Promise<ServiceResult<Organization>> {
  
  console.log(`[${traceId}] Creating organization: ${organizationData.name}`);

  try {
    // Check if user already belongs to an organization (enforce "at most one" constraint)
    const { data: existingMembership, error: membershipCheckError } = await supabase
      .from('user_organizations')
      .select('id')
      .eq('user_id', creatorUserId)
      .limit(1);

    if (membershipCheckError) {
      console.error(`[${traceId}] Error checking existing membership: ${membershipCheckError.message}`);
      return { success: false, error: 'Failed to check existing organization membership', details: membershipCheckError };
    }

    if (existingMembership && existingMembership.length > 0) {
      console.log(`[${traceId}] User ${creatorUserId} already belongs to an organization`);
      return { success: false, error: 'User can only belong to one organization' };
    }

    // Check if slug is already taken
    const { data: existingOrg, error: slugCheckError } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', organizationData.slug)
      .limit(1);

    if (slugCheckError) {
      console.error(`[${traceId}] Error checking slug availability: ${slugCheckError.message}`);
      return { success: false, error: 'Failed to check slug availability', details: slugCheckError };
    }

    if (existingOrg && existingOrg.length > 0) {
      console.log(`[${traceId}] Slug ${organizationData.slug} is already taken`);
      return { success: false, error: 'Organization slug is already taken' };
    }

    // Create the organization
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .insert([organizationData])
      .select()
      .single();

    if (orgError) {
      console.error(`[${traceId}] Error creating organization: ${orgError.message}`);
      return { success: false, error: 'Failed to create organization', details: orgError };
    }

    // Add the creator as owner
    const { error: membershipError } = await supabase
      .from('user_organizations')
      .insert([{
        user_id: creatorUserId,
        organization_id: organization.id,
        role: 'owner',
        is_primary: true
      }]);

    if (membershipError) {
      console.error(`[${traceId}] Error creating owner membership: ${membershipError.message}`);
      return { success: false, error: 'Failed to create organization membership', details: membershipError };
    }

    console.log(`[${traceId}] Successfully created organization: ${organization.id}`);
    return { success: true, data: organization };

  } catch (error: any) {
    console.error(`[${traceId}] Error creating organization: ${error.message}`);
    return { success: false, error: 'Internal error during organization creation', details: error.message };
  }
}

/**
 * Updates an existing organization
 * @param supabase - Authenticated Supabase client
 * @param organizationId - ID of the organization to update
 * @param updateData - Updated organization data
 * @param traceId - Trace ID for logging
 * @returns Result of the organization update
 */
export async function updateOrganization(
  supabase: SupabaseClient,
  organizationId: string,
  updateData: UpdateOrganizationInput,
  traceId: string
): Promise<ServiceResult<Organization>> {
  
  console.log(`[${traceId}] Updating organization: ${organizationId}`);

  try {
    // Check if slug is being updated and if it's available
    if (updateData.slug) {
      const { data: existingOrg, error: slugCheckError } = await supabase
        .from('organizations')
        .select('id')
        .eq('slug', updateData.slug)
        .neq('id', organizationId)
        .limit(1);

      if (slugCheckError) {
        console.error(`[${traceId}] Error checking slug availability: ${slugCheckError.message}`);
        return { success: false, error: 'Failed to check slug availability', details: slugCheckError };
      }

      if (existingOrg && existingOrg.length > 0) {
        console.log(`[${traceId}] Slug ${updateData.slug} is already taken`);
        return { success: false, error: 'Organization slug is already taken' };
      }
    }

    const { data: organization, error } = await supabase
      .from('organizations')
      .update(updateData)
      .eq('id', organizationId)
      .select()
      .single();

    if (error) {
      console.error(`[${traceId}] Error updating organization: ${error.message}`);
      return { success: false, error: 'Failed to update organization', details: error };
    }

    console.log(`[${traceId}] Successfully updated organization: ${organizationId}`);
    return { success: true, data: organization };

  } catch (error: any) {
    console.error(`[${traceId}] Error updating organization: ${error.message}`);
    return { success: false, error: 'Internal error during organization update', details: error.message };
  }
}

/**
 * Deletes an organization (soft delete)
 * @param supabase - Authenticated Supabase client
 * @param organizationId - ID of the organization to delete
 * @param traceId - Trace ID for logging
 * @returns Result of the organization deletion
 */
export async function deleteOrganization(
  supabase: SupabaseClient,
  organizationId: string,
  traceId: string
): Promise<ServiceResult<void>> {
  
  console.log(`[${traceId}] Deleting organization: ${organizationId}`);

  try {
    const { error } = await supabase
      .from('organizations')
      .update({ is_active: false })
      .eq('id', organizationId);

    if (error) {
      console.error(`[${traceId}] Error deleting organization: ${error.message}`);
      return { success: false, error: 'Failed to delete organization', details: error };
    }

    console.log(`[${traceId}] Successfully deleted organization: ${organizationId}`);
    return { success: true };

  } catch (error: any) {
    console.error(`[${traceId}] Error deleting organization: ${error.message}`);
    return { success: false, error: 'Internal error during organization deletion', details: error.message };
  }
}

/**
 * Gets organization with member details
 * @param supabase - Authenticated Supabase client
 * @param organizationId - ID of the organization
 * @param traceId - Trace ID for logging
 * @returns Organization with members or null if not found
 */
export async function getOrganizationWithMembers(
  supabase: SupabaseClient,
  organizationId: string,
  traceId: string
): Promise<OrganizationWithMembers | null> {
  
  console.log(`[${traceId}] Fetching organization with members: ${organizationId}`);

  try {
    // Get organization
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', organizationId)
      .eq('is_active', true)
      .single();

    if (orgError || !organization) {
      console.log(`[${traceId}] Organization not found: ${organizationId}`);
      return null;
    }

    // Get members with user details
    const { data: members, error: membersError } = await supabase
      .from('user_organizations')
      .select(`
        *,
        user:users (
          id,
          email,
          display_name,
          first_name,
          last_name,
          avatar_url,
          is_active
        )
      `)
      .eq('organization_id', organizationId);

    if (membersError) {
      console.error(`[${traceId}] Error fetching organization members: ${membersError.message}`);
      throw new Error('Failed to fetch organization members');
    }

    const organizationWithMembers: OrganizationWithMembers = {
      ...organization,
      members: members || [],
      member_count: members?.length || 0
    };

    console.log(`[${traceId}] Successfully fetched organization with ${members?.length || 0} members`);
    return organizationWithMembers;

  } catch (error: any) {
    console.error(`[${traceId}] Error fetching organization with members: ${error.message}`);
    throw error;
  }
}

/**
 * Adds a user to an organization
 * @param supabase - Authenticated Supabase client
 * @param userId - ID of the user to add
 * @param organizationId - ID of the organization
 * @param role - Role to assign to the user
 * @param invitedBy - ID of the user making the invitation
 * @param traceId - Trace ID for logging
 * @returns Result of the membership addition
 */
export async function addUserToOrganization(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
  role: UserOrganizationRole,
  invitedBy: string,
  traceId: string
): Promise<ServiceResult<UserOrganization>> {
  
  console.log(`[${traceId}] Adding user ${userId} to organization ${organizationId} with role ${role}`);

  try {
    // Check if user already belongs to an organization (enforce "at most one" constraint)
    const { data: existingMembership, error: membershipCheckError } = await supabase
      .from('user_organizations')
      .select('id')
      .eq('user_id', userId)
      .limit(1);

    if (membershipCheckError) {
      console.error(`[${traceId}] Error checking existing membership: ${membershipCheckError.message}`);
      return { success: false, error: 'Failed to check existing organization membership', details: membershipCheckError };
    }

    if (existingMembership && existingMembership.length > 0) {
      console.log(`[${traceId}] User ${userId} already belongs to an organization`);
      return { success: false, error: 'User can only belong to one organization' };
    }

    // Check if organization exists and is active
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('id', organizationId)
      .eq('is_active', true)
      .single();

    if (orgError || !organization) {
      console.log(`[${traceId}] Organization not found or inactive: ${organizationId}`);
      return { success: false, error: 'Organization not found or inactive' };
    }

    // Add the user to the organization
    const { data: membership, error: membershipError } = await supabase
      .from('user_organizations')
      .insert([{
        user_id: userId,
        organization_id: organizationId,
        role,
        is_primary: true, // Since user can only belong to one organization
        invited_by: invitedBy,
        invited_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (membershipError) {
      console.error(`[${traceId}] Error creating membership: ${membershipError.message}`);
      return { success: false, error: 'Failed to add user to organization', details: membershipError };
    }

    console.log(`[${traceId}] Successfully added user to organization`);
    return { success: true, data: membership };

  } catch (error: any) {
    console.error(`[${traceId}] Error adding user to organization: ${error.message}`);
    return { success: false, error: 'Internal error during membership creation', details: error.message };
  }
}

/**
 * Removes a user from an organization
 * @param supabase - Authenticated Supabase client
 * @param userId - ID of the user to remove
 * @param organizationId - ID of the organization
 * @param traceId - Trace ID for logging
 * @returns Result of the membership removal
 */
export async function removeUserFromOrganization(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
  traceId: string
): Promise<ServiceResult<void>> {
  
  console.log(`[${traceId}] Removing user ${userId} from organization ${organizationId}`);

  try {
    // Check if this is the last owner
    const { data: owners, error: ownersError } = await supabase
      .from('user_organizations')
      .select('user_id')
      .eq('organization_id', organizationId)
      .eq('role', 'owner');

    if (ownersError) {
      console.error(`[${traceId}] Error checking owners: ${ownersError.message}`);
      return { success: false, error: 'Failed to check organization owners', details: ownersError };
    }

    // Check if the user being removed is an owner
    const { data: userMembership, error: userMembershipError } = await supabase
      .from('user_organizations')
      .select('role')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .single();

    if (userMembershipError) {
      console.error(`[${traceId}] Error checking user membership: ${userMembershipError.message}`);
      return { success: false, error: 'User is not a member of this organization', details: userMembershipError };
    }

    // Prevent removing the last owner
    if (userMembership.role === 'owner' && owners && owners.length === 1) {
      console.log(`[${traceId}] Cannot remove the last owner of the organization`);
      return { success: false, error: 'Cannot remove the last owner of the organization' };
    }

    const { error } = await supabase
      .from('user_organizations')
      .delete()
      .eq('user_id', userId)
      .eq('organization_id', organizationId);

    if (error) {
      console.error(`[${traceId}] Error removing user from organization: ${error.message}`);
      return { success: false, error: 'Failed to remove user from organization', details: error };
    }

    console.log(`[${traceId}] Successfully removed user from organization`);
    return { success: true };

  } catch (error: any) {
    console.error(`[${traceId}] Error removing user from organization: ${error.message}`);
    return { success: false, error: 'Internal error during membership removal', details: error.message };
  }
}

/**
 * Updates a user's role in an organization
 * @param supabase - Authenticated Supabase client
 * @param userId - ID of the user
 * @param organizationId - ID of the organization
 * @param newRole - New role to assign
 * @param traceId - Trace ID for logging
 * @returns Result of the role update
 */
export async function updateUserRole(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
  newRole: UserOrganizationRole,
  traceId: string
): Promise<ServiceResult<UserOrganization>> {
  
  console.log(`[${traceId}] Updating user ${userId} role to ${newRole} in organization ${organizationId}`);

  try {
    // If changing from owner role, check if there are other owners
    const { data: currentMembership, error: currentMembershipError } = await supabase
      .from('user_organizations')
      .select('role')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .single();

    if (currentMembershipError || !currentMembership) {
      console.error(`[${traceId}] User membership not found: ${currentMembershipError?.message}`);
      return { success: false, error: 'User membership not found', details: currentMembershipError };
    }

    if (currentMembership.role === 'owner' && newRole !== 'owner') {
      const { data: owners, error: ownersError } = await supabase
        .from('user_organizations')
        .select('user_id')
        .eq('organization_id', organizationId)
        .eq('role', 'owner');

      if (ownersError) {
        console.error(`[${traceId}] Error checking owners: ${ownersError.message}`);
        return { success: false, error: 'Failed to check organization owners', details: ownersError };
      }

      if (owners && owners.length === 1) {
        console.log(`[${traceId}] Cannot change role of the last owner`);
        return { success: false, error: 'Cannot change role of the last owner. Add another owner first.' };
      }
    }

    const { data: membership, error } = await supabase
      .from('user_organizations')
      .update({ role: newRole })
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (error) {
      console.error(`[${traceId}] Error updating user role: ${error.message}`);
      return { success: false, error: 'Failed to update user role', details: error };
    }

    console.log(`[${traceId}] Successfully updated user role`);
    return { success: true, data: membership };

  } catch (error: any) {
    console.error(`[${traceId}] Error updating user role: ${error.message}`);
    return { success: false, error: 'Internal error during role update', details: error.message };
  }
}