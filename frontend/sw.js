const CACHE_NAME = 'bravo-music-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/css/main.css',
    '/css/responsive.css',
    '/js/app.js',
    '/js/config.js',
    '/manifest.json',
    '/assets/default/album-cover.jpg',
    '/assets/default/avatar.png'
];

// Install service worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

// Fetch from cache
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Return cached version or fetch from network
                if (response) {
                    return response;
                }
                
                return fetch(event.request).then(response => {
                    // Don't cache API calls
                    if (!event.request.url.includes('/api/')) {
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });
                    }
                    return response;
                });
            })
    );
});

// Background sync for offline actions
self.addEventListener('sync', event => {
    if (event.tag === 'sync-uploads') {
        event.waitUntil(syncUploads());
    }
});

async function syncUploads() {
    const cache = await caches.open('pending-uploads');
    const requests = await cache.keys();
    
    for (const request of requests) {
        try {
            const response = await fetch(request);
            if (response.ok) {
                await cache.delete(request);
            }
        } catch (error) {
            console.error('Failed to sync upload:', error);
        }
    }
}

// Push notifications
self.addEventListener('push', event => {
    const data = event.data.json();
    
    const options = {
        body: data.body,
        icon: '/assets/icons/icon-192x192.png',
        badge: '/assets/icons/badge-72x72.png',
        vibrate: [200, 100, 200],
        data: {
            url: data.url,
            id: data.id
        },
        actions: [
            {
                action: 'open',
                title: 'Open'
            },
            {
                action: 'close',
                title: 'Close'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    if (event.action === 'open') {
        const url = event.notification.data.url;
        event.waitUntil(
            clients.openWindow(url)
        );
    }
});