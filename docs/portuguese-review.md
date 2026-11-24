# Portuguese (Portugal) review: Talk with AI

Prepared on 2026-11-19 for a native speaker of **European Portuguese (pt-PT)** (for example someone at ACAPO Viseu) and for the owner.
Portuguese is **switched off** on the live site. Section 5 covers the Brazilian version, which is also off. Nothing here is "fixed": everything is *implemented, awaiting real-user confirmation*.
The texts below were written by an AI. No native speaker has read them yet.

The lists are generated from the site's own source files (`public/i18n.js`, `public/app.js`, `legal.js`, `about.js`). If a text is changed, change it in those files, not only here.

## For the reviewer: what to check

Talk with AI is a free voice assistant for blind and visually impaired people who use a screen reader. You press a button, speak, and the assistant answers aloud. Most texts below are **spoken aloud** by a synthetic voice or a screen reader, so please read them aloud too.

Please check each text for:

1. **Portugal, not Brazil.** Vocabulary, spelling and grammar should be what a person in Portugal uses. For example "ecrã", "telemóvel", "ficheiro", "descarregar", "utilizador", "contacto", "está a fazer" (not "está fazendo"), "diga-me" (not "me diga"). Spelling follows the 1990 Orthographic Agreement as used in Portugal ("ação", "atual", "objetivo").
2. **Natural speech.** Would a person in Portugal say it like this? Short sentences are better than long ones. Mark anything that sounds translated.
3. **Politeness.** The site addresses the user formally without "você" ("Prima…", "Pode dizer…", "aceita"). The spoken commands that the *user* says are in the familiar form ("repete", "mostra a última resposta") and also in the polite form ("repita", "mostre"). Is that mix acceptable? Is any text too cold or too familiar for an older blind user?
4. **Clear for a screen-reader user.** No text should depend on seeing the screen. Names of keys and buttons must match what the user hears: the buttons are "Iniciar conversa", "Falar", "Terminar conversa", "Língua", "Mudar de microfone", "Mostrar a última resposta", "Copiar".
5. **Spoken commands.** Would people in Portugal say these to ask for the same thing? What other ways would they say it? (Section "Spoken commands" below.) Note: "tchau" is mainly Brazilian; it is kept only so that it is still understood.
6. **Browser names.** In the microphone guide, the English button names of Chrome ("Allow while visiting the site") are quoted because Chrome may show them in English. Please check what Chrome and Firefox actually show in Portuguese (Portugal) on your computer and phone.

How to send corrections: write the key name (in bold below) and the new text, by e-mail to the owner. A short list is fine.

## 1. What the assistant says and what is on the page

Each item shows the Portuguese text, then the English original for reference.

### Spoken when a conversation starts and during it

- **greeting**: Prima a barra de espaços para falar e outra vez para enviar. Prima-a enquanto eu falo para me interromper. Diga adeus para terminar, ou ajuda para ouvir as instruções.  
  _English:_ Press Space to talk, and again to send. Press it while I’m speaking to interrupt. Say goodbye to finish, or help for instructions.
- **greetingTouch**: Prima Falar para falar e outra vez para enviar. Prima enquanto eu falo para me interromper. Diga adeus para terminar, ou ajuda para ouvir as instruções. Num telemóvel, os auscultadores podem ajudar a evitar que as vozes do leitor de ecrã e do assistente se sobreponham.  
  _English:_ Press Talk to speak, and again to send. Press it while I’m speaking to interrupt. Say goodbye to finish, or help for instructions. On a phone, headphones can help keep the screen reader and assistant audio from overlapping.
- **greetingShort**: Olá de novo. Prima a barra de espaços para falar.  
  _English:_ Welcome back. Press Space to talk.
- **greetingShortTouch**: Olá de novo. Prima Falar para falar.  
  _English:_ Welcome back. Press Talk to speak.
- **phoneHeadphones**: Num telemóvel, os auscultadores podem ajudar a evitar que as vozes do leitor de ecrã e do assistente se sobreponham.  
  _English:_ On a phone, headphones can help keep the screen reader and assistant audio from overlapping.
- **aiDisclosure**: Sou um assistente de inteligência artificial.  
  _English:_ I'm an AI assistant.
- **agreeSpoken**: Ao iniciar, aceita a política de privacidade e os termos; a sua voz e o texto vão para serviços externos.  
  _English:_ By starting, you agree to the privacy policy and terms; your voice and text go to outside services.
- **searching**: Vou procurar.  
  _English:_ Let me look that up.
- **notHeard**: Não ouvi nada. Prima a barra de espaços quando quiser falar.  
  _English:_ I didn't hear anything. Press the space bar when you want to talk.
- **notHeardTouch**: Não ouvi nada. Prima o botão Falar quando quiser falar.  
  _English:_ I didn't hear anything. Press the Talk button when you want to talk.
- **langChanged**: Está bem, vou falar português de Portugal.  
  _English:_ OK, I'll speak English.
- **askLanguage**: Que língua quer usar? Diga-a depois do sinal.  
  _English:_ Which language would you like to use? Say it after the tone.
- **langNotUnderstood**: Desculpe, não percebi. Diga outra vez o nome da sua língua.  
  _English:_ Sorry, I didn't understand. Please say the name of your language again.
- **farewell**: Adeus!  
  _English:_ Goodbye!

### Spoken help ("ajuda", "repete as instruções")

- **help**: Prima para começar. Depois prima a barra de espaços para falar e outra vez para ouvir a resposta; prima a qualquer momento para interromper. Para terminar, diga adeus.  
  _English:_ Press to start. Then press Space to talk, and again to get the answer; press it any time to interrupt. To end, say goodbye.
- **helpTouch**: Prima para começar. Depois prima Falar para falar e outra vez para ouvir a resposta; prima a qualquer momento para interromper. Para terminar, diga adeus.  
  _English:_ Press to start. Then press Talk to talk, and again to get the answer; press it any time to interrupt. To end, say goodbye.
- **voiceHelp**: Pode dizer: repete, mudar de língua, mostra a última resposta, mudar de microfone, ou adeus.  
  _English:_ You can say: repeat, change language, show the last answer, change microphone, or goodbye.
