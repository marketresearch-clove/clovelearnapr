import { supabase } from './supabaseClient';

interface SyncResult {
  success: boolean;
  message: string;
  totalAuthUsers?: number;
  profilesCreated?: number;
  profilesUpdated?: number;
  errors?: string[];
}

export const userProfileSyncService = {
  /**
   * Syncs all users from auth.users to profiles table
   * Creates missing profiles and updates existing ones
   */
  async syncAllUsers(): Promise<SyncResult> {
    try {
      const errors: string[] = [];

      // Get all users from auth.users
      const { data: allUsers, error: fetchError } = await supabase.auth.admin
        .listUsers();

      if (fetchError) {
        return {
          success: false,
          message: `Failed to fetch auth users: ${fetchError.message}`,
          errors: [fetchError.message],
        };
      }

      if (!allUsers || allUsers.users.length === 0) {
        return {
          success: true,
          message: 'No users found in auth.users',
          totalAuthUsers: 0,
          profilesCreated: 0,
          profilesUpdated: 0,
        };
      }

      let profilesCreated = 0;
      let profilesUpdated = 0;

      // Process each user
      for (const user of allUsers.users) {
        try {
          const fullName =
            user.user_metadata?.full_name ||
            user.email?.split('@')[0] ||
            'User';
          const role = user.user_metadata?.role || 'learner';

          // Try to upsert the profile
          const { data, error } = await supabase
            .from('profiles')
            .upsert(
              {
                id: user.id,
                email: user.email,
                fullname: fullName,
                role: role,
                joindate: user.created_at,
                createdat: user.created_at,
                updatedat: new Date().toISOString(),
                user_id: user.user_metadata?.user_id || user.id,
                mobile_number: user.user_metadata?.mobile_number,
                user_status: 'Active',
                preferred_language: user.user_metadata?.preferred_language,
                company: user.user_metadata?.company,
                designation: user.user_metadata?.designation,
                employment_type: user.user_metadata?.employment_type,
                industry: user.user_metadata?.industry,
                leadership_role: user.user_metadata?.leadership_role,
                location: user.user_metadata?.location,
                persona: user.user_metadata?.persona,
                team: user.user_metadata?.team,
                manager_id: user.user_metadata?.manager_id,
                manager_name: user.user_metadata?.manager_name,
              },
              {
                onConflict: 'id',
              }
            )
            .select()
            .single();

          if (error) {
            errors.push(
              `Failed to sync user ${user.email}: ${error.message}`
            );
          } else if (data) {
            // Determine if it was created or updated
            // Since upsert doesn't distinguish, we check if joindate matches user.created_at
            if (
              new Date(data.createdat).getTime() ===
              new Date(user.created_at).getTime()
            ) {
              profilesCreated++;
            } else {
              profilesUpdated++;
            }
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          errors.push(`Error processing user ${user.email}: ${errorMsg}`);
        }
      }

      return {
        success: errors.length === 0,
        message:
          errors.length === 0
            ? `Successfully synced ${allUsers.users.length} users`
            : `Synced users with ${errors.length} errors`,
        totalAuthUsers: allUsers.users.length,
        profilesCreated,
        profilesUpdated,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        message: `Sync operation failed: ${errorMsg}`,
        errors: [errorMsg],
      };
    }
  },

  /**
   * Syncs a single user from auth.users to profiles
   */
  async syncSingleUser(userId: string): Promise<SyncResult> {
    try {
      // Get user from auth.users
      const { data: authUser, error: fetchError } = await supabase.auth.admin
        .getUserById(userId);

      if (fetchError || !authUser) {
        return {
          success: false,
          message: `User not found: ${fetchError?.message || 'Unknown error'}`,
          errors: [fetchError?.message || 'User not found'],
        };
      }

      const fullName =
        authUser.user.user_metadata?.full_name ||
        authUser.user.email?.split('@')[0] ||
        'User';
      const role = authUser.user.user_metadata?.role || 'learner';

      // Upsert the profile
      const { data, error } = await supabase
        .from('profiles')
        .upsert({
          id: authUser.user.id,
          email: authUser.user.email,
          fullname: fullName,
          role: role,
          joindate: authUser.user.created_at,
          createdat: authUser.user.created_at,
          updatedat: new Date().toISOString(),
          user_id: authUser.user.user_metadata?.user_id || authUser.user.id,
          mobile_number: authUser.user.user_metadata?.mobile_number,
          user_status: 'Active',
          preferred_language: authUser.user.user_metadata?.preferred_language,
          company: authUser.user.user_metadata?.company,
          designation: authUser.user.user_metadata?.designation,
          employment_type: authUser.user.user_metadata?.employment_type,
          industry: authUser.user.user_metadata?.industry,
          leadership_role: authUser.user.user_metadata?.leadership_role,
          location: authUser.user.user_metadata?.location,
          persona: authUser.user.user_metadata?.persona,
          team: authUser.user.user_metadata?.team,
          manager_id: authUser.user.user_metadata?.manager_id,
          manager_name: authUser.user.user_metadata?.manager_name,
        })
        .select()
        .single();

      if (error) {
        return {
          success: false,
          message: `Failed to sync user: ${error.message}`,
          errors: [error.message],
        };
      }

      return {
        success: true,
        message: `Successfully synced user ${authUser.user.email}`,
        totalAuthUsers: 1,
        profilesCreated: 1,
        profilesUpdated: 0,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        message: `Sync operation failed: ${errorMsg}`,
        errors: [errorMsg],
      };
    }
  },

  /**
   * Gets current sync status - returns users without profiles
   */
  async getSyncStatus(): Promise<{
    totalAuthUsers: number;
    totalProfiles: number;
    missingProfiles: number;
    usersWithoutProfiles: Array<{ id: string; email: string }>;
  }> {
    try {
      // Get all auth users
      const { data: allUsers } = await supabase.auth.admin.listUsers();

      // Get all profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id');

      const profileIds = new Set(profiles?.map((p: any) => p.id) || []);

      const usersWithoutProfiles = (allUsers?.users || [])
        .filter((user) => !profileIds.has(user.id))
        .map((user) => ({
          id: user.id,
          email: user.email,
        }));

      return {
        totalAuthUsers: allUsers?.users.length || 0,
        totalProfiles: profiles?.length || 0,
        missingProfiles: usersWithoutProfiles.length,
        usersWithoutProfiles,
      };
    } catch (error) {
      console.error('Error getting sync status:', error);
      return {
        totalAuthUsers: 0,
        totalProfiles: 0,
        missingProfiles: 0,
        usersWithoutProfiles: [],
      };
    }
  },

  /**
   * Verifies data consistency between auth.users and profiles
   */
  async verifyConsistency(): Promise<{
    isConsistent: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    try {
      const { data: allUsers } = await supabase.auth.admin.listUsers();
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, role');

      if (!allUsers || !profiles) {
        return {
          isConsistent: false,
          issues: ['Failed to fetch data for verification'],
        };
      }

      // Check for orphaned auth users (users without profiles)
      const profileIds = new Set(profiles.map((p: any) => p.id));
      const orphanedUsers = (allUsers.users || []).filter(
        (u) => !profileIds.has(u.id)
      );

      if (orphanedUsers.length > 0) {
        issues.push(
          `${orphanedUsers.length} auth users have no profile record`
        );
      }

      // Check for invalid roles
      const invalidRoles = profiles.filter(
        (p: any) => !['learner', 'instructor', 'admin'].includes(p.role)
      );

      if (invalidRoles.length > 0) {
        issues.push(`${invalidRoles.length} profiles have invalid roles`);
      }

      // Check for orphaned profiles (profiles without auth users)
      const authUserIds = new Set((allUsers.users || []).map((u) => u.id));
      const orphanedProfiles = profiles.filter(
        (p: any) => !authUserIds.has(p.id)
      );

      if (orphanedProfiles.length > 0) {
        issues.push(
          `${orphanedProfiles.length} profiles have no corresponding auth user`
        );
      }

      return {
        isConsistent: issues.length === 0,
        issues,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return {
        isConsistent: false,
        issues: [errorMsg],
      };
    }
  },

  /**
   * Update user role in profile
   */
  async updateUserRole(
    userId: string,
    newRole: 'learner' | 'instructor' | 'admin'
  ): Promise<SyncResult> {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          role: newRole,
          updatedat: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) {
        return {
          success: false,
          message: `Failed to update user role: ${error.message}`,
          errors: [error.message],
        };
      }

      return {
        success: true,
        message: `User role updated to ${newRole}`,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        message: `Failed to update role: ${errorMsg}`,
        errors: [errorMsg],
      };
    }
  },
};
