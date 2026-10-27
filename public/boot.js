(function () {
  var t = window.vaultI18n ? window.vaultI18n.t : function (value) { return value; };
  document.querySelector(".boot span")?.replaceChildren(t("正在连接本地配置库…"));
  function failed(message) {
    if (document.documentElement.dataset.vaultReady === 'true') return;
    var app = document.getElementById('app');
    if (!app) return;
    var box = document.createElement('div');
    box.className = 'boot boot-error';
    var heading = document.createElement('h1');
    heading.textContent = t("配置库连接未完成");
    var detail = document.createElement('p');
    detail.textContent = message;
    var help = document.createElement('p');
    help.textContent = t("请保持启动窗口运行，再点击重新连接。");
    var retry = document.createElement('button');
    retry.className = 'button';
    retry.textContent = t("重新连接");
    retry.addEventListener('click', function () { location.reload(); });
    box.append(heading, detail, help, retry);
    app.replaceChildren(box);
  }
  window.addEventListener('error', function (event) {
    if (event.target && event.target.tagName === 'SCRIPT') failed(t("界面脚本未能加载，请刷新页面；如使用了脚本拦截扩展，请允许本机地址运行。"));
    else if (event.message) failed(t("界面初始化错误：") + event.message);
  }, true);
  window.addEventListener('unhandledrejection', function (event) {
    failed(t("界面初始化错误：") + (event.reason && event.reason.message || String(event.reason)));
  });
  window.setTimeout(function () {
    failed(t("加载已超过 15 秒。可能是脚本加载或本地请求未完成，请重试。"));
  }, 15000);
}());