- **voiceHelpTouch**: Pode dizer: repete, mudar de língua, mostra a última resposta, mudar de microfone, ou adeus. Num telemóvel, os auscultadores podem ajudar a evitar que as vozes do leitor de ecrã e do assistente se sobreponham.  
  _English:_ You can say: repeat, change language, show the last answer, change microphone, or goodbye. On a phone, headphones can help keep the screen reader and assistant audio from overlapping.
- **shortcutHelp**: Com o NVDA ou o JAWS, prima B para encontrar o botão e depois Espaço ou Enter. Alt+Shift+T também aciona Falar a partir de qualquer ponto desta página, se o navegador e o leitor de ecrã deixarem passar o atalho.  
  _English:_ With NVDA or JAWS, press B to find the button, then Space or Enter. Alt+Shift+T also controls Talk from anywhere on this page, if your browser and screen reader pass the shortcut through.

### Microphone guide (spoken before the browser asks for the microphone)

- **micGuide**: Para o ouvir, preciso do microfone. O navegador vai agora pedir autorização.  
  _English:_ To hear you, I need the microphone. Your browser will now ask for permission.
- **micChoice**: Escolha Permitir.  
  _English:_ Choose Allow.
- **micChoiceChrome**: Escolha o botão que dá acesso em cada visita ao site. Em inglês chama-se "Allow while visiting the site"; nas versões mais antigas do Chrome, "Allow on every visit". Só desta vez, em inglês "Allow this time", também funciona, mas depois o Chrome volta a perguntar.  
  _English:_ Choose "Allow while visiting the site"; older versions of Chrome call it "Allow on every visit". "Allow this time" also works, but then Chrome asks again later.
- **micChoiceFirefox**: Escolha Permitir. Se ouvir a caixa de verificação "Memorizar esta decisão", em inglês "Remember this decision", marque-a primeiro, para o Firefox não voltar a perguntar.  
  _English:_ Choose Allow. If you hear the checkbox "Remember this decision", tick it first, so Firefox does not ask again.
- **micShort**: O navegador está agora a pedir o microfone. Escolha Permitir.  
  _English:_ The browser now asks for the microphone. Choose Allow.
- **micShortChrome**: O navegador está agora a pedir o microfone. Escolha o botão que dá acesso em cada visita.  
  _English:_ The browser now asks for the microphone. Choose Allow while visiting the site.
- **micShortFirefox**: O navegador está agora a pedir o microfone. Marque Memorizar esta decisão, se aparecer, e depois escolha Permitir.  
  _English:_ The browser now asks for the microphone. Tick Remember this decision if it is shown, then choose Allow.
- **micGuideTouch**: Com um leitor de ecrã tátil, encontre Permitir e toque duas vezes.  
  _English:_ With a touch screen reader, find Allow, then double-tap it.
- **micGuideKeyboard**: No pedido do navegador, use Tab ou Shift+Tab para passar entre as opções, Enter para ativar um botão e Espaço para marcar ou desmarcar uma caixa.  
  _English:_ In the browser prompt, use Tab or Shift+Tab to move between choices, Enter to activate a button, and Space to toggle a checkbox.
- **micFallback**: Não encontro o microfone que usou antes, por isso estou a usar o microfone predefinido.  
  _English:_ I can't find the microphone you used before, so I'm using the default microphone.
- **micNow**: Vou usar agora este microfone:  
  _English:_ I will now use this microphone:
- **micOnlyOne**: Só encontro um microfone, por isso não há nada para mudar.  
  _English:_ I can find only one microphone, so there is nothing to change.

### Errors and limits (spoken once)

- **errMic**: Não consigo usar o microfone. Permita o acesso ao microfone para este site e depois prima o botão para tentar de novo.  
  _English:_ I can't use the microphone. Allow microphone access for this site, then press the button to try again.
- **errMicDenied**: O microfone está bloqueado para este site. Para o permitir, abra o botão de informações do site, o ícone do cadeado ao lado do endereço. Com o teclado, vá à barra de endereço e prima Shift+Tab até lá chegar. Depois escolha Microfone e a seguir Permitir. Por fim, prima de novo Iniciar conversa.  
  _English:_ The microphone is blocked for this site. To allow it, open the site information button, the lock icon next to the address. With the keyboard, go to the address bar and press Shift+Tab until you reach it. Then choose Microphone, then Allow. After that, press Start conversation again.
- **errConnection**: Algo correu mal e a ligação perdeu-se. Recarregue a página e tente de novo.  
  _English:_ Something went wrong and the connection was lost. Please reload the page and try again.
- **errLimit**: A inteligência artificial atingiu o limite gratuito de hoje. Tente de novo amanhã.  
  _English:_ The AI has reached its free limit for today. Please try again tomorrow.
- **errSupport**: Este navegador não consegue gravar som. Experimente o Chrome, o Edge, o Firefox ou o Safari.  
  _English:_ This browser can't record audio. Please try Chrome, Edge, Firefox or Safari.
- **errRetry**: Desculpe, algo correu mal. Prima a barra de espaços e diga outra vez.  
  _English:_ Sorry, something went wrong. Please press the space bar and say that again.
- **errRetryTouch**: Desculpe, algo correu mal. Prima o botão Falar e diga outra vez.  
  _English:_ Sorry, something went wrong. Please press the Talk button and say that again.
- **liveInfoUnavailable**: Não consigo confirmar informações atuais neste momento. Tente mais tarde ou consulte uma fonte atualizada.  
  _English:_ I can't verify current information right now. Please try again later or check an up-to-date source.
- **downloadUnavailable**: Não consigo descarregar ficheiros automaticamente neste site. Posso ajudar a encontrar uma fonte e explicar como guardar o ficheiro.  
  _English:_ I can't download files automatically from this site. I can help you find a source and explain how to save it yourself.
- **voiceChangeUnavailable**: Ainda não consigo mudar entre voz masculina e feminina neste site. A voz depende do seu dispositivo e do serviço de voz disponível.  
  _English:_ I can't switch between male and female voices on this site yet. The voice depends on your device and the available speech service.
- **askWeatherPlace**: Que localidade e que país quer dizer? Também pode indicar uma cidade próxima.  
  _English:_ Which town and country do you mean? You can also name a nearby city.

### Last answer as text

