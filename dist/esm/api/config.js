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
    return {
        databaseDriver: (_a = options.databaseDriver) !== null && _a !== void 0 ? _a : LowDriver,
        responseSizeLimit: (_b = options.responseSizeLimit) !== null && _b !== void 0 ? _b : 64,
        paramsToHide: (_c = options.paramsToHide) !== null && _c !== void 0 ? _c : ['password', 'token', '_csrf'],
        ignorePaths: (_d = options.ignorePaths) !== null && _d !== void 0 ? _d : [],
        clientIgnoreUrls: (_e = options.clientIgnoreUrls) !== null && _e !== void 0 ? _e : [],
        ignoreErrors: (_f = options.ignoreErrors) !== null && _f !== void 0 ? _f : [],
        isAuthorized: (_g = options.isAuthorized) !== null && _g !== void 0 ? _g : defaultIsAuthorized,
        getUser: options.getUser,
        // `?? true` rather than a truthiness check: `enableClient: false` is
        // the only value anyone passes, and must survive.
        enableClient: (_h = options.enableClient) !== null && _h !== void 0 ? _h : true,
        path: ((_j = options.path) !== null && _j !== void 0 ? _j : 'telescope').replace(/^\/+|\/+$/g, ''),
        slowQueryThreshold: (_k = options.slowQueryThreshold) !== null && _k !== void 0 ? _k : 100,
        timezone: (_l = options.timezone) !== null && _l !== void 0 ? _l : Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
}
