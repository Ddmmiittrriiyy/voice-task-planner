/* Голосовые задачи — логика приложения
   Хранение: localStorage, ключ voiceTasks_v1
   Приложение не даёт советов и не принимает решений — только выполняет команды. */

const STORAGE_KEY = 'voiceTasks_v1';
const THEME_KEY = 'voiceTasks_theme_v1';
const PLANNER_VERSION = '0.1.3-next.2';
function getAndroidBridge(){ return (window.AndroidBridge && typeof window.AndroidBridge === 'object') ? window.AndroidBridge : null; }
function hasNativeAlarm(){ const b=getAndroidBridge(); return !!(b && (typeof b.scheduleAlarm==='function' || typeof b.setAlarm==='function')); }
function getAndroidCoreVersion(){ const b=getAndroidBridge(); if(!b) return null; try{ if(typeof b.getCoreVersion==='function') return String(b.getCoreVersion()||'').trim()||null; }catch(e){} return null; }

/* ---------- Хранилище ---------- */
function loadTasks(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  }catch(e){ return []; }
}
function saveTasks(tasks){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}
let tasks = loadTasks();

function uid(){
  return Date.now().toString(36) + Math.random().toString(36).slice(2,8);
}

/* ---------- Язык (RU / UK / EN) ---------- */
const LANG_KEY = 'voiceLang_v1';
function getLang(){
  return localStorage.getItem(LANG_KEY) || 'ru';
}
function setLang(code){
  localStorage.setItem(LANG_KEY, code);
}

/* ---------- Разбор фразы: дата / время / текст (RU / UK / EN) ---------- */

// В JS \b не распознаёт кириллицу как "словесный" символ, поэтому границы слов
// собираем вручную через юникодные lookaround-проверки.
function wb(pattern){
  return new RegExp('(?<![\\p{L}\\p{N}_])(?:' + pattern + ')(?![\\p{L}\\p{N}_])', 'iu');
}

