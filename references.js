'use strict';
const fs=require('node:fs'),path=require('node:path');
const topics={settings:/command|setting|language|speed|microphone|install|comand|commande|команд|設定|指令/i,instructions:/instruction|how (do i|to) (use|start|interrupt)|istruzion|инструк|使い方|使用说明/i,privacy:/privacy|confidential|privacidade|données|隐私|プライバシー/i,limits:/capabilit|what can you|can you send|cannot|in grado|できること/i};
function read(topic,detailed){if(!Object.hasOwn(topics,topic))return '';const lines=fs.readFileSync(path.join(__dirname,'docs/references',topic+'.txt'),'utf8').trim().split('\n');return detailed?lines.join(' '):lines[0];}
function match(q){return Object.keys(topics).filter(key=>topics[key].test(q)).map(k=>read(k,/explain|detail|how|come|comment|как/i.test(q))).join('\n');}
module.exports={read,match};