- **lastButton**: Mostrar a última resposta  
  _English:_ Show last answer
- **lastHeading**: Última resposta  
  _English:_ Last answer
- **copyButton**: Copiar  
  _English:_ Copy
- **copied**: Copiado.  
  _English:_ Copied.
- **copyFailed**: Não foi possível copiar. Selecione o texto com o teclado e copie-o.  
  _English:_ Could not copy. Select the text with the keyboard and copy it.
- **lastShown**: A última resposta está na página como texto, sob o título Última resposta, com um botão Copiar.  
  _English:_ The last answer is on the page as text, under the heading Last answer, with a Copy button.
- **lastNone**: Ainda não há nenhuma resposta para mostrar.  
  _English:_ There is no answer to show yet.
- **lastHidden**: O texto das respostas está desligado.  
  _English:_ The text of answers is turned off.

### On the page (read by the screen reader)

- **title**: Fale com a Inteligência Artificial – prima o botão para começar  
  _English:_ Talk with Artificial Intelligence – press the button to start
- **h1**: Fale com a Inteligência Artificial  
  _English:_ Talk with Artificial Intelligence
- **start**: Iniciar conversa  
  _English:_ Start conversation
- **end**: Terminar conversa  
  _English:_ End conversation
- **talk**: Falar  
  _English:_ Talk
- **langButton**: Língua: português de Portugal. Mudar de língua  
  _English:_ Language: English. Change language
- **micButton**: Mudar de microfone  
  _English:_ Change microphone
- **agreeBefore**: Ao premir Iniciar, aceita a   
  _English:_ By pressing Start you agree to the 
- **agreePrivacy**: Política de Privacidade  
  _English:_ Privacy Policy
- **agreeAnd**:  e os   
  _English:_  and 
- **agreeTerms**: Termos  
  _English:_ Terms
- **agreeAfter**: .  
  _English:_ .
- **privacyLink**: Aviso de privacidade  
  _English:_ Privacy notice
- **termsLink**: Termos  
  _English:_ Terms
- **accessibilityLink**: Acessibilidade  
  _English:_ Accessibility
- **aboutLink**: Sobre o projeto  
  _English:_ About the project
- **back**: Voltar à página da conversa  
  _English:_ Back to the conversation page

### Spoken commands (the whole sentence must be one of these; "por favor" may be added)

- **Repeat the last answer**: “repete”, “repita”, “podes repetir”, “pode repetir”, “diz outra vez”, “o que disseste”, “diga outra vez”, “outra vez”, “repete isso”, “repita isso”, “podes repetir isso”, “pode repetir isso”, “o que disse”, “o que é que disse”, “o que é que disseste”
- **Hear the instructions**: “repete as instruções”, “ajuda”, “o que posso dizer”, “instruções”, “repita as instruções”, “o que é que posso dizer”, “como funciona”, “como é que funciona”
- **Show the last answer as text**: “mostra a última resposta”, “mostrar a última resposta”, “mostra-me a última resposta”, “mostra a resposta”, “mostrar a resposta”, “mostre a última resposta”, “mostre a resposta”, “mostra-me a resposta”, “mostre-me a resposta”, “mostre-me a última resposta”
- **Hide the text**: “esconde a resposta”, “esconder a resposta”, “esconde a última resposta”, “esconda a resposta”, “esconda a última resposta”, “oculta a resposta”, “oculte a resposta”
- **Use the next microphone**: “mudar de microfone”, “mudar o microfone”, “muda o microfone”, “outro microfone”, “trocar de microfone”, “troca o microfone”, “mude de microfone”, “mude o microfone”, “troque de microfone”, “troque o microfone”, “usa outro microfone”, “use outro microfone”
- **Change language (the assistant asks which one)**: “mudar de língua”, “mudar a língua”, “mudar de idioma”, “mudar o idioma”, “outra língua”, “outro idioma”, “muda de língua”, “mude de língua”, “muda a língua”, “mude a língua”, “muda de idioma”, “mude de idioma”, “trocar de língua”
- **Switch straight to a language**: one of “usa”, “fala”, “fale”, “falar”, “muda”, “mude”, “responde”, “responda”, “fala-me”, “fale-me”, “responde-me”, “responda-me”, “troca”, “troque”, followed by the language at the end, for example “fala inglês”, “fale-me em francês”, “responda em italiano, por favor”. Language names understood: inglês, italiano, francês, búlgaro, russo, chinês, japonês, neerlandês / holandês, português.
- **End the conversation**: “adeus”, “tchau”, “até logo”, “até à próxima”, “parar”, “xau”, “adeusinho”, “até já”, “até amanhã” (a short sentence containing one of these, at most four words).

## 2. Pages

These are read with the screen reader, not spoken by the assistant. `{owner}` and `{email}` are filled in by the site.

### Termos: Fale com a Inteligência Artificial

**O serviço**

Fale com a Inteligência Artificial é um assistente de voz gratuito. Não há conta, nem palavra-passe, nem pagamento. {owner} gere-o como projeto pessoal a partir da Suíça. Ao premir Iniciar, aceita estes termos e a política de privacidade.

**A sua voz e o texto vão para serviços externos**

Quando fala, o som vai para o nosso servidor e para a Groq, que o transforma em texto (transcrição) e escreve a resposta. Para informações atuais, uma pergunta de pesquisa e os endereços das páginas web a ler vão para a Tavily. A resposta pode ser lida em voz pela Fish Audio ou pelo seu próprio dispositivo. Não guardamos as suas gravações nem as suas conversas. A política de privacidade tem os pormenores.

**As respostas podem estar erradas**

Está a falar com uma inteligência artificial, não com uma pessoa. As respostas podem estar erradas, incompletas ou desatualizadas, mesmo quando indicam uma fonte. Não é um serviço médico, jurídico, financeiro nem de emergência. Confirme as informações importantes antes de confiar nelas.

**Uso adequado**

Não use o serviço para infringir a lei nem para prejudicar outras pessoas. Não lhe dê informações privadas de outras pessoas. Não tente sobrecarregá-lo nem atacá-lo.

**Disponibilidade**

O serviço é gratuito e não tem qualquer garantia. Pode ser lento, ficar limitado durante o dia, ser alterado ou terminar a qualquer momento, também porque os serviços externos têm os seus próprios limites.

