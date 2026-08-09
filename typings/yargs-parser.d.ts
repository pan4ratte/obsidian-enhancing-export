// The browser entry is the same parser without the Node-only config-file
// loading, which pulls `node:module` into the bundle. It ships no types.
declare module 'yargs-parser/browser' {
  import parser from 'yargs-parser';
  export default parser;
}
