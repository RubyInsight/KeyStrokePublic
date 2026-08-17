(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KeystrokeDrop = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const supportedFile = /\.(apkg|csv|tsv|txt)$/i;

  function supports(name) {
    return supportedFile.test(String(name || ''));
  }

  function hasFiles(types) {
    return Array.from(types || []).includes('Files');
  }

  function selectFiles(files) {
    const list = Array.from(files || []);
    if (!list.length) return { file: null, error: '' };
    if (list.length !== 1) return { file: null, error: 'Drop one deck or text file at a time.' };
    if (!supports(list[0].name)) return { file: null, error: 'Use an .apkg, .txt, .tsv, or .csv file.' };
    return { file: list[0], error: '' };
  }

  return { hasFiles, selectFiles, supports };
});