**Responsabilidade**

Na medida em que a lei o permita, {owner} não é responsável por danos resultantes do uso do serviço ou da confiança nas suas respostas. Os direitos que a lei lhe dá e que não podem ser excluídos mantêm-se.

**Alterações e contacto**

Estes termos podem mudar. A data abaixo mostra a versão atual, e o seu navegador lembra-se da versão que aceitou. Perguntas: {email}.


### Aviso de privacidade: Fale com a Inteligência Artificial

**Quem é responsável**

Fabrice Brambilla gere este projeto pessoal a partir da Suíça. Contacto: brambillafabrice@gmail.com.

**A sua voz e as suas perguntas**

Quando escolhe gravar, o navegador capta o som e envia-o para o nosso servidor e para a Groq, para produzir uma transcrição e uma resposta. As mensagens anteriores da conversa atual dão contexto. Não escrevemos gravações de voz nem transcrições de conversas de voz na base de dados da aplicação. Terminar a conversa apaga o texto da memória da página. As respostas são lidas com a voz do seu navegador ou dispositivo; se uma voz na nuvem opcional estiver ativada, o texto da resposta é enviado para a Fish Audio ou para a Groq. Uma voz do dispositivo pode, por sua vez, usar o serviço na nuvem do fabricante do dispositivo.

**Pesquisas na web**

Para obter informações atuais, pode ser enviada à Tavily uma curta pergunta em texto. Pode conter pormenores da sua pergunta. O seu som não é enviado ao serviço de pesquisa. A Tavily pode usar outros índices de pesquisa, segundo a política que publica. Evite pôr informações pessoais ou confidenciais nas perguntas. Para responder a partir de uma página web, o endereço dessa página (normalmente encontrada pela pesquisa) também é enviado à Tavily, que devolve o texto da página. A aplicação guarda na memória o texto das páginas lidas, nunca as suas palavras, durante até 20 minutos, para que um artigo lido por partes não seja descarregado de novo.

**Preferências do navegador**

O navegador lembra-se da língua escolhida e de se já apresentou a introdução e as informações de privacidade. Pode apagar estas preferências nas definições de dados de sites do navegador. Não há cookies de publicidade nem identificadores persistentes de visitantes. Os identificadores de visitantes mais antigos são removidos quando a página atualizada é carregada. Lembra-se também do microfone que escolheu (o identificador técnico e o nome), de que ouviu as instruções sobre o microfone e da versão da política de privacidade e dos termos que aceitou ao premir Iniciar. Se ligar o texto das respostas, lembra-se dessa escolha; as respostas em si ficam apenas na página aberta.

**O que a aplicação guarda**

As estatísticas de utilização contêm apenas uma data, o total de aberturas da página e o total de perguntas de voz enviadas, e são guardadas para os últimos sete dias de calendário, no fuso horário Europe/Zurich. Uma pergunta de voz válida é contada quando é enviada, mesmo que a resposta falhe depois. Os testes sintéticos assinalados e a API de texto separada não entram nos totais. Estas estatísticas não têm identificadores de visitantes, endereços IP, som, texto das conversas nem a hora de cada pedido. Recarregamentos, envios repetidos e automatização não assinalada podem aumentar os totais; não identificam pessoas nem confirmam uso humano. A API de texto separada guarda os identificadores de chat e as mensagens na memória do servidor até serem apagados, até um reinício, por falta de espaço ou cerca de 24 horas depois da última mensagem; a expiração é verificada no acesso e numa limpeza periódica. Quem tiver o identificador de um chat pode aceder a esse chat, por isso mantenha-o privado.

**Fornecedores e países**

O servidor da aplicação está alojado na Render, em Frankfurt, na Alemanha. A Groq processa os pedidos nos Estados Unidos. A Groq pode guardar o conteúdo enviado segundo as definições de dados da conta e a sua política publicada; os metadados de utilização são guardados. Não foi verificado, para todas as contas usadas por esta aplicação, que nenhum conteúdo é guardado. A Tavily e os serviços de voz opcionais podem tratar dados nos Estados Unidos e noutros países indicados nas suas políticas e nas informações sobre subcontratantes. A Render e outros fornecedores podem guardar informações técnicas e de segurança segundo as suas próprias regras. Continuam a aplicar-se as condições de tratamento e de transferência internacional dos fornecedores; o facto de a aplicação não gravar nada não significa que nenhum fornecedor trate dados. Informações dos fornecedores:

**Finalidade e informações sensíveis**

Os dados normais da conversa são tratados para prestar o serviço que pede. O tratamento técnico protege também o funcionamento e a segurança. Quando o RGPD se aplica, os fundamentos para o tratamento normal do serviço e para a segurança são, respetivamente, o artigo 6.º, n.º 1, alínea b), e o artigo 6.º, n.º 1, alínea f). O serviço não lhe pede que revele uma deficiência, historial de saúde, informações financeiras ou documentos de identificação. Não partilhe dados pessoais sensíveis ou confidenciais. Iniciar uma conversa ou autorizar o microfone não é um consentimento explícito geral para o tratamento de categorias especiais de dados, nos termos do artigo 9.º do RGPD.

**As suas escolhas e direitos**

A gravação só começa depois de escolher falar e de autorizar o microfone no navegador. Termine a conversa para parar novas gravações; isso não recupera informação já enviada. Pode contactar o Fabrice para pedir acesso, retificação, apagamento ou limitação, ou para se opor, nos termos da lei aplicável. Podemos precisar de informações para identificar os registos em causa; não é necessária uma conta. Pode apresentar queixa ao Comissário Federal Suíço para a Proteção de Dados e a Transparência (FDPIC) ou à autoridade competente do país onde vive. Os registos dos fornecedores e o armazenamento dos chats da API são independentes das contagens totais de visitas.

**IA e limitações**

Está a falar com um assistente de inteligência artificial, não com uma pessoa. As respostas podem estar erradas. Confirme as informações importantes por si. Este é um projeto de informação geral, não um serviço médico, de emergência, financeiro ou jurídico. Não decide sobre direitos, não faz diagnósticos nem toma decisões sobre si.

**Comentários e contacto profissional**

