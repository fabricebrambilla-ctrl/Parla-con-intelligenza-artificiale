// Privacy notice and accessibility statement, in the six site languages.
// Each page is a list of [heading, paragraph] pairs. {owner} and {email} are
// filled in from the OWNER_NAME and OWNER_EMAIL environment variables.
// Have a person who knows EU law check these texts before a public launch.

const UPDATED = "2026-10-10";

const PRIVACY = {
  en: {
    title: "Privacy notice – Talk with Artificial Intelligence",
    h1: "Privacy notice",
    sections: [
      ["Who is responsible", "This website is run by {owner}. Contact: {email}."],
      ["What happens to your voice", "While you speak, your voice is recorded and sent to Groq, an AI company, which turns it into text, writes the answer and, in English, produces the spoken voice. In other languages the voice comes from your own device. Our server does not save recordings, transcripts or answers."],
      ["Web searches", "When the assistant needs current information, it sends a short search text, never your voice, to Tavily, a search company, or to Groq."],
      ["What is stored on your device", "Your language choice, a random anonymous number and short summaries of your last ten conversations are stored only in this browser. You can delete the summaries on the page \"My past conversations\", or by clearing this site's data in your browser. We use no cookies, no advertising and no tracking."],
      ["What our server keeps", "To share the free daily limits fairly and to stop abuse, the server counts how much each visitor uses each day, linked to a scrambled (hashed) form of your internet address and the anonymous number. These counters are deleted automatically after about one day. Our hosting company may keep technical logs for a short time."],
      ["Where your data goes", "The site is hosted by Render in Frankfurt, Germany. Groq and Tavily may process data outside the European Union, including in the United States, under their own safeguards for international transfers. You can read their privacy policies here:"],
      ["Why we process it", "Only to give you the conversation you start (Article 6(1)(b) GDPR) and to keep the free service secure and fair (Article 6(1)(f) GDPR). Because the service is made for blind and visually impaired people, using it may reveal information about your health. By starting a conversation you agree to this processing (Article 9(2)(a) GDPR). You can stop at any time by ending the conversation."],
      ["Your rights", "You have the right to access, correct and delete your data, to restrict or object to its processing, and to complain to the data protection authority of your country (in Italy, the Garante per la protezione dei dati personali). Most of your data stays in your own browser and under your control."],
      ["Artificial intelligence", "The assistant is an artificial intelligence, not a person. It can make mistakes: check important information, especially about health, money or safety."],
    ],
    updated: "Last updated:",
    back: "Back to the conversation page",
  },
  it: {
    title: "Informativa sulla privacy – Parla con l'Intelligenza Artificiale",
    h1: "Informativa sulla privacy",
    sections: [
      ["Chi è responsabile", "Questo sito è gestito da {owner}. Contatto: {email}."],
      ["Cosa succede alla tua voce", "Mentre parli, la tua voce viene registrata e inviata a Groq, un'azienda di intelligenza artificiale, che la trasforma in testo, scrive la risposta e, in inglese, produce la voce parlata. Nelle altre lingue la voce è quella del tuo dispositivo. Il nostro server non salva registrazioni, trascrizioni né risposte."],
      ["Ricerche sul web", "Quando l'assistente ha bisogno di informazioni aggiornate, invia un breve testo di ricerca, mai la tua voce, a Tavily, un'azienda di ricerca, oppure a Groq."],
      ["Cosa viene salvato sul tuo dispositivo", "La lingua scelta, un numero anonimo casuale e brevi riassunti delle tue ultime dieci conversazioni sono salvati solo in questo browser. Puoi cancellare i riassunti nella pagina \"Le mie conversazioni passate\" oppure cancellando i dati di questo sito nel browser. Non usiamo cookie, pubblicità né tracciamento."],
      ["Cosa conserva il nostro server", "Per dividere in modo equo i limiti gratuiti giornalieri e impedire abusi, il server conta quanto usa ogni visitatore ogni giorno, collegato a una forma cifrata (hash) del tuo indirizzo internet e al numero anonimo. Questi contatori vengono cancellati automaticamente dopo circa un giorno. La nostra azienda di hosting può conservare registri tecnici per poco tempo."],
      ["Dove vanno i tuoi dati", "Il sito è ospitato da Render a Francoforte, in Germania. Groq e Tavily possono trattare i dati fuori dall'Unione Europea, anche negli Stati Uniti, con le proprie garanzie per i trasferimenti internazionali. Puoi leggere le loro informative qui:"],
      ["Perché li trattiamo", "Solo per offrirti la conversazione che avvii (articolo 6, paragrafo 1, lettera b del GDPR) e per mantenere il servizio gratuito sicuro ed equo (articolo 6, paragrafo 1, lettera f del GDPR). Poiché il servizio è pensato per persone cieche e ipovedenti, usarlo può rivelare informazioni sulla tua salute. Avviando una conversazione acconsenti a questo trattamento (articolo 9, paragrafo 2, lettera a del GDPR). Puoi fermarti in qualsiasi momento terminando la conversazione."],
      ["I tuoi diritti", "Hai il diritto di accedere ai tuoi dati, correggerli e cancellarli, di limitarne il trattamento o di opporti, e di presentare reclamo al Garante per la protezione dei dati personali. La maggior parte dei tuoi dati resta nel tuo browser, sotto il tuo controllo."],
      ["Intelligenza artificiale", "L'assistente è un'intelligenza artificiale, non una persona. Può sbagliare: verifica le informazioni importanti, soprattutto su salute, denaro o sicurezza."],
    ],
    updated: "Ultimo aggiornamento:",
    back: "Torna alla pagina della conversazione",
  },
  fr: {
    title: "Politique de confidentialité – Parler avec l'intelligence artificielle",
    h1: "Politique de confidentialité",
    sections: [
      ["Qui est responsable", "Ce site est géré par {owner}. Contact : {email}."],
      ["Ce qui arrive à votre voix", "Pendant que vous parlez, votre voix est enregistrée et envoyée à Groq, une entreprise d'intelligence artificielle, qui la transforme en texte, rédige la réponse et, en anglais, produit la voix parlée. Dans les autres langues, la voix est celle de votre appareil. Notre serveur n'enregistre ni les enregistrements, ni les transcriptions, ni les réponses."],
      ["Recherches sur le web", "Quand l'assistant a besoin d'informations récentes, il envoie un court texte de recherche, jamais votre voix, à Tavily, une entreprise de recherche, ou à Groq."],
      ["Ce qui est enregistré sur votre appareil", "Votre choix de langue, un numéro anonyme aléatoire et de courts résumés de vos dix dernières conversations sont enregistrés uniquement dans ce navigateur. Vous pouvez supprimer les résumés sur la page « Mes conversations précédentes » ou en effaçant les données de ce site dans votre navigateur. Nous n'utilisons ni cookies, ni publicité, ni pistage."],
      ["Ce que notre serveur conserve", "Pour partager équitablement les limites gratuites quotidiennes et empêcher les abus, le serveur compte l'utilisation de chaque visiteur par jour, liée à une forme brouillée (hachée) de votre adresse internet et au numéro anonyme. Ces compteurs sont supprimés automatiquement après environ un jour. Notre hébergeur peut conserver des journaux techniques pendant une courte durée."],
      ["Où vont vos données", "Le site est hébergé par Render à Francfort, en Allemagne. Groq et Tavily peuvent traiter des données hors de l'Union européenne, notamment aux États-Unis, avec leurs propres garanties pour les transferts internationaux. Vous pouvez lire leurs politiques de confidentialité ici :"],
      ["Pourquoi nous les traitons", "Uniquement pour vous offrir la conversation que vous lancez (article 6, paragraphe 1, point b du RGPD) et pour garder le service gratuit sûr et équitable (article 6, paragraphe 1, point f du RGPD). Comme le service est conçu pour les personnes aveugles et malvoyantes, son utilisation peut révéler des informations sur votre santé. En lançant une conversation, vous acceptez ce traitement (article 9, paragraphe 2, point a du RGPD). Vous pouvez arrêter à tout moment en terminant la conversation."],
      ["Vos droits", "Vous avez le droit d'accéder à vos données, de les corriger et de les supprimer, d'en limiter le traitement ou de vous y opposer, et de déposer une plainte auprès de l'autorité de protection des données de votre pays (en France, la CNIL). La plupart de vos données restent dans votre propre navigateur, sous votre contrôle."],
      ["Intelligence artificielle", "L'assistant est une intelligence artificielle, pas une personne. Il peut se tromper : vérifiez les informations importantes, surtout sur la santé, l'argent ou la sécurité."],
    ],
    updated: "Dernière mise à jour :",
    back: "Retour à la page de conversation",
  },
  bg: {
    title: "Политика за поверителност – Говорете с изкуствен интелект",
    h1: "Политика за поверителност",
    sections: [
      ["Кой отговаря", "Този сайт се управлява от {owner}. Контакт: {email}."],
      ["Какво се случва с гласа ви", "Докато говорите, гласът ви се записва и се изпраща на Groq, компания за изкуствен интелект, която го превръща в текст, съставя отговора и на английски език създава говоримия глас. На другите езици гласът идва от вашето устройство. Нашият сървър не запазва записи, преписи или отговори."],
      ["Търсене в интернет", "Когато асистентът се нуждае от актуална информация, той изпраща кратък текст за търсене, никога гласа ви, на Tavily, компания за търсене, или на Groq."],
      ["Какво се запазва на вашето устройство", "Избраният език, случаен анонимен номер и кратки обобщения на последните ви десет разговора се запазват само в този браузър. Можете да изтриете обобщенията на страницата „Моите предишни разговори“ или като изчистите данните на този сайт в браузъра. Не използваме бисквитки, реклами или проследяване."],
      ["Какво пази нашият сървър", "За да се разпределят честно безплатните дневни лимити и да се предотвратят злоупотреби, сървърът брои колко използва всеки посетител на ден, свързано с кодирана (хеширана) форма на интернет адреса ви и анонимния номер. Тези броячи се изтриват автоматично след около един ден. Хостинг компанията ни може да пази технически записи за кратко време."],
      ["Къде отиват данните ви", "Сайтът се хоства от Render във Франкфурт, Германия. Groq и Tavily може да обработват данни извън Европейския съюз, включително в САЩ, със собствени гаранции за международно предаване. Можете да прочетете техните политики за поверителност тук:"],
      ["Защо ги обработваме", "Само за да ви предоставим разговора, който започвате (член 6, параграф 1, буква „б“ от ОРЗД), и за да поддържаме безплатната услуга сигурна и справедлива (член 6, параграф 1, буква „е“ от ОРЗД). Тъй като услугата е създадена за слепи и слабовиждащи хора, използването ѝ може да разкрие информация за здравето ви. Като започнете разговор, вие се съгласявате с тази обработка (член 9, параграф 2, буква „а“ от ОРЗД). Можете да спрете по всяко време, като приключите разговора."],
      ["Вашите права", "Имате право на достъп до данните си, на тяхното коригиране и изтриване, на ограничаване на обработката или възражение срещу нея, както и да подадете жалба до Комисията за защита на личните данни. Повечето от данните ви остават във вашия браузър, под ваш контрол."],
      ["Изкуствен интелект", "Асистентът е изкуствен интелект, а не човек. Може да греши: проверявайте важната информация, особено за здраве, пари или безопасност."],
    ],
    updated: "Последна актуализация:",
    back: "Обратно към страницата за разговор",
  },
  ru: {
    title: "Политика конфиденциальности – Поговорите с искусственным интеллектом",
    h1: "Политика конфиденциальности",
    sections: [
      ["Кто отвечает", "Этим сайтом управляет {owner}. Контакт: {email}."],
      ["Что происходит с вашим голосом", "Пока вы говорите, ваш голос записывается и отправляется в Groq, компанию в области искусственного интеллекта, которая превращает его в текст, составляет ответ и на английском языке создаёт голос. На других языках используется голос вашего устройства. Наш сервер не сохраняет записи, расшифровки и ответы."],
      ["Поиск в интернете", "Когда ассистенту нужна актуальная информация, он отправляет короткий поисковый запрос, никогда не ваш голос, в Tavily, поисковую компанию, или в Groq."],
      ["Что хранится на вашем устройстве", "Выбранный язык, случайный анонимный номер и краткие пересказы ваших последних десяти разговоров хранятся только в этом браузере. Вы можете удалить их на странице «Мои прошлые разговоры» или очистив данные этого сайта в браузере. Мы не используем файлы cookie, рекламу и отслеживание."],
      ["Что хранит наш сервер", "Чтобы честно распределять бесплатные дневные лимиты и предотвращать злоупотребления, сервер считает, сколько использует каждый посетитель за день, по зашифрованной (хешированной) форме вашего интернет-адреса и анонимному номеру. Эти счётчики удаляются автоматически примерно через сутки. Наш хостинг-провайдер может недолго хранить технические журналы."],
      ["Куда передаются данные", "Сайт размещён у Render во Франкфурте, Германия. Groq и Tavily могут обрабатывать данные за пределами Европейского союза, в том числе в США, со своими гарантиями для международной передачи данных. Их политики конфиденциальности:"],
      ["Зачем мы их обрабатываем", "Только чтобы провести разговор, который вы начинаете (статья 6(1)(b) GDPR), и чтобы бесплатный сервис оставался безопасным и честным (статья 6(1)(f) GDPR). Поскольку сервис создан для незрячих и слабовидящих людей, его использование может раскрыть сведения о вашем здоровье. Начиная разговор, вы соглашаетесь на такую обработку (статья 9(2)(a) GDPR). Вы можете остановиться в любой момент, завершив разговор."],
      ["Ваши права", "Вы имеете право на доступ к своим данным, их исправление и удаление, на ограничение обработки или возражение против неё, а также право подать жалобу в орган по защите данных вашей страны (в Италии — Garante per la protezione dei dati personali). Большая часть ваших данных остаётся в вашем браузере, под вашим контролем."],
      ["Искусственный интеллект", "Ассистент — это искусственный интеллект, а не человек. Он может ошибаться: проверяйте важную информацию, особенно о здоровье, деньгах и безопасности."],
    ],
    updated: "Последнее обновление:",
    back: "Вернуться на страницу разговора",
  },
  zh: {
    title: "隐私声明 – 与人工智能对话",
    h1: "隐私声明",
    sections: [
      ["谁负责", "本网站由 {owner} 运营。联系方式：{email}。"],
      ["您的声音会怎样处理", "您说话时，您的声音会被录下并发送给人工智能公司 Groq，由它转成文字、生成回答，并在英语时生成语音。其他语言使用您设备自带的声音。我们的服务器不保存录音、文字记录或回答。"],
      ["网络搜索", "当助手需要最新信息时，它会把一段简短的搜索文字（绝不是您的声音）发送给搜索公司 Tavily 或 Groq。"],
      ["您的设备上保存了什么", "您选择的语言、一个随机的匿名编号，以及最近十次对话的简短摘要只保存在这个浏览器中。您可以在“我以前的对话”页面删除摘要，或在浏览器中清除本网站的数据。我们不使用 Cookie、广告或跟踪。"],
      ["我们的服务器保存什么", "为了公平分配每天的免费额度并防止滥用，服务器会统计每位访问者每天的使用量，并与您网络地址的加密（哈希）形式和匿名编号关联。这些计数大约一天后会自动删除。我们的托管公司可能会短期保存技术日志。"],
      ["您的数据去哪里", "本网站由 Render 托管在德国法兰克福。Groq 和 Tavily 可能在欧盟以外（包括美国）处理数据，并采用其自身的国际传输保障措施。您可以在这里阅读它们的隐私政策："],
      ["我们为什么处理这些数据", "仅为了提供您发起的对话（GDPR 第 6 条第 1 款 b 项），并保持免费服务安全、公平（GDPR 第 6 条第 1 款 f 项）。由于本服务是为盲人和视障人士设计的，使用它可能会透露与您健康有关的信息。开始对话即表示您同意这种处理（GDPR 第 9 条第 2 款 a 项）。您可以随时结束对话来停止。"],
      ["您的权利", "您有权访问、更正和删除您的数据，有权限制或反对处理，并有权向您所在国家的数据保护机构投诉（例如意大利的 Garante per la protezione dei dati personali）。您的大部分数据都保存在您自己的浏览器中，由您掌控。"],
      ["人工智能", "助手是人工智能，不是真人。它可能出错：请核实重要信息，尤其是关于健康、金钱或安全的信息。"],
    ],
    updated: "最后更新：",
    back: "返回对话页面",
  },
};

