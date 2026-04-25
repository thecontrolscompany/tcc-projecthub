// v1
// TCC ProjectHub — Service Worker
// Phase 1: static asset caching + network-first API caching + offline fallback
// Phase 2: background sync for offline write queue (see sync event handler)

const STATIC_CACHE = "tcc-static-v1";
const API_CACHE = "tcc-api-v1";
const ALL_CACHES = [STATIC_CACHE, API_CACHE];

// API GET routes to cache for offline read access
const CACHEABLE_API_PATTERNS = [
  /^\/api\/pm\/projects(\?|$)/,
  /^\/api\/admin\/bom\?.*projectId=/,
];

// TTL in milliseconds
const API_TTL = {
  "/api/pm/projects": 4 * 60 * 60 * 1000,        // 4 hours
  "/api/admin/bom": 2 * 60 * 60 * 1000,           // 2 hours
  default: 2 * 60 * 60 * 1000,
};

function getApiTtl(url) {
  const path = new URL(url).pathname;
  for (const [prefix, ttl] of Object.entries(API_TTL)) {
    if (path.startsWith(prefix)) return ttl;
  }
  return API_TTL.default;
}

function isStaticAsset(url) {
  const parsed = new URL(url);
  return (
    parsed.pathname.startsWith("/_next/static/") ||
    parsed.pathname.startsWith("/fonts/") ||
    /\.(png|jpg|jpeg|svg|gif|webp|ico|woff|woff2)$/.test(parsed.pathname)
  );
}

function isCacheableApiGet(request) {
  if (request.method !== "GET") return false;
  const parsed = new URL(request.url);
  const path = parsed.pathname + parsed.search;
  return CACHEABLE_API_PATTERNS.some((pattern) => pattern.test(path));
}

// ─── Install ──────────────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(["/offline.html", "/logo.png"]))
      .then(() => self.skipWaiting())
  );
});

