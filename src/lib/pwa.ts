export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return
  const registration = await navigator.serviceWorker.register('/sw.js')
  registration.addEventListener('updatefound', () => {
    const worker = registration.installing
    worker?.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        window.dispatchEvent(new CustomEvent('pawprint:update-ready'))
      }
    })
  })
}