const ACCESSIBILITY = {
  en: {
    title: "Accessibility statement – Talk with Artificial Intelligence",
    h1: "Accessibility statement",
    sections: [
      ["Our goal", "This website is made to be used entirely by voice and with screen readers. We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA and the European standard EN 301 549."],
      ["How to use it", "The page has one heading and one large button. Press it and speak. After each answer a short tone tells you it is your turn. To interrupt the assistant, press the button or the space bar, and press it again when you have finished speaking. To end the conversation, say goodbye, or press the button while nobody is speaking."],
      ["Supported screen readers and devices", "It is designed for JAWS, NVDA and Narrator on Windows, VoiceOver on Mac and iPhone, TalkBack on Android and Orca on Linux, with current versions of Chrome, Edge, Firefox and Safari. No headphones and no special settings are needed."],
      ["Known limitations", "In English the assistant uses a natural AI voice. In other languages it uses the best voice installed on your device: Microsoft Edge on Windows, iPhones and Android phones usually have natural voices for all six languages. You cannot interrupt the assistant by speaking; press the button instead."],
      ["Feedback", "If something does not work for you, please write to {email}. Every message is read."],
    ],
    updated: "Last updated:",
    back: "Back to the conversation page",
  },
  it: {
    title: "Dichiarazione di accessibilità – Parla con l'Intelligenza Artificiale",
    h1: "Dichiarazione di accessibilità",
    sections: [
      ["Il nostro obiettivo", "Questo sito è fatto per essere usato interamente con la voce e con i lettori di schermo. Puntiamo a rispettare le Linee guida per l'accessibilità dei contenuti web (WCAG) 2.2 al livello AA e la norma europea EN 301 549."],
      ["Come si usa", "La pagina ha un titolo e un grande pulsante. Premilo e parla. Dopo ogni risposta un breve suono ti dice che è il tuo turno. Per interrompere l'assistente, premi il pulsante o la barra spaziatrice, e premilo di nuovo quando hai finito di parlare. Per terminare la conversazione, di' arrivederci, oppure premi il pulsante quando nessuno sta parlando."],
      ["Lettori di schermo e dispositivi supportati", "È pensato per JAWS, NVDA e Assistente vocale su Windows, VoiceOver su Mac e iPhone, TalkBack su Android e Orca su Linux, con le versioni attuali di Chrome, Edge, Firefox e Safari. Non servono cuffie né impostazioni speciali."],
      ["Limiti noti", "In inglese l'assistente usa una voce naturale generata dall'intelligenza artificiale. Nelle altre lingue usa la migliore voce installata sul tuo dispositivo: Microsoft Edge su Windows, gli iPhone e i telefoni Android di solito hanno voci naturali per tutte e sei le lingue. Non puoi interrompere l'assistente parlando; premi invece il pulsante."],
      ["Segnalazioni", "Se qualcosa non funziona per te, scrivi a {email}. Leggiamo ogni messaggio."],
    ],
    updated: "Ultimo aggiornamento:",
    back: "Torna alla pagina della conversazione",
  },
  fr: {
    title: "Déclaration d'accessibilité – Parler avec l'intelligence artificielle",
    h1: "Déclaration d'accessibilité",
    sections: [
      ["Notre objectif", "Ce site est conçu pour être utilisé entièrement à la voix et avec les lecteurs d'écran. Nous visons le respect des Règles pour l'accessibilité des contenus web (WCAG) 2.2 au niveau AA et de la norme européenne EN 301 549."],
      ["Comment l'utiliser", "La page contient un titre et un grand bouton. Appuyez dessus et parlez. Après chaque réponse, un petit son vous indique que c'est à vous. Pour interrompre l'assistant, appuyez sur le bouton ou sur la barre d'espace, puis appuyez de nouveau quand vous avez fini de parler. Pour terminer la conversation, dites au revoir, ou appuyez sur le bouton quand personne ne parle."],
      ["Lecteurs d'écran et appareils pris en charge", "Il est conçu pour JAWS, NVDA et le Narrateur sous Windows, VoiceOver sur Mac et iPhone, TalkBack sur Android et Orca sous Linux, avec les versions actuelles de Chrome, Edge, Firefox et Safari. Aucun casque ni réglage particulier n'est nécessaire."],
      ["Limites connues", "En anglais, l'assistant utilise une voix naturelle générée par intelligence artificielle. Dans les autres langues, il utilise la meilleure voix installée sur votre appareil : Microsoft Edge sous Windows, les iPhone et les téléphones Android ont généralement des voix naturelles pour les six langues. Vous ne pouvez pas interrompre l'assistant en parlant ; appuyez plutôt sur le bouton."],
      ["Vos retours", "Si quelque chose ne fonctionne pas pour vous, écrivez à {email}. Chaque message est lu."],
    ],
    updated: "Dernière mise à jour :",
    back: "Retour à la page de conversation",
  },
  bg: {
    title: "Декларация за достъпност – Говорете с изкуствен интелект",
    h1: "Декларация за достъпност",
    sections: [
      ["Нашата цел", "Този сайт е създаден да се използва изцяло с глас и с екранни четци. Стремим се да отговаряме на Указанията за достъпност на уеб съдържанието (WCAG) 2.2 на ниво AA и на европейския стандарт EN 301 549."],
      ["Как се използва", "Страницата има едно заглавие и един голям бутон. Натиснете го и говорете. След всеки отговор кратък сигнал ви казва, че е ваш ред. За да прекъснете асистента, натиснете бутона или интервала, и натиснете отново, когато приключите да говорите. За да приключите разговора, кажете довиждане или натиснете бутона, когато никой не говори."],
      ["Поддържани екранни четци и устройства", "Създаден е за JAWS, NVDA и Разказвач в Windows, VoiceOver на Mac и iPhone, TalkBack на Android и Orca в Linux, с актуалните версии на Chrome, Edge, Firefox и Safari. Не са нужни слушалки или специални настройки."],
      ["Известни ограничения", "На английски асистентът използва естествен глас, създаден от изкуствен интелект. На другите езици използва най-добрия глас, инсталиран на устройството ви: Microsoft Edge в Windows, iPhone и телефоните с Android обикновено имат естествени гласове и за шестте езика. Не можете да прекъснете асистента с говорене; натиснете бутона."],
      ["Обратна връзка", "Ако нещо не работи за вас, пишете на {email}. Четем всяко съобщение."],
    ],
    updated: "Последна актуализация:",
    back: "Обратно към страницата за разговор",
  },
  ru: {
    title: "Заявление о доступности – Поговорите с искусственным интеллектом",
    h1: "Заявление о доступности",
    sections: [
      ["Наша цель", "Этот сайт сделан так, чтобы им можно было пользоваться полностью голосом и с программами экранного доступа. Мы стремимся соответствовать Руководству по доступности веб-контента (WCAG) 2.2 на уровне AA и европейскому стандарту EN 301 549."],
      ["Как пользоваться", "На странице один заголовок и одна большая кнопка. Нажмите её и говорите. После каждого ответа короткий сигнал сообщает, что теперь ваша очередь. Чтобы перебить ассистента, нажмите кнопку или пробел, а когда закончите говорить, нажмите ещё раз. Чтобы завершить разговор, скажите «до свидания» или нажмите кнопку, когда никто не говорит."],
      ["Поддерживаемые программы и устройства", "Сайт рассчитан на JAWS, NVDA и Экранный диктор в Windows, VoiceOver на Mac и iPhone, TalkBack на Android и Orca в Linux, в текущих версиях Chrome, Edge, Firefox и Safari. Наушники и особые настройки не нужны."],
      ["Известные ограничения", "На английском ассистент использует естественный голос, созданный искусственным интеллектом. На других языках используется лучший голос, установленный на вашем устройстве: в Microsoft Edge на Windows, на iPhone и телефонах Android обычно есть естественные голоса для всех шести языков. Перебить ассистента голосом нельзя — нажмите кнопку."],
      ["Обратная связь", "Если что-то у вас не работает, напишите на {email}. Мы читаем каждое сообщение."],
    ],
    updated: "Последнее обновление:",
    back: "Вернуться на страницу разговора",
  },
  zh: {
    title: "无障碍声明 – 与人工智能对话",
    h1: "无障碍声明",
    sections: [
      ["我们的目标", "本网站可以完全通过语音和读屏软件使用。我们的目标是符合《网页内容无障碍指南》（WCAG）2.2 AA 级和欧洲标准 EN 301 549。"],
      ["如何使用", "页面上有一个标题和一个大按钮。按下按钮后说话。每次回答后，一声短提示音表示轮到您说话。想打断助手时，请按按钮或空格键，说完后再按一次。要结束对话，请说“再见”，或在没有人说话时按下按钮。"],
      ["支持的读屏软件和设备", "本网站适用于 Windows 上的 JAWS、NVDA 和讲述人，Mac 和 iPhone 上的 VoiceOver，Android 上的 TalkBack，以及 Linux 上的 Orca，并支持最新版本的 Chrome、Edge、Firefox 和 Safari。不需要耳机，也不需要特别设置。"],
      ["已知限制", "英语使用人工智能生成的自然语音。其他语言使用您设备上安装的最佳语音：Windows 上的 Microsoft Edge、iPhone 和 Android 手机通常都有六种语言的自然语音。您不能通过说话打断助手，请按按钮。"],
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
];

module.exports = { PRIVACY, ACCESSIBILITY, POLICY_LINKS, UPDATED };
