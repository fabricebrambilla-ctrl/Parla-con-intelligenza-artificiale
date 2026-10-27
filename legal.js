// Privacy notice and accessibility statement, in the six site languages.
// Each page is a list of [heading, paragraph] pairs. {owner} and {email} are
// filled in from the OWNER_NAME and OWNER_EMAIL environment variables.
// Have a person who knows EU law check these texts before a public launch.

const UPDATED = "2026-10-27";

const PRIVACY = require("./privacy-notice.js");

const ACCESSIBILITY = {
  en: {
    title: "Accessibility statement: Talk with Artificial Intelligence",
    h1: "Accessibility statement",
    sections: [
      ["Microphone permission and keyboard shortcut", "Waiting for microphone access. If your browser asks, choose Allow in its microphone permission prompt. These controls are outside this page. Alt+Shift+T also controls Talk from anywhere on this page, if your browser and screen reader pass the shortcut through."],
      ["Our goal", "This website is made to be used entirely by voice and with screen readers. We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA and the European standard EN 301 549."],
      ["How to use it", "The page has one heading and one large button. Press it to start. The first time, the assistant asks which language you want to use: just say it. Then press the space bar (or the button) to start talking, and press it again when you have finished to get the answer. If you stop talking for seven seconds, the assistant answers anyway. Pressing the space bar while the assistant is talking interrupts it. To end the conversation, say goodbye. To change language, say so at any time, for example \"speak Italian\", or use the Language button. On a phone or tablet, use the Talk button instead of the space bar. You can end at any time with the End conversation button, which appears right after the Talk button."],
      ["Things you can say", ["“Repeat”: hear the last answer again.", "“Change language”, or for example “speak Italian”: switch language.", "“Help”: hear what you can say.", "“Goodbye”: end the conversation."]],
      ["Commands for your screen reader", ["NVDA: the page opens on the Start conversation button. Press Space or Enter. This works in browse mode; you do not need focus mode. If you moved away, press B to jump to the next button, or Shift+B to go back. Escape ends the conversation. Press Control to silence NVDA while the assistant talks.", "JAWS: the same as NVDA. Space or Enter on the button works with the virtual cursor, B and Shift+B jump between buttons, Escape ends the conversation and Control silences JAWS.", "Narrator: in scan mode press Space or Enter on the button; B jumps to the next button. Caps Lock+Space turns scan mode on and off.", "VoiceOver on Mac: press Control+Option+Space on the button, or Space when the keyboard focus is on it. Tab moves between the buttons.", "VoiceOver on iPhone and iPad: swipe right to the Start conversation button and double-tap. Then double-tap the Talk button to talk, and again to get the answer. The End conversation button comes right after it.", "TalkBack on Android: the same as VoiceOver on iPhone: swipe right to the button and double-tap.", "Orca on Linux: press Space or Enter on the button; B jumps to the next button. Orca+A switches between browse and focus mode."]],
      ["Supported screen readers and devices", "It is designed for JAWS, NVDA and Narrator on Windows, VoiceOver on Mac and iPhone, TalkBack on Android and Orca on Linux, with current versions of Chrome, Edge, Firefox and Safari. No headphones and no special settings are needed."],
      ["Known limitations", "The voice depends on your device and the services enabled by the operator; a natural voice is not available on every configuration. Automated checks have been run, but complete real-device testing with JAWS, NVDA and VoiceOver is still pending. You cannot interrupt the assistant by speaking; press the button instead."],
      ["Feedback", "If something does not work for you, please write to {email}. Every message is read."],
    ],
    updated: "Last updated:",
    back: "Back to the conversation page",
  },
  it: {
    title: "Dichiarazione di accessibilità: Parla con l'Intelligenza Artificiale",
    h1: "Dichiarazione di accessibilità",
    sections: [
      ["Microfono e scorciatoia da tastiera", "In attesa dell'accesso al microfono. Se il browser lo chiede, scegli Consenti nella richiesta di autorizzazione. Questi controlli sono fuori dalla pagina. Alt+Maiusc+T aziona anche Parla da qualsiasi punto della pagina, se il browser e il lettore di schermo lasciano passare la combinazione."],
      ["Il nostro obiettivo", "Questo sito è fatto per essere usato interamente con la voce e con i lettori di schermo. Puntiamo a rispettare le Linee guida per l'accessibilità dei contenuti web (WCAG) 2.2 al livello AA e la norma europea EN 301 549."],
      ["Come si usa", "La pagina ha un titolo e un grande pulsante. Premilo per iniziare. La prima volta l'assistente ti chiede quale lingua vuoi usare: basta dirla. Poi premi la barra spaziatrice (o il pulsante) per iniziare a parlare, e premila di nuovo quando hai finito per avere la risposta. Se smetti di parlare per sette secondi, l'assistente risponde comunque. Se premi la barra spaziatrice mentre l'assistente parla, lo interrompi. Per terminare la conversazione, di' arrivederci. Per cambiare lingua, dillo in qualsiasi momento, per esempio «parla inglese», oppure usa il pulsante Lingua. Su telefono o tablet usa il pulsante Parla al posto della barra spaziatrice. Puoi terminare in qualsiasi momento con il pulsante Termina conversazione, che compare subito dopo il pulsante Parla."],
      ["Cosa puoi dire", ["«Ripeti»: riascolti l'ultima risposta.", "«Cambia lingua», oppure per esempio «parla inglese»: cambi lingua.", "«Aiuto»: senti cosa puoi dire.", "«Arrivederci»: termini la conversazione."]],
      ["Comandi per il tuo lettore di schermo", ["NVDA: la pagina si apre sul pulsante Inizia conversazione. Premi la barra spaziatrice o Invio. Funziona in modalità navigazione; non serve la modalità focus. Se ti sei spostato, premi B per andare al pulsante successivo, o Maiusc+B per tornare indietro. Esc termina la conversazione. Premi Ctrl per zittire NVDA mentre parla l'assistente.", "JAWS: come NVDA. La barra spaziatrice o Invio sul pulsante funzionano con il cursore virtuale, B e Maiusc+B passano da un pulsante all'altro, Esc termina la conversazione e Ctrl zittisce JAWS.", "Assistente vocale (Narrator): in modalità di analisi premi la barra spaziatrice o Invio sul pulsante; B va al pulsante successivo. BLOC MAIUSC+barra spaziatrice attiva e disattiva la modalità di analisi.", "VoiceOver su Mac: premi Ctrl+Opzione+barra spaziatrice sul pulsante, oppure la barra spaziatrice quando il focus della tastiera è sul pulsante. Tab passa da un pulsante all'altro.", "VoiceOver su iPhone e iPad: scorri a destra fino al pulsante Inizia conversazione e tocca due volte. Poi tocca due volte il pulsante Parla per parlare, e di nuovo per avere la risposta. Il pulsante Termina conversazione è subito dopo.", "TalkBack su Android: come VoiceOver su iPhone: scorri a destra fino al pulsante e tocca due volte.", "Orca su Linux: premi la barra spaziatrice o Invio sul pulsante; B va al pulsante successivo. Orca+A passa dalla modalità navigazione alla modalità focus."]],
      ["Lettori di schermo e dispositivi supportati", "È pensato per JAWS, NVDA e Assistente vocale su Windows, VoiceOver su Mac e iPhone, TalkBack su Android e Orca su Linux, con le versioni attuali di Chrome, Edge, Firefox e Safari. Non servono cuffie né impostazioni speciali."],
      ["Limiti noti", "La voce dipende dal dispositivo e dai servizi attivati dal gestore; una voce naturale non è disponibile in ogni configurazione. Sono stati eseguiti test automatici, ma restano da completare le prove reali con JAWS, NVDA e VoiceOver. Non puoi interrompere l’assistente parlando; premi il pulsante."],
      ["Segnalazioni", "Se qualcosa non funziona per te, scrivi a {email}. Leggiamo ogni messaggio."],
    ],
    updated: "Ultimo aggiornamento:",
    back: "Torna alla pagina della conversazione",
  },
  fr: {
    title: "Déclaration d'accessibilité: Parler avec l'intelligence artificielle",
    h1: "Déclaration d'accessibilité",
    sections: [
      ["Microphone et raccourci clavier", "En attente de l'accès au microphone. Si le navigateur le demande, choisissez Autoriser dans sa demande d'accès. Ces commandes sont en dehors de cette page. Alt+Maj+T commande aussi Parler depuis n'importe où sur cette page, si le navigateur et le lecteur d'écran transmettent le raccourci."],
      ["Notre objectif", "Ce site est conçu pour être utilisé entièrement à la voix et avec les lecteurs d'écran. Nous visons le respect des Règles pour l'accessibilité des contenus web (WCAG) 2.2 au niveau AA et de la norme européenne EN 301 549."],
      ["Comment l'utiliser", "La page contient un titre et un grand bouton. Appuyez dessus pour commencer. La première fois, l'assistant vous demande quelle langue vous voulez utiliser : il suffit de la dire. Ensuite, appuyez sur la barre d'espace (ou sur le bouton) pour commencer à parler, puis appuyez de nouveau quand vous avez fini pour obtenir la réponse. Si vous arrêtez de parler pendant sept secondes, l'assistant répond quand même. Appuyer sur la barre d'espace pendant que l'assistant parle l'interrompt. Pour terminer la conversation, dites au revoir. Pour changer de langue, dites-le à tout moment, par exemple « parle italien », ou utilisez le bouton Langue. Sur un téléphone ou une tablette, utilisez le bouton Parler à la place de la barre d'espace. Vous pouvez terminer à tout moment avec le bouton Terminer la conversation, qui apparaît juste après le bouton Parler."],
      ["Ce que vous pouvez dire", ["« Répète » : réécouter la dernière réponse.", "« Changer de langue », ou par exemple « parle anglais » : changer de langue.", "« Aide » : entendre ce que vous pouvez dire.", "« Au revoir » : terminer la conversation."]],
      ["Commandes pour votre lecteur d'écran", ["NVDA : la page s'ouvre sur le bouton Commencer la conversation. Appuyez sur Espace ou Entrée. Cela fonctionne en mode navigation ; le mode formulaire n'est pas nécessaire. Si vous vous êtes déplacé, appuyez sur B pour aller au bouton suivant, ou Maj+B pour revenir. Échap termine la conversation. Appuyez sur Ctrl pour faire taire NVDA pendant que l'assistant parle.", "JAWS : comme NVDA. Espace ou Entrée sur le bouton fonctionnent avec le curseur virtuel, B et Maj+B passent d'un bouton à l'autre, Échap termine la conversation et Ctrl fait taire JAWS.", "Narrateur : en mode d'analyse, appuyez sur Espace ou Entrée sur le bouton ; B va au bouton suivant. Verr. Maj+Espace active et désactive le mode d'analyse.", "VoiceOver sur Mac : appuyez sur Ctrl+Option+Espace sur le bouton, ou sur Espace quand le focus du clavier est dessus. Tab passe d'un bouton à l'autre.", "VoiceOver sur iPhone et iPad : balayez vers la droite jusqu'au bouton Commencer la conversation et touchez deux fois. Ensuite, touchez deux fois le bouton Parler pour parler, puis de nouveau pour obtenir la réponse. Le bouton Terminer la conversation se trouve juste après.", "TalkBack sur Android : comme VoiceOver sur iPhone : balayez vers la droite jusqu'au bouton et touchez deux fois.", "Orca sur Linux : appuyez sur Espace ou Entrée sur le bouton ; B va au bouton suivant. Orca+A bascule entre le mode navigation et le mode formulaire."]],
      ["Lecteurs d'écran et appareils pris en charge", "Il est conçu pour JAWS, NVDA et le Narrateur sous Windows, VoiceOver sur Mac et iPhone, TalkBack sur Android et Orca sous Linux, avec les versions actuelles de Chrome, Edge, Firefox et Safari. Aucun casque ni réglage particulier n'est nécessaire."],
      ["Limites connues", "La voix dépend de votre appareil et des services activés par le responsable ; une voix naturelle n’est pas disponible dans toutes les configurations. Des tests automatiques ont été effectués, mais les essais complets avec JAWS, NVDA et VoiceOver sur des appareils réels restent à faire. Pour interrompre l’assistant, appuyez sur le bouton plutôt que de parler."],
      ["Vos retours", "Si quelque chose ne fonctionne pas pour vous, écrivez à {email}. Chaque message est lu."],
    ],
    updated: "Dernière mise à jour :",
    back: "Retour à la page de conversation",
  },
  bg: {
    title: "Декларация за достъпност: Говорете с изкуствен интелект",
    h1: "Декларация за достъпност",
    sections: [
      ["Микрофон и клавишна комбинация", "Изчаква се достъп до микрофона. Ако браузърът попита, изберете Разрешаване в неговия прозорец за разрешения. Тези контроли са извън страницата. Alt+Shift+T управлява бутона за говорене от всяко място на страницата, ако браузърът и екранният четец пропускат комбинацията."],
      ["Нашата цел", "Този сайт е създаден да се използва изцяло с глас и с екранни четци. Стремим се да отговаряме на Указанията за достъпност на уеб съдържанието (WCAG) 2.2 на ниво AA и на европейския стандарт EN 301 549."],
      ["Как се използва", "Страницата има едно заглавие и един голям бутон. Натиснете го, за да започнете. Първия път асистентът ви пита кой език искате да използвате: просто го кажете. След това натиснете интервала (или бутона), за да започнете да говорите, и го натиснете отново, когато приключите, за да чуете отговора. Ако спрете да говорите за седем секунди, асистентът отговаря и така. Натискането на интервала, докато асистентът говори, го прекъсва. За да приключите разговора, кажете довиждане. За да смените езика, кажете го по всяко време, например „говори на английски“, или използвайте бутона Език. На телефон или таблет използвайте бутона Говорете вместо интервала. Можете да приключите по всяко време с бутона Край на разговора, който се появява веднага след бутона Говорете."],
      ["Какво можете да кажете", ["„Повтори“: чувате отново последния отговор.", "„Смени езика“ или например „говори на английски“: сменяте езика.", "„Помощ“: чувате какво можете да кажете.", "„Довиждане“: приключвате разговора."]],
      ["Команди за вашия екранен четец", ["NVDA: страницата се отваря на бутона Започни разговор. Натиснете интервал или Enter. Това работи в режим на разглеждане; не е нужен режим на фокус. Ако сте се преместили, натиснете B, за да отидете на следващия бутон, или Shift+B, за да се върнете. Escape приключва разговора. Натиснете Control, за да заглушите NVDA, докато асистентът говори.", "JAWS: както при NVDA. Интервал или Enter върху бутона работят с виртуалния курсор, B и Shift+B прескачат между бутоните, Escape приключва разговора, а Control заглушава JAWS.", "Разказвач (Narrator): в режим на сканиране натиснете интервал или Enter върху бутона; B отива на следващия бутон. Caps Lock+интервал включва и изключва режима на сканиране.", "VoiceOver на Mac: натиснете Control+Option+интервал върху бутона или интервал, когато фокусът на клавиатурата е върху него. Tab преминава между бутоните.", "VoiceOver на iPhone и iPad: плъзнете надясно до бутона Започни разговор и докоснете два пъти. След това докоснете два пъти бутона Говорете, за да говорите, и отново, за да чуете отговора. Бутонът Край на разговора е веднага след него.", "TalkBack на Android: както VoiceOver на iPhone: плъзнете надясно до бутона и докоснете два пъти.", "Orca на Linux: натиснете интервал или Enter върху бутона; B отива на следващия бутон. Orca+A превключва между режим на разглеждане и режим на фокус."]],
      ["Поддържани екранни четци и устройства", "Създаден е за JAWS, NVDA и Разказвач в Windows, VoiceOver на Mac и iPhone, TalkBack на Android и Orca в Linux, с актуалните версии на Chrome, Edge, Firefox и Safari. Не са нужни слушалки или специални настройки."],
      ["Известни ограничения", "Гласът зависи от устройството и услугите, включени от оператора; естествен глас не е наличен при всяка конфигурация. Извършени са автоматични проверки, но пълните тестове с JAWS, NVDA и VoiceOver на реални устройства още предстоят. За да прекъснете асистента, натиснете бутона, вместо да говорите."],
      ["Обратна връзка", "Ако нещо не работи за вас, пишете на {email}. Четем всяко съобщение."],
    ],
    updated: "Последна актуализация:",
    back: "Обратно към страницата за разговор",
  },
  ru: {
    title: "Заявление о доступности: Поговорите с искусственным интеллектом",
    h1: "Заявление о доступности",
    sections: [
      ["Микрофон и сочетание клавиш", "Ожидание доступа к микрофону. Если браузер запросит разрешение, выберите Разрешить. Эти элементы управления находятся за пределами страницы. Alt+Shift+T также управляет кнопкой разговора из любого места страницы, если браузер и программа экранного доступа передают это сочетание."],
      ["Наша цель", "Этот сайт сделан так, чтобы им можно было пользоваться полностью голосом и с программами экранного доступа. Мы стремимся соответствовать Руководству по доступности веб-контента (WCAG) 2.2 на уровне AA и европейскому стандарту EN 301 549."],
      ["Как пользоваться", "На странице один заголовок и одна большая кнопка. Нажмите её, чтобы начать. В первый раз ассистент спросит, какой язык вы хотите использовать: просто назовите его. Затем нажмите пробел (или кнопку), чтобы начать говорить, и нажмите ещё раз, когда закончите, чтобы получить ответ. Если вы замолчите на семь секунд, ассистент всё равно ответит. Нажатие пробела, пока ассистент говорит, прерывает его. Чтобы завершить разговор, скажите «до свидания». Чтобы сменить язык, скажите об этом в любой момент, например «говори по-английски», или воспользуйтесь кнопкой «Язык». На телефоне или планшете используйте кнопку «Говорить» вместо пробела. Закончить можно в любой момент кнопкой «Завершить разговор», которая появляется сразу после кнопки «Говорить»."],
      ["Что можно сказать", ["«Повтори»: услышать последний ответ ещё раз.", "«Смени язык» или, например, «говори по-английски»: сменить язык.", "«Помощь»: услышать, что можно сказать.", "«До свидания»: завершить разговор."]],
      ["Команды для вашей программы экранного доступа", ["NVDA: страница открывается на кнопке «Начать разговор». Нажмите пробел или Enter. Это работает в режиме обзора; режим фокуса не нужен. Если вы ушли с кнопки, нажмите B, чтобы перейти к следующей кнопке, или Shift+B, чтобы вернуться. Escape завершает разговор. Нажмите Ctrl, чтобы заглушить NVDA, пока говорит ассистент.", "JAWS: так же, как NVDA. Пробел или Enter на кнопке работают с виртуальным курсором, B и Shift+B переходят между кнопками, Escape завершает разговор, а Ctrl заглушает JAWS.", "Экранный диктор (Narrator): в режиме сканирования нажмите пробел или Enter на кнопке; B переходит к следующей кнопке. Caps Lock+пробел включает и выключает режим сканирования.", "VoiceOver на Mac: нажмите Control+Option+пробел на кнопке или пробел, когда на ней фокус клавиатуры. Tab переходит между кнопками.", "VoiceOver на iPhone и iPad: смахните вправо до кнопки «Начать разговор» и коснитесь дважды. Затем дважды коснитесь кнопки «Говорить», чтобы говорить, и ещё раз, чтобы получить ответ. Кнопка «Завершить разговор» идёт сразу после неё.", "TalkBack на Android: так же, как VoiceOver на iPhone: смахните вправо до кнопки и коснитесь дважды.", "Orca в Linux: нажмите пробел или Enter на кнопке; B переходит к следующей кнопке. Orca+A переключает режим обзора и режим фокуса."]],
      ["Поддерживаемые программы и устройства", "Сайт рассчитан на JAWS, NVDA и Экранный диктор в Windows, VoiceOver на Mac и iPhone, TalkBack на Android и Orca в Linux, в текущих версиях Chrome, Edge, Firefox и Safari. Наушники и особые настройки не нужны."],
      ["Известные ограничения", "Голос зависит от устройства и сервисов, включённых оператором; естественный голос доступен не во всех конфигурациях. Проведены автоматические проверки, но полные испытания с JAWS, NVDA и VoiceOver на реальных устройствах ещё не завершены. Чтобы перебить ассистента, нажмите кнопку, а не говорите."],
      ["Обратная связь", "Если что-то у вас не работает, напишите на {email}. Мы читаем каждое сообщение."],
    ],
    updated: "Последнее обновление:",
    back: "Вернуться на страницу разговора",
  },
  zh: {
    title: "无障碍声明: 与人工智能对话",
    h1: "无障碍声明",
    sections: [
      ["麦克风权限和键盘快捷键", "正在等待麦克风权限。如果浏览器询问，请在麦克风权限提示中选择允许。这些控件位于网页之外。 如果浏览器和屏幕阅读器允许传递此快捷键，在本页任何位置都可按 Alt+Shift+T 操作说话按钮。"],
      ["我们的目标", "本网站可以完全通过语音和读屏软件使用。我们的目标是符合《网页内容无障碍指南》（WCAG）2.2 AA 级和欧洲标准 EN 301 549。"],
      ["如何使用", "页面上有一个标题和一个大按钮。按下它即可开始。第一次使用时，助手会问您想使用哪种语言，您直接说出来即可。然后按空格键（或按钮）开始说话，说完后再按一次即可听到回答。如果您停下来七秒钟不说话，助手也会回答。助手说话时按空格键可以打断它。要结束对话，请说“再见”。要换语言，可以随时说出来，例如“说英语”，也可以使用“语言”按钮。在手机或平板电脑上，请用“说话”按钮代替空格键。您可以随时按“结束对话”按钮结束，它就在“说话”按钮后面。"],
      ["您可以说的话", ["“再说一遍”：重新听上一个回答。", "“换语言”，或者例如“说英语”：切换语言。", "“帮助”：听听您可以说什么。", "“再见”：结束对话。"]],
      ["读屏软件的操作方法", ["NVDA：页面打开时焦点在“开始对话”按钮上。按空格键或回车键即可，在浏览模式下就能使用，不需要切换到焦点模式。如果您离开了按钮，按 B 跳到下一个按钮，按 Shift+B 返回。按 Esc 结束对话。助手说话时，按 Ctrl 可以让 NVDA 停止朗读。", "JAWS：与 NVDA 相同。在虚拟光标下，在按钮上按空格键或回车键即可；B 和 Shift+B 在按钮之间跳转；Esc 结束对话；Ctrl 让 JAWS 停止朗读。", "讲述人（Narrator）：在扫描模式下，在按钮上按空格键或回车键；B 跳到下一个按钮。Caps Lock+空格键可以打开或关闭扫描模式。", "Mac 上的 VoiceOver：在按钮上按 Control+Option+空格键；如果键盘焦点在按钮上，直接按空格键也可以。Tab 键在按钮之间移动。", "iPhone 和 iPad 上的 VoiceOver：向右轻扫到“开始对话”按钮，然后轻点两下。之后轻点两下“说话”按钮开始说话，再轻点两下听回答。“结束对话”按钮就在它后面。", "Android 上的 TalkBack：与 iPhone 上的 VoiceOver 相同：向右轻扫到按钮，然后轻点两下。", "Linux 上的 Orca：在按钮上按空格键或回车键；B 跳到下一个按钮。Orca+A 在浏览模式和焦点模式之间切换。"]],
      ["支持的读屏软件和设备", "本网站适用于 Windows 上的 JAWS、NVDA 和讲述人，Mac 和 iPhone 上的 VoiceOver，Android 上的 TalkBack，以及 Linux 上的 Orca，并支持最新版本的 Chrome、Edge、Firefox 和 Safari。不需要耳机，也不需要特别设置。"],
      ["已知限制", "语音取决于您的设备和运营者启用的服务，并非所有配置都有自然语音。已完成自动化检查，但 JAWS、NVDA 和 VoiceOver 的完整真机测试仍待完成。要打断助手，请按按钮，不能通过说话打断。"],
      ["反馈", "如果有什么对您不起作用，请写信至 {email}。我们会阅读每一封来信。"],
    ],
    updated: "最后更新：",
    back: "返回对话页面",
  },
};

const POLICY_LINKS = [
  ["Groq", "https://groq.com/privacy-policy"],
  ["Tavily", "https://tavily.com/privacy"],
  ["Render", "https://render.com/privacy"],
  ["Fish Audio", "https://fish.audio/privacy"],
];

module.exports = { PRIVACY, ACCESSIBILITY, POLICY_LINKS, UPDATED };

