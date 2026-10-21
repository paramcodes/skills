# Choose a TypeScript project profile

Do not choose a profile just because a project contains `.ts` files. Determine where the code runs and how it is built first.

## Node.js ESM

Use `templates/node-esm/tsconfig.json` when the app is genuinely a Node.js ESM project and its `package.json`/build tooling agrees with Node's module rules. It uses `module` and `moduleResolution` set to `NodeNext`, and expects Node type definitions. Confirm import extensions, package exports, and the production build command rather than assuming `tsc --noEmit` compiles the app for deployment.

## Browser + React + Vite

Use `templates/browser-react-vite/tsconfig.json` only when React + Vite is the chosen stack. It uses DOM libraries, bundler-style module resolution, React JSX, and Vite client types. Add/retain the framework's recommended config and plugins. Don't adopt its `types` or `jsx` settings for non-Vite/non-React projects.

## Next.js, other bundlers, monorepos, libraries

Do not shoehorn these into either profile. Keep a separate TSConfig per runtime/package where appropriate, use the framework's current official config as the base, and apply compatible safety flags. In workspaces, invoke type checking per package or via the workspace task runner; don't assume root `tsc --noEmit` covers every package.

## Vitest

The standalone example is for projects that do not already have a Vite config. Vitest can read the Vite config; a standalone Vitest config takes precedence and may cause existing Vite aliases/plugins to be ignored. For a Vite app, merge the `test` property into `vite.config.ts` or explicitly compose a shared config.

## ESLint and type-aware linting

The common ESLint template uses flat config and `parserOptions.projectService`. Make sure every linted TypeScript file belongs to a discoverable TSConfig. If configs/scripts/tests intentionally use a distinct TSConfig, model that explicitly rather than disabling type-aware linting across the whole project. Check the installed `typescript-eslint` version's current API before copying.