function pad2(n){ return String(n).padStart(2,'0'); }
function toISODate(d){ return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
function addDays(base, n){
  const d = new Date(base);
  d.setDate(d.getDate()+n);
  return d;
}

const LANGS = {
  ru: {
    code: 'ru-RU', label: 'RU',
    months: {'января':1,'февраля':2,'марта':3,'апреля':4,'мая':5,'июня':6,'июля':7,'августа':8,'сентября':9,'октября':10,'ноября':11,'декабря':12},
    monthsList: 'января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря',
    weekdays: [
      {stem:'воскресень', dow:0},{stem:'понедельник', dow:1},{stem:'вторник', dow:2},
      {stem:'сред', dow:3},{stem:'четверг', dow:4},{stem:'пятниц', dow:5},{stem:'суббот', dow:6},
    ],
    weekdayCharClass: '[а-яё]',
    weekdayPrep: 'во?',
    today:'сегодня', tomorrow:'завтра', dayAfterTomorrow:'послезавтра',
    prep: 'во?', // "в"/"во"
    meridiem: {'утра':'am','дня':'pm','вечера':'pm','ночи':'am','днем':'pm','днём':'pm'},
    meridiemWords: 'утра|дня|вечера|ночи|днем|днём',
    hourWords: {'один':1,'одну':1,'два':2,'две':2,'три':3,'четыре':4,'пять':5,'шесть':6,'семь':7,'восемь':8,'девять':9,'десять':10,'одиннадцать':11,'двенадцать':12},
    hourWordsList: 'один|одну|два|две|три|четыре|пять|шесть|семь|восемь|девять|десять|одиннадцать|двенадцать',
    hourNoun: 'час(?:а|ов)?',
    ambiguousAfternoonMax: 7,
  },
  uk: {
    code: 'uk-UA', label: 'UA',
    months: {'січня':1,'лютого':2,'березня':3,'квітня':4,'травня':5,'червня':6,'липня':7,'серпня':8,'вересня':9,'жовтня':10,'листопада':11,'грудня':12},
    monthsList: 'січня|лютого|березня|квітня|травня|червня|липня|серпня|вересня|жовтня|листопада|грудня',
    weekdays: [
      {stem:'неділ', dow:0},{stem:'понеділ', dow:1},{stem:'вівтор', dow:2},
      {stem:'серед', dow:3},{stem:'четвер', dow:4},{stem:"п['’]?ятниц", dow:5},{stem:'субот', dow:6},
    ],
    weekdayCharClass: "[а-яіїєґ'’]",
    weekdayPrep: '(?:у|в)',
    today:'сьогодні', tomorrow:'завтра', dayAfterTomorrow:'післязавтра',
    prep: '(?:об|о)',
    meridiem: {'ранку':'am','дня':'pm','вечора':'pm','ночі':'am'},
    meridiemWords: 'ранку|дня|вечора|ночі',
    hourWords: {'одна':1,'два':2,'дві':2,'три':3,'чотири':4,'п’ять':5,"п'ять":5,'шість':6,'сім':7,'вісім':8,'дев’ять':9,"дев'ять":9,'десять':10,'одинадцять':11,'дванадцять':12},
    hourWordsList: "одна|два|дві|три|чотири|п[’']ять|шість|сім|вісім|дев[’']ять|десять|одинадцять|дванадцять",
    hourNoun: 'годин(?:а|и|і|у)?',
    ambiguousAfternoonMax: 7,
  },
  en: {
    code: 'en-US', label: 'EN',
    months: {'january':1,'february':2,'march':3,'april':4,'may':5,'june':6,'july':7,'august':8,'september':9,'october':10,'november':11,'december':12},
    monthsList: 'january|february|march|april|may|june|july|august|september|october|november|december',
    weekdays: [
      {stem:'sunday', dow:0},{stem:'monday', dow:1},{stem:'tuesday', dow:2},
      {stem:'wednesday', dow:3},{stem:'thursday', dow:4},{stem:'friday', dow:5},{stem:'saturday', dow:6},
    ],
    weekdayCharClass: '[a-z]',
    weekdayPrep: 'on',
    today:'today', tomorrow:'tomorrow', dayAfterTomorrow:'day after tomorrow',
    prep: 'at',
    meridiemWords: 'am|pm',
    hourWords: {'one':1,'two':2,'three':3,'four':4,'five':5,'six':6,'seven':7,'eight':8,'nine':9,'ten':10,'eleven':11,'twelve':12},
    hourWordsList: 'one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve',
    hourNoun: "(?:o(?:'|\\s*)clock|hours?)",
    ambiguousAfternoonMax: 7,
  }
};

function currentLangCfg(){
  return LANGS[getLang()] || LANGS.ru;
}

function to24h(hour, pmOrAm){
  hour = hour % 12;
  if(pmOrAm === 'pm') hour += 12;
  return hour;
}
function parseHourToken(token, cfg){
  if(/^\d+$/.test(token)) return parseInt(token, 10);
  return cfg.hourWords && cfg.hourWords[token.toLowerCase()];
}
function applyPlanningHourHeuristic(hour, cfg, rawToken){
  if(hour >= 1 && hour <= (cfg.ambiguousAfternoonMax || 0) && !/^0/.test(String(rawToken))) return hour + 12;
  return hour;
}

// Возвращает {iso, matchedText} или null. Не придумывает дату сама — только распознаёт явные указания.
function extractDate(text, cfg){
  const today = new Date();
  today.setHours(0,0,0,0);

  // 1) точная дата дд.мм(.гггг) или дд/мм(/гггг)
  let m = text.match(wb('(\\d{1,2})[.\\/](\\d{1,2})(?:[.\\/](\\d{2,4}))?'));
  if(m){
    let day = parseInt(m[1],10), month = parseInt(m[2],10);
    let year = m[3] ? parseInt(m[3],10) : today.getFullYear();
    if(year < 100) year += 2000;
    if(day>=1 && day<=31 && month>=1 && month<=12){
      let d = new Date(year, month-1, day);
      if(!m[3] && d < today) d = new Date(year+1, month-1, day);
      return { iso: toISODate(d), matchedText: m[0] };
    }
  }

  // 2) "2 сентября" (RU/UK) или "2 september" / "september 2" (EN)
  m = text.match(wb('(\\d{1,2})\\s+(' + cfg.monthsList + ')(?:st|nd|rd|th)?'));
  if(m){
    const day = parseInt(m[1],10);
    const month = cfg.months[m[2].toLowerCase()];
    let year = today.getFullYear();
    let d = new Date(year, month-1, day);
    if(d < today) d = new Date(year+1, month-1, day);
    return { iso: toISODate(d), matchedText: m[0] };
  }
  m = text.match(wb('(' + cfg.monthsList + ')\\s+(\\d{1,2})(?:st|nd|rd|th)?'));
  if(m){
    const day = parseInt(m[2],10);
    const month = cfg.months[m[1].toLowerCase()];
    let year = today.getFullYear();
    let d = new Date(year, month-1, day);
    if(d < today) d = new Date(year+1, month-1, day);
    return { iso: toISODate(d), matchedText: m[0] };
  }

  // 3) дни недели
  for(const w of cfg.weekdays){
    const re = wb('(?:' + cfg.weekdayPrep + '\\s+)?(' + w.stem + cfg.weekdayCharClass + '*)');
    const wm = text.match(re);
    if(wm){
      let diff = (w.dow - today.getDay() + 7) % 7;
      if(diff === 0) diff = 7;
      const d = addDays(today, diff);
      return { iso: toISODate(d), matchedText: wm[0] };
    }
  }

  // 4) послезавтра / післязавтра / day after tomorrow (проверяем раньше "завтра")
  m = text.match(wb(cfg.dayAfterTomorrow.replace(/\s+/g,'\\s+')));
  if(m) return { iso: toISODate(addDays(today,2)), matchedText: m[0] };

  // 5) завтра / tomorrow
  m = text.match(wb(cfg.tomorrow));
  if(m) return { iso: toISODate(addDays(today,1)), matchedText: m[0] };

  // 6) сегодня / today
  m = text.match(wb(cfg.today));
  if(m) return { iso: toISODate(today), matchedText: m[0] };

  return null;
}

// Явная часть суток имеет приоритет над эвристикой 1–7 -> 13–19.
function detectDayPart(text, cfg){
  const t = text.toLowerCase();

  if(cfg.code === 'ru-RU'){
    const patterns = [
      ['morning', /(?:^|[^\p{L}])(?:с\s+утра|утром|утро|утра)(?!\p{L})/iu],
      ['afternoon', /(?:^|[^\p{L}])(?:после\s+обеда|днём|днем|день|дня)(?!\p{L})/iu],
      ['evening', /(?:^|[^\p{L}])(?:вечером|вечер|вечера)(?!\p{L})/iu],
      ['night', /(?:^|[^\p{L}])(?:ночью|ночь|ночи)(?!\p{L})/iu],
    ];
    for(const [kind,re] of patterns){
      const m=t.match(re);
      if(m) return {kind, matchedText:m[0].trim()};
    }
  }

  if(cfg.code === 'uk-UA'){
    const patterns = [
      ['morning', /(?:^|[^\p{L}])(?:зранку|вранці|ранок|ранку)(?!\p{L})/iu],
      ['afternoon', /(?:^|[^\p{L}])(?:після\s+обіду|вдень|день)(?!\p{L})/iu],
      ['evening', /(?:^|[^\p{L}])(?:увечері|ввечері|вечір|вечора)(?!\p{L})/iu],
      ['night', /(?:^|[^\p{L}])(?:вночі|ніч|ночі)(?!\p{L})/iu],
    ];
    for(const [kind,re] of patterns){
      const m=t.match(re);
      if(m) return {kind, matchedText:m[0].trim()};
    }
  }

  if(cfg.code === 'en-US'){
    const patterns = [
      ['morning', /\b(?:in\s+the\s+morning|morning)\b/i],
      ['afternoon', /\b(?:in\s+the\s+afternoon|afternoon)\b/i],
      ['evening', /\b(?:in\s+the\s+evening|evening)\b/i],
      ['night', /\b(?:at\s+night|night)\b/i],
    ];
    for(const [kind,re] of patterns){
      const m=t.match(re);
      if(m) return {kind, matchedText:m[0]};
    }
  }

  return null;
}

function applyDayPart(hour, kind){
  if(kind === 'morning' || kind === 'night') return to24h(hour, 'am');
  if(kind === 'afternoon' || kind === 'evening') return to24h(hour, 'pm');
  return hour;
}

function stripDayPart(text, cfg){
  if(cfg.code === 'ru-RU'){
    return text
      .replace(/(?:^|[^\p{L}])(?:с\s+утра|утром|утро|утра|после\s+обеда|днём|днем|день|дня|вечером|вечер|вечера|ночью|ночь|ночи)(?!\p{L})/giu, ' ')
      .replace(/\s+/g,' ').trim();
  }
  if(cfg.code === 'uk-UA'){
    return text
      .replace(/(?:^|[^\p{L}])(?:зранку|вранці|ранок|ранку|після\s+обіду|вдень|день|увечері|ввечері|вечір|вечора|вночі|ніч|ночі)(?!\p{L})/giu, ' ')
      .replace(/\s+/g,' ').trim();
  }
  if(cfg.code === 'en-US'){
    return text
      .replace(/\b(?:in\s+the\s+morning|morning|in\s+the\s+afternoon|afternoon|in\s+the\s+evening|evening|at\s+night|night)\b/gi, ' ')
      .replace(/\s+/g,' ').trim();
  }
  return text;
}

// Возвращает {hhmm, matchedText} или null.
function extractTime(text, cfg){
  const explicitPart = detectDayPart(text, cfg);
  const source = explicitPart ? stripDayPart(text, cfg) : text;

  // а) чч:мм или чч.мм, с необязательным am/pm
  let m = source.match(wb('(?:' + cfg.prep + '\\s*)?(\\d{1,2})[:.](\\d{2})\\s*(am|pm)?'));
  if(m){
    let h = parseInt(m[1],10), mm = parseInt(m[2],10);
    if(h<=23 && mm<=59){
      if(m[3]) h = to24h(h, m[3].toLowerCase());
      else if(explicitPart && h>=1 && h<=12) h = applyDayPart(h, explicitPart.kind);
      else h = applyPlanningHourHeuristic(h, cfg, m[1]);

      let matched = m[0];
      if(explicitPart) matched += ' ' + explicitPart.matchedText;
      return { hhmm: `${pad2(h)}:${pad2(mm)}`, matchedText: matched.trim() };
    }
  }

  const hourToken = '(\\d{1,2}|' + cfg.hourWordsList + ')';
  const optionalHourNoun = cfg.hourNoun ? '(?:\\s+' + cfg.hourNoun + ')?' : '';

  // б) Явная часть суток может стоять до ИЛИ после часа.
  // Мы уже нашли её в исходной строке и удалили из source, поэтому ищем сам час.
  if(explicitPart){
    m = source.match(wb('(?:' + cfg.prep + '\\s*)?' + hourToken + optionalHourNoun));
    if(m){
      const rawHour = parseHourToken(m[1], cfg);
      if(rawHour >= 1 && rawHour <= 12){
        const h = applyDayPart(rawHour, explicitPart.kind);
        return { hhmm: `${pad2(h)}:00`, matchedText: (m[0] + ' ' + explicitPart.matchedText).trim() };
      }
    }
  }

  // в) Старая проверенная форма: "2 часа дня" / "6 pm"
  m = text.match(wb('(?:' + cfg.prep + '\\s*)?' + hourToken + optionalHourNoun + '\\s*(' + cfg.meridiemWords + ')'));
  if(m){
    const word = m[2].toLowerCase();
    const kind = cfg.meridiem ? cfg.meridiem[word] : word;
    const rawHour = parseHourToken(m[1], cfg);
    if(rawHour >= 1 && rawHour <= 12){
      const h = to24h(rawHour, kind);
      return { hhmm: `${pad2(h)}:00`, matchedText: m[0] };
    }
  }

  // г) Без части суток: старое правило 1–7 => 13–19, 8+ остаётся как сказано.
  m = text.match(wb(cfg.prep + '\\s+' + hourToken));
  if(m){
    let h = parseHourToken(m[1], cfg);
    if(h<=23){
      h = applyPlanningHourHeuristic(h, cfg, m[1]);
      return { hhmm: `${pad2(h)}:00`, matchedText: m[0] };
    }
  }

  return null;
}

function cleanupTitle(text){
  return text
    .replace(/\s{2,}/g,' ')
    .replace(/^[\s,.-]+|[\s,.-]+$/g,'')
    .trim()
    .replace(/^./, c => c.toUpperCase());
}

// Главная функция разбора фразы
function parsePhrase(raw){
  const cfg = currentLangCfg();
  let working = raw.trim();
  let dateRes = extractDate(working, cfg);
  if(dateRes) working = working.replace(dateRes.matchedText, ' ');
  let timeRes = extractTime(working, cfg);
  if(timeRes) working = working.replace(timeRes.matchedText, ' ');
  const title = cleanupTitle(working);
  return {
    date: dateRes ? dateRes.iso : null,
    time: timeRes ? timeRes.hhmm : null,
    text: title || raw.trim()
  };
}

/* ---------- Действия с задачами ---------- */

function addTask({date, time, text}){
  const task = { id: uid(), date, time, text, done: false, alarmEnabled: false, alarmTriggered: false, createdAt: Date.now() };
  tasks.push(task);
  saveTasks(tasks);
  // Порядок задач не меняем: render() по-прежнему сортирует строго по дате/времени.
  // После добавления только прокручиваем экран к новой карточке и кратко подсвечиваем её.
  render({ focusTaskId: task.id });
  return task;
}
function updateTask(id, patch){
  const t = tasks.find(t=>t.id===id);
  if(!t) return;
  Object.assign(t, patch);
  saveTasks(tasks);
  render();
}
function deleteTask(id){
  const existing=tasks.find(t=>t.id===id); if(existing&&existing.alarmEnabled) cancelNativeAlarm(existing);
  tasks = tasks.filter(t=>t.id!==id);
  saveTasks(tasks);
  render();
}
function toggleDone(id){
  const t = tasks.find(t=>t.id===id);
  if(!t) return;
  t.done = !t.done;
  saveTasks(tasks);
  render();
}

/* ---------- Android bridge: системный будильник ---------- */
function normalizeTask(t){ if(typeof t.alarmEnabled!=='boolean')t.alarmEnabled=false; if(typeof t.alarmTriggered!=='boolean')t.alarmTriggered=false; return t; }
tasks.forEach(normalizeTask);
function taskAlarmTimestamp(t){ if(!t||!t.date||!t.time)return null; const d=new Date(`${t.date}T${t.time}:00`); return Number.isNaN(d.getTime())?null:d.getTime(); }
function scheduleNativeAlarm(t){ if(!hasNativeAlarm()||!t||!t.alarmEnabled)return false; const ts=taskAlarmTimestamp(t); if(!ts)return false; const b=getAndroidBridge(); try{ if(typeof b.scheduleAlarm==='function'){b.scheduleAlarm(String(t.id),String(t.text||''),Number(ts));return true;} if(typeof b.setAlarm==='function'){b.setAlarm(String(t.id),String(t.text||''),String(t.date),String(t.time));return true;} }catch(e){console.error(e)} return false; }
function cancelNativeAlarm(x){ if(!hasNativeAlarm())return false; const id=typeof x==='object'?x.id:x,b=getAndroidBridge(); try{ if(typeof b.cancelAlarm==='function'){b.cancelAlarm(String(id));return true;} }catch(e){console.error(e)} return false; }
function setAlarmEnabled(id,enabled){ const t=tasks.find(x=>x.id===id); if(!t)return false; normalizeTask(t); if(enabled){ if(!t.date||!t.time){showToast('Для будильника укажите дату и время задачи');return false;} const ts=taskAlarmTimestamp(t); if(!ts||ts<=Date.now()){openEdit(t);return false;} t.alarmEnabled=true;t.alarmTriggered=false;saveTasks(tasks);scheduleNativeAlarm(t); }else{ cancelNativeAlarm(t);t.alarmEnabled=false;t.alarmTriggered=false;saveTasks(tasks); } render();return true; }
window.voiceTasksAlarmTriggered=function(taskId){const t=tasks.find(x=>String(x.id)===String(taskId));if(!t)return;normalizeTask(t);t.alarmTriggered=true;saveTasks(tasks);render();};
function syncNativeTriggeredAlarms(){ if(!hasNativeAlarm())return; const b=getAndroidBridge(); if(!b||typeof b.getTriggeredAlarmIds!=='function')return; try{ const ids=JSON.parse(String(b.getTriggeredAlarmIds()||'[]')); let changed=false; ids.forEach(id=>{const t=tasks.find(x=>String(x.id)===String(id));if(t){normalizeTask(t);if(!t.alarmTriggered||t.alarmEnabled){t.alarmTriggered=true;t.alarmEnabled=false;changed=true;}}}); if(changed){saveTasks(tasks);render();} }catch(e){console.error(e)} }
window.addEventListener('focus',()=>setTimeout(syncNativeTriggeredAlarms,100));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(syncNativeTriggeredAlarms,100);});
setTimeout(syncNativeTriggeredAlarms,700);

