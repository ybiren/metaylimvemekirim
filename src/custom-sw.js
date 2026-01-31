// src/custom-sw.js
importScripts('./ngsw-worker.js');

(function () {
  'use strict';

  self.addEventListener('push', (event) => {
    const payload = event.data ? event.data.json() : {};
    event.waitUntil(
      self.registration.showNotification(payload.title || 'Notification', {
        body: payload.body || '',
        data: payload.data || {},
        icon: 'icons/logo-192x192.png',
      })
    );
  });

  self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification?.data?.url || '/';
    event.waitUntil(clients.openWindow(url));
  });
})();
