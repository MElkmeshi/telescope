/**
 * Recover from an expired session instead of showing the user a 401.
 *
 * This panel is a plain page: it never loads the host app's auth SDK, so
 * nothing here refreshes a short-lived session cookie. Session middleware
 * generally renews an expired cookie silently, but only on a GET — Clerk's
 * refresh, for one, is gated on `request.method === 'GET'` — and these screens
 * poll with POST every couple of seconds. The result is a 401 that appears at
 * random and that reloading the page seems to cure, a document navigation
 * being the other request shape such middleware will renew on.
 *
 * A timer cannot fix this: the poll runs every 2.5s, so any ping interval
 * leaves a window where the poll reaches an expired cookie first. Retrying
 * through the keepalive at the moment of the 401 is exact, and costs nothing
 * while the session is healthy.
 *
 * Written without optional chaining or ?? so the compiled bundle stays within
 * what the toolchain's browser targets guarantee.
 *
 * @param {object} axios  the axios instance the screens use
 * @param {function(): string} basePath  the panel's mount path, read lazily
 *                                       because it is set after this module
 *                                       is imported
 */
export default function installSessionRecovery(axios, basePath)
{
    // One shared in-flight keepalive: an expiry trips every poller on the page
    // at the same instant, and they must not each renew the session.
    let renewal = null;

    return axios.interceptors.response.use(null, function (error) {
        const original = error.config;

        if (!error.response || error.response.status !== 401) {
            return Promise.reject(error);
        }

        // No config means we cannot replay it; `retried` means we already did,
        // and it also marks the keepalive itself so it can never recurse.
        if (!original || original.telescopeRetried) {
            return Promise.reject(error);
        }

        original.telescopeRetried = true;

        if (!renewal) {
            renewal = axios
                .get(basePath() + '/telescope-api/keepalive', {telescopeRetried: true})
                .then(function () {
                    renewal = null;
                })
                .catch(function () {
                    renewal = null;

                    // Genuinely signed out, not merely expired. Let the
                    // original 401 stand rather than retrying into it.
                    throw error;
                });
        }

        return renewal.then(function () {
            return axios(original);
        });
    });
}
