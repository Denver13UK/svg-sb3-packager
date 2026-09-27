const els = {
  fileInput: document.querySelector('#fileInput'),
  loadButton: document.querySelector('#loadButton'),
  exportButton: document.querySelector('#exportButton'),
  copyButton: document.querySelector('#copyButton'),
  stage: document.querySelector('#stage'),
  projectName: document.querySelector('#projectName'),
  status: document.querySelector('#status'),
  domOutput: document.querySelector('#domOutput'),
  stageWidth: document.querySelector('#stageWidth'),
  stageHeight: document.querySelector('#stageHeight'),
  responsive: document.querySelector('#responsive')
};

let current = null;

els.loadButton.addEventListener('click', () => els.fileInput.click());
els.fileInput.addEventListener('change', () => {
  const file = els.fileInput.files?.[0];
  if (file) loadSB3(file);
});
els.exportButton.addEventListener('click', exportHTML);
els.copyButton.addEventListener('click', copyHTML);
[els.stageWidth, els.stageHeight].forEach(input => input.addEventListener('input', () => {
  if (current) {
    updateStageSize();
    renderProject(current);
  }
}));

async function loadSB3(file) {
  setStatus('Reading project…');
  try {
    const zip = await JSZip.loadAsync(file);
    const projectFile = zip.file('project.json');
    if (!projectFile) throw new Error('project.json was not found in this SB3.');

    const project = JSON.parse(await projectFile.async('text'));
    const assets = new Map();

    for (const [name, entry] of Object.entries(zip.files)) {
      if (entry.dir || name === 'project.json') continue;
      const bytes = await entry.async('uint8array');
      assets.set(name, bytes);
    }

    current = {fileName: file.name, project, assets};
    els.projectName.textContent = project.meta?.name || file.name.replace(/\\.sb3$/i, '');
    els.exportButton.disabled = false;
    els.copyButton.disabled = false;
    updateStageSize();
    renderProject(current);
    setStatus('Loaded successfully. This preview uses DOM/SVG only.');
  } catch (error) {
    console.error(error);
    current = null;
    els.exportButton.disabled = true;
    els.copyButton.disabled = true;
    setStatus(error.message || String(error));
  }
}

function updateStageSize() {
  const width = Math.max(1, Number(els.stageWidth.value) || 480);
  const height = Math.max(1, Number(els.stageHeight.value) || 360);
  els.stage.style.width = width + 'px';
  els.stage.style.height = height + 'px';
}

function renderProject(state) {
  const project = state.project;
  els.stage.replaceChildren();

  const width = Number(els.stageWidth.value) || 480;
  const height = Number(els.stageHeight.value) || 360;
  els.stage.style.background = colorToCSS(project.stage?.[0]?.color) || '#ffffff';

  const targets = Array.isArray(project.targets) ? project.targets : [];
  const stageTarget = targets.find(t => t.isStage);
  if (stageTarget?.tempo) {
    els.stage.dataset.tempo = String(stageTarget.tempo);
  }

  const sprites = targets.filter(t => !t.isStage);
  sprites.sort((a, b) => Number(a.layerOrder || 0) - Number(b.layerOrder || 0));

  for (const target of sprites) {
    els.stage.appendChild(createSpriteElement(target, state, width, height));
  }

  els.domOutput.textContent = els.stage.outerHTML;
}

function createSpriteElement(target, state, stageWidth, stageHeight) {
  const wrapper = document.createElement('div');
  wrapper.className = 'sprite';
  wrapper.dataset.spriteName = target.name || '';
  wrapper.dataset.targetId = target.id || '';
  wrapper.dataset.x = String(target.x ?? 0);
  wrapper.dataset.y = String(target.y ?? 0);
  wrapper.dataset.size = String(target.size ?? 100);
  wrapper.dataset.direction = String(target.direction ?? 90);

  const costume = getCurrentCostume(target);
  const visual = costume ? createCostumeElement(costume, state) : null;

  const costumeSize = getCostumeSize(costume);
  const scale = Number(target.size ?? 100) / 100;
  const w = Math.max(1, costumeSize.width * scale);
  const h = Math.max(1, costumeSize.height * scale);

  if (visual) {
    visual.style.width = w + 'px';
    visual.style.height = h + 'px';
    wrapper.appendChild(visual);
  } else {
    const missing = document.createElement('div');
    missing.textContent = target.name || 'Sprite';
    missing.style.cssText = 'padding:8px;background:#ffdf8a;border:1px solid #9b7a00;';
    wrapper.appendChild(missing);
  }

  const x = Number(target.x || 0);
  const y = Number(target.y || 0);
  const rotation = Number(target.direction || 90) - 90;

  wrapper.style.width = w + 'px';
  wrapper.style.height = h + 'px';
  wrapper.style.left = (stageWidth / 2 + x - w / 2) + 'px';
  wrapper.style.top = (stageHeight / 2 - y - h / 2) + 'px';
  wrapper.style.transform = 'rotate(' + rotation + 'deg)';

  if (target.visible === false) wrapper.style.display = 'none';

  return wrapper;
}

function getCurrentCostume(target) {
  const costumes = Array.isArray(target.costumes) ? target.costumes : [];
  if (!costumes.length) return null;
  const index = Math.max(0, Math.min(costumes.length - 1, Number(target.currentCostume || 0)));
  return costumes[index];
}