// ─── Activate ─────────────────────────────────────────────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !ALL_CACHES.includes(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ─── Fetch ────────────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Never intercept non-GET mutations (POST, PATCH, etc.) in Phase 1
  // Phase 2 write-queue is handled client-side, not in the SW fetch handler
  if (request.method !== "GET") return;

  // Page HTML — network only, fallback to offline.html on navigation failure
  if (request.destination === "document") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/offline.html"))
    );
    return;
  }

  // Static assets — cache first
  if (isStaticAsset(request.url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Cacheable API GETs — network first, fallback to cache
  if (isCacheableApiGet(request)) {
    event.respondWith(networkFirstWithCache(request));
    return;
  }

  // Everything else — pass through
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstWithCache(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(API_CACHE);
      // Attach a cached-at timestamp as a custom header for TTL checks
      const headers = new Headers(response.headers);
      headers.set("x-sw-cached-at", Date.now().toString());
      const cloned = new Response(await response.clone().blob(), {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
      cache.put(request, cloned);
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) {
      // Check TTL — serve stale but flag it
      const cachedAt = parseInt(cached.headers.get("x-sw-cached-at") || "0");
      const ttl = getApiTtl(request.url);
      if (Date.now() - cachedAt > ttl) {
        const headers = new Headers(cached.headers);
        headers.set("x-sw-stale", "true");
        return new Response(await cached.blob(), {
          status: cached.status,
          statusText: cached.statusText,
          headers,
        });
      }
      return cached;
    }
    // No cache — return offline.html for navigations, or a 503 for API calls
    return new Response(JSON.stringify({ offline: true }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// ─── Sync (Phase 2 — Background Sync for write queue) ────────────────────────

self.addEventListener("sync", (event) => {
  if (event.tag === "tcc-sync-mutations") {
    event.waitUntil(replayPendingMutations());
  }
});

async function replayPendingMutations() {
  let db;
  try {
    db = await openOfflineDb();
  } catch {
    return;
  }

  const pending = await getAllPending(db);
  if (pending.length === 0) return;

  const broadcast = new BroadcastChannel("tcc-sync");

  for (const record of pending) {
    await updateMutationStatus(db, record.id, "syncing");
    try {
      const response = await fetch(record.url, {
        method: record.method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record.payload),
      });

      if (response.ok) {
        const serverResponse = await response.json().catch(() => null);
        await deleteMutation(db, record.id);
        await appendSyncLog(db, {
          mutationId: record.id,
          result: "success",
          serverResponse,
        });
        // Invalidate the cached project-detail entry so next read is fresh
        if (record.projectId) {
          invalidateProjectCache(record.projectId);
        }
        broadcast.postMessage({ type: "SYNC_COMPLETE", mutationId: record.id, result: "success" });
      } else if (response.status === 401) {
        await updateMutationStatus(db, record.id, "failed", "Session expired — please sign in again");
        await appendSyncLog(db, { mutationId: record.id, result: "error", serverResponse: { status: 401 } });
        broadcast.postMessage({ type: "SYNC_FAILED", mutationId: record.id, reason: "session_expired" });
      } else if (response.status === 409) {
        await updateMutationStatus(db, record.id, "conflict", "A submitted update already exists for this week");
        await appendSyncLog(db, { mutationId: record.id, result: "conflict", serverResponse: { status: 409 } });
        broadcast.postMessage({ type: "SYNC_FAILED", mutationId: record.id, reason: "conflict" });
      } else {
        // 5xx or unexpected — retry up to 3 times
        const attempt = (record.attempt || 0) + 1;
        if (attempt >= 3) {
          await updateMutationStatus(db, record.id, "failed", `Server error (${response.status}) after ${attempt} attempts`);
          broadcast.postMessage({ type: "SYNC_FAILED", mutationId: record.id, reason: "server_error" });
        } else {
          await updateMutationAttempt(db, record.id, attempt);
          // Re-register the sync tag so the browser retries
          self.registration.sync.register("tcc-sync-mutations").catch(() => {});
        }
      }
    } catch {
      // Network failure during replay — re-register for next connectivity window
      await updateMutationStatus(db, record.id, "pending", null);
      self.registration.sync.register("tcc-sync-mutations").catch(() => {});
    }
  }

  broadcast.close();
}

async function invalidateProjectCache(projectId) {
  const cache = await caches.open(API_CACHE);
  const keys = await cache.keys();
  for (const key of keys) {
    if (key.url.includes(`projectId=${projectId}`)) {
      await cache.delete(key);
    }
  }
}

// ─── Message (Phase 3 — Pre-fetch trigger) ────────────────────────────────────

self.addEventListener("message", (event) => {
  if (event.data?.type === "PREFETCH") {
    prefetchForRole(event.data.role).catch(() => {});
  }
});

async function prefetchForRole(role) {
  if (role !== "pm") return; // Installer has no client-fetchable API in Phase 3

  try {
    const listResponse = await fetch("/api/pm/projects", { credentials: "include" });
    if (!listResponse.ok) return;

    const cache = await caches.open(API_CACHE);
    const listClone = listResponse.clone();

    const headers = new Headers(listResponse.headers);
    headers.set("x-sw-cached-at", Date.now().toString());
    cache.put(
      "/api/pm/projects",
      new Response(await listResponse.blob(), { status: 200, headers })
    );

    const data = await listClone.json().catch(() => null);
    const projects = data?.projects ?? data ?? [];
    const ids = Array.isArray(projects)
      ? projects.map((p) => p.id ?? p.project_id).filter(Boolean)
      : [];

    // Fetch project details with a max of 3 concurrent requests
    const semaphore = 3;
    for (let i = 0; i < ids.length; i += semaphore) {
      const batch = ids.slice(i, i + semaphore);
      await Promise.allSettled(
        batch.map((id) => prefetchProjectDetail(cache, id))
      );
    }
  } catch {
    // Pre-fetch is best-effort; silently ignore failures
  }
}

async function prefetchProjectDetail(cache, projectId) {
  const url = `/api/pm/projects?section=project-data&projectId=${projectId}`;
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) return;
  const headers = new Headers(response.headers);
  headers.set("x-sw-cached-at", Date.now().toString());
  cache.put(url, new Response(await response.blob(), { status: 200, headers }));
}

// ─── IndexedDB helpers (inline — mirrors offline-db.js for SW context) ────────

const DB_NAME = "tcc-offline-v1";
const DB_VERSION = 1;

function openOfflineDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("pending_mutations")) {
        const store = db.createObjectStore("pending_mutations", { keyPath: "id" });
        store.createIndex("status", "status");
        store.createIndex("projectId", "projectId");
      }
      if (!db.objectStoreNames.contains("sync_log")) {
        db.createObjectStore("sync_log", { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getAllPending(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pending_mutations", "readonly");
    const store = tx.objectStore("pending_mutations");
    const index = store.index("status");
    const req = index.getAll("pending");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function updateMutationStatus(db, id, status, lastError = null) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pending_mutations", "readwrite");
    const store = tx.objectStore("pending_mutations");
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const record = getReq.result;
      if (!record) { resolve(); return; }
      record.status = status;
      record.lastError = lastError;
      store.put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
  });
}

function updateMutationAttempt(db, id, attempt) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pending_mutations", "readwrite");
    const store = tx.objectStore("pending_mutations");
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const record = getReq.result;
      if (!record) { resolve(); return; }
      record.attempt = attempt;
      record.status = "pending";
      store.put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
  });
}

function deleteMutation(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pending_mutations", "readwrite");
    const store = tx.objectStore("pending_mutations");
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function appendSyncLog(db, entry) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("sync_log", "readwrite");
    const store = tx.objectStore("sync_log");
    store.add({
      id: crypto.randomUUID(),
      syncedAt: new Date().toISOString(),
      ...entry,
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