Se nos enviar um e-mail, a sua mensagem e os seus contactos são usados para responder e melhorar o projeto. Para um convite de feedback profissional, os contactos vêm das informações de contacto profissional publicadas pela organização. Guardamos apenas a correspondência e o registo de envio ou de não contactar necessários para tratar a conversa e evitar convites repetidos. Pode opor-se respondendo ou escrevendo para o contacto acima. Não vendemos listas de contactos nem enviamos convites de seguimento automaticamente.


### Declaração de acessibilidade: Fale com a Inteligência Artificial

**Autorização do microfone e atalho de teclado**

A aguardar o acesso ao microfone. Se o navegador perguntar, escolha Permitir no pedido de autorização do microfone. Estes controlos estão fora desta página. Alt+Shift+T também aciona Falar a partir de qualquer ponto desta página, se o navegador e o leitor de ecrã deixarem passar o atalho. Escolha o botão que dá acesso em cada visita ao site. Em inglês chama-se "Allow while visiting the site"; nas versões mais antigas do Chrome, "Allow on every visit". Só desta vez, em inglês "Allow this time", também funciona, mas depois o Chrome volta a perguntar. Escolha Permitir. Se ouvir a caixa de verificação "Memorizar esta decisão", em inglês "Remember this decision", marque-a primeiro, para o Firefox não voltar a perguntar. No pedido do navegador, use Tab ou Shift+Tab para passar entre as opções, Enter para ativar um botão e Espaço para marcar ou desmarcar uma caixa.

**O nosso objetivo**

Este site foi feito para ser usado inteiramente por voz e com leitores de ecrã. Procuramos cumprir as Diretrizes de Acessibilidade para o Conteúdo da Web (WCAG) 2.2, nível AA, e a norma europeia EN 301 549.

**Como usar**

A página tem um título e um botão grande. Prima-o para começar. Na primeira vez, se as duas versões do português estiverem disponíveis, o assistente pergunta se prefere o português de Portugal ou o do Brasil: basta dizer Portugal ou Brasil. Depois prima a barra de espaços (ou o botão) para começar a falar, e outra vez quando terminar, para ouvir a resposta. Se não falar durante sete segundos, o assistente responde na mesma. Premir a barra de espaços enquanto o assistente fala interrompe-o. Para terminar a conversa, diga adeus. Para mudar de língua, diga-o a qualquer momento, por exemplo "fala inglês", ou use o botão Língua. Num telemóvel ou tablet, use o botão Falar em vez da barra de espaços. Pode terminar a qualquer momento com o botão Terminar conversa, que fica logo a seguir ao botão Falar.

**O que pode dizer**

- “Repete”: ouvir de novo a última resposta.
- “Mudar de língua”, ou por exemplo “fala inglês”: mudar de língua.
- “Fala português de Portugal” ou “fala português do Brasil”: mudar a versão do português.
- “Mostra a última resposta”: a última resposta como texto na página, com um botão Copiar; “esconde a resposta” desliga-o.
- “Mudar de microfone”: usar o microfone seguinte.
- “Ajuda”: ouvir o que pode dizer.
- “Adeus”: terminar a conversa.

**Comandos para o seu leitor de ecrã**

- NVDA: a página abre no botão Iniciar conversa. Prima Espaço ou Enter. Funciona no modo de navegação; não precisa do modo de foco. Se se afastou, prima B para ir para o botão seguinte, ou Shift+B para voltar. Escape termina a conversa. Prima Control para calar o NVDA enquanto o assistente fala.
- JAWS: igual ao NVDA. Espaço ou Enter no botão funciona com o cursor virtual, B e Shift+B saltam entre botões, Escape termina a conversa e Control cala o JAWS.
- Narrador: no modo de análise, prima Espaço ou Enter no botão; B salta para o botão seguinte. Caps Lock+Espaço liga e desliga o modo de análise.
- VoiceOver no Mac: prima Control+Option+Espaço no botão, ou Espaço quando o foco do teclado está nele. Tab passa de botão em botão.
- VoiceOver no iPhone e no iPad: deslize para a direita até ao botão Iniciar conversa e toque duas vezes. Depois toque duas vezes no botão Falar para falar, e outra vez para ouvir a resposta. O botão Terminar conversa fica logo a seguir.
- TalkBack no Android: igual ao VoiceOver no iPhone: deslize para a direita até ao botão e toque duas vezes.
- Orca no Linux: prima Espaço ou Enter no botão; B salta para o botão seguinte. Orca+A alterna entre o modo de navegação e o modo de foco.

**Leitores de ecrã e dispositivos suportados**

Foi pensado para o JAWS, o NVDA e o Narrador no Windows, o VoiceOver no Mac e no iPhone, o TalkBack no Android e o Orca no Linux, com versões atuais do Chrome, Edge, Firefox e Safari. Não são precisos auscultadores nem definições especiais.

**Limitações conhecidas**

A voz depende do seu dispositivo e dos serviços ativados pelo responsável; uma voz natural não está disponível em todas as configurações. Foram feitas verificações automáticas, mas os testes completos em dispositivos reais com o JAWS, o NVDA e o VoiceOver ainda estão por fazer. A versão em português ainda não foi testada por utilizadores que falam português. Não pode interromper o assistente falando; prima o botão.

**Comentários**

Se alguma coisa não funcionar para si, escreva para {email}. Todas as mensagens são lidas.


### Sobre o projeto (About page)

- **organizationsTitle**: Projetos-piloto e colaboração
- **generalContactTitle**: Contacto
- **generalContact**: Tem perguntas sobre o projeto? Envie-me um e-mail ou ligue-me.
- **title**: Sobre o Talk with AI
- **intro**: Tenho 17 anos e sou aluno do ensino secundário na Suíça. Gostava de estudar engenharia.
- **storyTitle**: Porque criei isto
- **story**: A minha tia nasceu cega e usa o JAWS. Achava difíceis de usar as ferramentas de inteligência artificial mais conhecidas, sobretudo para pesquisar na internet. Comecei este projeto para tornar isso mais simples.
- **missionTitle**: Pergunte com a voz. Explore a web.
- **mission**: O Talk with AI é um assistente de voz gratuito para perguntas e pesquisas na web. Fala, ouve a resposta e faz outra pergunta. Estou a desenvolvê-lo para quem usa leitores de ecrã, como o JAWS e o NVDA.
- **pilotsTitle**: Projetos-piloto em curso
- **pilotCountry**: Itália
- **contactTitle**: Para organizações
- **contact**: Se a sua organização apoia pessoas que usam leitores de ecrã, gostaria de falar sobre um projeto-piloto gratuito ou uma colaboração, para melhorarmos a aplicação juntos. Envie-me um e-mail ou ligue-me para combinarmos uma conversa curta.
- **emailLabel**: E-mail
- **phoneLabel**: Telefone