/* ---------- Отрисовка ---------- */

let currentView = 'active';
const listEl = document.getElementById('list');
const emptyEl = document.getElementById('empty');

const DATE_LABELS = {
  ru: {
    noDate:'Без даты',
    weekdaysFull:['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'],
    monthsGenitive:['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'],
    order: (wd, day, month, year) => `${wd}, ${day} ${month} ${year}`,
  },
  uk: {
    noDate:'Без дати',
    weekdaysFull:['Неділя','Понеділок','Вівторок','Середа','Четвер',"П'ятниця",'Субота'],
    monthsGenitive:['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'],
    order: (wd, day, month, year) => `${wd}, ${day} ${month} ${year}`,
  },
  en: {
    noDate:'No date',
    weekdaysFull:['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
    monthsGenitive:['January','February','March','April','May','June','July','August','September','October','November','December'],
    order: (wd, day, month, year) => `${wd}, ${month} ${day}, ${year}`,
  },
};

function dateLabel(iso){
  const L = DATE_LABELS[getLang()] || DATE_LABELS.ru;
  const d = new Date(iso + 'T00:00:00');
  const wd = L.weekdaysFull[d.getDay()];
  const month = L.monthsGenitive[d.getMonth()];
  return L.order(wd, d.getDate(), month, d.getFullYear());
}

function sortKey(t){
  return (t.date || '9999-99-99') + ' ' + (t.time || '99:99');
}

let initialPositionDone = false;

function render(options={}){
  const filtered = tasks.filter(t => currentView==='active' ? !t.done : t.done);
  filtered.sort((a,b)=> sortKey(a) < sortKey(b) ? -1 : sortKey(a) > sortKey(b) ? 1 : 0);

  listEl.innerHTML = '';
  emptyEl.classList.toggle('hidden', filtered.length>0);
  const doneToolbar = document.getElementById('doneToolbar');
  if(doneToolbar) doneToolbar.classList.toggle('hidden', currentView !== 'done' || filtered.length === 0);

  const groups = new Map();
  const noDate = [];
  for(const t of filtered){
    if(!t.date){ noDate.push(t); continue; }
    if(!groups.has(t.date)) groups.set(t.date, []);
    groups.get(t.date).push(t);
  }

  if(noDate.length){
    listEl.appendChild(renderGroup((DATE_LABELS[getLang()]||DATE_LABELS.ru).noDate, noDate, false, null));
  }

  // Сегодняшний пустой блок НЕ создаём. Если на сегодня задач нет,
  // линия «Сейчас» отображается отдельно между прошедшими и будущими датами.
  const todayIso = toISODate(new Date());
  const dates = Array.from(groups.keys()).sort();
  let standaloneNowInserted = false;

  for(const iso of dates){
    if(currentView === 'active' && !groups.has(todayIso) && !standaloneNowInserted && iso > todayIso){
      listEl.appendChild(renderCurrentTimeMarker());
      standaloneNowInserted = true;
    }

    const dayTasks = groups.get(iso);
    listEl.appendChild(renderGroup(dateLabel(iso), dayTasks, dayTasks.some(isOverdue), iso));
  }

  // Если все датированные задачи находятся в прошлом, линия «Сейчас» идёт после них.
  // Если датированных задач нет совсем, она всё равно остаётся ориентиром в активном списке.
  if(currentView === 'active' && !groups.has(todayIso) && !standaloneNowInserted){
    listEl.appendChild(renderCurrentTimeMarker());
  }

  // После DOM-отрисовки выполняем только визуальную навигацию.
  requestAnimationFrame(()=>{
    requestAnimationFrame(()=>{
      if(options.focusTaskId){
        focusNewTask(options.focusTaskId);
      }else if(!initialPositionDone && currentView === 'active'){
        initialPositionDone = true;
        focusCurrentTime();
      }
    });
  });
}

function currentTimeLabel(){
  const now = new Date();
  return `Сейчас ${pad2(now.getHours())}-${pad2(now.getMinutes())}`;
}

function renderCurrentTimeMarker(){
  const marker = document.createElement('div');
  marker.className = 'currentTimeMarker';
  marker.id = 'currentTimeMarker';

  const lineLeft = document.createElement('span');
  lineLeft.className = 'currentTimeLine';
  const label = document.createElement('span');
  label.className = 'currentTimeText';
  label.textContent = currentTimeLabel();
  const lineRight = document.createElement('span');
  lineRight.className = 'currentTimeLine';

  marker.appendChild(lineLeft);
  marker.appendChild(label);
  marker.appendChild(lineRight);
  return marker;
}

function renderGroup(label, items, hasOverdue=false, iso=null){
  const wrap = document.createElement('div');
  wrap.className = 'dayGroup' + (iso === toISODate(new Date()) ? ' todayGroup' : '');
  if(iso) wrap.dataset.date = iso;

  const lbl = document.createElement('div');
  lbl.className = 'dayLabel' + (hasOverdue ? ' overdueDay' : '');
  lbl.textContent = label;
  wrap.appendChild(lbl);

  const todayIso = toISODate(new Date());
  const isToday = iso === todayIso && currentView === 'active';
  const now = new Date();
  const nowHHMM = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  let markerInserted = false;

  for(const t of items){
    // Ставим линию «Сейчас» между прошедшими и будущими задачами сегодняшнего дня.
    // Задачи без времени остаются в своём прежнем месте в конце дня.
    if(isToday && !markerInserted && (!t.time || t.time >= nowHHMM)){
      wrap.appendChild(renderCurrentTimeMarker());
      markerInserted = true;
    }
    wrap.appendChild(renderCard(t));
  }
  if(isToday && !markerInserted){
    wrap.appendChild(renderCurrentTimeMarker());
  }
  return wrap;
}

function scrollElementInList(el, verticalRatio=0.5, behavior='smooth'){
  if(!el) return;
  const listRect = listEl.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const relativeTop = elRect.top - listRect.top;
  const target = listEl.scrollTop + relativeTop - (listEl.clientHeight * verticalRatio) + (elRect.height / 2);
  listEl.scrollTo({ top: Math.max(0, target), behavior });
}

function focusCurrentTime(){
  const marker = document.getElementById('currentTimeMarker');
  if(marker){
    scrollElementInList(marker, 0.50, 'auto');
    return;
  }

  // Если сегодняшнего блока нет (например, вообще нет датированных задач),
  // ориентируемся на ближайшую будущую дату, не меняя список.
  const todayIso = toISODate(new Date());
  const futureGroup = Array.from(listEl.querySelectorAll('.dayGroup[data-date]'))
    .find(el => el.dataset.date >= todayIso);
  if(futureGroup) scrollElementInList(futureGroup, 0.50, 'auto');
}

function focusNewTask(taskId){
  const card = listEl.querySelector(`[data-task-id="${taskId}"]`);
  if(!card) return;

  // Пользователь интуитивно ищет только что добавленную запись ниже середины экрана.
  // Поэтому ставим её примерно на 68% высоты рабочей области, не меняя сортировку.
  scrollElementInList(card, 0.68, 'smooth');
  card.classList.add('justAdded');
  setTimeout(()=>card.classList.remove('justAdded'), 1900);
}

function formatTimeDisplay(hhmm){
  return hhmm.replace(':', '-');
}

function isOverdue(t){
  if(t.done || !t.date) return false;
  const now = new Date();
  const todayIso = toISODate(now);
  // Любая незавершённая задача с прошедшей датой считается просроченной,
  // даже если время для неё не было указано. Для сегодняшней даты учитываем
  // время только тогда, когда оно задано.
  if(t.date < todayIso) return true;
  if(t.date > todayIso || !t.time) return false;
  const dueAt = new Date(t.date + 'T' + t.time + ':00');
  return !Number.isNaN(dueAt.getTime()) && dueAt < now;
}

function renderCard(t){
  const card = document.createElement('div');
  card.className = 'taskCard' + (t.done ? ' done' : '') + (isOverdue(t) ? ' overdue' : '');
  card.dataset.taskId = t.id;

  const mark = document.createElement('div');
  mark.className = 'doneMark';
  mark.textContent = '✓';
  card.appendChild(mark);

  const body = document.createElement('div');
  body.className = 'taskBody';

  const time = document.createElement('div');
  time.className = 'taskTime' + (t.time ? '' : ' notime');
  time.textContent = t.time ? formatTimeDisplay(t.time) : 'без времени';
  body.appendChild(time);

  const text = document.createElement('div');
  text.className = 'taskText';
  text.textContent = t.text;
  body.appendChild(text);

  const actions = document.createElement('div');
  actions.className = 'taskActions';

  const editBtn = document.createElement('button');
  editBtn.textContent = 'Редактировать';
  editBtn.onclick = () => openEdit(t);
  actions.appendChild(editBtn);

  const doneBtn = document.createElement('button');
  if(t.done){
    doneBtn.textContent = 'Вернуть';
    doneBtn.className = 'returnA';
  }else{
    doneBtn.textContent = 'Выполнено';
    doneBtn.className = 'doneA';
  }
  doneBtn.onclick = () => toggleDone(t.id);
  actions.appendChild(doneBtn);

  const delBtn = document.createElement('button');
  delBtn.textContent = 'Удалить';
  delBtn.className = 'deleteA';
  delBtn.onclick = () => openDeleteConfirm(t.id);
  actions.appendChild(delBtn);

  body.appendChild(actions);
  card.appendChild(body);
  if(hasNativeAlarm() && !t.done){
    normalizeTask(t);
    const alarmBtn=document.createElement('button');
    const overdue=isOverdue(t);
    // Три состояния будильника:
    // серый = выключен, зелёный = включён и ждёт, красный = реально сработал.
    // Сам факт просрочки цвет не меняет.
    let alarmState='inactive';
    if(t.alarmTriggered) alarmState='triggered';
    else if(t.alarmEnabled) alarmState='active';

    alarmBtn.className='alarmIconBtn '+alarmState;
    alarmBtn.type='button';
    alarmBtn.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M22 5.72 17.4 1.86l-.65.76 4.6 3.86.65-.76ZM7.24 2.62l-.64-.76L2 5.71l.65.76 4.59-3.85ZM12.5 8H11v6l4.75 2.85.75-1.23-4-2.37V8ZM12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 14.5A6.5 6.5 0 1 1 12 5a6.5 6.5 0 0 1 0 13.5Z"/></svg>';

    if(alarmState==='active') alarmBtn.title='Будильник активен — отключить';
    else if(alarmState==='triggered') alarmBtn.title='Будильник сработал — изменить задачу';
    else if(overdue) alarmBtn.title='Будильник выключен — изменить просроченную задачу';
    else alarmBtn.title='Активировать будильник';

    alarmBtn.onclick=()=>{
      // У любой задачи в прошлом нажатие на будильник открывает редактирование.
      if(overdue){ openEdit(t); return; }
      setAlarmEnabled(t.id,!t.alarmEnabled);
    };
    card.appendChild(alarmBtn);
  }
  return card;
}

/* ---------- Модалка редактирования ---------- */

const modalOverlay = document.getElementById('modalOverlay');
const modalTitle = document.getElementById('modalTitle');
const editText = document.getElementById('editText');
const editDate = document.getElementById('editDate');
const editTime = document.getElementById('editTime');
const alarmEditor=document.getElementById('alarmEditor');
const alarmToggleBtn=document.getElementById('alarmToggleBtn');
let editingId=null, editingAlarmEnabled=false;

function openEdit(t){
  editingId = t.id;
  modalTitle.textContent = 'Редактировать задачу';
  editText.value = t.text;
  editDate.value = t.date || '';
  editTime.value = t.time || '';
  normalizeTask(t); editingAlarmEnabled=!!t.alarmEnabled;
  if(alarmEditor) alarmEditor.classList.toggle('hidden',!hasNativeAlarm());
  updateAlarmEditorButton();
  modalOverlay.classList.remove('hidden');
}
function updateAlarmEditorButton(){if(!alarmToggleBtn)return;alarmToggleBtn.classList.toggle('active',editingAlarmEnabled);alarmToggleBtn.textContent=editingAlarmEnabled?'⏰ Будильник активен — отключить':'⏰ Активировать будильник';}
if(alarmToggleBtn) alarmToggleBtn.onclick=()=>{if(!hasNativeAlarm())return;if(!editingAlarmEnabled&&(!editDate.value||!editTime.value)){showToast('Для будильника укажите дату и время задачи');return;}editingAlarmEnabled=!editingAlarmEnabled;updateAlarmEditorButton();};
document.getElementById('modalCancel').onclick = () => modalOverlay.classList.add('hidden');
document.getElementById('modalSave').onclick=()=>{
  if(!editingId)return;
  const t=tasks.find(x=>x.id===editingId);
  if(!t)return;
  normalizeTask(t);

  const wasTriggered=!!t.alarmTriggered;
  const oldDate=t.date||null;
  const oldTime=t.time||null;
  if(t.alarmEnabled)cancelNativeAlarm(t);

  t.date=editDate.value||null;
  t.time=editTime.value||null;
  t.text=editText.value.trim()||'Без названия';
  t.alarmEnabled=hasNativeAlarm()?!!editingAlarmEnabled:false;

  if(t.alarmEnabled&&(!t.date||!t.time)){
    t.alarmEnabled=false;
    showToast('Будильник отключён: нет даты или времени');
  }

  // Красный означает исторический факт срабатывания.
  // Сохраняем его, если пользователь просто отредактировал уже прошедшую задачу.
  // Если поставлен новый будильник или задача перенесена на другое время/дату,
  // начинается новый цикл и состояние "сработал" сбрасывается.
  const scheduleChanged=(oldDate!==t.date)||(oldTime!==t.time);
  if(t.alarmEnabled || scheduleChanged) t.alarmTriggered=false;
  else t.alarmTriggered=wasTriggered;

  saveTasks(tasks);
  if(t.alarmEnabled)scheduleNativeAlarm(t);
  render();
  modalOverlay.classList.add('hidden');
  editingId=null;
};

/* ---------- Подтверждение удаления ---------- */
const confirmOverlay = document.getElementById('confirmOverlay');
let deletingId = null;
function openDeleteConfirm(id){
  deletingId = id;
  confirmOverlay.classList.remove('hidden');
}
document.getElementById('confirmCancel').onclick = () => { confirmOverlay.classList.add('hidden'); deletingId=null; };
document.getElementById('confirmDelete').onclick = () => {
  if(deletingId) deleteTask(deletingId);
  confirmOverlay.classList.add('hidden');
  deletingId = null;
};

/* ---------- Массовое удаление выполненных ---------- */
const deleteAllDoneBtn = document.getElementById('deleteAllDoneBtn');
const confirmAllDoneOverlay = document.getElementById('confirmAllDoneOverlay');
if(deleteAllDoneBtn){
  deleteAllDoneBtn.onclick = () => {
    if(!tasks.some(t=>t.done)) return;
    confirmAllDoneOverlay.classList.remove('hidden');
  };
}
document.getElementById('confirmAllDoneCancel').onclick = () => confirmAllDoneOverlay.classList.add('hidden');
document.getElementById('confirmAllDoneDelete').onclick = () => {
  tasks = tasks.filter(t=>!t.done);
  saveTasks(tasks);
  confirmAllDoneOverlay.classList.add('hidden');
  render();
  showToast('Выполненные задачи удалены');
};

/* ---------- Вкладки ---------- */
document.querySelectorAll('.tab').forEach(btn=>{
  btn.onclick = () => {
    document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    currentView = btn.dataset.view;
    render();
  };
});

/* ---------- Ввод текста ---------- */
const textInput = document.getElementById('textInput');
const sendBtn = document.getElementById('sendBtn');

function submitPhrase(raw){
  if(!raw || !raw.trim()) return;
  const parsed = parsePhrase(raw);
  addTask(parsed);
  showToast(parsed.date ? 'Задача добавлена' : 'Добавлено — уточните дату вручную');
}
sendBtn.onclick = () => { submitPhrase(textInput.value); textInput.value=''; };
textInput.addEventListener('keydown', e=>{
  if(e.key === 'Enter'){ submitPhrase(textInput.value); textInput.value=''; }
});

const PLACEHOLDERS = {
  ru: 'Например: завтра в 10 утра гараж',
  uk: 'Наприклад: завтра о 10 ранку гараж',
  en: 'e.g. tomorrow at 10am garage',
};

/* ---------- Переключатель языка ---------- */
const langButtons = document.querySelectorAll('.langBtn');
function applyLangUI(){
  const lang = getLang();
  langButtons.forEach(b => b.classList.toggle('active', b.dataset.lang === lang));
  textInput.placeholder = PLACEHOLDERS[lang] || PLACEHOLDERS.ru;
  if(recognition) recognition.lang = currentLangCfg().code;
}
langButtons.forEach(btn=>{
  btn.onclick = () => { setLang(btn.dataset.lang); applyLangUI(); render(); };
});

/* ---------- Голосовой ввод ---------- */
const micBtn = document.getElementById('micBtn');
let recognition = null;

if(window.AndroidBridge && window.AndroidBridge.startListening){
  // Нативное распознавание речи Android (используется внутри APK, т.к. системный
  // WebView не поддерживает Web Speech API — см. MainActivity.java)
  window.startVoiceResult = function(text){
    micBtn.classList.remove('listening');
    if(text){ textInput.value = text; submitPhrase(text); textInput.value = ''; }
  };
  window.startVoiceError = function(code){
    micBtn.classList.remove('listening');
    if(typeof code === 'number'){
      showToast('Не удалось распознать голос (' + code + ')');
    }else{
      showToast('Не удалось распознать голос');
    }
  };
  micBtn.onclick = () => {
    micBtn.classList.add('listening');
    window.AndroidBridge.startListening(currentLangCfg().code);
  };
}else{
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(SR){
    recognition = new SR();
    recognition.lang = currentLangCfg().code;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => micBtn.classList.add('listening');
    recognition.onend = () => micBtn.classList.remove('listening');
    recognition.onerror = () => { micBtn.classList.remove('listening'); showToast('Не удалось распознать голос'); };
    recognition.onresult = (e) => {
      const said = e.results[0][0].transcript;
      textInput.value = said;
      submitPhrase(said);
      textInput.value = '';
    };
    micBtn.onclick = () => {
      recognition.lang = currentLangCfg().code;
      try{ recognition.start(); }catch(e){}
    };
  }else{
    micBtn.onclick = () => showToast('Голосовой ввод не поддерживается этим браузером');
  }
}
applyLangUI();

/* ---------- Тосты ---------- */
let toastTimer = null;
function showToast(msg){
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>el.classList.add('hidden'), 2200);
}

