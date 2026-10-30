// Use JS config to avoid TypeScript transpile issues in some environments.
// This file simply re-exports the JS config so local TS tooling still works.
import config from "./next.config.mjs";
export default config;
