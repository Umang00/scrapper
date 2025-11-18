# Supabase Realtime Channel Topology

## Overview

This document defines the channel naming conventions, payload contracts, and usage patterns for Supabase Realtime in the Universal Crawler system.

---

## Channel Types

### 1. Broadcast Channels
Used for pub/sub messaging where publishers send events to all subscribers.

### 2. Presence Channels
Used for tracking online/offline state of operators.

### 3. Database Change Subscriptions
Direct table subscriptions using PostgreSQL replication.

---

## Channel Definitions

### jobs.<crawl_id>

**Type**: Broadcast + Database Subscription
**Purpose**: Job-specific real-time updates
**Subscribers**: Operators viewing job detail page
**Publishers**: Worker processes, API server

#### Subscription Pattern
```typescript
const channel = supabase.channel(`jobs.${crawlId}`)
  .on('broadcast', { event: 'status' }, (payload) => {
    // Handle status updates
  })
  .on('broadcast', { event: 'progress' }, (payload) => {
    // Handle progress updates
  })
  .on('broadcast', { event: 'error' }, (payload) => {
    // Handle errors
  })
  .subscribe();
```

#### Payload Contracts

**Event: status**
```typescript
{
  event: 'status',
  data: {
    job_id: string,
    status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled',
    timestamp: string,
    message?: string
  }
}
```

**Event: progress**
```typescript
{
  event: 'progress',
  data: {
    job_id: string,
    total_urls: number,
    processed_urls: number,
    success_count: number,
    error_count: number,
    current_url?: string,
    timestamp: string
  }
}
```

**Event: error**
```typescript
{
  event: 'error',
  data: {
    job_id: string,
    error_message: string,
    error_details?: object,
    url?: string,
    timestamp: string
  }
}
```

**Event: item_extracted**
```typescript
{
  event: 'item_extracted',
  data: {
    job_id: string,
    item_id: string,
    url: string,
    content_type: string,
    timestamp: string
  }
}
```

---

### captcha_queue

**Type**: Broadcast
**Purpose**: Global captcha queue for operator resolution
**Subscribers**: All active operators (dashboard, captcha queue page)
**Publishers**: Worker processes (captcha manager)

#### Subscription Pattern
```typescript
const channel = supabase.channel('captcha_queue')
  .on('broadcast', { event: 'new_captcha' }, (payload) => {
    // Show notification, update queue UI
  })
  .on('broadcast', { event: 'captcha_solved' }, (payload) => {
    // Remove from queue
  })
  .subscribe();
```

#### Payload Contracts

**Event: new_captcha**
```typescript
{
  event: 'new_captcha',
  data: {
    captcha_id: string,
    job_id: string,
    captcha_type: string,
    source_platform: string,
    url: string,
    screenshot_url?: string, // Signed S3 URL
    site_key?: string,
    timeout_at: string,
    timestamp: string
  }
}
```

**Event: captcha_solved**
```typescript
{
  event: 'captcha_solved',
  data: {
    captcha_id: string,
    solved_by: string, // user_id or email
    timestamp: string
  }
}
```

**Event: captcha_timeout**
```typescript
{
  event: 'captcha_timeout',
  data: {
    captcha_id: string,
    timestamp: string
  }
}
```

---

### operator_presence

**Type**: Presence
**Purpose**: Track which operators are online and available
**Subscribers**: Dashboard, operator list, captcha queue
**Publishers**: All operator frontend sessions

#### Subscription Pattern
```typescript
const channel = supabase.channel('operator_presence', {
  config: {
    presence: {
      key: userId,
    },
  },
})
  .on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState();
    // state contains all online operators
  })
  .on('presence', { event: 'join' }, ({ key, newPresences }) => {
    // Operator came online
  })
  .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
    // Operator went offline
  })
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track({
        user_id: userId,
        email: userEmail,
        online_at: new Date().toISOString(),
        status: 'available', // available, busy, away
      });
    }
  });
```

#### Presence State
```typescript
{
  [userId: string]: [
    {
      user_id: string,
      email: string,
      online_at: string,
      status: 'available' | 'busy' | 'away'
    }
  ]
}
```

---

### alerts.global

**Type**: Broadcast
**Purpose**: System-wide alerts and notifications
**Subscribers**: All authenticated operators
**Publishers**: API server, worker monitoring systems

