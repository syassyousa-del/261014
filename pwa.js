(function () {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (typeof navigator === 'undefined') return;
    if (window.location.protocol === 'file:') return;

    const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    if (isLocalhost) {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(registrations => {
                registrations.forEach(reg => reg.unregister());
            }).catch(() => {
                console.warn('Service worker unregister failed.');
            });
        }
        return;
    }

    if (!document.querySelector('link[rel="manifest"]')) {
        const manifest = document.createElement('link');
        manifest.rel = 'manifest';
        manifest.href = 'manifest.webmanifest';
        document.head.appendChild(manifest);
    }

    if (!('serviceWorker' in navigator)) return;

    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js').catch(err => {
            console.warn('Service worker registration failed:', err);
        });
    });
})();
