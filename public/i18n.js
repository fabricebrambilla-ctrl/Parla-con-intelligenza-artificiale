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

  // Which of the six languages a piece of text is written in, so each reply is spoken
  // by a voice of that language. `fallback` (the conversation's language) wins whenever
  // the text is short or not clearly in another language, so a French reply that
  // quotes an English title stays French.
  var WORDS = {
    en: "the and is are was of to in it you that this for with what have be not on can it's i'm there they about would",
    it: "il lo la gli le di che è e un una per non sono del della con mi ti si ci questo questa anche come più ho hai ma",
    fr: "le la les des est et un une pour pas que qui dans du je vous il elle ce cette sur au avec sont mais c'est j'ai",
    bg: "и на е да се за не с от че по това как са ще ли ми те си беше може като ни",
    ru: "и в не на что я с он как это по но из у за от так же вы мы есть был все она"
  };
  var WORD_SETS = {};
  for (var w in WORDS) WORD_SETS[w] = WORDS[w].split(" ");

  function detectLang(text, fallback) {
    fallback = META[fallback] ? fallback : "en";
    text = String(text || "").toLowerCase();
    var han = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    var cyr = (text.match(/[\u0400-\u04ff]/g) || []).length;
    var lat = (text.match(/[a-zàâäçéèêëîïôöùûüœæ]/g) || []).length;
    if (han > (cyr + lat) / 3 && han >= 2) return "zh";
    var words = text.split(/[^a-zàâäçéèêëîïôöùûüœæ'\u0400-\u04ff]+/).filter(Boolean);
    var count = function (code) {
      var n = 0;
      for (var i = 0; i < words.length; i++) if (WORD_SETS[code].indexOf(words[i]) !== -1) n++;
      return n;
    };
    var pickBest = function (codes) {
      var best = null, bestN = 0, total = 0, keep = codes.indexOf(fallback) !== -1 ? count(fallback) : 0;
      codes.forEach(function (c) { var n = count(c); total += n; if (n > bestN) { best = c; bestN = n; } });
      if (codes.indexOf(fallback) !== -1 && (bestN < 3 || bestN < keep * 2 || best === fallback)) return fallback;
      return bestN >= 3 && bestN > total / 2 ? best : codes.indexOf(fallback) !== -1 ? fallback : best || codes[0];
    };
    if (cyr > lat) {
      // Letters only one of the two languages uses.
      if (/[ыэё]/.test(text)) return "ru";
      if (/ѝ|\bъ|[бвгджзклмнпрстфхцчшщ]ъ[бвгджзклмнпрстфхцчшщ]/.test(text) && !/[ыэё]/.test(text)) return "bg";
      return pickBest(["bg", "ru"]);
    }
    if (lat === 0) return fallback;
    return pickBest(["en", "it", "fr"]);
  }

  var S = {
    en: {
      title: "Talk with Artificial Intelligence – press the button to start",
      h1: "Talk with Artificial Intelligence",
      start: "Start conversation",
      end: "End conversation",
      continue: "Continue last conversation",
      langButton: "Language: English. Change language",
      help: "Press to start. Then press Space to talk, and again to get the answer; press it any time to interrupt. To end, say goodbye.",
      privacy: "Your conversations are saved only on this computer.",
      historyLink: "My past conversations",
      greeting: "Hi, I'm an AI assistant. Press the space bar to talk, and press it again when you've finished. You can press it any time to interrupt me. If you go quiet for seven seconds, I'll answer. To end, say goodbye. To change language, or for help, just say so.",
      greetingContinue: "Welcome back. I'm your AI assistant, and we can pick up where we left off. Press the space bar to talk.",
      farewell: "Goodbye!",
      langChanged: "OK, I'll speak English.",
      voiceHelp: "You can say: repeat, change language, or goodbye.",
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
      notice: "Your voice is processed by AI services. Details are in the privacy notice.",
      searching: "Let me look that up.",
      errRetry: "Sorry, something went wrong. Please press the space bar and say that again.",
      privacyLink: "Privacy notice",
      accessibilityLink: "Accessibility",
      askLanguage: "Which language would you like to use? Say it after the tone.",
      langNotUnderstood: "Sorry, I didn't understand. Please say the name of your language again.",
      notHeard: "I didn't hear anything. Press the space bar when you want to talk.",
      talk: "Talk",
      helpTouch: "Press to start. Then press Talk to talk, and again to get the answer; press it any time to interrupt. To end, say goodbye.",
      greetingTouch: "Hi, I'm an AI assistant. Press the Talk button to talk, and press it again when you've finished. You can press it any time to interrupt me. If you go quiet for seven seconds, I'll answer. To end, say goodbye. To change language, or for help, just say so.",
      greetingContinueTouch: "Welcome back. I'm your AI assistant, and we can pick up where we left off. Press the Talk button to talk.",
      notHeardTouch: "I didn't hear anything. Press the Talk button when you want to talk.",
      errRetryTouch: "Sorry, something went wrong. Please press the Talk button and say that again.",
      greetingShort: "Hi again, I'm your AI assistant. Press the space bar when you want to talk.",
      greetingShortTouch: "Hi again, I'm your AI assistant. Press the Talk button when you want to talk."
    },
    it: {
      title: "Parla con l'Intelligenza Artificiale – premi il pulsante per iniziare",
      h1: "Parla con l'Intelligenza Artificiale",
      start: "Inizia conversazione",
      end: "Termina conversazione",
      continue: "Continua l'ultima conversazione",
      langButton: "Lingua: Italiano. Cambia lingua",
      help: "Premi per iniziare. Poi premi la barra spaziatrice per parlare, e di nuovo per avere la risposta; premila in qualsiasi momento per interrompere. Per finire, di' arrivederci.",
      privacy: "Le tue conversazioni sono salvate solo su questo computer.",
      historyLink: "Le mie conversazioni passate",
      greeting: "Ciao, sono un assistente di intelligenza artificiale. Premi la barra spaziatrice per parlare, e premila di nuovo quando hai finito. Puoi premerla in qualsiasi momento per interrompermi. Se resti in silenzio per sette secondi, rispondo io. Per finire, di' arrivederci. Per cambiare lingua o avere aiuto, basta dirlo.",
      greetingContinue: "Eccoci di nuovo. Sono il tuo assistente di intelligenza artificiale e possiamo riprendere da dove eravamo rimasti. Premi la barra spaziatrice per parlare.",
      farewell: "Arrivederci!",
      langChanged: "Va bene, parlo italiano.",
      voiceHelp: "Puoi dire: ripeti, cambia lingua, oppure arrivederci.",
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
      notice: "La tua voce viene elaborata da servizi di intelligenza artificiale. I dettagli sono nell'informativa sulla privacy.",
      searching: "Un attimo, controllo.",
      errRetry: "Scusa, qualcosa non ha funzionato. Premi la barra spaziatrice e ripeti, per favore.",
      privacyLink: "Informativa sulla privacy",
      accessibilityLink: "Accessibilità",
      askLanguage: "Quale lingua vuoi usare? Dilla dopo il suono.",
      langNotUnderstood: "Scusa, non ho capito. Ripeti il nome della tua lingua, per favore.",
      notHeard: "Non ho sentito niente. Premi la barra spaziatrice quando vuoi parlare.",
      talk: "Parla",
      helpTouch: "Premi per iniziare. Poi premi Parla per parlare, e di nuovo per avere la risposta; premilo in qualsiasi momento per interrompere. Per finire, di' arrivederci.",
      greetingTouch: "Ciao, sono un assistente di intelligenza artificiale. Premi il pulsante Parla per parlare, e premilo di nuovo quando hai finito. Puoi premerlo in qualsiasi momento per interrompermi. Se resti in silenzio per sette secondi, rispondo io. Per finire, di' arrivederci. Per cambiare lingua o avere aiuto, basta dirlo.",
      greetingContinueTouch: "Eccoci di nuovo. Sono il tuo assistente di intelligenza artificiale e possiamo riprendere da dove eravamo rimasti. Premi il pulsante Parla per parlare.",
      notHeardTouch: "Non ho sentito niente. Premi il pulsante Parla quando vuoi parlare.",
      errRetryTouch: "Scusa, qualcosa non ha funzionato. Premi il pulsante Parla e ripeti, per favore.",
      greetingShort: "Ciao di nuovo, sono il tuo assistente di intelligenza artificiale. Premi la barra spaziatrice quando vuoi parlare.",
      greetingShortTouch: "Ciao di nuovo, sono il tuo assistente di intelligenza artificiale. Premi il pulsante Parla quando vuoi parlare."
    },
    fr: {
      title: "Parler avec l'intelligence artificielle – appuyez sur le bouton pour commencer",
      h1: "Parler avec l'intelligence artificielle",
      start: "Commencer la conversation",
      end: "Terminer la conversation",
      continue: "Reprendre la dernière conversation",
      langButton: "Langue : Français. Changer de langue",
      help: "Appuyez pour commencer. Ensuite, appuyez sur la barre d'espace pour parler, puis de nouveau pour avoir la réponse ; appuyez à tout moment pour interrompre. Pour terminer, dites au revoir.",
      privacy: "Vos conversations sont enregistrées uniquement sur cet ordinateur.",
      historyLink: "Mes conversations précédentes",
      greeting: "Bonjour, je suis un assistant d'intelligence artificielle. Appuyez sur la barre d'espace pour parler, puis de nouveau quand vous avez fini. Vous pouvez appuyer à tout moment pour m'interrompre. Si vous vous taisez pendant sept secondes, je réponds. Pour terminer, dites au revoir. Pour changer de langue ou obtenir de l'aide, dites-le simplement.",
      greetingContinue: "Bon retour. Je suis votre assistant d'intelligence artificielle, et nous pouvons reprendre là où nous nous étions arrêtés. Appuyez sur la barre d'espace pour parler.",
      farewell: "Au revoir !",
      langChanged: "D'accord, je parle français.",
      voiceHelp: "Vous pouvez dire : répète, changer de langue, ou au revoir.",
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
      notice: "Votre voix est traitée par des services d'intelligence artificielle. Les détails sont dans la politique de confidentialité.",
      searching: "Un instant, je vérifie.",
      errRetry: "Désolé, quelque chose n'a pas fonctionné. Appuyez sur la barre d'espace et répétez, s'il vous plaît.",
      privacyLink: "Politique de confidentialité",
      accessibilityLink: "Accessibilité",
      askLanguage: "Quelle langue voulez-vous utiliser ? Dites-la après le son.",
      langNotUnderstood: "Désolé, je n'ai pas compris. Redites le nom de votre langue, s'il vous plaît.",
      notHeard: "Je n'ai rien entendu. Appuyez sur la barre d'espace quand vous voulez parler.",
      talk: "Parler",
      helpTouch: "Appuyez pour commencer. Ensuite, appuyez sur Parler pour parler, puis de nouveau pour avoir la réponse ; appuyez à tout moment pour interrompre. Pour terminer, dites au revoir.",
      greetingTouch: "Bonjour, je suis un assistant d'intelligence artificielle. Appuyez sur le bouton Parler pour parler, puis de nouveau quand vous avez fini. Vous pouvez appuyer à tout moment pour m'interrompre. Si vous vous taisez pendant sept secondes, je réponds. Pour terminer, dites au revoir. Pour changer de langue ou obtenir de l'aide, dites-le simplement.",
      greetingContinueTouch: "Bon retour. Je suis votre assistant d'intelligence artificielle, et nous pouvons reprendre là où nous nous étions arrêtés. Appuyez sur le bouton Parler pour parler.",
      notHeardTouch: "Je n'ai rien entendu. Appuyez sur le bouton Parler quand vous voulez parler.",
      errRetryTouch: "Désolé, quelque chose n'a pas fonctionné. Appuyez sur le bouton Parler et répétez, s'il vous plaît.",
      greetingShort: "Rebonjour, je suis votre assistant d'intelligence artificielle. Appuyez sur la barre d'espace quand vous voulez parler.",
      greetingShortTouch: "Rebonjour, je suis votre assistant d'intelligence artificielle. Appuyez sur le bouton Parler quand vous voulez parler."
    },
    bg: {
      title: "Говорете с изкуствен интелект – натиснете бутона, за да започнете",
      h1: "Говорете с изкуствен интелект",
      start: "Започни разговор",
      end: "Край на разговора",
      continue: "Продължи последния разговор",
      langButton: "Език: Български. Смяна на езика",
      help: "Натиснете, за да започнете. След това натиснете интервала, за да говорите, и отново, за да чуете отговора; натиснете го по всяко време, за да прекъснете. За да приключите, кажете довиждане.",
      privacy: "Вашите разговори се запазват само на този компютър.",
      historyLink: "Моите предишни разговори",
      greeting: "Здравейте, аз съм асистент с изкуствен интелект. Натиснете интервала, за да говорите, и отново, когато приключите. Можете да го натиснете по всяко време, за да ме прекъснете. Ако мълчите седем секунди, ще отговоря. За да приключите, кажете довиждане. За да смените езика или за помощ, просто го кажете.",
      greetingContinue: "Добре дошли отново. Аз съм вашият асистент с изкуствен интелект и можем да продължим оттам, докъдето стигнахме. Натиснете интервала, за да говорите.",
      farewell: "Довиждане!",
      langChanged: "Добре, ще говоря на български.",
      voiceHelp: "Можете да кажете: повтори, смени езика или довиждане.",
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
      notice: "Гласът ви се обработва от услуги с изкуствен интелект. Подробности има в политиката за поверителност.",
      searching: "Момент, ще проверя.",
      errRetry: "Извинете, нещо се обърка. Натиснете интервала и повторете, моля.",
      privacyLink: "Политика за поверителност",
      accessibilityLink: "Достъпност",
      askLanguage: "Кой език искате да използвате? Кажете го след сигнала.",
      langNotUnderstood: "Извинете, не разбрах. Кажете отново името на езика си, моля.",
      notHeard: "Не чух нищо. Натиснете интервала, когато искате да говорите.",
      talk: "Говорете",
      helpTouch: "Натиснете, за да започнете. След това натиснете Говорете, за да говорите, и отново, за да чуете отговора; натиснете го по всяко време, за да прекъснете. За да приключите, кажете довиждане.",
      greetingTouch: "Здравейте, аз съм асистент с изкуствен интелект. Натиснете бутона Говорете, за да говорите, и отново, когато приключите. Можете да го натиснете по всяко време, за да ме прекъснете. Ако мълчите седем секунди, ще отговоря. За да приключите, кажете довиждане. За да смените езика или за помощ, просто го кажете.",
      greetingContinueTouch: "Добре дошли отново. Аз съм вашият асистент с изкуствен интелект и можем да продължим оттам, докъдето стигнахме. Натиснете бутона Говорете, за да говорите.",
      notHeardTouch: "Не чух нищо. Натиснете бутона Говорете, когато искате да говорите.",
      errRetryTouch: "Извинете, нещо се обърка. Натиснете бутона Говорете и повторете, моля.",
      greetingShort: "Здравейте отново, аз съм вашият асистент с изкуствен интелект. Натиснете интервала, когато искате да говорите.",
      greetingShortTouch: "Здравейте отново, аз съм вашият асистент с изкуствен интелект. Натиснете бутона Говорете, когато искате да говорите."
    },
    ru: {
      title: "Поговорите с искусственным интеллектом – нажмите кнопку, чтобы начать",
      h1: "Поговорите с искусственным интеллектом",
      start: "Начать разговор",
      end: "Завершить разговор",
      continue: "Продолжить последний разговор",
      langButton: "Язык: Русский. Сменить язык",
      help: "Нажмите, чтобы начать. Затем нажмите пробел, чтобы говорить, и ещё раз, чтобы получить ответ; нажмите его в любой момент, чтобы перебить. Чтобы закончить, скажите «до свидания».",
      privacy: "Ваши разговоры сохраняются только на этом компьютере.",
      historyLink: "Мои прошлые разговоры",
      greeting: "Здравствуйте, я ассистент с искусственным интеллектом. Нажмите пробел, чтобы говорить, и ещё раз, когда закончите. Нажмите его в любой момент, чтобы перебить меня. Если вы помолчите семь секунд, я отвечу. Чтобы закончить, скажите «до свидания». Чтобы сменить язык или получить помощь, просто скажите об этом.",
      greetingContinue: "С возвращением. Я ваш ассистент с искусственным интеллектом, и мы можем продолжить с того места, где остановились. Нажмите пробел, чтобы говорить.",
      farewell: "До свидания!",
      langChanged: "Хорошо, буду говорить по-русски.",
      voiceHelp: "Вы можете сказать: повтори, смени язык или до свидания.",
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
      notice: "Ваш голос обрабатывается сервисами искусственного интеллекта. Подробности — в политике конфиденциальности.",
      searching: "Секунду, сейчас проверю.",
      errRetry: "Извините, что-то пошло не так. Нажмите пробел и повторите, пожалуйста.",
      privacyLink: "Политика конфиденциальности",
      accessibilityLink: "Доступность",
      askLanguage: "Какой язык вы хотите использовать? Скажите его после сигнала.",
      langNotUnderstood: "Извините, я не понял. Повторите, пожалуйста, название языка.",
      notHeard: "Я ничего не услышал. Нажмите пробел, когда захотите говорить.",
      talk: "Говорить",
      helpTouch: "Нажмите, чтобы начать. Затем нажмите «Говорить», чтобы говорить, и ещё раз, чтобы получить ответ; нажмите её в любой момент, чтобы перебить. Чтобы закончить, скажите «до свидания».",
      greetingTouch: "Здравствуйте, я ассистент с искусственным интеллектом. Нажмите кнопку «Говорить», чтобы говорить, и ещё раз, когда закончите. Нажмите её в любой момент, чтобы перебить меня. Если вы помолчите семь секунд, я отвечу. Чтобы закончить, скажите «до свидания». Чтобы сменить язык или получить помощь, просто скажите об этом.",
      greetingContinueTouch: "С возвращением. Я ваш ассистент с искусственным интеллектом, и мы можем продолжить с того места, где остановились. Нажмите кнопку «Говорить», чтобы говорить.",
      notHeardTouch: "Я ничего не услышал. Нажмите кнопку «Говорить», когда захотите говорить.",
      errRetryTouch: "Извините, что-то пошло не так. Нажмите кнопку «Говорить» и повторите, пожалуйста.",
      greetingShort: "Снова здравствуйте, я ваш ассистент с искусственным интеллектом. Нажмите пробел, когда захотите говорить.",
      greetingShortTouch: "Снова здравствуйте, я ваш ассистент с искусственным интеллектом. Нажмите кнопку «Говорить», когда захотите говорить."
    },
    zh: {
      title: "与人工智能对话 – 按下按钮开始",
      h1: "与人工智能对话",
      start: "开始对话",
      end: "结束对话",
      continue: "继续上次的对话",
      langButton: "语言：中文。更改语言",
      help: "按下即可开始。然后按空格键说话，再按一次得到回答；随时按空格键可以打断。要结束时，请说“再见”。",
      privacy: "您的对话只保存在这台电脑上。",
      historyLink: "我以前的对话",
      greeting: "您好，我是人工智能助手。按空格键说话，说完再按一次。随时按空格键都可以打断我。如果您七秒钟不说话，我就会回答。要结束时，请说“再见”。要换语言或需要帮助，直接说就行。",
      greetingContinue: "欢迎回来。我是您的人工智能助手，我们可以接着上次的话题继续。按空格键说话。",
      farewell: "再见！",
      langChanged: "好的，我会说中文。",
      voiceHelp: "您可以说：再说一遍、换语言，或者再见。",
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
      notice: "您的声音由人工智能服务处理。详情请见隐私声明。",
      searching: "稍等，我查一下。",
      errRetry: "抱歉，出了点问题。请按空格键再说一遍。",
      privacyLink: "隐私声明",
      accessibilityLink: "无障碍",
      askLanguage: "您想使用哪种语言？请在提示音后说出来。",
      langNotUnderstood: "抱歉，我没听懂。请再说一遍您的语言。",
      notHeard: "我没有听到声音。想说话时请按空格键。",
      talk: "说话",
      helpTouch: "按下即可开始。然后按“说话”说话，再按一次得到回答；随时按它可以打断。要结束时，请说“再见”。",
      greetingTouch: "您好，我是人工智能助手。按“说话”按钮说话，说完再按一次。随时按这个按钮都可以打断我。如果您七秒钟不说话，我就会回答。要结束时，请说“再见”。要换语言或需要帮助，直接说就行。",
      greetingContinueTouch: "欢迎回来。我是您的人工智能助手，我们可以接着上次的话题继续。按“说话”按钮说话。",
      notHeardTouch: "我没有听到声音。想说话时请按“说话”按钮。",
      errRetryTouch: "抱歉，出了点问题。请按“说话”按钮再说一遍。",
      greetingShort: "您好，我又来了，我是您的人工智能助手。想说话时请按空格键。",
      greetingShortTouch: "您好，我又来了，我是您的人工智能助手。想说话时请按“说话”按钮。"
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

  var api = { LANGS: LANGS, META: META, S: S, pick: pick, t: t, applyPage: applyPage, detectLang: detectLang };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.I18N = api;
})(this);
