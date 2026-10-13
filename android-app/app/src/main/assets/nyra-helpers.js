/*
 * Injected by the Android app after every NYRA page load (see MainActivity.onPageFinished).
 *
 * The site saves songs / Instagram downloads by clicking a hidden <a download href="blob:...">.
 * Android's WebView ignores that, so we intercept the click and stream the file to the app in
 * chunks over window.NyraAndroid, which saves it to Downloads/NYRA (see DownloadSaver.kt).
 */
(function () {
  if (window.__nyraHelpersInstalled || !window.NyraAndroid) return;
  window.__nyraHelpersInstalled = true;

  var CHUNK = 512 * 1024; // raw bytes per message (~700 KB as base64)
  var queue = Promise.resolve(); // send one file at a time so chunks never interleave

  function send(obj) {
    window.NyraAndroid.postMessage(JSON.stringify(obj));
  }

  function toBase64(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var s = String(reader.result);
        resolve(s.slice(s.indexOf(',') + 1));
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function save(url, name) {
    // Grab the blob right away: the site revokes blob URLs a few seconds after the click.
    var blobPromise = fetch(url).then(function (r) { return r.blob(); });

    queue = queue.then(function () {
      return blobPromise.then(async function (blob) {
        var id = Date.now().toString(36) + Math.random().toString(36).slice(2);
        send({ type: 'fileStart', id: id, name: name, mime: blob.type || 'application/octet-stream' });
        for (var i = 0; i < blob.size; i += CHUNK) {
          send({ type: 'fileChunk', id: id, data: await toBase64(blob.slice(i, i + CHUNK)) });
        }
        send({ type: 'fileEnd', id: id });
      });
    }).catch(function () {
      send({ type: 'fileError', name: name });
    });
  }

  window.__nyraSaveBlob = save; // also called by DownloadListener as a fallback

  var originalClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.hasAttribute('download') && /^blob:/.test(this.href)) {
      save(this.href, this.getAttribute('download') || 'nyra-download');
      return;
    }
    return originalClick.apply(this, arguments);
  };
})();
