/* Голосовые задачи — логика приложения
   Хранение: localStorage, ключ voiceTasks_v1
   Приложение не даёт советов и не принимает решений — только выполняет команды. */

const STORAGE_KEY = 'voiceTasks_v1';

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

function detectInitialLang(){
  const browserLang = (navigator.language || navigator.userLanguage || '').toLowerCase();
  if(browserLang.startsWith('uk')) return 'uk';
  if(browserLang.startsWith('en')) return 'en';
  return 'ru';
}
if(!localStorage.getItem(LANG_KEY)){
  setLang(detectInitialLang());
}

const UI_TEXT = {
  ru: {
    appTitle:'Голосовые задачи',
    activeTab:'Активные',
    doneTab:'Выполненные',
    empty:'Пока пусто. Скажите или напишите задачу ниже.',
    voiceInput:'Голосовой ввод',
    add:'Добавить',
    editTask:'Редактировать задачу',
    textLabel:'Текст',
    dateLabel:'Дата',
    timeLabel:'Время (необязательно)',
    cancel:'Отмена',
    save:'Сохранить',
    deleteQuestion:'Удалить задачу?',
    deleteWarning:'Действие нельзя отменить.',
    delete:'Удалить',
    menu:'Меню',
    exportFile:'Экспорт в файл',
    importFile:'Импорт из файла',
    noTime:'без времени',
    edit:'Редактировать',
    returnTask:'Вернуть',
    done:'Выполнено',
    untitled:'Без названия',
    taskAdded:'Задача добавлена',
    taskAddedNoDate:'Добавлено — уточните дату вручную',
    voiceError:'Не удалось распознать голос',
    voiceUnsupported:'Голосовой ввод не поддерживается этим браузером',
    importDone:'Импорт завершён',
    importError:'Не удалось прочитать файл',
    placeholder:'Например: завтра в 10 утра гараж'
  },
  uk: {
    appTitle:'Голосові завдання',
    activeTab:'Активні',
    doneTab:'Виконані',
    empty:'Поки порожньо. Скажіть або напишіть завдання нижче.',
    voiceInput:'Голосове введення',
    add:'Додати',
    editTask:'Редагувати завдання',
    textLabel:'Текст',
    dateLabel:'Дата',
    timeLabel:'Час (необов’язково)',
    cancel:'Скасувати',
    save:'Зберегти',
    deleteQuestion:'Видалити завдання?',
    deleteWarning:'Цю дію не можна скасувати.',
    delete:'Видалити',
    menu:'Меню',
    exportFile:'Експорт у файл',
    importFile:'Імпорт із файлу',
    noTime:'без часу',
    edit:'Редагувати',
    returnTask:'Повернути',
    done:'Виконано',
    untitled:'Без назви',
    taskAdded:'Завдання додано',
    taskAddedNoDate:'Додано — уточніть дату вручну',
    voiceError:'Не вдалося розпізнати голос',
    voiceUnsupported:'Голосове введення не підтримується цим браузером',
    importDone:'Імпорт завершено',
    importError:'Не вдалося прочитати файл',
    placeholder:'Наприклад: завтра о 10 ранку гараж'
  },
  en: {
    appTitle:'VoiceTasks',
    activeTab:'Active',
    doneTab:'Completed',
    empty:'Nothing here yet. Say or type a task below.',
    voiceInput:'Voice input',
    add:'Add',
    editTask:'Edit task',
    textLabel:'Text',
    dateLabel:'Date',
    timeLabel:'Time (optional)',
    cancel:'Cancel',
    save:'Save',
    deleteQuestion:'Delete task?',
    deleteWarning:'This action cannot be undone.',
    delete:'Delete',
    menu:'Menu',
    exportFile:'Export to file',
    importFile:'Import from file',
    noTime:'no time',
    edit:'Edit',
    returnTask:'Restore',
    done:'Done',
    untitled:'Untitled',
    taskAdded:'Task added',
    taskAddedNoDate:'Added — set the date manually if needed',
    voiceError:'Could not recognize speech',
    voiceUnsupported:'Voice input is not supported by this browser',
    importDone:'Import complete',
    importError:'Could not read the file',
    placeholder:'Example: tomorrow at two pm garage'
  }
};
function t(key){
  const lang = getLang();
  return (UI_TEXT[lang] && UI_TEXT[lang][key]) || UI_TEXT.ru[key] || key;
}
function applyStaticTexts(){
  document.documentElement.lang = getLang();
  document.title = t('appTitle');
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => {
    el.setAttribute('aria-label', t(el.dataset.i18nAria));
  });
}

