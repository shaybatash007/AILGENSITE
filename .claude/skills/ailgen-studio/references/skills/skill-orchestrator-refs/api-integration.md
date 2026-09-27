# API Integration Reference — Fetch Patterns

This reference is loaded when atoms involve external APIs, Firebase, cloud services,
or any connected system. Read this before writing any API-touching code.

---

## The Fetch-First Contract

Every API operation follows this sequence without exception:

```
1. IDENTIFY    — what resource / endpoint / collection is being touched?
2. FETCH       — pull the current state of that resource
3. VALIDATE    — does the fetched state match your assumptions?
4. EXECUTE     — perform the write/transform/call
5. CONFIRM     — fetch again (if critical) to verify the change landed
```

---

## Fetch Patterns by System Type

### REST API

```javascript
// Pre-fetch pattern — always before a write
const current = await fetch(`${BASE_URL}/resource/${id}`, {
  headers: { Authorization: `Bearer ${token}` }
}).then(r => {
  if (!r.ok) throw new Error(`Fetch failed: ${r.status} ${r.statusText}`);
  return r.json();
});

// Validate before writing
if (!current || current.status === 'locked') {
  throw new Error('Resource not in writable state — aborting write');
}

// Now execute the write with full context
const result = await fetch(`${BASE_URL}/resource/${id}`, {
  method: 'PATCH',
  headers: { 
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ ...current, ...updates }) // merge, never overwrite blind
}).then(r => r.json());
```

### Firebase / Firestore

```javascript
// Pre-fetch before any write
const docRef = db.collection('collection').doc(docId);
const snap = await docRef.get();

if (!snap.exists) {
  throw new Error(`Document ${docId} does not exist — cannot update`);
}

const currentData = snap.data();

// Validate shape
const requiredFields = ['status', 'ownerId', 'updatedAt'];
for (const field of requiredFields) {
  if (!(field in currentData)) {
    throw new Error(`Missing expected field: ${field}`);
  }
}

// Execute with fetched context
await docRef.update({
  ...updates,
  updatedAt: FieldValue.serverTimestamp(),
  _prevStatus: currentData.status // preserve audit trail
});
```

### GraphQL

```graphql
# Pre-fetch query — get current state of the node
query PreFetch($id: ID!) {
  node(id: $id) {
    ... on Resource {
      id
      status
      version      # critical for optimistic locking
      updatedAt
    }
  }
}
```

```javascript
// Use fetched version for optimistic concurrency
const mutation = await gqlClient.mutate({
  mutation: UPDATE_RESOURCE,
  variables: {
    id,
    version: fetched.version, // if version mismatch → server rejects → safe
    ...updates
  }
});
```

---

## Fetch Scope Decision Table

Use this to determine exactly what to fetch for each atom type:

| Operation | Minimum fetch scope |
|---|---|
| Update a document | Full document current state |
| Delete a resource | Document + any dependent references |
| Create with relations | Parent resource + schema for relation constraints |
| Auth-gated operation | Current user permissions + token scopes |
| Batch write | Sample of affected documents + collection schema |
| Storage upload | Existing file metadata (to avoid silent overwrite) |
| Deploy / publish | Current deployed version + diff |

---

## Error Classification

After a fetch, classify the result:

| Result | Classification | Action |
|---|---|---|
| 200 + expected shape | `CLEAN` | Proceed to execute |
| 200 + unexpected shape | `SCHEMA_DRIFT` | Stop, document the drift, ask user |
| 404 Not Found | `MISSING` | Decide: create new or surface error |
| 403 / 401 | `AUTH_FAILURE` | Stop, surface permission issue |
| 5xx | `SYSTEM_ERROR` | Retry once with backoff, then surface |
| Network timeout | `CONNECTIVITY` | Retry once, then surface |

Never silently swallow any classification other than `CLEAN`.

---

## Security Baseline

Every API atom must comply:

```javascript
// ✓ Correct — secrets from environment
const apiKey = process.env.API_KEY;

// ✗ Never — hardcoded secret
const apiKey = 'sk-live-abc123'; // disqualifies the atom from passing gate

// ✓ Correct — input validation before sending
function validatePayload(data: unknown): asserts data is UpdatePayload {
  if (!data || typeof data !== 'object') throw new Error('Invalid payload');
  if (!('id' in data)) throw new Error('Missing required field: id');
}

// ✓ Correct — rate limit awareness
const RATE_LIMIT_MS = 100;
let lastCall = 0;
async function rateLimitedFetch(url: string) {
  const now = Date.now();
  if (now - lastCall < RATE_LIMIT_MS) {
    await sleep(RATE_LIMIT_MS - (now - lastCall));
  }
  lastCall = Date.now();
  return fetch(url);
}
```

---

## Logging Pattern

Every API atom produces a structured log entry:

```javascript
const log = {
  atomId: 'A2',
  timestamp: new Date().toISOString(),
  operation: 'UPDATE',
  target: `collection/${docId}`,
  prefetch: {
    performed: true,
    result: 'CLEAN',
    snapshot: currentData // or summary if large
  },
  execution: {
    payload: updates,
    result: 'SUCCESS', // or ERROR
    responseTime: `${Date.now() - start}ms`
  },
  gateStatus: 'PASS'
};
```

This log is the audit trail. It is what makes the gate meaningful.