function createCostumeElement(costume, state) {
  const fileName = costume.md5ext || costume.assetId;
  const bytes = state.assets.get(fileName);
  if (!bytes) {
    const placeholder = document.createElement('div');
    placeholder.className = 'text-layer';
    placeholder.textContent = costume.name || 'Missing costume';
    return placeholder;
  }

  const ext = (fileName.split('.').pop() || '').toLowerCase();
  const mime = ext === 'svg' ? 'image/svg+xml' :
    ext === 'png' ? 'image/png' :
    ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
    ext === 'gif' ? 'image/gif' : 'application/octet-stream';

  if (ext === 'svg') {
    const svgText = new TextDecoder().decode(bytes);
    const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
    const svg = doc.documentElement;
    if (svg && svg.nodeName.toLowerCase() === 'svg') {
      return document.importNode(svg, true);
    }
  }

  const img = document.createElement('img');
  img.alt = costume.name || '';
  img.src = bytesToDataURL(bytes, mime);
  return img;
}

function getCostumeSize(costume) {
  if (!costume) return {width: 100, height: 100};
  const w = Number(costume.bitmapResolution ? 100 : costume.rotationCenterX ? costume.rotationCenterX * 2 : 100);
  const h = Number(costume.rotationCenterY ? costume.rotationCenterY * 2 : 100);
  return {width: Math.max(1, w), height: Math.max(1, h)};
}

function bytesToDataURL(bytes, mime) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return 'data:' + mime + ';base64,' + btoa(binary);
}

function colorToCSS(color) {
  if (typeof color !== 'string') return null;
  return color;
}

function setStatus(message) {
  els.status.textContent = message;
}

function generateHTML() {
  if (!current) return null;

  const width = Math.max(1, Number(els.stageWidth.value) || 480);
  const height = Math.max(1, Number(els.stageHeight.value) || 360);
  const responsive = els.responsive.checked;
  const projectJSON = JSON.stringify(current.project);
  const assets = {};

  for (const [name, bytes] of current.assets) {
    const ext = (name.split('.').pop() || '').toLowerCase();
    const mime = ext === 'svg' ? 'image/svg+xml' :
      ext === 'png' ? 'image/png' :
      ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
      ext === 'gif' ? 'image/gif' : 'application/octet-stream';
    assets[name] = bytesToDataURL(bytes, mime);
  }

  return buildStandaloneHTML(projectJSON, JSON.stringify(assets), width, height, responsive);
}

function exportHTML() {
  const html = generateHTML();
  if (!html) return;

  const blob = new Blob([html], {type: 'text/html'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (current.fileName || 'project').replace(/\\.sb3$/i, '') + '-site.html';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus('Saved canvas-free HTML.');
}

async function copyHTML() {
  const html = generateHTML();
  if (!html) return;

  try {
    await navigator.clipboard.writeText(html);
    setStatus('HTML copied to the clipboard.');
  } catch (error) {
    console.error(error);
    setStatus('Clipboard access was blocked. Try running the site from HTTPS or localhost.');
  }
}

function buildStandaloneHTML(projectJSON, assetsJSON, width, height, responsive) {
  return '<!doctype html>\\n<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>TurboWarp: Site Maker export</title>' +
    '<style>' +
    'html,body{margin:0;min-height:100%;background:#111;font-family:Arial,sans-serif}' +
    '.site-stage{position:relative;overflow:hidden;background:#fff;margin:auto;' +
    'width:' + width + 'px;height:' + height + 'px;' +
    (responsive ? 'max-width:100vw;max-height:100vh;aspect-ratio:' + width + '/' + height + ';' : '') +
    '}' +
    '.site-sprite{position:absolute;transform-origin:center center;user-select:text}' +
    '.site-sprite svg,.site-sprite img{display:block;width:100%;height:100%}' +
    '</style></head><body>' +
    '<div id="stage" class="site-stage"></div>' +
    '<script>\\n' +
    'const PROJECT=' + projectJSON + ';\\n' +
    'const ASSETS=' + assetsJSON + ';\\n' +
    'if(document.querySelector("canvas"))throw new Error("Canvas is forbidden in this export.");\\n' +
    '(function(){' +
    'const stage=document.getElementById("stage");' +
    'const W=' + width + ',H=' + height + ';' +
    'function costume(t){const c=(t.costumes||[])[Number(t.currentCostume||0)];return c||null}' +
    'function size(c){return {w:Math.max(1,Number(c&&c.rotationCenterX?c.rotationCenterX*2:100)),h:Math.max(1,Number(c&&c.rotationCenterY?c.rotationCenterY*2:100))}}' +
    'function add(t){const c=costume(t),s=document.createElement("div");s.className="site-sprite";s.dataset.spriteName=t.name||"";const z=size(c),scale=Number(t.size==null?100:t.size)/100,w=z.w*scale,h=z.h*scale;s.style.width=w+"px";s.style.height=h+"px";s.style.left=(W/2+Number(t.x||0)-w/2)+"px";s.style.top=(H/2-Number(t.y||0)-h/2)+"px";s.style.transform="rotate("+(Number(t.direction||90)-90)+"deg)";if(t.visible===false)s.style.display="none";if(c){const name=c.md5ext||c.assetId;const src=ASSETS[name];if(src&&(name.toLowerCase().endsWith(".svg"))){const box=document.createElement("div");box.innerHTML=atob(src.split(",")[1]);const svg=box.firstElementChild;if(svg){s.appendChild(svg)}}else if(src){const img=document.createElement("img");img.src=src;img.alt=c.name||"";s.appendChild(img)}}stage.appendChild(s)}' +
    '(PROJECT.targets||[]).filter(t=>!t.isStage).sort((a,b)=>(a.layerOrder||0)-(b.layerOrder||0)).forEach(add);' +
    '})();\\n' +
    '</script></body></html>';
}

window.__siteMaker = {getProject: () => current};
