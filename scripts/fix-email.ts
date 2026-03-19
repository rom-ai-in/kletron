import { getSupabaseAdminClient } from '../packages/server/src/lib/supabase/supabaseAdmin';
import dotenv from 'dotenv';
dotenv.config();

async function fix() {
  const admin = getSupabaseAdminClient();
  const userId = 'd284882f-8556-417e-9464-9c6066f55e24';
  const { data: authUser } = await admin.auth.admin.getUserById(userId);
  const email = authUser?.user?.email;
  if (email) {
      await admin.from('user_profiles').update({ email, full_name: email.split('@')[0] }).eq('id', userId);
      console.log('✅ Backfilled email for user profile:', email);
  }
}
fix().catch(console.error);