#### Subscription Pattern
```typescript
const channel = supabase.channel('alerts.global')
  .on('broadcast', { event: 'alert' }, (payload) => {
    // Show toast/notification
  })
  .subscribe();
```

#### Payload Contracts

**Event: alert**
```typescript
{
  event: 'alert',
  data: {
    alert_id: string,
    severity: 'info' | 'warning' | 'error' | 'critical',
    title: string,
    message: string,
    details?: object,
    action?: {
      label: string,
      url: string
    },
    timestamp: string
  }
}
```

**Common Alert Types**:
- Proxy pool depletion
- High captcha spike
- Session invalidation
- Worker crash
- Storage quota warning
- Rate limit violations

---

### jobs_list

**Type**: Database Subscription
**Purpose**: Live updates to jobs list view
**Subscribers**: Dashboard, jobs list page
**Publishers**: Database (via RLS)

#### Subscription Pattern
```typescript
const channel = supabase.channel('jobs_list')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'crawl_jobs',
    },
    (payload) => {
      // Handle INSERT, UPDATE, DELETE
    }
  )
  .subscribe();
```

---

## Security & Access Control

### RLS Integration
All Realtime subscriptions respect Row Level Security policies:
- Operators can only subscribe to jobs they created or have access to
- Service role (workers) can publish to any channel
- Anon key subscriptions are rejected

### Channel Access Matrix

| Channel | Authenticated Operators | Service Role | Anon Key |
|---------|------------------------|--------------|----------|
| jobs.<id> | Read (if authorized) | Read/Write | ❌ |
| captcha_queue | Read/Write | Read/Write | ❌ |
| operator_presence | Read/Write | Read | ❌ |
| alerts.global | Read | Read/Write | ❌ |
| jobs_list | Read (filtered by RLS) | Read/Write | ❌ |

### Authorization Checks

```typescript
// Server-side publishing (service role)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Client-side subscribing (authenticated user)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
    },
  }
);
```

---

## Performance Considerations

### Event Throttling
- **Progress updates**: Max 1 event per second per job
- **Presence updates**: Max 1 update per 5 seconds per user
- **Alert broadcasts**: Max 10 events per minute globally

### Reconnection Strategy
```typescript
const channel = supabase.channel('my-channel', {
  config: {
    broadcast: {
      ack: false, // Don't wait for ack (faster, less reliable)
    },
  },
});
```

### Cleanup
```typescript
// Always unsubscribe when component unmounts
useEffect(() => {
  const channel = supabase.channel('...');
  channel.subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, []);
```

---

## Monitoring & Debugging

### Connection Status
```typescript
const channel = supabase.channel('my-channel')
  .subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('Connected to channel');
    }
    if (status === 'CHANNEL_ERROR') {
      console.error('Connection failed');
    }
    if (status === 'TIMED_OUT') {
      console.warn('Subscription timeout');
    }
  });
```

### Event Logging
All Realtime events should be logged for debugging:
```typescript
channel.on('broadcast', { event: '*' }, (payload) => {
  logger.info('Realtime event received', {
    channel: 'my-channel',
    event: payload.event,
    timestamp: payload.timestamp,
  });
});
```

---

## Testing

### Local Development
Use Supabase local development:
```bash
supabase start
supabase db push
```

### Integration Tests
```typescript
test('should receive job status update', async () => {
  const channel = supabase.channel('jobs.test-123');
  const promise = new Promise((resolve) => {
    channel.on('broadcast', { event: 'status' }, resolve);
  });

  await channel.subscribe();

  // Trigger event from backend
  await publishJobStatus('test-123', 'running');

  const payload = await promise;
  expect(payload.data.status).toBe('running');
});
```

---

## Migration Path

If migrating from another realtime system:
1. Implement new Supabase channels alongside existing system
2. Dual-publish events to both systems during transition
3. Migrate frontend subscribers incrementally
4. Remove old system after full migration

---

## References

- [Supabase Realtime Docs](https://supabase.com/docs/guides/realtime)
- [Realtime Broadcast](https://supabase.com/docs/guides/realtime/broadcast)
- [Realtime Presence](https://supabase.com/docs/guides/realtime/presence)
- [Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)
