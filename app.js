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
    hourWords: {'один':1,'одну':1,'два':2,'две':2,'три':3,'четыре':4},
    hourWordsList: 'один|одну|два|две|три|четыре',
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
    prep: '(?:об|о)',
    meridiem: {'ранку':'am','дня':'pm','вечора':'pm','ночі':'am'},
    meridiemWords: 'ранку|дня|вечора|ночі',
    hourWords: {'одна':1,'два':2,'дві':2,'три':3,'чотири':4},
    hourWordsList: 'одна|два|дві|три|чотири',
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
    meridiemWords: 'am|pm',
    hourWords: {'one':1,'two':2,'three':3,'four':4},
    hourWordsList: 'one|two|three|four',
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
  // б) "2 часа дня" / "два часа дня" / "6 pm" — с частью суток
  const hourToken = '(\\d{1,2}|' + cfg.hourWordsList + ')';
  const optionalHourNoun = cfg.hourNoun ? '(?:\\s+' + cfg.hourNoun + ')?' : '';
  m = text.match(wb('(?:' + cfg.prep + '\\s*)?' + hourToken + optionalHourNoun + '\\s*(' + cfg.meridiemWords + ')'));
  if(m){
    const word = m[2].toLowerCase();
    const kind = cfg.meridiem ? cfg.meridiem[word] : word; // ru/uk словарь -> am/pm, en уже am/pm
    const rawHour = parseHourToken(m[1], cfg);
    if(rawHour >= 1 && rawHour <= 12){
      const h = to24h(rawHour, kind);
      return { hhmm: `${pad2(h)}:00`, matchedText: m[0] };
    }
  }
  // в) "в 9" / "в два" / "at two" — только с предлогом
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

function isOverdue(t){
  if(t.done || !t.date || !t.time) return false;
  const dueAt = new Date(t.date + 'T' + t.time + ':00');
  return !Number.isNaN(dueAt.getTime()) && dueAt < new Date();
}

function renderCard(t){
  const card = document.createElement('div');
  card.className = 'taskCard' + (t.done ? ' done' : '') + (isOverdue(t) ? ' overdue' : '');

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
  modalTitle.textContent = 'Редактировать задачу';
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
    text: editText.value.trim() || 'Без названия'
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
  window.startVoiceError = function(){
    micBtn.classList.remove('listening');
    showToast('Не удалось распознать голос');
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

/* ---------- Меню: экспорт / импорт ---------- */
const menuBtn = document.getElementById('menuBtn');
const menu = document.getElementById('menu');
menuBtn.onclick = () => menu.classList.toggle('hidden');
document.addEventListener('click', (e)=>{
  if(!menu.contains(e.target) && e.target!==menuBtn) menu.classList.add('hidden');
});

document.getElementById('exportBtn').onclick = () => {
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
document.getElementById('importBtn').onclick = () => { importFile.click(); menu.classList.add('hidden'); };
importFile.onchange = () => {
  const file = importFile.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const imported = JSON.parse(reader.result);
      if(!Array.isArray(imported)) throw new Error('bad format');
      // объединяем по id, не удаляя существующие
      const byId = new Map(tasks.map(t=>[t.id,t]));
      for(const t of imported){
        if(t && t.id) byId.set(t.id, t);
      }
      tasks = Array.from(byId.values());
      saveTasks(tasks);
      render();
      showToast('Импорт завершён');
    }catch(e){
      showToast('Не удалось прочитать файл');
    }
  };
  reader.readAsText(file);
  importFile.value = '';
};

render();
