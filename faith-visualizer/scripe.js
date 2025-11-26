let canvas = new fabric.Canvas('canvas');
let uploadedImage = null;
let driveConnected = false;
let folderId = null;

// 載入相框元數據
fetch('../frames-faith-calendar/metadata.json')
  .then(res => res.json())
  .then(frames => renderFrameList(frames));

function renderFrameList(frames) {
  const container = document.getElementById('frameList');
  frames.forEach(f => {
    const img = document.createElement('img');
    img.src = '../frames-faith-calendar/' + f.file;
    img.title = `${f.name_zh} (${f.keywords.join(', ')})`;
    img.className = 'frame-item';
    img.onclick = () => applyFrame(f.file);
    container.appendChild(img);
  });
}

function applyFrame(relativePath) {
  const fullPath = '../frames-faith-calendar/' + relativePath;
  // 移除舊相框
  canvas.getObjects().forEach(obj => {
    if (obj.isFrame) canvas.remove(obj);
  });
  fabric.Image.fromURL(fullPath, function(img) {
    img.set({
      left: 0, top: 0,
      scaleX: canvas.width / img.width,
      scaleY: canvas.height / img.height,
      selectable: false,
      evented: false,
      isFrame: true
    });
    canvas.add(img);
    canvas.renderAll();
  });
}

// 動態文字框
document.getElementById('addText').addEventListener('click', () => {
  const text = new fabric.Textbox('點擊編輯', {
    left: 100, top: 100,
    fontSize: 20, fill: '#000', fontFamily: 'Microsoft YaHei',
    width: 200, hasControls: true, editable: true
  });
  text.on('changed', () => {
    text.set('width', Math.min(text.textLines.reduce((m, l) =>
      Math.max(m, text._getLineWidth(l)), 0) + 20, 500));
    canvas.renderAll();
  });
  canvas.add(text);
  canvas.setActiveObject(text);
});

// 手勢圖標拖入
document.querySelectorAll('.icon-item').forEach(icon => {
  icon.addEventListener('click', () => {
    fabric.Image.fromURL(icon.src, img => {
      img.set({ left: 50, top: 50, scaleX: 0.4, scaleY: 0.4, hasControls: true });
      canvas.add(img);
    });
  });
});

// 上傳圖片
document.getElementById('upload').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = f => {
    fabric.Image.fromURL(f.target.result, img => {
      uploadedImage = img;
      canvas.clear();
      canvas.setWidth(Math.min(img.width, 800));
      canvas.setHeight(img.height * (canvas.width / img.width));
      canvas.add(img);
      canvas.renderAll();
    });
  };
  reader.readAsDataURL(file);
});

// Google Drive 初始化
document.getElementById('connectDrive').addEventListener('click', async () => {
  gapi.load('client:auth2', async () => {
    await gapi.client.init({
      apiKey: 'YOUR_API_KEY',
      clientId: 'YOUR_CLIENT_ID.apps.googleusercontent.com',
      scope: 'https://www.googleapis.com/auth/drive.file',
      discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']
    });
    const auth = gapi.auth2.getAuthInstance();
    await auth.signIn();
    driveConnected = true;
    
    // 建立主文件夾（如不存在）
    const res = await gapi.client.drive.files.list({
      q: "name='弟兄讀書會' and mimeType='application/vnd.google-apps.folder'",
      fields: 'files(id)'
    });
    if (res.result.files.length === 0) {
      const folder = await gapi.client.drive.files.create({
        resource: { name: '弟兄讀書會', mimeType: 'application/vnd.google-apps.folder' }
      });
      folderId = folder.result.id;
    } else {
      folderId = res.result.files[0].id;
    }
    alert('✅ 已連接 Google Drive！');
  });
});

// 儲存到 Drive
document.getElementById('saveToDrive').addEventListener('click', () => {
  if (!driveConnected) {
    alert('請先連接 Google Drive');
    return;
  }
  const dataURL = canvas.toDataURL('image/png');
  const blob = dataURLToBlob(dataURL);
  const file = new File([blob], `美化圖_${new Date().toISOString().slice(0,10)}.png`, { type: 'image/png' });
  
  const metadata = { name: file.name, parents: [folderId], mimeType: 'image/png' };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token },
    body: form
  }).then(r => r.json())
    .then(() => alert('✅ 已儲存到 Google Drive / 弟兄讀書會 資料夾！'));
});

function dataURLToBlob(dataURL) {
  const parts = dataURL.split(',');
  const mime = parts[0].match(/:(.*?);/)[1];
  const bstr = atob(parts[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while(n--) u8arr[n] = bstr.charCodeAt(n);
  return new Blob([u8arr], { type: mime });
}
