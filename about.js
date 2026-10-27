// Server-rendered project and organization pages. No microphone or client code.
const I18N = require("./public/i18n.js");
const CONTACT = { email: "brambillafabrice@gmail.com", phone: "+41 78 335 15 72", tel: "+41783351572" };
const PAGES = {
  en: {
    organizationsTitle: "Pilots and collaboration", generalContactTitle: "Get in touch", generalContact: "Questions about the project? Email or call me.",
    title: "About Talk with AI", intro: "I'm 17 and a high school student in Switzerland. I'd like to study engineering.",
    storyTitle: "Why I built this", story: "My aunt was born blind and uses JAWS. She found mainstream AI tools difficult to use, especially for researching things online. I started this project to make that simpler.",
    missionTitle: "Ask by voice. Explore the web.", mission: "Talk with AI is a free voice assistant for questions and web research. You speak, listen to the answer, and ask another question. I'm building it for people who use screen readers, including JAWS and NVDA.",
    pilotsTitle: "Current pilots", pilotCountry: "Italy",
    contactTitle: "For organizations", contact: "If your organization supports people who use screen readers, I'd love to discuss a free pilot or collaboration and improve the app together. Email or call me to arrange a short conversation.", emailLabel: "Email", phoneLabel: "Phone"
  },
  it: {
    organizationsTitle: "Sperimentazioni e collaborazioni", generalContactTitle: "Contatti", generalContact: "Per domande sul progetto, scrivetemi o chiamatemi.",
    title: "Il progetto Talk with AI", intro: "Ho 17 anni e frequento una scuola superiore in Svizzera. Vorrei studiare ingegneria.",
    storyTitle: "Perché ho creato questo progetto", story: "Mia zia è cieca dalla nascita e usa JAWS. Trovava difficili da usare i principali strumenti di intelligenza artificiale, soprattutto per fare ricerche online. Ho iniziato questo progetto per rendere tutto più semplice.",
    missionTitle: "Chiedi a voce. Esplora il web.", mission: "Talk with AI è un assistente vocale gratuito per fare domande e ricerche sul web. Parli, ascolti la risposta e fai un'altra domanda. Lo sto sviluppando per chi usa un lettore di schermo, come JAWS o NVDA.",
    pilotsTitle: "Sperimentazioni in corso", pilotCountry: "Italia",
    contactTitle: "Per le organizzazioni", contact: "Se la vostra organizzazione affianca persone che usano lettori di schermo, mi piacerebbe discutere una sperimentazione gratuita o una collaborazione e migliorare il sito insieme. Scrivetemi o chiamatemi per un breve confronto.", emailLabel: "Email", phoneLabel: "Telefono"
  },
  fr: {
    organizationsTitle: "Essais pilotes et collaboration", generalContactTitle: "Me contacter", generalContact: "Pour toute question sur le projet, écrivez-moi ou appelez-moi.",
    title: "À propos de Talk with AI", intro: "J'ai 17 ans et je suis lycéen en Suisse. J'aimerais étudier l'ingénierie.",
    storyTitle: "Pourquoi ce projet", story: "Ma tante est aveugle de naissance et utilise JAWS. Elle trouvait les principaux outils d'IA difficiles à utiliser, surtout pour faire des recherches en ligne. J'ai commencé ce projet pour lui simplifier la tâche.",
    missionTitle: "Posez vos questions à voix haute. Explorez le web.", mission: "Talk with AI est un assistant vocal gratuit pour poser des questions et faire des recherches sur le web. Vous parlez, écoutez la réponse, puis posez une autre question. Je le développe pour les personnes qui utilisent un lecteur d'écran, notamment JAWS et NVDA.",
    pilotsTitle: "Essais pilotes en cours", pilotCountry: "Italie",
    contactTitle: "Pour les organisations", contact: "Si votre organisation accompagne des personnes utilisant un lecteur d'écran, j'aimerais discuter d'un essai gratuit ou d'une collaboration pour améliorer le site ensemble. Écrivez-moi ou appelez-moi pour convenir d'un court échange.", emailLabel: "E-mail", phoneLabel: "Téléphone"
  },
  bg: {
    organizationsTitle: "Пилотни изпитвания и сътрудничество", generalContactTitle: "Свържете се с мен", generalContact: "Ако имате въпроси за проекта, пишете ми или се обадете.",
    title: "За Talk with AI", intro: "На 17 години съм и уча в гимназия в Швейцария. Бих искал да уча инженерство.",
    storyTitle: "Защо създадох този проект", story: "Леля ми е незряща по рождение и използва JAWS. За нея популярните инструменти с изкуствен интелект бяха трудни за използване, особено за проучване в интернет. Започнах този проект, за да улесня това.",
    missionTitle: "Питайте с глас. Проучвайте в интернет.", mission: "Talk with AI е безплатен гласов асистент за въпроси и проучване в интернет. Говорите, слушате отговора и задавате следващ въпрос. Разработвам го за хора, които използват екранни четци, включително JAWS и NVDA.",
    pilotsTitle: "Текущи пилотни изпитвания", pilotCountry: "Италия",
    contactTitle: "За организациите", contact: "Ако вашата организация подкрепя хора, които използват екранни четци, бих се радвал да обсъдим безплатно пилотно изпитване или сътрудничество и да подобрим приложението заедно. Пишете ми или се обадете за кратък разговор.", emailLabel: "Имейл", phoneLabel: "Телефон"
  },
  ru: {
    organizationsTitle: "Пилотные проекты и сотрудничество", generalContactTitle: "Связаться со мной", generalContact: "Если у вас есть вопросы о проекте, напишите мне или позвоните.",
    title: "О проекте Talk with AI", intro: "Мне 17 лет, я учусь в старшей школе в Швейцарии. Я хотел бы изучать инженерное дело.",
    storyTitle: "Почему я создал этот проект", story: "Моя тётя незрячая с рождения и пользуется JAWS. Ей было трудно пользоваться популярными инструментами ИИ, особенно для поиска информации в интернете. Я начал этот проект, чтобы упростить эту задачу.",
    missionTitle: "Задавайте вопросы голосом. Исследуйте интернет.", mission: "Talk with AI: бесплатный голосовой помощник для вопросов и поиска информации в интернете. Вы говорите, слушаете ответ и задаёте следующий вопрос. Я разрабатываю его для пользователей программ экранного доступа, включая JAWS и NVDA.",
    pilotsTitle: "Текущие пилотные проекты", pilotCountry: "Италия",
    contactTitle: "Для организаций", contact: "Если ваша организация поддерживает пользователей программ экранного доступа, я буду рад обсудить бесплатное пилотное тестирование или сотрудничество и вместе улучшить приложение. Напишите мне или позвоните, чтобы договориться о коротком разговоре.", emailLabel: "Эл. почта", phoneLabel: "Телефон"
  },
  zh: {
    organizationsTitle: "试点与合作", generalContactTitle: "联系我", generalContact: "如果您对项目有任何问题，欢迎发邮件或打电话联系我。",
    title: "关于 Talk with AI", intro: "我今年17岁，在瑞士读高中。我希望将来学习工程。",
    storyTitle: "我为什么创建这个项目", story: "我的阿姨天生失明，使用 JAWS。她觉得主流人工智能工具很难使用，尤其是在网上查找资料时。我开始这个项目，就是想让这些事情变得简单一些。",
    missionTitle: "用语音提问，探索网络。", mission: "Talk with AI 是一个免费的语音助手，可用于提问和网上查找资料。您说出问题，听取回答，然后继续提问。我正在为使用 JAWS、NVDA 等屏幕阅读器的人开发它。",
    pilotsTitle: "当前试点", pilotCountry: "意大利",
    contactTitle: "面向机构", contact: "如果您的机构为屏幕阅读器使用者提供支持，我很希望与您讨论免费试用或合作，一起改进这个应用。欢迎发邮件或打电话，安排一次简短交流。", emailLabel: "电子邮件", phoneLabel: "电话"
  }
};

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function render(lang) {
  lang = I18N.LANGS.includes(lang) ? lang : "en";
  const p = PAGES[lang], e = escapeHtml;
  return `<!doctype html>
<html lang="${I18N.META[lang].html}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${e(p.title)}</title>
  <link rel="icon" href="data:,">
  <link rel="stylesheet" href="/style.css">
</head>
<body class="about-page">
  <main class="about">
    <a class="about-back" href="/?lang=${lang}">${e(I18N.t(lang, "back"))}</a>
    <header class="about-profile">
      <img class="profile-photo" src="/images/fabrice-brambilla.png" width="130" height="130" alt="Fabrice Brambilla">
      <div>
        <p class="about-label">${e(p.title)}</p>
        <h1>Fabrice Brambilla</h1>
        <p class="profile-intro">${e(p.intro)}</p>
      </div>
    </header>
    <section class="about-section">
      <h2>${e(p.storyTitle)}</h2>
      <p>${e(p.story)}</p>
    </section>
    <section class="about-section">
      <h2>${e(p.missionTitle)}</h2>
      <p>${e(p.mission)}</p>
    </section>
    <section class="about-section contact-section">
      <h2>${e(p.generalContactTitle)}</h2>
      <p>${e(p.generalContact)}</p>
      <address class="contact-links">
        <a href="mailto:${CONTACT.email}"><span>${e(p.emailLabel)}</span>${CONTACT.email}</a>
        <a href="tel:${CONTACT.tel}"><span>${e(p.phoneLabel)}</span>${CONTACT.phone}</a>
      </address>
    </section>
  </main>
  <footer>
    <a href="/organizations?lang=${lang}">${e(p.organizationsTitle)}</a>
    <a href="/privacy?lang=${lang}">${e(I18N.t(lang, "privacyLink"))}</a>
    <a href="/accessibility?lang=${lang}">${e(I18N.t(lang, "accessibilityLink"))}</a>
  </footer>
</body>
</html>`;
}
function renderOrganizations(lang) {
  lang = I18N.LANGS.includes(lang) ? lang : "en";
  const p = PAGES[lang], e = escapeHtml;
  return `<!doctype html>
<html lang="${I18N.META[lang].html}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${e(p.organizationsTitle)} | Talk with AI</title>
  <link rel="icon" href="data:,">
  <link rel="stylesheet" href="/style.css">
</head>
<body class="about-page">
  <main class="about">
    <a class="about-back" href="/about?lang=${lang}">${e(p.title)}</a>
    <header class="about-profile">
      <h1>${e(p.organizationsTitle)}</h1>
    </header>
    <section class="about-section pilot-list-section">
      <h2>${e(p.pilotsTitle)}</h2>
      <ul><li><a href="https://uicite.it/" lang="it">UICI Teramo</a>, ${e(p.pilotCountry)}</li></ul>
    </section>
    <section class="about-section contact-section">
      <h2>${e(p.contactTitle)}</h2>
      <p>${e(p.contact)}</p>
      <address class="contact-links">
        <a href="mailto:${CONTACT.email}"><span>${e(p.emailLabel)}</span>${CONTACT.email}</a>
        <a href="tel:${CONTACT.tel}"><span>${e(p.phoneLabel)}</span>${CONTACT.phone}</a>
      </address>
    </section>
  </main>
  <footer>
    <a href="/?lang=${lang}">${e(I18N.t(lang, "back"))}</a>
    <a href="/privacy?lang=${lang}">${e(I18N.t(lang, "privacyLink"))}</a>
    <a href="/accessibility?lang=${lang}">${e(I18N.t(lang, "accessibilityLink"))}</a>
  </footer>
</body>
</html>`;
}
module.exports = { PAGES, CONTACT, render, renderOrganizations };
