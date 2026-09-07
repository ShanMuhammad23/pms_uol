/** Resolve `server-only` to a no-op so reminder scripts can run outside Next.js. */
const Module = require("module");
const path = require("path");
const fs = require("fs");

const stubPath = path.join(__dirname, "_server-only-stub.js");
if (!fs.existsSync(stubPath)) {
  fs.writeFileSync(stubPath, "module.exports = {};\n");
}

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request === "server-only") {
    return stubPath;
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};