## 3. Answers written by the AI

The assistant's own answers are written by the language model. It is told to write Portugal's Portuguese (the exact instruction is in `server.js`, `systemPrompt`). It still sometimes uses Brazilian forms. Before an answer is spoken, the server changes the forms where the Portugal word is certain:

- "acessem" → "acedam", "acessar" → "aceder"
- "na tela" → "no ecrã"; "o celular" → "o telemóvel"
- "contato" → "contacto"; "equipe" → "equipa"; "usuário" → "utilizador"
- "trem" → "comboio"; "ônibus" → "autocarro"; "registro" → "registo"; "esporte" → "desporto"; "de fato" → "de facto"; "café da manhã" → "pequeno-almoço"
- "está fazendo" → "está a fazer" (estar followed by a gerund)
- Brazilian accents on a short list of words: "econômico" → "económico", "gênero" → "género", "fenômeno" → "fenómeno", "Antônio" → "António", "bebê" → "bebé", "câmera" → "câmara"

Forms that need the whole sentence rewritten are not changed, only logged (the word, never the answer): "você", "baixar", "arquivo", "tela" and "celular" on their own, "aplicativo", "banheiro", "geladeira", "planilha", "mouse", "a gente", "pra". Please tell the owner if answers still sound Brazilian, and give an example.

## 4. Owner checklist: switching Portuguese on

Do this only after the native-speaker review, or for a private test that you switch off again afterwards.

1. **Switch it on.** Render dashboard → the Talk with AI web service → **Environment** → add the variable `NEW_LANGUAGES` with the value `nl,pt` (or `pt` for Portuguese only) → **Save changes**. Render redeploys the service. Wait until the deploy shows **Live**. To switch it off again, delete the variable and save.
2. **Optional voice.** If you use Fish Audio, add `FISH_VOICE_PT` with the ID of a **Portugal** Portuguese voice. Without it, the device's own voice is used. On Windows Edge that is "Microsoft Raquel/Duarte (Portugal)", and on iPhone "Joana" or "Catarina", if installed.
3. **Check the button.** Open the site, press "Language", and check that the list includes "Português". With a screen reader, the button is read in a Portuguese voice (it has `lang="pt-PT"`). Then open `https://<your site>/?lang=pt` and check:
   - The page says "Fale com a Inteligência Artificial".
   - The big button says "Iniciar conversa".
   - The screen reader switches to its Portuguese voice.
   - The links Termos, Aviso de privacidade, Acessibilidade and Sobre o projeto open Portuguese pages.
4. **Check it is off when you remove it.** Without the variable, "Português" must not be in the list, and `/?lang=pt` must show the English page.
5. **5-minute listening test** (headphones or speakers, a quiet room; ideally done by the Portuguese reviewer):
   1. Start a conversation in Portuguese. Listen to the greeting. Is the voice from **Portugal**, not Brazil? Is the speed comfortable?
   2. Ask: "Que horas são em Lisboa?" Was your question understood? Was the answer in Portugal's Portuguese?
   3. Ask something that needs the internet: "Como vai estar o tempo amanhã em Viseu?" Did it say it would search, and did the answer make sense?
   4. Say each command once: "repete", "ajuda", "mostra a última resposta", "mudar de microfone", "fala inglês" and then "fala português", and finally "adeus". Did each one do the right thing?
   5. Write down every word that was misheard, or that sounded Brazilian or unnatural, and send the list with the review.
6. **Before sharing with ACAPO Viseu:** apply the reviewer's corrections, run `npm test`, and record in `docs/talk-with-ai-brief.md` (§12) who reviewed it and on which date.

### Known gaps the owner should know

- No real Portuguese speech has been tested with the speech recognition (Groq Whisper, language code `pt`). Whisper is not told "Portugal" (it only takes `pt`), so it may write some words with Brazilian spelling. This only affects what the model reads, not what it says.
- The Accessibility page ("How to use") in the other seven languages still says the assistant asks for the language the first time. Since the H change (2026-11-18) it does not. In Portuguese this sentence now describes the real first-use question (Portugal or Brazil). The other languages are left for the owner to decide and are recorded in the brief.
- The Privacy notice and Terms in Portuguese are translations, not a legal review under Portuguese law.

## 5. Brazilian Portuguese (pt-BR), added 2026-11-19

A second Portuguese, for Brazil. It has its own switch and is **off** unless `NEW_LANGUAGES` contains `pt-BR`. It needs its **own reviewer, a native speaker from Brazil**. The European reviewer does not need to read this section.

How the site chooses:

- A browser set to Portuguese (Brazil), `pt-BR`, gets Brazilian Portuguese. A browser set to `pt-PT`, or only `pt`, gets Portugal's Portuguese.
- If only one of the two is switched on, every Portuguese browser gets that one.
- When both are on, the first conversation of a Portuguese user starts with a question in both versions: "Prefere o português de Portugal ou o português do Brasil? Diga Portugal ou Brasil." The answer is remembered in the browser and is not asked again. If it is not understood twice, the version from the browser stays. It is never asked of users of other languages.
- It can be changed at any time: the Language button lists "Português (Portugal)" and "Português (Brasil)", and the user can say "fala português do Brasil" or "fala português de Portugal" (also "fala brasileiro").
- The AI is told to write Brazilian Portuguese. The Portugal correction (section 3) is **not** applied to Brazilian answers.
- Speech recognition is the same for both (Whisper gets `pt`). The device voice is a Brazilian voice when one is installed (for example "Microsoft Francisca" or "Google português do Brasil").

