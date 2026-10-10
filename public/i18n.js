// Shared by the browser (window.I18N) and the server (require).
(function (root) {
  "use strict";

  var LANGS = ["en", "it", "fr", "bg", "ru", "zh"];

  // html: value for <html lang>, speech: BCP-47 tag for speech synthesis,
  // native: language name in its own language, english: name used in prompts.
  var META = {
    en: { html: "en", speech: "en-US", native: "English", english: "English" },
    it: { html: "it", speech: "it-IT", native: "Italiano", english: "Italian" },
    fr: { html: "fr", speech: "fr-FR", native: "Français", english: "French" },
    bg: { html: "bg", speech: "bg-BG", native: "Български", english: "Bulgarian" },
    ru: { html: "ru", speech: "ru-RU", native: "Русский", english: "Russian" },
    zh: { html: "zh-Hans", speech: "zh-CN", native: "中文", english: "Simplified Chinese" }
  };

  var S = {
    en: {
      title: "Talk with Artificial Intelligence – press the button to start",
      h1: "Talk with Artificial Intelligence",
      start: "Start conversation",
      end: "End conversation",
      continue: "Continue last conversation",
      langButton: "Language: English. Change language",
      help: "Press the button and speak. To finish, press it again or say goodbye.",
      privacy: "Your conversations are saved only on this computer.",
      historyLink: "My past conversations",
      greeting: "Hi, I'm an AI assistant, and I'm listening. Ask me anything. After each answer you'll hear a short tone: that's your turn to speak. When you're done, just say goodbye.",
      greetingContinue: "Welcome back. I'm your AI assistant. We can continue where we left off. Go ahead after the tone.",
      farewell: "Goodbye!",
      errMic: "I can't use the microphone. Allow microphone access for this site, then press the button to try again.",
      errConnection: "Connection lost. Press the button to try again.",
      errLimit: "Today's free limit is used up. Please try again tomorrow.",
      errSupport: "This browser can't record audio. Please try Chrome, Edge, Firefox or Safari.",
      historyTitle: "My past conversations – Talk with Artificial Intelligence",
      historyH1: "My past conversations",
      historyEmpty: "There are no saved conversations.",
      deleteAll: "Delete all my history",
      deleted: "Your history has been deleted.",
      back: "Back to the conversation page",
      notice: "Before we start: to understand you, your voice is sent to an AI service. Nothing is saved on our server. The privacy notice is at the bottom of the page.",
      searching: "Let me look that up.",
      errRetry: "Sorry, something went wrong. Could you say that again?",
      privacyLink: "Privacy notice",
      accessibilityLink: "Accessibility"
    },
    it: {
      title: "Parla con l'Intelligenza Artificiale – premi il pulsante per iniziare",
      h1: "Parla con l'Intelligenza Artificiale",
      start: "Inizia conversazione",
      end: "Termina conversazione",
      continue: "Continua l'ultima conversazione",
      langButton: "Lingua: Italiano. Cambia lingua",
      help: "Premi il pulsante e parla. Per finire, premilo di nuovo o di' arrivederci.",
      privacy: "Le tue conversazioni sono salvate solo su questo computer.",
      historyLink: "Le mie conversazioni passate",
      greeting: "Ciao, sono un assistente di intelligenza artificiale e ti ascolto. Chiedimi qualsiasi cosa. Dopo ogni risposta sentirai un breve suono: è il tuo turno di parlare. Quando hai finito, di' semplicemente arrivederci.",
      greetingContinue: "Eccoci di nuovo. Sono il tuo assistente di intelligenza artificiale. Possiamo riprendere da dove eravamo rimasti. Parla dopo il suono.",
      farewell: "Arrivederci!",
      errMic: "Non riesco a usare il microfono. Consenti l'accesso al microfono per questo sito, poi premi il pulsante per riprovare.",
      errConnection: "Connessione persa. Premi il pulsante per riprovare.",
      errLimit: "Il limite gratuito di oggi è esaurito. Riprova domani.",
      errSupport: "Questo browser non può registrare l'audio. Prova con Chrome, Edge, Firefox o Safari.",
      historyTitle: "Le mie conversazioni passate – Parla con l'Intelligenza Artificiale",
      historyH1: "Le mie conversazioni passate",
      historyEmpty: "Non ci sono conversazioni salvate.",
      deleteAll: "Cancella tutta la mia cronologia",
      deleted: "La tua cronologia è stata cancellata.",
      back: "Torna alla pagina della conversazione",
      notice: "Prima di iniziare: per capirti, la tua voce viene inviata a un servizio di intelligenza artificiale. Sul nostro server non viene salvato nulla. L'informativa sulla privacy è in fondo alla pagina.",
      searching: "Un attimo, controllo.",
      errRetry: "Scusa, qualcosa non ha funzionato. Puoi ripetere?",
      privacyLink: "Informativa sulla privacy",
      accessibilityLink: "Accessibilità"
    },
    fr: {
      title: "Parler avec l'intelligence artificielle – appuyez sur le bouton pour commencer",
      h1: "Parler avec l'intelligence artificielle",
      start: "Commencer la conversation",
      end: "Terminer la conversation",
      continue: "Reprendre la dernière conversation",
      langButton: "Langue : Français. Changer de langue",
      help: "Appuyez sur le bouton et parlez. Pour terminer, appuyez à nouveau ou dites au revoir.",
      privacy: "Vos conversations sont enregistrées uniquement sur cet ordinateur.",
      historyLink: "Mes conversations précédentes",
      greeting: "Bonjour, je suis un assistant d'intelligence artificielle et je vous écoute. Posez-moi n'importe quelle question. Après chaque réponse, vous entendrez un petit son : c'est à vous de parler. Quand vous avez terminé, dites simplement au revoir.",
      greetingContinue: "Bon retour. Je suis votre assistant d'intelligence artificielle. Nous pouvons reprendre là où nous nous étions arrêtés. Parlez après le son.",
      farewell: "Au revoir !",
      errMic: "Je ne peux pas utiliser le microphone. Autorisez l'accès au microphone pour ce site, puis appuyez sur le bouton pour réessayer.",
      errConnection: "Connexion perdue. Appuyez sur le bouton pour réessayer.",
      errLimit: "La limite gratuite d'aujourd'hui est atteinte. Veuillez réessayer demain.",
      errSupport: "Ce navigateur ne peut pas enregistrer l'audio. Essayez Chrome, Edge, Firefox ou Safari.",
      historyTitle: "Mes conversations précédentes – Parler avec l'intelligence artificielle",
      historyH1: "Mes conversations précédentes",
      historyEmpty: "Aucune conversation enregistrée.",
      deleteAll: "Supprimer tout mon historique",
      deleted: "Votre historique a été supprimé.",
      back: "Retour à la page de conversation",
      notice: "Avant de commencer : pour vous comprendre, votre voix est envoyée à un service d'intelligence artificielle. Rien n'est enregistré sur notre serveur. La politique de confidentialité se trouve en bas de la page.",
      searching: "Un instant, je vérifie.",
      errRetry: "Désolé, quelque chose n'a pas fonctionné. Pouvez-vous répéter ?",
      privacyLink: "Politique de confidentialité",
      accessibilityLink: "Accessibilité"
    },
    bg: {
      title: "Говорете с изкуствен интелект – натиснете бутона, за да започнете",
      h1: "Говорете с изкуствен интелект",
      start: "Започни разговор",
      end: "Край на разговора",
      continue: "Продължи последния разговор",
      langButton: "Език: Български. Смяна на езика",
      help: "Натиснете бутона и говорете. За да приключите, натиснете го отново или кажете довиждане.",
      privacy: "Вашите разговори се запазват само на този компютър.",
      historyLink: "Моите предишни разговори",
      greeting: "Здравейте, аз съм асистент с изкуствен интелект и ви слушам. Питайте ме каквото пожелаете. След всеки отговор ще чуете кратък сигнал: тогава е ваш ред да говорите. Когато приключите, просто кажете довиждане.",
      greetingContinue: "Добре дошли отново. Аз съм вашият асистент с изкуствен интелект. Можем да продължим оттам, докъдето стигнахме. Говорете след сигнала.",
      farewell: "Довиждане!",
      errMic: "Не мога да използвам микрофона. Разрешете достъп до микрофона за този сайт и натиснете бутона, за да опитате отново.",
      errConnection: "Връзката е прекъсната. Натиснете бутона, за да опитате отново.",
      errLimit: "Безплатният лимит за днес е изчерпан. Моля, опитайте отново утре.",
      errSupport: "Този браузър не може да записва звук. Опитайте с Chrome, Edge, Firefox или Safari.",
      historyTitle: "Моите предишни разговори – Говорете с изкуствен интелект",
      historyH1: "Моите предишни разговори",
      historyEmpty: "Няма запазени разговори.",
      deleteAll: "Изтрий цялата ми история",
      deleted: "Историята ви е изтрита.",
      back: "Обратно към страницата за разговор",
      notice: "Преди да започнем: за да ви разбера, гласът ви се изпраща до услуга с изкуствен интелект. Нищо не се запазва на нашия сървър. Политиката за поверителност е в долната част на страницата.",
      searching: "Момент, ще проверя.",
      errRetry: "Извинете, нещо се обърка. Можете ли да повторите?",
      privacyLink: "Политика за поверителност",
      accessibilityLink: "Достъпност"
    },
    ru: {
      title: "Поговорите с искусственным интеллектом – нажмите кнопку, чтобы начать",
      h1: "Поговорите с искусственным интеллектом",
      start: "Начать разговор",
      end: "Завершить разговор",
      continue: "Продолжить последний разговор",
      langButton: "Язык: Русский. Сменить язык",
      help: "Нажмите кнопку и говорите. Чтобы закончить, нажмите её ещё раз или скажите «до свидания».",
      privacy: "Ваши разговоры сохраняются только на этом компьютере.",
      historyLink: "Мои прошлые разговоры",
      greeting: "Здравствуйте, я ассистент с искусственным интеллектом, и я вас слушаю. Спрашивайте о чём угодно. После каждого ответа вы услышите короткий сигнал: это значит, что теперь ваша очередь говорить. Когда закончите, просто скажите «до свидания».",
      greetingContinue: "С возвращением. Я ваш ассистент с искусственным интеллектом. Мы можем продолжить с того места, где остановились. Говорите после сигнала.",
      farewell: "До свидания!",
      errMic: "Не удаётся использовать микрофон. Разрешите этому сайту доступ к микрофону и нажмите кнопку, чтобы попробовать снова.",
      errConnection: "Соединение потеряно. Нажмите кнопку, чтобы попробовать снова.",
      errLimit: "Бесплатный лимит на сегодня исчерпан. Пожалуйста, попробуйте завтра.",
      errSupport: "Этот браузер не может записывать звук. Попробуйте Chrome, Edge, Firefox или Safari.",
      historyTitle: "Мои прошлые разговоры – Поговорите с искусственным интеллектом",
      historyH1: "Мои прошлые разговоры",
      historyEmpty: "Сохранённых разговоров нет.",
      deleteAll: "Удалить всю мою историю",
      deleted: "Ваша история удалена.",
      back: "Вернуться на страницу разговора",
      notice: "Прежде чем начать: чтобы понять вас, ваш голос отправляется в сервис искусственного интеллекта. На нашем сервере ничего не сохраняется. Политика конфиденциальности находится внизу страницы.",
      searching: "Секунду, сейчас проверю.",
      errRetry: "Извините, что-то пошло не так. Повторите, пожалуйста.",
      privacyLink: "Политика конфиденциальности",
      accessibilityLink: "Доступность"
    },
    zh: {
      title: "与人工智能对话 – 按下按钮开始",
      h1: "与人工智能对话",
      start: "开始对话",
      end: "结束对话",
      continue: "继续上次的对话",
      langButton: "语言：中文。更改语言",
      help: "按下按钮后说话。要结束时，再按一次按钮或说“再见”。",
      privacy: "您的对话只保存在这台电脑上。",
      historyLink: "我以前的对话",
      greeting: "您好，我是人工智能助手，我在听。您可以问我任何问题。每次回答后您会听到一声短提示音，这时就轮到您说话了。结束时，说一声“再见”就可以。",
      greetingContinue: "欢迎回来。我是您的人工智能助手。我们可以接着上次的话题继续。听到提示音后请说话。",
      farewell: "再见！",
      errMic: "无法使用麦克风。请允许本网站使用麦克风，然后按下按钮重试。",
      errConnection: "连接已断开。请按下按钮重试。",
      errLimit: "今天的免费额度已用完。请明天再试。",
      errSupport: "此浏览器无法录音。请使用 Chrome、Edge、Firefox 或 Safari。",
      historyTitle: "我以前的对话 – 与人工智能对话",
      historyH1: "我以前的对话",
      historyEmpty: "没有保存的对话。",
      deleteAll: "删除我的全部历史记录",
      deleted: "您的历史记录已删除。",
      back: "返回对话页面",
      notice: "开始之前：为了听懂您的话，您的声音会发送到一个人工智能服务。我们的服务器不保存任何内容。隐私声明在页面底部。",
      searching: "稍等，我查一下。",
      errRetry: "抱歉，出了点问题。请再说一遍。",
      privacyLink: "隐私声明",
      accessibilityLink: "无障碍"
    }
  };

  // First supported language from a list of tags like ["it-IT", "en"].
  function pick(list) {
    for (var i = 0; i < (list || []).length; i++) {
      var base = String(list[i] || "").toLowerCase().split(/[-_]/)[0];
      if (LANGS.indexOf(base) !== -1) return base;
    }
    return "en";
  }

  function t(lang, key) {
    return (S[lang] && S[lang][key]) || S.en[key] || "";
  }

  // Browser only: set <html lang> and every [data-i18n] text.
  function applyPage(lang) {
    document.documentElement.lang = META[lang].html;
    var els = document.querySelectorAll("[data-i18n]");
    for (var i = 0; i < els.length; i++) els[i].textContent = t(lang, els[i].getAttribute("data-i18n"));
  }

  var api = { LANGS: LANGS, META: META, S: S, pick: pick, t: t, applyPage: applyPage };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.I18N = api;
})(this);
