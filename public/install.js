/* Installation is user-initiated. No tracking or conversation cache. */
(function () {
  'use strict';
  const READY = {
  "en": "Activate the Install the app button, then confirm in the browser. A voice request cannot open the browser’s install prompt by itself.",
  "it": "Attiva il pulsante Installa l’app, poi conferma nel browser. La sola richiesta vocale non può aprire la conferma di installazione.",
  "fr": "Activez le bouton Installer l’application, puis confirmez dans le navigateur. Une demande vocale seule ne peut pas ouvrir la confirmation d’installation.",
  "bg": "Активирайте бутона Инсталирай приложението, после потвърдете в браузъра. Само гласова заявка не може да отвори потвърждението за инсталиране.",
  "ru": "Активируйте кнопку Установить приложение и подтвердите в браузере. Один голосовой запрос не может открыть подтверждение установки.",
  "zh": "请激活安装应用按钮，然后在浏览器中确认。仅凭语音请求无法打开浏览器的安装确认。",
  "ja": "アプリをインストールするボタンを押し、ブラウザーで確認してください。音声だけではインストール確認を開けません。",
  "nl": "Activeer de knop App installeren en bevestig in de browser. Alleen een spraakopdracht kan de installatiebevestiging niet openen.",
  "pt": "Ative o botão Instalar a aplicação e confirme no navegador. Um pedido de voz, por si só, não pode abrir a confirmação de instalação."
};
  const HELP = {
  "en": "Android Chrome: say “install the app”, then activate the Install button if offered and confirm in the browser. iPhone or iPad: open Safari, choose Share, Add to Home Screen, then Add (enable Open as Web App if shown). Windows or Mac: use the browser’s install option; Safari on Mac offers File, Add to Dock. Installation needs an internet connection; conversations also need the internet.",
  "it": "Chrome su Android: di’ «installa l’app», attiva il pulsante Installa se disponibile e conferma nel browser. iPhone o iPad: apri Safari, scegli Condividi, Aggiungi alla schermata Home, poi Aggiungi (attiva Apri come app web se presente). Windows o Mac: usa l’opzione di installazione del browser; Safari su Mac offre File, Aggiungi al Dock. Installazione e conversazioni richiedono Internet.",
  "fr": "Chrome sur Android : dites « installe l’application », activez le bouton Installer s’il est proposé et confirmez dans le navigateur. iPhone ou iPad : dans Safari, choisissez Partager, Sur l’écran d’accueil, puis Ajouter (activez Ouvrir comme app web si proposé). Windows ou Mac : utilisez l’option d’installation du navigateur ; Safari sur Mac propose Fichier, Ajouter au Dock. L’installation et les conversations nécessitent Internet.",
  "bg": "Chrome на Android: кажете „инсталирай приложението“, активирайте бутона за инсталиране, ако се появи, и потвърдете в браузъра. iPhone или iPad: в Safari изберете Споделяне, Добавяне към началния екран, после Добавяне (включете Отваряне като уеб приложение, ако е налично). Windows или Mac: използвайте опцията за инсталиране на браузъра; Safari на Mac предлага File, Add to Dock. Инсталирането и разговорите изискват интернет.",
  "ru": "Chrome на Android: скажите «установи приложение», активируйте кнопку установки, если она появится, и подтвердите в браузере. iPhone или iPad: в Safari выберите Поделиться, На экран Домой, затем Добавить (включите Открывать как веб-приложение, если доступно). Windows или Mac: используйте установку в меню браузера; Safari на Mac предлагает Файл, Добавить в Dock. Установка и разговоры требуют интернета.",
  "zh": "Android Chrome：说“安装应用”，如果出现安装按钮，激活它并在浏览器中确认。iPhone 或 iPad：在 Safari 中选择分享、添加到主屏幕，然后选择添加（如有“作为网页 App 打开”，请开启）。Windows 或 Mac：使用浏览器的安装选项；Mac Safari 可选择文件、添加到程序坞。安装和对话都需要联网。",
  "ja": "Android の Chrome：「アプリをインストールして」と言い、表示されたインストールボタンを押してブラウザーで確認します。iPhone・iPad：Safari で共有、ホーム画面に追加、追加を選びます。「Webアプリとして開く」があれば有効にします。Windows・Mac：ブラウザーのインストール機能を使います。Mac の Safari ではファイル、Dockに追加を選べます。インストールと会話にはインターネット接続が必要です。",
  "nl": "Chrome op Android: zeg “installeer de app”, activeer de installatieknop als die verschijnt en bevestig in de browser. iPhone of iPad: kies in Safari Deel, Zet op beginscherm en Voeg toe (zet Open als webapp aan indien beschikbaar). Windows of Mac: gebruik de installatieoptie van de browser; Safari op Mac biedt Archief, Voeg toe aan Dock. Installeren en gesprekken vereisen internet.",
  "pt": "Chrome no Android: diga «instala a aplicação», ative o botão Instalar se aparecer e confirme no navegador. iPhone ou iPad: no Safari, escolha Partilhar, Adicionar ao ecrã principal e Adicionar (ative Abrir como aplicação web, se disponível). Windows ou Mac: use a opção de instalação do navegador; o Safari no Mac oferece Ficheiro, Adicionar à Dock. A instalação e as conversas precisam de Internet."
};
  const INSTALLED = {
  "en": "The app is already open as an installed app.",
  "it": "L’app è già aperta come app installata.",
  "fr": "L’application est déjà ouverte comme application installée.",
  "bg": "Приложението вече е отворено като инсталирано приложение.",
  "ru": "Приложение уже открыто как установленное.",
  "zh": "应用已以安装后的模式打开。",
  "ja": "すでにインストール済みのアプリとして開いています。",
  "nl": "De app is al geopend als geïnstalleerde app.",
  "pt": "A aplicação já está aberta como aplicação instalada."
};
  let deferredPrompt = null;
  let installed = false;
  const button = document.getElementById('installApp');
  function standalone() {
    return installed || navigator.standalone === true ||
      (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches);
  }
  function syncButton() {
    if (!button) return;
    const hidingFocusedButton = document.activeElement === button && (!deferredPrompt || standalone());
    button.hidden = !deferredPrompt || standalone();
    if (hidingFocusedButton) document.getElementById('talk')?.focus();
  }
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    syncButton();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferredPrompt = null;
    syncButton();
  });
  window.requestAppInstall = function (language) {
    const lang = String(language || document.documentElement.lang || 'en').toLowerCase().split('-')[0];
    if (standalone()) return INSTALLED[lang] || INSTALLED.en;
    if (deferredPrompt && button) {
      syncButton();
      button.focus();
      return READY[lang] || READY.en;
    }
    return HELP[lang] || HELP.en;
  };
  if (button) button.addEventListener('click', async () => {
    if (!deferredPrompt || standalone()) return;
    const prompt = deferredPrompt;
    deferredPrompt = null; // A browser event can be used only once.
    button.disabled = true;
    try {
      await prompt.prompt(); // Called directly from the native button activation.
      await prompt.userChoice;
    } catch (_) {
      // Browser declined/unavailable: keep the normal website usable.
    } finally {
      button.disabled = false;
      syncButton();
    }
  });
  syncButton();
  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('/service-worker.js', { scope: '/' }).catch(() => {});
  }
})();