/* ---------- Разбор фразы: дата / время / текст (RU / UK / EN) ---------- */

// В JS \b не распознаёт кириллицу как "словесный" символ, поэтому границы слов
// собираем вручную через юникодные lookaround-проверки.
function wb(pattern){
  return new RegExp('(?<![\\p{L}\\p{N}_])(?:' + pattern + ')(?![\\p{L}\\p{N}_])', 'iu');
}

function pad2(n){ return String(n).padStart(2,'0'); }
function toISODate(d){ return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
function isRealDate(year, month, day){
  const d = new Date(year, month-1, day);
  return d.getFullYear() === year && d.getMonth() === month-1 && d.getDate() === day;
}
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
    meridiem: {'утра':'am','утром':'am','дня':'pm','днем':'pm','днём':'pm','после обеда':'pm','вечера':'pm','вечером':'pm','ночи':'am','ночью':'am'},
    meridiemWords: 'после\\s+обеда|утра|утром|дня|днем|днём|вечера|вечером|ночи|ночью',
    hourWords: {'час':1,'часу':1,'один':1,'одну':1,'два':2,'две':2,'три':3,'четыре':4,'пять':5,'шесть':6,'семь':7,'восемь':8,'девять':9,'десять':10,'одиннадцать':11,'двенадцать':12},
    hourWordsList: 'час|часу|один|одну|два|две|три|четыре|пять|шесть|семь|восемь|девять|десять|одиннадцать|двенадцать',
    hourNoun: 'час(?:а|ов)?',
    ambiguousAfternoonMax: 4,
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
    prep: '(?:об|о|у|в)',
    meridiem: {'ранку':'am','зранку':'am','дня':'pm','вдень':'pm','після обіду':'pm','вечора':'pm','увечері':'pm','ввечері':'pm','ночі':'am','вночі':'am'},
    meridiemWords: 'після\\s+обіду|ранку|зранку|дня|вдень|вечора|увечері|ввечері|ночі|вночі',
    hourWords: {'одна':1,'першій':1,'першу':1,'два':2,'дві':2,'другій':2,'три':3,'третій':3,'чотири':4,'четвертій':4,'пʼять':5,"п'ять":5,'п’ять':5,'шість':6,'сім':7,'вісім':8,"дев'ять":9,'дев’ять':9,'десять':10,'одинадцять':11,'дванадцять':12},
    hourWordsList: "одна|першій|першу|два|дві|другій|три|третій|чотири|четвертій|п['’ʼ]?ять|шість|сім|вісім|дев['’]?ять|десять|одинадцять|дванадцять",
    hourNoun: 'годин(?:а|и|і|у)?',
    ambiguousAfternoonMax: 4,
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
    meridiem: {'am':'am','pm':'pm','in the morning':'am','morning':'am','in the afternoon':'pm','afternoon':'pm','in the evening':'pm','evening':'pm','at night':'am','night':'am'},
    meridiemWords: 'in\\s+the\\s+morning|in\\s+the\\s+afternoon|in\\s+the\\s+evening|at\\s+night|morning|afternoon|evening|night|am|pm',
    hourWords: {'one':1,'two':2,'three':3,'four':4,'five':5,'six':6,'seven':7,'eight':8,'nine':9,'ten':10,'eleven':11,'twelve':12},
    hourWordsList: 'one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve',
    hourNoun: "(?:o(?:'|\\s*)clock|hours?)",
    ambiguousAfternoonMax: 4,
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
function normalizeSpeechToken(token){
  return token.toLowerCase().replace(/ʼ/g, "'").replace(/’/g, "'").replace(/\s+/g, ' ').trim();
}
function parseHourToken(token, cfg){
  if(/^\d+$/.test(token)) return parseInt(token, 10);
  const normalized = normalizeSpeechToken(token);
  return cfg.hourWords && cfg.hourWords[normalized];
}
function applyPlanningHourHeuristic(hour, cfg, rawToken){
  if(hour >= 1 && hour <= (cfg.ambiguousAfternoonMax || 0) && !/^0/.test(String(rawToken))){
    return hour + 12;
  }
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
    if(day>=1 && day<=31 && month>=1 && month<=12 && isRealDate(year, month, day)){
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
    if(!isRealDate(year, month, day)) return null;
    let d = new Date(year, month-1, day);
    if(d < today) d = new Date(year+1, month-1, day);
    return { iso: toISODate(d), matchedText: m[0] };
  }
  m = text.match(wb('(' + cfg.monthsList + ')\\s+(\\d{1,2})(?:st|nd|rd|th)?'));
  if(m){
    const day = parseInt(m[2],10);
    const month = cfg.months[m[1].toLowerCase()];
    let year = today.getFullYear();
    if(!isRealDate(year, month, day)) return null;
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

// Возвращает {hhmm, matchedText} или null.
function extractTime(text, cfg){
  // а) чч:мм или чч.мм, с необязательным am/pm (для EN)
  let m = text.match(wb('(?:' + cfg.prep + '\\s*)?(\\d{1,2})[:.](\\d{2})\\s*(am|pm)?'));
  if(m){
    let h = parseInt(m[1],10), mm = parseInt(m[2],10);
    if(h<=23 && mm<=59){
      if(m[3]) h = to24h(h, m[3].toLowerCase());
      else h = applyPlanningHourHeuristic(h, cfg, m[1]);
      return { hhmm: `${pad2(h)}:${pad2(mm)}`, matchedText: m[0] };
    }
  }
  // б) "2 часа дня" / "два часа дня" / "6 pm" — с частью суток.
  const hourToken = '(\\d{1,2}|' + cfg.hourWordsList + ')';
  const optionalHourNoun = cfg.hourNoun ? '(?:\\s+' + cfg.hourNoun + ')?' : '';
  m = text.match(wb('(?:' + cfg.prep + '\\s*)?' + hourToken + optionalHourNoun + '\\s*(' + cfg.meridiemWords + ')'));
  if(m){
    const word = normalizeSpeechToken(m[2]);
    const kind = cfg.meridiem ? cfg.meridiem[word] : word; // ru/uk словарь -> am/pm, en уже am/pm
    const rawHour = parseHourToken(m[1], cfg);
    if(rawHour >= 1 && rawHour <= 12){
      const h = to24h(rawHour, kind);
      return { hhmm: `${pad2(h)}:00`, matchedText: m[0] };
    }
  }
  // в) "в 9" / "в два" / "at two" — только с предлогом, чтобы не путать с другими числами.
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
  const task = { id: uid(), date, time, text, done: false, createdAt: Date.now() };
  tasks.push(task);
  saveTasks(tasks);
  render();
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

function render(){
  const filtered = tasks.filter(t => currentView==='active' ? !t.done : t.done);
  filtered.sort((a,b)=> sortKey(a) < sortKey(b) ? -1 : sortKey(a) > sortKey(b) ? 1 : 0);

  listEl.innerHTML = '';
  emptyEl.classList.toggle('hidden', filtered.length>0);

  const groups = new Map();
  const noDate = [];
  for(const t of filtered){
    if(!t.date){ noDate.push(t); continue; }
    if(!groups.has(t.date)) groups.set(t.date, []);
    groups.get(t.date).push(t);
  }

  if(noDate.length){
    listEl.appendChild(renderGroup((DATE_LABELS[getLang()]||DATE_LABELS.ru).noDate, noDate));
  }
  for(const [iso, list] of groups){
    listEl.appendChild(renderGroup(dateLabel(iso), list));
  }
}

function renderGroup(label, items){
  const wrap = document.createElement('div');
  wrap.className = 'dayGroup';
  const lbl = document.createElement('div');
  lbl.className = 'dayLabel';
  lbl.textContent = label;
  wrap.appendChild(lbl);
  for(const t of items) wrap.appendChild(renderCard(t));
  return wrap;
}

function formatTimeDisplay(hhmm){
  return hhmm.replace(':', '-');
}

function renderCard(t){
  const card = document.createElement('div');
  card.className = 'taskCard' + (t.done ? ' done' : '');

  const mark = document.createElement('div');
  mark.className = 'doneMark';
  mark.textContent = '✓';
  card.appendChild(mark);

  const body = document.createElement('div');
  body.className = 'taskBody';

  const time = document.createElement('div');
  time.className = 'taskTime' + (t.time ? '' : ' notime');
  time.textContent = t.time ? formatTimeDisplay(t.time) : t('noTime');
  body.appendChild(time);

  const text = document.createElement('div');
  text.className = 'taskText';
  text.textContent = t.text;
  body.appendChild(text);

  const actions = document.createElement('div');
  actions.className = 'taskActions';

  const editBtn = document.createElement('button');
  editBtn.textContent = t('edit');
  editBtn.onclick = () => openEdit(t);
  actions.appendChild(editBtn);

  const doneBtn = document.createElement('button');
  if(t.done){
    doneBtn.textContent = t('returnTask');
    doneBtn.className = 'returnA';
  }else{
    doneBtn.textContent = t('done');
    doneBtn.className = 'doneA';
  }
  doneBtn.onclick = () => toggleDone(t.id);
  actions.appendChild(doneBtn);

  const delBtn = document.createElement('button');
  delBtn.textContent = t('delete');
  delBtn.className = 'deleteA';
  delBtn.onclick = () => openDeleteConfirm(t.id);
  actions.appendChild(delBtn);

  body.appendChild(actions);
  card.appendChild(body);
  return card;
}

/* ---------- Модалка редактирования ---------- */

const modalOverlay = document.getElementById('modalOverlay');
const modalTitle = document.getElementById('modalTitle');
const editText = document.getElementById('editText');
const editDate = document.getElementById('editDate');
const editTime = document.getElementById('editTime');
let editingId = null;

function openEdit(t){
  editingId = t.id;
  modalTitle.textContent = t('editTask');
  editText.value = t.text;
  editDate.value = t.date || '';
  editTime.value = t.time || '';
  modalOverlay.classList.remove('hidden');
}
document.getElementById('modalCancel').onclick = () => modalOverlay.classList.add('hidden');
document.getElementById('modalSave').onclick = () => {
  if(!editingId) return;
  updateTask(editingId, {
    date: editDate.value || null,
    time: editTime.value || null,
    text: editText.value.trim() || t('untitled')
  });
  modalOverlay.classList.add('hidden');
  editingId = null;
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
  showToast(parsed.date ? t('taskAdded') : t('taskAddedNoDate'));
}
function submitVoicePhrase(raw){
  try{
    submitPhrase(raw);
  }finally{
    textInput.value = '';
  }
}
sendBtn.onclick = () => { submitPhrase(textInput.value); textInput.value=''; };
textInput.addEventListener('keydown', e=>{
  if(e.key === 'Enter'){ submitPhrase(textInput.value); textInput.value=''; }
});

/* ---------- Переключатель языка ---------- */
const langButtons = document.querySelectorAll('.langBtn');
function applyLangUI(){
  const lang = getLang();
  applyStaticTexts();
  langButtons.forEach(b => b.classList.toggle('active', b.dataset.lang === lang));
  textInput.placeholder = t('placeholder');
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
    if(text) submitVoicePhrase(text);
    else textInput.value = '';
  };
  window.startVoiceError = function(){
    micBtn.classList.remove('listening');
    showToast(t('voiceError'));
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
    recognition.onerror = () => { micBtn.classList.remove('listening'); showToast(t('voiceError')); };
    recognition.onresult = (e) => {
      const said = e.results[0][0].transcript;
      submitVoicePhrase(said);
    };
    micBtn.onclick = () => {
      recognition.lang = currentLangCfg().code;
      try{ recognition.start(); }catch(e){}
    };
  }else{
    micBtn.onclick = () => showToast(t('voiceUnsupported'));
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

/* ---------- Меню: экспорт / импорт ---------- */
const menuBtn = document.getElementById('menuBtn');
const menu = document.getElementById('menu');
menuBtn.onclick = () => menu.classList.toggle('hidden');
document.addEventListener('click', (e)=>{
  if(!menu.contains(e.target) && e.target!==menuBtn) menu.classList.add('hidden');
});

document.getElementById('exportBtn').onclick = () => {
  if(window.AndroidBridge && window.AndroidBridge.exportTasks){
    window.AndroidBridge.exportTasks(JSON.stringify(tasks, null, 2));
    menu.classList.add('hidden');
    return;
  }
  const blob = new Blob([JSON.stringify(tasks, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `voice-tasks-${toISODate(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(url);
  menu.classList.add('hidden');
};

const importFile = document.getElementById('importFile');
function mergeImportedTasks(rawJson){
  const imported = JSON.parse(rawJson);
  if(!Array.isArray(imported)) throw new Error('bad format');
  // объединяем по id, не удаляя существующие
  const byId = new Map(tasks.map(t=>[t.id,t]));
  for(const t of imported){
    if(t && t.id) byId.set(t.id, t);
  }
  tasks = Array.from(byId.values());
  saveTasks(tasks);
  render();
  showToast(t('importDone'));
}
window.importTasksFromAndroid = function(rawJson){
  try{
    mergeImportedTasks(rawJson);
  }catch(e){
    showToast(t('importError'));
  }
};
document.getElementById('importBtn').onclick = () => {
  if(window.AndroidBridge && window.AndroidBridge.importTasks){
    window.AndroidBridge.importTasks();
  }else{
    importFile.click();
  }
  menu.classList.add('hidden');
};
importFile.onchange = () => {
  const file = importFile.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      mergeImportedTasks(reader.result);
    }catch(e){
      showToast(t('importError'));
    }
  };
  reader.readAsText(file);
  importFile.value = '';
};

render();
