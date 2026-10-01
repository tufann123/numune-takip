// Numune Takip - push bildirimlerini gostermek icin minimal Service Worker.
// Sayfa (tab) kapali/arka planda/minimize olsa bile, Chrome bu dosyayi
// ayri bir arka plan sureci olarak calistirip 'push' olayini isleyebilir.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (err) {
    data = { title: "Numune Takip", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Numune Takip";
  const options = {
    body: data.body || "",
    tag: "numune-takip-bildirim",
    renotify: true,
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});
