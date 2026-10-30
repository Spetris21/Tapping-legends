// Builds TappingLegends-offline.html: one file with every script inside it.
// It works on its own (double-click it, email it, put it on a USB stick). Guest mode only.
// Run: node tools/build-offline.js
const fs = require('fs'), path = require('path');
const pub = path.join(__dirname, '..', 'public');
let html = fs.readFileSync(path.join(pub, 'index.html'), 'utf8');
html = html.replace(/<script src="([\w.]+)"><\/script>/g, (m, f) => {
  const js = fs.readFileSync(path.join(pub, f), 'utf8').replace(/<\/script/gi, '<\\/script');
  return '<script>/* ' + f + ' */\n' + js + '\n</script>';
});
// fonts become data: URLs so the single file still has them
html = html.replace(/url\(fonts\/([\w.-]+)\)/g, (m, f) => 'url(data:font/woff;base64,' + fs.readFileSync(path.join(pub, 'fonts', f)).toString('base64') + ')');
const out = path.join(__dirname, '..', 'TappingLegends-offline.html');
fs.writeFileSync(out, html);
console.log('Wrote', out, (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
