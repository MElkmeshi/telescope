import LowDriver from "./drivers/LowDriver.js";
function defaultIsAuthorized(request, response, next) {
    if (process.env.NODE_ENV === "production") {
        response.status(403).send('Forbidden');
        return;
    }
    next();
}
export function resolveConfig(options = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    const path = ((_a = options.path) !== null && _a !== void 0 ? _a : 'telescope').replace(/^\/+|\/+$/g, '');
    return {
        databaseDriver: (_b = options.databaseDriver) !== null && _b !== void 0 ? _b : LowDriver,
        responseSizeLimit: (_c = options.responseSizeLimit) !== null && _c !== void 0 ? _c : 64,
        paramsToHide: (_d = options.paramsToHide) !== null && _d !== void 0 ? _d : ['password', 'token', '_csrf'],
        // Telescope's own UI polls its API continuously; recording that
        // traffic floods the request list with self-inflicted noise.
        ignorePaths: [...((_e = options.ignorePaths) !== null && _e !== void 0 ? _e : []), `/${path}*`],
        clientIgnoreUrls: (_f = options.clientIgnoreUrls) !== null && _f !== void 0 ? _f : [],
        ignoreErrors: (_g = options.ignoreErrors) !== null && _g !== void 0 ? _g : [],
        isAuthorized: (_h = options.isAuthorized) !== null && _h !== void 0 ? _h : defaultIsAuthorized,
        getUser: options.getUser,
        // `?? true` rather than a truthiness check: `enableClient: false` is
        // the only value anyone passes, and must survive.
        enableClient: (_j = options.enableClient) !== null && _j !== void 0 ? _j : true,
        path,
        slowQueryThreshold: (_k = options.slowQueryThreshold) !== null && _k !== void 0 ? _k : 100,
        timezone: (_l = options.timezone) !== null && _l !== void 0 ? _l : Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
}
