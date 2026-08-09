/** The `obsidian` package ships types only, so anything importing it has no module to resolve in a test run. */
export const requestUrl = async () => {
  throw new Error('requestUrl is not available outside of Obsidian');
};

export const moment = { locale: () => 'en-us' };
