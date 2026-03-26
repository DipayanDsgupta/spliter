import toast from 'react-hot-toast'

let LocalNotifications = null
let notifId = 100

// Lazy-load Capacitor Local Notifications (no-op on web)
async function getPlugin() {
    if (LocalNotifications) return LocalNotifications
    try {
        const mod = await import('@capacitor/local-notifications')
        LocalNotifications = mod.LocalNotifications
        // Request permission on first use
        const perm = await LocalNotifications.checkPermissions()
        if (perm.display !== 'granted') {
            await LocalNotifications.requestPermissions()
        }
        return LocalNotifications
    } catch {
        return null
    }
}

/**
 * Send both an in-app toast AND an Android notification bar notification.
 * @param {string} title - Notification title (shown in notification bar)
 * @param {string} body - Notification body / toast message
 * @param {'success'|'error'|'info'} type - Toast style
 */
export async function sendNotification(title, body, type = 'info') {
    // In-app toast
    if (type === 'success') toast.success(body)
    else if (type === 'error') toast.error(body, { duration: 5000 })
    else toast(body, { icon: 'ℹ️' })

    // Native notification bar
    try {
        const plugin = await getPlugin()
        if (plugin) {
            await plugin.schedule({
                notifications: [{
                    id: notifId++,
                    title,
                    body,
                    smallIcon: 'ic_launcher',
                    largeIcon: 'ic_launcher',
                    channelId: 'spliter-default',
                }]
            })
        }
    } catch {
        // Silently fail on web or if permission denied
    }
}
