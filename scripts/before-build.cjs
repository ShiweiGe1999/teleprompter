// Runtime libraries are bundled by electron-vite. Returning false tells
// electron-builder not to rebuild or collect node_modules into the app.
module.exports = async function beforeBuild() {
  return false
}
