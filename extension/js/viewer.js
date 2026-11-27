const params = new URLSearchParams(location.search);
const target = params.get('url');
const frame = document.getElementById('inner-frame');

if (target) {
  try {
    frame.src = new URL(target).href;
  } catch {
    document.body.textContent = '无效的网址';
  }
} else {
  document.body.textContent = '未指定网址';
}
