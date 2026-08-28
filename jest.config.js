/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  verbose: true,
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    // Types are checked by `npm run typecheck` (tsc); isolatedModules in
    // tsconfig.json keeps ts-jest in transpile-only mode.
    "\\.tsx?$": ["ts-jest", {useESM: true}],
    // The client's session-recovery module is plain browser JS. Scoped to that
    // directory on purpose: a blanket .js transform would also rewrite the ESM
    // dependencies below, which are meant to load natively.
    "src/client/.*\\.js$": "babel-jest",
  },
  transformIgnorePatterns: ["/node_modules/(?!(lowdb|steno)/)"]
}