For the Brazilian reviewer, please check naturalness, Brazilian wording ("tela", "celular", "arquivo", "baixar", "você"), and clarity for a screen-reader user. The pages are at `/?lang=pt-BR`, `/terms?lang=pt-BR`, `/privacy?lang=pt-BR`, `/accessibility?lang=pt-BR`, `/about?lang=pt-BR` once switched on. In the privacy notice, the legal wording was translated from the Portugal version. It is **not** a review under Brazilian law (LGPD).

### Spoken and on-page texts (pt-BR)

- **lastButton**: Mostrar a última resposta  
  _English: Show last answer_
- **lastHeading**: Última resposta  
  _English: Last answer_
- **copyButton**: Copiar  
  _English: Copy_
- **copied**: Copiado.  
  _English: Copied._
- **copyFailed**: Não foi possível copiar. Selecione o texto com o teclado e copie.  
  _English: Could not copy. Select the text with the keyboard and copy it._
- **lastShown**: A última resposta está na página como texto, abaixo do título Última resposta, com um botão Copiar.  
  _English: The last answer is on the page as text, under the heading Last answer, with a Copy button._
- **lastNone**: Ainda não há nenhuma resposta para mostrar.  
  _English: There is no answer to show yet._
- **lastHidden**: O texto das respostas está desativado.  
  _English: The text of answers is turned off._
- **agreeBefore**: Ao pressionar Iniciar, você aceita a   
  _English: By pressing Start you agree to the _
- **agreePrivacy**: Política de Privacidade  
  _English: Privacy Policy_
- **agreeAnd**:  e os   
  _English:  and _
- **agreeTerms**: Termos  
  _English: Terms_
- **agreeAfter**: .  
  _English: ._
- **agreeSpoken**: Ao iniciar, você aceita a política de privacidade e os termos; sua voz e o texto vão para serviços externos.  
  _English: By starting, you agree to the privacy policy and terms; your voice and text go to outside services._
- **termsLink**: Termos  
  _English: Terms_
- **micGuide**: Para ouvir você, preciso do microfone. Agora o navegador vai pedir permissão.  
  _English: To hear you, I need the microphone. Your browser will now ask for permission._
- **micChoice**: Escolha Permitir.  
  _English: Choose Allow._
- **micChoiceChrome**: Escolha o botão que permite o acesso em todas as visitas ao site. Em inglês ele se chama "Allow while visiting the site"; nas versões mais antigas do Chrome, "Allow on every visit". Só desta vez, em inglês "Allow this time", também funciona, mas depois o Chrome pergunta de novo.  
  _English: Choose "Allow while visiting the site"; older versions of Chrome call it "Allow on every visit". "Allow this time" also works, but then Chrome asks again later._
- **micChoiceFirefox**: Escolha Permitir. Se você ouvir a caixa de seleção "Lembrar esta decisão", em inglês "Remember this decision", marque essa caixa antes, para o Firefox não perguntar de novo.  
  _English: Choose Allow. If you hear the checkbox "Remember this decision", tick it first, so Firefox does not ask again._
- **micShort**: O navegador está pedindo o microfone. Escolha Permitir.  
  _English: The browser now asks for the microphone. Choose Allow._
- **micShortChrome**: O navegador está pedindo o microfone. Escolha o botão que permite o acesso em todas as visitas.  
  _English: The browser now asks for the microphone. Choose Allow while visiting the site._
- **micShortFirefox**: O navegador está pedindo o microfone. Marque Lembrar esta decisão, se aparecer, e depois escolha Permitir.  
  _English: The browser now asks for the microphone. Tick Remember this decision if it is shown, then choose Allow._
- **errMicDenied**: O microfone está bloqueado para este site. Para liberar, abra o botão de informações do site, o ícone de cadeado ao lado do endereço. Com o teclado, vá para a barra de endereço e pressione Shift+Tab até chegar nele. Depois escolha Microfone e em seguida Permitir. Por fim, pressione Iniciar conversa de novo.  
  _English: The microphone is blocked for this site. To allow it, open the site information button, the lock icon next to the address. With the keyboard, go to the address bar and press Shift+Tab until you reach it. Then choose Microphone, then Allow. After that, press Start conversation again._
- **micButton**: Trocar de microfone  
  _English: Change microphone_
- **micFallback**: Não encontrei o microfone que você usou antes, então estou usando o microfone padrão.  
  _English: I can't find the microphone you used before, so I'm using the default microphone._
- **micNow**: Agora vou usar este microfone:  
  _English: I will now use this microphone:_
- **micOnlyOne**: Só encontrei um microfone, então não há outro para trocar.  
  _English: I can find only one microphone, so there is nothing to change._
- **micGuideTouch**: Com um leitor de tela por toque, encontre Permitir e toque duas vezes.  
  _English: With a touch screen reader, find Allow, then double-tap it._
- **micGuideKeyboard**: No pedido do navegador, use Tab ou Shift+Tab para passar pelas opções, Enter para ativar um botão e Espaço para marcar ou desmarcar uma caixa.  
  _English: In the browser prompt, use Tab or Shift+Tab to move between choices, Enter to activate a button, and Space to toggle a checkbox._
- **askWeatherPlace**: De qual cidade e de qual país você está falando? Também pode dizer uma cidade próxima.  
  _English: Which town and country do you mean? You can also name a nearby city._
- **liveInfoUnavailable**: Não consigo confirmar informações atuais neste momento. Tente mais tarde ou consulte uma fonte atualizada.  
  _English: I can't verify current information right now. Please try again later or check an up-to-date source._
- **downloadUnavailable**: Não consigo baixar arquivos automaticamente neste site. Posso ajudar a encontrar uma fonte e explicar como salvar o arquivo.  
  _English: I can't download files automatically from this site. I can help you find a source and explain how to save it yourself._
- **voiceChangeUnavailable**: Ainda não consigo trocar entre voz masculina e feminina neste site. A voz depende do seu dispositivo e do serviço de voz disponível.  
  _English: I can't switch between male and female voices on this site yet. The voice depends on your device and the available speech service._
- **aiDisclosure**: Sou um assistente de inteligência artificial.  
  _English: I'm an AI assistant._
- **title**: Fale com a Inteligência Artificial – pressione o botão para começar  
  _English: Talk with Artificial Intelligence – press the button to start_
- **h1**: Fale com a Inteligência Artificial  
  _English: Talk with Artificial Intelligence_