/* ---------- Тема: светлая по умолчанию ---------- */
const themeBtn = document.getElementById('themeBtn');
const themeColorMeta = document.getElementById('themeColorMeta');

function getTheme(){
  // Явный выбор пользователя сохраняется. Для новых установок тема всегда светлая.
  return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
}

function applyTheme(theme, save=true){
  const next = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  if(save) localStorage.setItem(THEME_KEY, next);
  if(themeBtn){
    // Показываем тему, на которую переключит следующее нажатие.
    themeBtn.textContent = next === 'dark' ? '☀' : '☾';
    themeBtn.setAttribute('aria-label', next === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему');
    themeBtn.title = next === 'dark' ? 'Светлая тема' : 'Тёмная тема';
  }
  if(themeColorMeta){
    themeColorMeta.setAttribute('content', next === 'dark' ? '#14171A' : '#F5F7FA');
  }
}

applyTheme(getTheme(), false);
if(themeBtn){
  themeBtn.onclick = () => applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

/* ---------- Меню: экспорт / импорт ---------- */
const menuBtn = document.getElementById('menuBtn');
const menu = document.getElementById('menu');
menuBtn.onclick = () => menu.classList.toggle('hidden');
document.addEventListener('click', (e)=>{
  if(!menu.contains(e.target) && e.target!==menuBtn) menu.classList.add('hidden');
});

function updateVersionInfo(){const el=document.getElementById('versionInfo');if(!el)return;const core=getAndroidCoreVersion();el.textContent=core?`Planner ${PLANNER_VERSION} · Android Core ${core}`:`Planner ${PLANNER_VERSION}`;} updateVersionInfo();

document.getElementById('exportBtn').onclick = () => {
  const filename = `voice-tasks-${toISODate(new Date())}.json`;
  const json = JSON.stringify(tasks, null, 2);
  const bridge = getAndroidBridge();
  if(bridge && typeof bridge.exportTasks === 'function'){
    bridge.exportTasks(json, filename);
    menu.classList.add('hidden');
    return;
  }
  const blob = new Blob([json], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  menu.classList.add('hidden');
};

function importTasksFromJson(raw){
  try{
    const imported = JSON.parse(raw);
    if(!Array.isArray(imported)) throw new Error('bad format');
    const byId = new Map(tasks.map(t=>[t.id,t]));
    for(const t of imported){
      if(t && t.id) byId.set(t.id, t);
    }
    tasks=Array.from(byId.values()).map(normalizeTask);
    if(!hasNativeAlarm()) tasks.forEach(t=>{t.alarmEnabled=false;t.alarmTriggered=false;});
    saveTasks(tasks);
    render();
    showToast('Импорт завершён');
  }catch(e){
    showToast('Не удалось прочитать файл');
  }
}
window.voiceTasksImportJson = importTasksFromJson;

const importFile = document.getElementById('importFile');
document.getElementById('importBtn').onclick = () => {
  const bridge = getAndroidBridge();
  if(bridge && typeof bridge.importTasks === 'function'){
    bridge.importTasks();
    menu.classList.add('hidden');
    return;
  }
  importFile.click();
  menu.classList.add('hidden');
};
importFile.onchange = () => {
  const file = importFile.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => importTasksFromJson(reader.result);
  reader.readAsText(file);
  importFile.value = '';
};

render({ initial: true });
