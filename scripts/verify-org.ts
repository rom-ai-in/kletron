import { getSupabaseAdminClient } from '../packages/server/src/lib/supabase/supabaseAdmin';
import dotenv from 'dotenv';
dotenv.config();

async function verify() {
  const admin = getSupabaseAdminClient();
  const userId = 'd284882f-8556-417e-9464-9c6066f55e24';

  console.log('Fetching user_context for:', userId);
  const { data: contexts, error } = await admin
    .from('user_context')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching context:', error.message);
    process.exit(1);
  }

  if (!contexts || contexts.length === 0) {
    console.error('No organization context found! The view did not resolve any data.');
    process.exit(1);
  }

  console.log('✅ Successfully resolved User Context:', JSON.stringify(contexts, null, 2));
  
  const tenantId = contexts[0].tenant_id;
  console.log('\nFetching Tenant Details for tenant_id:', tenantId);
  const { data: tenant, error: tErr } = await admin
    .from('tenants')
    .select(`
      id,
      name,
      slug,
      companies (
        id,
        name,
        slug,
        groups (
          id,
          name
        )
      )
    `)
    .eq('id', tenantId)
    .single();

  if (tErr) {
    console.error('Error fetching tenant details:', tErr.message);
    process.exit(1);
  }

  console.log('✅ Successfully resolved Tenant Details:', JSON.stringify(tenant, null, 2));
}

verify().catch(console.error);