- **start**: Iniciar conversa  
  _English: Start conversation_
- **end**: Encerrar conversa  
  _English: End conversation_
- **langButton**: Idioma: português do Brasil. Mudar de idioma  
  _English: Language: English. Change language_
- **help**: Pressione para começar. Depois pressione a barra de espaço para falar e de novo para ouvir a resposta; pressione a qualquer momento para interromper. Para encerrar, diga tchau.  
  _English: Press to start. Then press Space to talk, and again to get the answer; press it any time to interrupt. To end, say goodbye._
- **greeting**: Pressione a barra de espaço para falar e de novo para enviar. Pressione enquanto eu falo para me interromper. Diga tchau para encerrar, ou ajuda para ouvir as instruções.  
  _English: Press Space to talk, and again to send. Press it while I’m speaking to interrupt. Say goodbye to finish, or help for instructions._
- **farewell**: Tchau!  
  _English: Goodbye!_
- **langChanged**: Tudo bem, vou falar português do Brasil.  
  _English: OK, I'll speak English._
- **voiceHelp**: Você pode dizer: repete, mudar de idioma, mostra a última resposta, trocar de microfone ou tchau.  
  _English: You can say: repeat, change language, show the last answer, change microphone, or goodbye._
- **shortcutHelp**: Com o NVDA ou o JAWS, pressione B para encontrar o botão e depois Espaço ou Enter. Alt+Shift+T também aciona Falar de qualquer lugar desta página, se o navegador e o leitor de tela deixarem passar o atalho.  
  _English: With NVDA or JAWS, press B to find the button, then Space or Enter. Alt+Shift+T also controls Talk from anywhere on this page, if your browser and screen reader pass the shortcut through._
- **errMic**: Não consigo usar o microfone. Permita o acesso ao microfone para este site e depois pressione o botão para tentar de novo.  
  _English: I can't use the microphone. Allow microphone access for this site, then press the button to try again._
- **errConnection**: Algo deu errado e a conexão caiu. Recarregue a página e tente de novo.  
  _English: Something went wrong and the connection was lost. Please reload the page and try again._
- **errLimit**: A inteligência artificial atingiu o limite gratuito de hoje. Tente de novo amanhã.  
  _English: The AI has reached its free limit for today. Please try again tomorrow._
- **errSupport**: Este navegador não consegue gravar áudio. Tente usar o Chrome, o Edge, o Firefox ou o Safari.  
  _English: This browser can't record audio. Please try Chrome, Edge, Firefox or Safari._
- **back**: Voltar para a página da conversa  
  _English: Back to the conversation page_
- **searching**: Vou pesquisar.  
  _English: Let me look that up._
- **errRetry**: Desculpe, algo deu errado. Pressione a barra de espaço e fale de novo.  
  _English: Sorry, something went wrong. Please press the space bar and say that again._
- **privacyLink**: Aviso de privacidade  
  _English: Privacy notice_
- **accessibilityLink**: Acessibilidade  
  _English: Accessibility_
- **aboutLink**: Sobre o projeto  
  _English: About the project_
- **askLanguage**: Qual idioma você quer usar? Diga depois do sinal.  
  _English: Which language would you like to use? Say it after the tone._
- **langNotUnderstood**: Desculpe, não entendi. Diga de novo o nome do seu idioma.  
  _English: Sorry, I didn't understand. Please say the name of your language again._
- **notHeard**: Não ouvi nada. Pressione a barra de espaço quando quiser falar.  
  _English: I didn't hear anything. Press the space bar when you want to talk._
- **talk**: Falar  
  _English: Talk_
- **helpTouch**: Pressione para começar. Depois pressione Falar para falar e de novo para ouvir a resposta; pressione a qualquer momento para interromper. Para encerrar, diga tchau.  
  _English: Press to start. Then press Talk to talk, and again to get the answer; press it any time to interrupt. To end, say goodbye._
- **greetingTouch**: Pressione Falar para falar e de novo para enviar. Pressione enquanto eu falo para me interromper. Diga tchau para encerrar, ou ajuda para ouvir as instruções. No celular, fones de ouvido podem ajudar a evitar que as vozes do leitor de tela e do assistente se sobreponham.  
  _English: Press Talk to speak, and again to send. Press it while I’m speaking to interrupt. Say goodbye to finish, or help for instructions. On a phone, headphones can help keep the screen reader and assistant audio from overlapping._
- **notHeardTouch**: Não ouvi nada. Pressione o botão Falar quando quiser falar.  
  _English: I didn't hear anything. Press the Talk button when you want to talk._
- **errRetryTouch**: Desculpe, algo deu errado. Pressione o botão Falar e fale de novo.  
  _English: Sorry, something went wrong. Please press the Talk button and say that again._
- **greetingShort**: Oi de novo. Pressione a barra de espaço para falar.  
  _English: Welcome back. Press Space to talk._
- **greetingShortTouch**: Oi de novo. Pressione Falar para falar.  
  _English: Welcome back. Press Talk to speak._
- **askPtVariant**: Prefere o português de Portugal ou o português do Brasil? Diga Portugal ou Brasil.
- **ptVariantNotUnderstood**: Desculpe, não entendi. Diga Portugal ou Brasil.

### Owner checklist for pt-BR

1. Render → Environment → set `NEW_LANGUAGES` to `nl,pt,pt-BR` (or `pt,pt-BR`) → Save. Wait for **Live**.
2. Optional: `FISH_VOICE_PT_BR` = the ID of a **Brazilian** Fish Audio voice.
3. Open `/?lang=pt-BR`. The page must say "Idioma: português do Brasil" and use `lang="pt-BR"`. The Language list must show both "Português (Portugal)" and "Português (Brasil)".
4. In a browser with no saved choice (a private window), set to Portuguese (Brazil), start a conversation. You must first hear the question "Portugal ou Brasil?". Answer "Brasil". The instructions that follow must be the Brazilian ones ("Diga tchau para encerrar"). Close and start again: the question must not come back.
5. Listening test as in section 4, step 5, with a Brazilian speaker and Brazilian phrases ("Que horas são em São Paulo?", "tchau").
6. To switch only Brazilian off, set `NEW_LANGUAGES` back to `nl,pt`.
