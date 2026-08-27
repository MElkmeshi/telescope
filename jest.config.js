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
  },
  transformIgnorePatterns: ["/node_modules/(?!(lowdb|steno)/)"]
}
