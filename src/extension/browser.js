// Firefox exposes `browser` with promises; Chromium exposes `chrome`, which also
// returns promises for the MV3 APIs used here. This is the only place they meet.
export const api = globalThis.browser ?? globalThis.chrome
