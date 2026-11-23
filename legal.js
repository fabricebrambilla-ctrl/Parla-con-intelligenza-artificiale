// Privacy notice and accessibility statement, in all supported site languages.
// Each page is a list of [heading, paragraph] pairs. {owner} and {email} are
// filled in from the OWNER_NAME and OWNER_EMAIL environment variables.
// Have a person who knows EU law check these texts before a public launch.

const UPDATED = "2026-11-23";

const PRIVACY = require("./privacy-notice.js");
const TERMS = require("./terms.js");

const ACCESSIBILITY = {
  "ja": {
    "title": "アクセシビリティに関する方針：Talk with AI",
    "h1": "アクセシビリティに関する方針",
    "sections": [
      [
        "マイクの許可とキーボード操作",
        "ブラウザーがマイクの許可を求めます。「許可」を選んでください。 Tab または Shift+Tab でブラウザーの選択肢を移動し、Enter で決定します。"
      ],
      [
        "目標",
        "このサイトは、音声とスクリーンリーダーで使えるように開発しています。WCAG 2.2のレベルAAと欧州規格EN 301 549への対応を目標としています。"
      ],
      [
        "使い方",
        "自由に話してください。電車の時刻、レストラン、最新のニュースなどを聞けます。話しかけると私の声を中断できます。使い方をもう一度、または機能の説明を頼めます。もっと速く話して、日本語に切り替えて、マイクを変更してと言えます。 Ctrl で一時停止できます。 メインボタンを使うか、一時停止と言ってください。"
      ],
      [
        "使える音声コマンド",
        [
          "「もう一度」：直前の回答を繰り返します。",
          "「言語を変更」または「英語に切り替えて」：言語を変更します。",
          "「最後の回答を表示」：最後の回答をページに文字で表示し、コピーボタンも表示します。「回答を非表示」で消せます。",
          "「マイクを変更」：次のマイクに切り替えます。",
          "「ヘルプ」：使えるコマンドを聞きます。",
          "「さようなら」：会話を終了します。",
          "一時停止しました。ボタンまたは Ctrl で再開できます。"
        ]
      ],
      [
        "スクリーンリーダーの操作",
        "Tab または Shift+Tab でブラウザーの選択肢を移動し、Enter で決定します。 Ctrl で一時停止できます。 メインボタンを使うか、一時停止と言ってください。"
      ],
      [
        "想定する環境",
        "WindowsのJAWS、NVDA、ナレーター、MacとiPhoneのVoiceOver、AndroidのTalkBack、LinuxのOrca、および現在のChrome、Edge、Firefox、Safariでの利用を想定しています。すべての組み合わせで動作が確認されたわけではありません。"
      ],
      [
        "既知の制限",
        "音声による中断とエコー軽減を実装しましたが、実機での確認が必要です。スピーカーやスクリーンリーダーの声が入り込むことがあります。NVDA や JAWS が Ctrl を受け取る場合はメインボタンを使ってください。一時停止ではマイクが閉じるため、ボタンか Ctrl で再開します。自動チェックは視覚障害者によるテストの代わりにはなりません。"
      ],
      [
        "ご意見",
        "使えないところがありましたら、{email}にご連絡ください。すべてのメッセージを確認します。"
      ]
    ],
    "updated": "最終更新日：",
    "back": "会話のページに戻る"
  },
  "en": {
    "title": "Accessibility statement: Talk with Artificial Intelligence",
    "h1": "Accessibility statement",
    "sections": [
      [
        "Microphone permission and keyboard shortcut",
        "The browser now asks for the microphone. Choose Allow. Use Tab or Shift+Tab between browser choices, then Enter."
      ],
      [
        "Our goal",
        "This website is made to be used entirely by voice and with screen readers. We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA and the European standard EN 301 549."
      ],
      [
        "How to use it",
        "Talk freely. Ask about train times, restaurants or the latest news. Speak to interrupt me. Ask me to repeat the instructions or explain any function. Say talk faster, change language to English, or change microphone. Press Ctrl to pause. Use the main button or say pause."
      ],
      [
        "Things you can say",
        [
          "“Repeat”: hear the last answer again.",
          "“Change language”, or for example “speak Italian”: switch language.",
          "“Show the last answer”: the last answer as text on the page, with a Copy button; “hide the answer” turns it off.",
          "“Change microphone”: use the next microphone.",
          "“Help”: hear what you can say.",
          "“Goodbye”: end the conversation.",
          "Paused. Press the button or Ctrl to resume."
        ]
      ],
      [
        "Commands for your screen reader",
        "Use Tab or Shift+Tab between browser choices, then Enter. Press Ctrl to pause. Use the main button or say pause."
      ],
      [
        "Supported screen readers and devices",
        "It is designed for JAWS, NVDA and Narrator on Windows, VoiceOver on Mac and iPhone, TalkBack on Android and Orca on Linux, with current versions of Chrome, Edge, Firefox and Safari. No headphones and no special settings are needed."
      ],
      [
        "Known limitations",
        "Speech interruption and echo reduction are implemented, awaiting real-device confirmation. Speakers or screen readers can still cause echo. NVDA or JAWS may intercept Ctrl; use the main button if it does not reach the page. Pausing closes the microphone, so resume with the button or Ctrl. Automatic checks do not replace testing with blind users."
      ],
      [
        "Feedback",
        "If something does not work for you, please write to {email}. Every message is read."
      ]
    ],
    "updated": "Last updated:",
    "back": "Back to the conversation page"
  },
  "it": {
    "title": "Dichiarazione di accessibilità: Parla con l'Intelligenza Artificiale",
    "h1": "Dichiarazione di accessibilità",
    "sections": [
      [
        "Microfono e scorciatoia da tastiera",
        "Ora il browser chiede il microfono. Scegli Consenti. Usa Tab o Maiusc+Tab tra le opzioni del browser, poi Invio."
      ],
      [
        "Il nostro obiettivo",
        "Questo sito è fatto per essere usato interamente con la voce e con i lettori di schermo. Puntiamo a rispettare le Linee guida per l'accessibilità dei contenuti web (WCAG) 2.2 al livello AA e la norma europea EN 301 549."
      ],
      [
        "Come si usa",
        "Parla liberamente. Chiedi orari dei treni, ristoranti o notizie attuali. Parla per interrompermi. Chiedimi di ripetere le istruzioni o spiegare una funzione. Puoi dire parla più velocemente, parla italiano o cambia microfono. Premi Ctrl per mettere in pausa. Usa il pulsante principale o di’ pausa."
      ],
      [
        "Cosa puoi dire",
        [
          "«Ripeti»: riascolti l'ultima risposta.",
          "«Cambia lingua», oppure per esempio «parla inglese»: cambi lingua.",
          "“Mostra l'ultima risposta”: l'ultima risposta come testo nella pagina, con un pulsante Copia; “nascondi la risposta” la disattiva.",
          "“Cambia microfono”: usa il microfono successivo.",
          "«Aiuto»: senti cosa puoi dire.",
          "«Arrivederci»: termini la conversazione.",
          "In pausa. Premi il pulsante o Ctrl per riprendere."
        ]
      ],
      [
        "Comandi per il tuo lettore di schermo",
        "Usa Tab o Maiusc+Tab tra le opzioni del browser, poi Invio. Premi Ctrl per mettere in pausa. Usa il pulsante principale o di’ pausa."
      ],
      [
        "Lettori di schermo e dispositivi supportati",
        "È pensato per JAWS, NVDA e Assistente vocale su Windows, VoiceOver su Mac e iPhone, TalkBack su Android e Orca su Linux, con le versioni attuali di Chrome, Edge, Firefox e Safari. Non servono cuffie né impostazioni speciali."
      ],
      [
        "Limiti noti",
        "Interruzione vocale e riduzione dell’eco implementate, in attesa di verifica su dispositivi reali. Altoparlanti e lettori di schermo possono causare eco. NVDA o JAWS possono intercettare Ctrl: usa il pulsante se non funziona. La pausa chiude il microfono: riprendi con il pulsante o Ctrl. I controlli automatici non sostituiscono le prove con utenti ciechi."
      ],
      [
        "Segnalazioni",
        "Se qualcosa non funziona per te, scrivi a {email}. Leggiamo ogni messaggio."
      ]
    ],
    "updated": "Ultimo aggiornamento:",
    "back": "Torna alla pagina della conversazione"
  },
  "fr": {
    "title": "Déclaration d'accessibilité: Parler avec l'intelligence artificielle",
    "h1": "Déclaration d'accessibilité",
    "sections": [
      [
        "Microphone et raccourci clavier",
        "Le navigateur demande maintenant le microphone. Choisissez Autoriser. Utilisez Tab ou Maj+Tab entre les choix du navigateur, puis Entrée."
      ],
      [
        "Notre objectif",
        "Ce site est conçu pour être utilisé entièrement à la voix et avec les lecteurs d'écran. Nous visons le respect des Règles pour l'accessibilité des contenus web (WCAG) 2.2 au niveau AA et de la norme européenne EN 301 549."
      ],
      [
        "Comment l'utiliser",
        "Parlez librement. Demandez des horaires de train, des restaurants ou les dernières nouvelles. Parlez pour m’interrompre. Demandez-moi de répéter les instructions ou d’expliquer une fonction. Dites parle plus vite, parle français ou change de microphone. Appuyez sur Ctrl pour mettre en pause. Utilisez le bouton principal ou dites pause."
      ],
      [
        "Ce que vous pouvez dire",
        [
          "« Répète » : réécouter la dernière réponse.",
          "« Changer de langue », ou par exemple « parle anglais » : changer de langue.",
          "« Affiche la dernière réponse » : la dernière réponse en texte sur la page, avec un bouton Copier ; « masque la réponse » la désactive.",
          "« Changer de microphone » : utiliser le microphone suivant.",
          "« Aide » : entendre ce que vous pouvez dire.",
          "« Au revoir » : terminer la conversation.",
          "En pause. Appuyez sur le bouton ou Ctrl pour reprendre."
        ]
      ],
      [
        "Commandes pour votre lecteur d'écran",
        "Utilisez Tab ou Maj+Tab entre les choix du navigateur, puis Entrée. Appuyez sur Ctrl pour mettre en pause. Utilisez le bouton principal ou dites pause."
      ],
      [
        "Lecteurs d'écran et appareils pris en charge",
        "Il est conçu pour JAWS, NVDA et le Narrateur sous Windows, VoiceOver sur Mac et iPhone, TalkBack sur Android et Orca sous Linux, avec les versions actuelles de Chrome, Edge, Firefox et Safari. Aucun casque ni réglage particulier n'est nécessaire."
      ],
      [
        "Limites connues",
        "L’interruption vocale et la réduction de l’écho sont implémentées, en attente de vérification sur appareils réels. Les haut-parleurs et lecteurs d’écran peuvent produire de l’écho. NVDA ou JAWS peuvent intercepter Ctrl : utilisez alors le bouton. La pause ferme le microphone : reprenez avec le bouton ou Ctrl. Les contrôles automatiques ne remplacent pas les essais avec des personnes aveugles."
      ],
      [
        "Vos retours",
        "Si quelque chose ne fonctionne pas pour vous, écrivez à {email}. Chaque message est lu."
      ]
    ],
    "updated": "Dernière mise à jour :",
    "back": "Retour à la page de conversation"
  },
  "bg": {
    "title": "Декларация за достъпност: Говорете с изкуствен интелект",
    "h1": "Декларация за достъпност",
    "sections": [
      [
        "Микрофон и клавишна комбинация",
        "Браузърът сега иска достъп до микрофона. Изберете Разрешаване. Използвайте Tab или Shift+Tab между опциите, после Enter."
      ],
      [
        "Нашата цел",
        "Този сайт е създаден да се използва изцяло с глас и с екранни четци. Стремим се да отговаряме на Указанията за достъпност на уеб съдържанието (WCAG) 2.2 на ниво AA и на европейския стандарт EN 301 549."
      ],
      [
        "Как се използва",
        "Говорете свободно. Питайте за влакове, ресторанти или последните новини. Говорете, за да ме прекъснете. Поискайте да повторя инструкциите или да обясня функция. Кажете говори по-бързо, говори български или смени микрофона. Натиснете Ctrl за пауза. Използвайте главния бутон или кажете пауза."
      ],
      [
        "Какво можете да кажете",
        [
          "„Повтори“: чувате отново последния отговор.",
          "„Смени езика“ или например „говори на английски“: сменяте езика.",
          "„Покажи последния отговор“: последният отговор като текст на страницата, с бутон Копирай; „скрий отговора“ го изключва.",
          "„Смени микрофона“: използва следващия микрофон.",
          "„Помощ“: чувате какво можете да кажете.",
          "„Довиждане“: приключвате разговора.",
          "На пауза. Натиснете бутона или Ctrl, за да продължите."
        ]
      ],
      [
        "Команди за вашия екранен четец",
        "Използвайте Tab или Shift+Tab между опциите, после Enter. Натиснете Ctrl за пауза. Използвайте главния бутон или кажете пауза."
      ],
      [
        "Поддържани екранни четци и устройства",
        "Създаден е за JAWS, NVDA и Разказвач в Windows, VoiceOver на Mac и iPhone, TalkBack на Android и Orca в Linux, с актуалните версии на Chrome, Edge, Firefox и Safari. Не са нужни слушалки или специални настройки."
      ],
      [
        "Известни ограничения",
        "Гласовото прекъсване и намаляването на ехото са реализирани, но очакват тестове на реални устройства. Говорителите и екранните четци могат да създадат ехо. NVDA или JAWS могат да прихванат Ctrl; тогава използвайте бутона. При пауза микрофонът се затваря: продължете с бутона или Ctrl. Автоматичните проверки не заменят тестовете с незрящи."
      ],
      [
        "Обратна връзка",
        "Ако нещо не работи за вас, пишете на {email}. Четем всяко съобщение."
      ]
    ],
    "updated": "Последна актуализация:",
    "back": "Обратно към страницата за разговор"
  },
  "ru": {
    "title": "Заявление о доступности: Поговорите с искусственным интеллектом",
    "h1": "Заявление о доступности",
    "sections": [
      [
        "Микрофон и сочетание клавиш",
        "Сейчас браузер запрашивает микрофон. Выберите «Разрешить». Используйте Tab или Shift+Tab для выбора, затем Enter."
      ],
      [
        "Наша цель",
        "Этот сайт сделан так, чтобы им можно было пользоваться полностью голосом и с программами экранного доступа. Мы стремимся соответствовать Руководству по доступности веб-контента (WCAG) 2.2 на уровне AA и европейскому стандарту EN 301 549."
      ],
      [
        "Как пользоваться",
        "Говорите свободно. Спрашивайте о поездах, ресторанах или последних новостях. Говорите, чтобы меня перебить. Попросите повторить инструкции или объяснить функцию. Скажите говори быстрее, говори по-русски или смени микрофон. Нажмите Ctrl для паузы. Используйте главную кнопку или скажите пауза."
      ],
      [
        "Что можно сказать",
        [
          "«Повтори»: услышать последний ответ ещё раз.",
          "«Смени язык» или, например, «говори по-английски»: сменить язык.",
          "«Покажи последний ответ»: последний ответ текстом на странице, с кнопкой Копировать; «скрой ответ» выключает это.",
          "«Сменить микрофон»: использовать следующий микрофон.",
          "«Помощь»: услышать, что можно сказать.",
          "«До свидания»: завершить разговор.",
          "Пауза. Нажмите кнопку или Ctrl, чтобы продолжить."
        ]
      ],
      [
        "Команды для вашей программы экранного доступа",
        "Используйте Tab или Shift+Tab для выбора, затем Enter. Нажмите Ctrl для паузы. Используйте главную кнопку или скажите пауза."
      ],
      [
        "Поддерживаемые программы и устройства",
        "Сайт рассчитан на JAWS, NVDA и Экранный диктор в Windows, VoiceOver на Mac и iPhone, TalkBack на Android и Orca в Linux, в текущих версиях Chrome, Edge, Firefox и Safari. Наушники и особые настройки не нужны."
      ],
      [
        "Известные ограничения",
        "Голосовое прерывание и снижение эха реализованы, но требуют проверки на реальных устройствах. Динамики и экранные дикторы могут создавать эхо. NVDA или JAWS могут перехватить Ctrl; тогда используйте кнопку. Пауза закрывает микрофон: продолжите кнопкой или Ctrl. Автоматические проверки не заменяют тесты с незрячими пользователями."
      ],
      [
        "Обратная связь",
        "Если что-то у вас не работает, напишите на {email}. Мы читаем каждое сообщение."
      ]
    ],
    "updated": "Последнее обновление:",
    "back": "Вернуться на страницу разговора"
  },
  "zh": {
    "title": "无障碍声明: 与人工智能对话",
    "h1": "无障碍声明",
    "sections": [
      [
        "麦克风权限和键盘快捷键",
        "浏览器现在请求使用麦克风。请选择“允许”。 用 Tab 或 Shift+Tab 移动到浏览器选项，然后按回车。"
      ],
      [
        "我们的目标",
        "本网站可以完全通过语音和读屏软件使用。我们的目标是符合《网页内容无障碍指南》（WCAG）2.2 AA 级和欧洲标准 EN 301 549。"
      ],
      [
        "如何使用",
        "自由说话。可以询问火车时刻、餐厅或最新新闻。说话即可打断我。随时让我重复使用说明或解释功能。可以说说快一点、说中文或更换麦克风。 按 Ctrl 暂停。 使用主按钮或说暂停。"
      ],
      [
        "您可以说的话",
        [
          "“再说一遍”：重新听上一个回答。",
          "“换语言”，或者例如“说英语”：切换语言。",
          "“显示上一个回答”：把上一个回答作为文字显示在页面上，并有“复制”按钮；“隐藏回答”可以关闭。",
          "“换麦克风”：使用下一个麦克风。",
          "“帮助”：听听您可以说什么。",
          "“再见”：结束对话。",
          "已暂停。按按钮或 Ctrl 继续。"
        ]
      ],
      [
        "读屏软件的操作方法",
        "用 Tab 或 Shift+Tab 移动到浏览器选项，然后按回车。 按 Ctrl 暂停。 使用主按钮或说暂停。"
      ],
      [
        "支持的读屏软件和设备",
        "本网站适用于 Windows 上的 JAWS、NVDA 和讲述人，Mac 和 iPhone 上的 VoiceOver，Android 上的 TalkBack，以及 Linux 上的 Orca，并支持最新版本的 Chrome、Edge、Firefox 和 Safari。不需要耳机，也不需要特别设置。"
      ],
      [
        "已知限制",
        "已实现语音打断和回声抑制，仍待真实设备验证。扬声器和屏幕阅读器仍可能产生回声。NVDA 或 JAWS 可能拦截 Ctrl，此时请使用主按钮。暂停会关闭麦克风，须用按钮或 Ctrl 继续。自动检查不能代替盲人用户测试。"
      ],
      [
        "反馈",
        "如果有什么对您不起作用，请写信至 {email}。我们会阅读每一封来信。"
      ]
    ],
    "updated": "最后更新：",
    "back": "返回对话页面"
  },
  "nl": {
    "title": "Toegankelijkheidsverklaring: Praat met Kunstmatige Intelligentie",
    "h1": "Toegankelijkheidsverklaring",
    "sections": [
      [
        "Toestemming voor de microfoon en sneltoets",
        "De browser vraagt nu om de microfoon. Kies Toestaan. Gebruik Tab of Shift+Tab tussen de browseropties en daarna Enter."
      ],
      [
        "Ons doel",
        "Deze website is gemaakt om helemaal met de stem en met schermlezers te gebruiken. We streven naar de Web Content Accessibility Guidelines (WCAG) 2.2 op niveau AA en de Europese norm EN 301 549."
      ],
      [
        "Hoe het werkt",
        "Praat vrijuit. Vraag naar treintijden, restaurants of het laatste nieuws. Praat om mij te onderbreken. Vraag mij de instructies te herhalen of een functie uit te leggen. Zeg praat sneller, spreek Nederlands of verander de microfoon. Druk op Ctrl om te pauzeren. Gebruik de hoofdknop of zeg pauze."
      ],
      [
        "Wat je kunt zeggen",
        [
          "“Herhaal”: hoor het laatste antwoord nog een keer.",
          "“Taal wijzigen”, of bijvoorbeeld “spreek Engels”: wissel van taal.",
          "“Laatste antwoord tonen”: het laatste antwoord als tekst op de pagina, met een knop Kopiëren; “verberg het antwoord” zet dit weer uit.",
          "“Microfoon wijzigen”: gebruik de volgende microfoon.",
          "“Help”: hoor wat je kunt zeggen.",
          "“Tot ziens”: beëindig het gesprek.",
          "Gepauzeerd. Druk op de knop of Ctrl om verder te gaan."
        ]
      ],
      [
        "Opdrachten voor je schermlezer",
        "Gebruik Tab of Shift+Tab tussen de browseropties en daarna Enter. Druk op Ctrl om te pauzeren. Gebruik de hoofdknop of zeg pauze."
      ],
      [
        "Ondersteunde schermlezers en apparaten",
        "Hij is ontworpen voor JAWS, NVDA en Verteller op Windows, VoiceOver op Mac en iPhone, TalkBack op Android en Orca op Linux, met actuele versies van Chrome, Edge, Firefox en Safari. Er zijn geen koptelefoon en geen speciale instellingen nodig."
      ],
      [
        "Bekende beperkingen",
        "Spraakonderbreking en echovermindering zijn geïmplementeerd en wachten op tests op echte apparaten. Luidsprekers en schermlezers kunnen echo veroorzaken. NVDA of JAWS kan Ctrl onderscheppen; gebruik dan de hoofdknop. Pauzeren sluit de microfoon: hervat met de knop of Ctrl. Automatische controles vervangen geen tests met blinde gebruikers."
      ],
      [
        "Feedback",
        "Als iets voor jou niet werkt, schrijf dan naar {email}. Elk bericht wordt gelezen."
      ]
    ],
    "updated": "Laatst bijgewerkt:",
    "back": "Terug naar de gesprekspagina"
  },
  "pt": {
    "title": "Declaração de acessibilidade: Fale com a Inteligência Artificial",
    "h1": "Declaração de acessibilidade",
    "sections": [
      [
        "Autorização do microfone e atalho de teclado",
        "O navegador está agora a pedir o microfone. Escolha Permitir. Use Tab ou Shift+Tab entre as opções do navegador e depois Enter."
      ],
      [
        "O nosso objetivo",
        "Este site foi feito para ser usado inteiramente por voz e com leitores de ecrã. Procuramos cumprir as Diretrizes de Acessibilidade para o Conteúdo da Web (WCAG) 2.2, nível AA, e a norma europeia EN 301 549."
      ],
      [
        "Como usar",
        "Fale à vontade. Pergunte por horários de comboios, restaurantes ou notícias atuais. Fale para me interromper. Peça para repetir as instruções ou explicar uma função. Diga fala mais depressa, fala português ou muda o microfone. Prima Ctrl para pausar. Use o botão principal ou diga pausa."
      ],
      [
        "O que pode dizer",
        [
          "“Repete”: ouvir de novo a última resposta.",
          "“Mudar de língua”, ou por exemplo “fala inglês”: mudar de língua.",
          "“Mostra a última resposta”: a última resposta como texto na página, com um botão Copiar; “esconde a resposta” desliga-o.",
          "“Mudar de microfone”: usar o microfone seguinte.",
          "“Ajuda”: ouvir o que pode dizer.",
          "“Adeus”: terminar a conversa.",
          "Em pausa. Prima o botão ou Ctrl para retomar."
        ]
      ],
      [
        "Comandos para o seu leitor de ecrã",
        "Use Tab ou Shift+Tab entre as opções do navegador e depois Enter. Prima Ctrl para pausar. Use o botão principal ou diga pausa."
      ],
      [
        "Leitores de ecrã e dispositivos suportados",
        "Foi pensado para o JAWS, o NVDA e o Narrador no Windows, o VoiceOver no Mac e no iPhone, o TalkBack no Android e o Orca no Linux, com versões atuais do Chrome, Edge, Firefox e Safari. Não são precisos auscultadores nem definições especiais."
      ],
      [
        "Limitações conhecidas",
        "A interrupção por voz e a redução de eco estão implementadas, a aguardar testes em dispositivos reais. As colunas e os leitores de ecrã podem causar eco. O NVDA ou o JAWS podem intercetar Ctrl; nesse caso, use o botão principal. A pausa fecha o microfone: retome com o botão ou Ctrl. Os testes automáticos não substituem os testes com pessoas cegas."
      ],
      [
        "Comentários",
        "Se alguma coisa não funcionar para si, escreva para {email}. Todas as mensagens são lidas."
      ]
    ],
    "updated": "Última atualização:",
    "back": "Voltar à página da conversa"
  }
};

const POLICY_LINKS = [
  ["Groq", "https://groq.com/privacy-policy"],
  ["Tavily", "https://tavily.com/privacy"],
  ["Render", "https://render.com/privacy"],
  ["Fish Audio", "https://fish.audio/privacy"],
];

module.exports = { PRIVACY, TERMS, ACCESSIBILITY, POLICY_LINKS, UPDATED };

