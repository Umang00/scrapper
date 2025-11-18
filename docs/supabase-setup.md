# Supabase Setup Guide

This guide covers how to set up Supabase for the Universal Crawler system.

## Prerequisites

- Supabase account (https://supabase.com)
- PostgreSQL database access
- Supabase CLI installed: `npm install -g supabase`

---

## Step 1: Create Supabase Project

1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Fill in project details:
   - **Name**: universal-crawler
   - **Database Password**: (generate strong password)
   - **Region**: Select closest to your infrastructure
4. Wait for project to be provisioned (~2 minutes)

---

## Step 2: Get API Keys

From your Supabase project dashboard:

1. Go to **Settings** > **API**
2. Copy the following keys:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon/public key**: Used for frontend
   - **service_role key**: Used for backend (keep secret!)

Add these to your `.env` file:
```bash
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## Step 3: Apply Database Schema

### Option A: Using Supabase Dashboard

1. Go to **SQL Editor** in Supabase dashboard
2. Copy contents of `infra/database/migrations/001_initial_schema.sql`
3. Paste and run the SQL
4. Copy contents of `infra/database/migrations/002_realtime_setup.sql`
5. Paste and run the SQL

### Option B: Using Supabase CLI

```bash
# Link to your project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push
```

---

## Step 4: Enable Realtime

The migrations already configure Realtime for the following tables:
- `crawl_jobs`
- `crawl_items`
- `captcha_events`
- `operator_sessions`

To verify, go to **Database** > **Replication** in Supabase dashboard and ensure these tables are enabled.

---

## Step 5: Configure Row Level Security (RLS)

RLS policies are included in the migration scripts. Verify they're active:

```sql
-- Check RLS is enabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```

All tables should show `rowsecurity = true`.

---

## Step 6: Test Connection

### Backend Test (API Server)

```bash
cd api-server
npm run dev
```

Check logs for: `✅ Supabase clients initialized`

### Database Test

```bash
# Using psql
psql "postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres"

# Test query
SELECT COUNT(*) FROM crawl_jobs;
```

---

## Step 7: Configure Storage Buckets (Optional)

If using Supabase Storage instead of S3:

1. Go to **Storage** in Supabase dashboard
2. Create bucket: `crawler-artifacts`
3. Set policies for service role access
4. Update `.env`:
   ```bash
   USE_SUPABASE_STORAGE=true
   SUPABASE_BUCKET=crawler-artifacts
   ```

---

## Realtime Channel Testing

Test Realtime channels from browser console:

```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://xxxxx.supabase.co',
  'your-anon-key'
)

// Subscribe to job updates
const channel = supabase.channel('jobs.test-123')
  .on('broadcast', { event: 'status' }, (payload) => {
    console.log('Job status:', payload)
  })
  .subscribe()

// Send test message (from backend)
channel.send({
  type: 'broadcast',
  event: 'status',
  payload: { job_id: 'test-123', status: 'running' }
})
```

---

## Troubleshooting

### Connection Errors

**Error**: `Failed to connect to Supabase`

**Solution**:
- Verify `SUPABASE_URL` and keys are correct
- Check network/firewall rules
- Ensure project is not paused (free tier pauses after inactivity)

### RLS Policy Errors

**Error**: `new row violates row-level security policy`

**Solution**:
- Check policies in `001_initial_schema.sql`
- Service role bypasses RLS automatically
- For anon key, ensure proper auth context

### Realtime Not Working

**Error**: No events received

**Solution**:
- Check tables are enabled in Replication settings
- Verify channel names match documentation
- Ensure using correct authentication (anon vs service role)

---

## Production Checklist

- [ ] Database password rotated from default
- [ ] Service role key stored in secure vault (not in code)
- [ ] RLS policies tested with real user roles
- [ ] Realtime channels tested under load
- [ ] Database backups configured (automatic in Supabase)
- [ ] Connection pooling configured (Supavisor enabled)
- [ ] Rate limits reviewed and adjusted if needed
- [ ] Monitoring/alerts set up for database metrics

---

## References

- [Supabase Documentation](https://supabase.com/docs)
- [Realtime Guide](https://supabase.com/docs/guides/realtime)
- [RLS Policies](https://supabase.com/docs/guides/auth/row-level-security)
- [Database Migrations](https://supabase.com/docs/guides/cli/local-development)
