const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const STORAGE = 'keydeck.v1';
const THEMES = ['dark','light','cyberspace','serika','dracula','nord','gruvbox','miami'];
const DropImport = window.KeystrokeDrop;

const els = { setup: $('#setupView'), practice: $('#practiceView'), results: $('#resultsView'), importCard: $('#importCard'), input: $('#cardInput'), file: $('#fileInput'), parse: $('#parseStatus'), start: $('#startBtn'), answer: $('#answerInput'), form: $('#answerForm'), learnControls: $('#learnControls'), prompt: $('#promptText'), direction: $('#directionLabel'), feedback: $('#feedback'), bar: $('#progressBar'), progress: $('#progressStat'), accuracy: $('#accuracyStat'), wpm: $('#wpmStat'), streak: $('#streakStat'), missedToggle: $('#missedToggle'), deckPicker: $('#deckPicker'), deckSelect: $('#deckSelect'), deleteDeck: $('#deleteDeckBtn'), importNotice: $('#importNotice'), sessionDeck: $('#sessionDeck') };
const DEFAULT_CARD_PLACEHOLDER = els.input.getAttribute('placeholder');
let state = { cards: [], source: 'text', libraryName: '', selectedDeck: '*', mode: 'term-def', queue: [], index: 0, attempts: 0, correct: 0, streak: 0, bestStreak: 0, missed: [], reviews: {}, activity: {}, startedAt: 0, typedChars: 0, answered: false };
let mediaRenderToken = 0;
let mediaUrls = [];
let deletingDeck = false;
let importingFile = false;
let fileDragDepth = 0;

function parseCards(raw) {
  const allLines = raw.replace(/^\uFEFF/, '').split(/\r?\n/);
  const isAnki = allLines.some(line => /^#deck column:/i.test(line));
  const lines = allLines.map(x => x.trim()).filter(x => x && !x.startsWith('#'));
  if (!lines.length) return [];
  const delimiter = lines.some(l => l.includes('\t')) ? '\t' : lines.some(l => l.includes(';')) ? ';' : ',';
  const splitCsv = line => {
    if (delimiter !== ',') return line.split(delimiter);
    const out=[]; let cur='', quote=false;
    for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quote&&line[i+1]==='"'){cur+='"';i++;}else quote=!quote;}else if(c===','&&!quote){out.push(cur);cur='';}else cur+=c;} out.push(cur); return out;
  };
  return lines.map(splitCsv).map(parts => {
    if (isAnki && parts.length >= 3) return { deck: cleanField(parts[0]), term: cleanField(parts[1]), definition: cleanField(parts[2]) };
    return { deck: '', term: cleanField(parts[0] || ''), definition: cleanField(parts.slice(1).join(delimiter)) };
  }).filter(card => card.term && card.definition);
}

function cleanField(value) {
  let source = String(value).trim();
  if (source.startsWith('"') && source.endsWith('"')) source = source.slice(1, -1).replace(/""/g, '"');
  const doc = new DOMParser().parseFromString(source
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<img\b[^>]*>/gi, ' [image] '), 'text/html');
  return (doc.body.textContent || '').replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function currentTheme(){return THEMES.find(theme=>theme!=='dark'&&document.body.classList.contains(theme))||'dark'}
function applyTheme(theme,shouldSave=true){const selected=THEMES.includes(theme)?theme:'dark';document.body.classList.remove(...THEMES.filter(t=>t!=='dark'));if(selected!=='dark')document.body.classList.add(selected);updateThemeButton();$$('.theme-choice').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.theme===selected)));if(shouldSave)save()}
function updateThemeButton(){const theme=currentTheme();$('#themeBtn').title=`Theme: ${theme}`;$('#themeBtn').setAttribute('aria-label',`Choose theme, current: ${theme}`);$('#themeBtn').textContent='◈'}
function save() { const payload=JSON.stringify({ raw: els.input.value, source: state.source, libraryName: state.libraryName, selectedDeck: state.selectedDeck, mode: state.mode, theme: currentTheme(), reviews: state.reviews, activity: state.activity });localStorage.setItem(STORAGE,payload);window.webkit?.messageHandlers?.keystrokeStorage?.postMessage(payload); }
function setImportNotice(message='',type='') { els.importNotice.textContent=message;els.importNotice.className=`import-notice${message?'':' hidden'}${type?` ${type}`:''}`; }
function displayDeck(deck){return deck||'Unfiled'}
function activeCards(){return state.selectedDeck==='*'?state.cards:state.cards.filter(card=>card.deck===state.selectedDeck)}
function updateDeleteDeckButton(){
  const hasCards=state.cards.length>0;
  els.deleteDeck.disabled=!hasCards||deletingDeck;
  els.deleteDeck.textContent=state.selectedDeck==='*'?'delete all':'delete deck';
  els.deleteDeck.title=state.selectedDeck==='*'?'Delete every stored deck':`Delete ${displayDeck(state.selectedDeck)}`;
}
function updateCardSummary(){
  const decks=new Set(state.cards.map(card=>card.deck));
  const selected=activeCards();
  els.parse.textContent='';
  const count=document.createElement('b');count.textContent=state.cards.length;els.parse.append(count,` card${state.cards.length===1?'':'s'} detected`);
  if(decks.size) { const deckCount=document.createElement('b');deckCount.textContent=decks.size;els.parse.append(' across ',deckCount,` deck${decks.size===1?'':'s'}`); }
  if(state.selectedDeck!=='*'&&selected.length!==state.cards.length)els.parse.append(` · ${selected.length} selected`);
  els.start.disabled=!selected.length;
  updateDeleteDeckButton();
}
function refreshDeckSelector(){
  const counts=new Map();
  for(const card of state.cards)counts.set(card.deck,(counts.get(card.deck)||0)+1);
  if(state.selectedDeck!=='*'&&!counts.has(state.selectedDeck))state.selectedDeck='*';
  els.deckSelect.textContent='';
  const all=document.createElement('option');all.value='*';all.textContent=`All decks (${state.cards.length})`;els.deckSelect.appendChild(all);
  [...counts.entries()].sort((a,b)=>displayDeck(a[0]).localeCompare(displayDeck(b[0]))).forEach(([deck,count])=>{const option=document.createElement('option');option.value=deck;option.textContent=`${displayDeck(deck)} (${count})`;els.deckSelect.appendChild(option)});
  els.deckSelect.value=state.selectedDeck;
  els.deckPicker.classList.toggle('hidden',!state.cards.length);
  updateCardSummary();
}
function serializedField(value){return String(value||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\t/g,' ').replace(/\r?\n/g,'<br>')}
function serializeTextCards(cards){
  const hasDecks=cards.some(card=>card.deck);
  const rows=cards.map(card=>hasDecks
    ? `${serializedField(card.deck)}\t${serializedField(card.term)}\t${serializedField(card.definition)}`
    : `${serializedField(card.term)}\t${serializedField(card.definition)}`);
  return hasDecks?`#separator:tab\n#deck column:1\n${rows.join('\n')}`:rows.join('\n');
}
async function deleteSelectedDeck(){
  if(!state.cards.length||deletingDeck)return;
  const deleteAll=state.selectedDeck==='*',deck=state.selectedDeck;
  const removedCards=deleteAll?[...state.cards]:state.cards.filter(card=>card.deck===deck);
  if(!removedCards.length)return;
  const label=deleteAll?'all stored decks':`“${displayDeck(deck)}”`;
  const details=deleteAll
    ? `This removes all ${removedCards.length} cards and their saved images from this device.`
    : `This removes ${removedCards.length} card${removedCards.length===1?'':'s'} from this device. Your other decks will stay saved.`;
  if(!confirm(`Delete ${label}?\n\n${details}\n\nThis cannot be undone.`))return;

  deletingDeck=true;updateDeleteDeckButton();
  try {
    let remaining;
    if(state.source==='apkg'&&window.KeystrokeLibrary){
      const result=await window.KeystrokeLibrary.deleteDeck(deleteAll?null:deck);
      if(!result.removed)throw new Error('The saved deck changed before it could be deleted. Reload Keystroke and try again.');
      remaining=result.cards;
    } else {
      remaining=deleteAll?[]:state.cards.filter(card=>card.deck!==deck);
      els.input.value=serializeTextCards(remaining);
    }
    for(const card of removedCards)delete state.reviews[cardKey(card)];
    state.cards=remaining;state.selectedDeck='*';state.queue=[];state.missed=[];state.index=0;
    mediaRenderToken++;clearMediaUrls();
    if(!remaining.length){state.source='text';state.libraryName='';els.input.value='';els.input.placeholder=DEFAULT_CARD_PLACEHOLDER;}
    refreshDeckSelector();save();
    const remainingDecks=new Set(remaining.map(card=>card.deck)).size;
    setImportNotice(`Deleted ${removedCards.length} card${removedCards.length===1?'':'s'}${deleteAll?'':` from ${displayDeck(deck)}`}. ${remaining.length?`${remaining.length} card${remaining.length===1?' remains':'s remain'} across ${remainingDecks} deck${remainingDecks===1?'':'s'}.`:'No decks are stored now.'}`,'good');
  } catch(error){
    setImportNotice(error?.message||'That deck could not be deleted. Nothing was changed.','bad');
  } finally {
    deletingDeck=false;updateDeleteDeckButton();
  }
}
async function load() {
  let savedTheme='dark',saved={};
  try { saved=JSON.parse(localStorage.getItem(STORAGE)||'{}'); if(saved.raw) els.input.value=saved.raw; if(saved.reviews)state.reviews=saved.reviews;if(saved.activity)state.activity=saved.activity;if(saved.selectedDeck!=null)state.selectedDeck=saved.selectedDeck;if(saved.mode) { state.mode=saved.mode; const radio=$(`input[name=mode][value="${saved.mode}"]`); if(radio) radio.checked=true; } if(THEMES.includes(saved.theme))savedTheme=saved.theme; } catch {}
  applyTheme(savedTheme,false);
  if(saved.source==='apkg'&&window.KeystrokeLibrary){
    try { const library=await window.KeystrokeLibrary.loadLibrary();if(library?.cards?.length){state.cards=library.cards;state.source='apkg';state.libraryName=library.name||saved.libraryName||'Anki collection';els.input.value='';els.input.placeholder=`${state.libraryName} is stored locally. Import another file or try the sample to replace it.`;setImportNotice(`${state.libraryName} restored from this device.`,`good`);}else throw new Error('missing library'); }
    catch { state.source='text';state.libraryName='';state.cards=parseCards(els.input.value);setImportNotice('The saved Anki deck could not be restored. Import the .apkg again.','bad'); }
  } else state.cards=parseCards(els.input.value);
  refreshDeckSelector();save();
}
function updateParse() {
  const wasApkg=state.source==='apkg';
  state.source='text';state.libraryName='';state.cards=parseCards(els.input.value);
  if(wasApkg)window.KeystrokeLibrary?.clearLibrary().catch(()=>{});
  setImportNotice('');refreshDeckSelector();save();
}
async function importFile(file){
  if(!file)return;
  if(!DropImport.supports(file.name))throw new Error('Use an .apkg, .txt, .tsv, or .csv file.');
  if(/\.apkg$/i.test(file.name)){
    setImportNotice('Opening the Anki package…');
    const imported=await window.KeystrokeLibrary.importApkg(file,message=>setImportNotice(message));
    state.cards=imported.cards;state.source='apkg';state.libraryName=imported.name;state.selectedDeck='*';els.input.value='';els.input.placeholder=`${imported.name} is stored locally. Import another file or try the sample to replace it.`;refreshDeckSelector();save();
    const imageText=imported.loadedImages?` and ${imported.loadedImages} image${imported.loadedImages===1?'':'s'}`:'';
    const missingText=imported.missingImages?` (${imported.missingImages} unsupported or missing image${imported.missingImages===1?'':'s'})`:'';
    setImportNotice(`Imported ${imported.cards.length} cards across ${new Set(imported.cards.map(card=>card.deck)).size} decks${imageText}${missingText}.`,'good');
  }else{
    state.selectedDeck='*';els.input.value=await file.text();updateParse();
    setImportNotice(`Imported ${state.cards.length} card${state.cards.length===1?'':'s'} from ${file.name}.`,'good');
  }
}
async function handleImportFile(file){
  if(importingFile){setImportNotice('Please wait for the current import to finish.');return;}
  importingFile=true;els.importCard.classList.add('is-importing');els.importCard.setAttribute('aria-busy','true');
  try{await importFile(file)}catch(error){setImportNotice(error?.message||'That file could not be imported.','bad')}
  finally{importingFile=false;els.importCard.classList.remove('is-importing');els.importCard.removeAttribute('aria-busy')}
}
function hasDraggedFiles(event){return DropImport.hasFiles(event.dataTransfer?.types)}
function clearFileDrag(){fileDragDepth=0;els.importCard.classList.remove('is-dragging')}
function handleFileDrop(event){
  const selection=DropImport.selectFiles(event.dataTransfer?.files);
  if(!selection.file&&!selection.error)return;
  event.preventDefault();event.stopPropagation();clearFileDrag();
  if(selection.error){setImportNotice(selection.error,'bad');return;}
  handleImportFile(selection.file);
}
function shuffle(a) { const b=[...a]; for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];} return b; }
function makeQueue(cards=state.cards) { return shuffle(cards).map(card => ({ card, direction: state.mode==='mixed' ? (Math.random()<.5?'term-def':'def-term') : state.mode, repeats: 0 })); }
function show(view) { [els.setup,els.practice,els.results].forEach(v=>v.classList.add('hidden')); view.classList.remove('hidden'); }
function cardKey(card){let h=2166136261,s=`${card.deck}|${card.term}|${card.definition}`;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return `c${(h>>>0).toString(36)}`}
function dueCards(cards){const now=Date.now();return cards.filter(card=>!state.reviews[cardKey(card)]||state.reviews[cardKey(card)].dueAt<=now)}
const MINUTE=60000,DAY=86400000;
function intervalLabel(ms){if(ms<60*MINUTE)return `${Math.max(1,Math.round(ms/MINUTE))}m`;if(ms<DAY)return `${Math.max(1,Math.round(ms/(60*MINUTE)))}h`;const days=Math.max(1,Math.round(ms/DAY));return days<30?`${days}d`:days<365?`${Math.round(days/30)}mo`:`${(days/365).toFixed(1).replace(/\.0$/,'')}y`}
function nextInterval(card,rating){
  const review=state.reviews[cardKey(card)]||{},previous=Math.max(0,Number(review.intervalDays)||0),currentEase=Math.min(3.2,Math.max(1.3,Number(review.ease)||2.5));
  const elapsed=review.reviewedAt?Math.max(0,(Date.now()-review.reviewedAt)/DAY):previous,overdue=Math.max(0,elapsed-previous),base=previous+overdue*.5;
  let days,ease=currentEase;
  if(rating==='again'){days=1/1440;ease=Math.max(1.3,currentEase-.2)}
  else if(rating==='hard'){days=previous?Math.max(6/1440,base*1.2):6/1440;ease=Math.max(1.3,currentEase-.15)}
  else if(rating==='good'){days=previous?Math.max(1,base*currentEase):1}
  else{days=previous?Math.max(7,base*currentEase*1.3):7;ease=Math.min(3.2,currentEase+.15)}
  const ms=Math.max(MINUTE,Math.round(days*DAY));return {days:ms/DAY,ms,label:intervalLabel(ms),ease};
}
function updateIntervals(card){$$('#learnControls button').forEach(button=>{button.querySelector('small').textContent=nextInterval(card,button.dataset.rating).label})}
function localDateKey(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
function recordActivity(correct=false){const key=localDateKey(),day=state.activity[key]||{reviewed:0,correct:0};day.reviewed++;if(correct)day.correct++;state.activity[key]=day;save()}
function addDays(date,amount){const next=new Date(date);next.setDate(next.getDate()+amount);return next}
function activityStreaks(){const active=new Set(Object.entries(state.activity).filter(([,v])=>v.reviewed>0).map(([k])=>k));let longest=0,run=0,previous=null;[...active].sort().forEach(key=>{const date=new Date(`${key}T12:00:00`);if(previous&&Math.round((date-previous)/86400000)===1)run++;else run=1;longest=Math.max(longest,run);previous=date});let anchor=new Date();if(!active.has(localDateKey(anchor)))anchor=addDays(anchor,-1);let current=0;while(active.has(localDateKey(anchor))){current++;anchor=addDays(anchor,-1)}return {longest,current}}
function renderCalendar(){const heatmap=$('#heatmap');heatmap.textContent='';let total=0,studied=0;const today=new Date(),start=addDays(today,-(364+today.getDay()));for(let i=0;i<371;i++){const date=addDays(start,i),key=localDateKey(date),count=date<=today?(state.activity[key]?.reviewed||0):0;total+=count;if(count)studied++;const level=count===0?0:count<5?1:count<15?2:count<30?3:4,cell=document.createElement('i');cell.className='heat-cell';cell.dataset.level=level;cell.title=date<=today?`${key}: ${count} review${count===1?'':'s'}`:key;heatmap.appendChild(cell)}const streaks=activityStreaks();$('#calendarTotal').textContent=`${total} review${total===1?'':'s'}`;$('#dailyAverage').textContent=studied?Math.round(total/studied):0;$('#daysStudied').textContent=studied;$('#longestStreak').textContent=`${streaks.longest}d`;$('#currentStreak').textContent=`${streaks.current}d`}

function startSession(cards=null) {
  const reviewingMissed=Array.isArray(cards);
  const baseCards=reviewingMissed?cards:activeCards();
  if (!baseCards.length) return;
  const sessionCards=state.mode==='learn'&&!reviewingMissed?dueCards(baseCards):baseCards;
  if(!sessionCards.length){$('#resultAccuracy').textContent='100%';$('#resultWpm').textContent='—';$('#resultBest').textContent='0';$('#resultSummary').textContent='You are caught up. No cards are due right now.';$('#missedBtn').disabled=true;show(els.results);return;}
  state.queue=makeQueue(sessionCards); state.index=0; state.attempts=0; state.correct=0; state.streak=0; state.bestStreak=0; state.missed=[]; state.startedAt=Date.now(); state.typedChars=0; state.answered=false;
  els.missedToggle.checked=reviewingMissed;
  els.sessionDeck.textContent=reviewingMissed?'missed cards':state.selectedDeck==='*'?'all decks':displayDeck(state.selectedDeck);
  syncMode(); show(els.practice); renderCard();
}
function current() { return state.queue[state.index]; }
function norm(s) { return s.normalize('NFKC').trim().toLowerCase().replace(/[\s\u00a0]+/g,' ').replace(/[.,;:!?]+$/,''); }
function stats() { const mins=Math.max((Date.now()-state.startedAt)/60000,1/60); return {accuracy:state.attempts?Math.round(state.correct/state.attempts*100):100,wpm:Math.round((state.typedChars/5)/mins)}; }
function clearMediaUrls(){for(const url of mediaUrls)URL.revokeObjectURL(url);mediaUrls=[]}
async function appendMedia(target,keys=[],token=mediaRenderToken){
  if(!keys?.length||!window.KeystrokeLibrary)return;
  const gallery=document.createElement('div');gallery.className='card-media';target.appendChild(gallery);
  for(const key of keys){
    try { const item=await window.KeystrokeLibrary.getMedia(key);if(token!==mediaRenderToken)return;if(!item?.blob)continue;const url=URL.createObjectURL(item.blob);mediaUrls.push(url);const image=document.createElement('img');image.src=url;image.alt=item.name||'Card image';image.loading='eager';gallery.appendChild(image); }
    catch { if(token===mediaRenderToken){const missing=document.createElement('span');missing.className='media-missing';missing.textContent='image unavailable';gallery.appendChild(missing);} }
  }
  if(!gallery.childElementCount)gallery.remove();
}
function renderField(target,text,media,token=mediaRenderToken){target.textContent='';if(text){const copy=document.createElement('div');copy.className='field-text';copy.textContent=text;target.appendChild(copy)}appendMedia(target,media,token)}
function renderCard() {
  const q=current(); if(!q) return finish();
  mediaRenderToken++;clearMediaUrls();
  state.answered=false; els.answer.value=''; els.answer.disabled=false; els.feedback.className='feedback'; els.feedback.textContent='';
  const learning=q.direction==='learn', termFirst=q.direction==='term-def';
  els.form.classList.remove('hidden'); els.learnControls.classList.add('hidden');
  els.answer.placeholder=learning?'type what you remember…':'start typing…';
  els.direction.textContent=learning?'learn this card':termFirst?'type the definition':'type the term';
  renderField(els.prompt,learning||termFirst?q.card.term:q.card.definition,learning||termFirst?q.card.termMedia:q.card.definitionMedia,mediaRenderToken);
  if(learning)updateIntervals(q.card);
  const st=stats(); els.progress.textContent=`${state.index+1} / ${state.queue.length}`; els.accuracy.textContent=`${st.accuracy}%`; els.wpm.textContent=st.wpm; els.streak.textContent=state.streak; els.bar.style.width=`${state.index/state.queue.length*100}%`; els.answer.focus();
}
function revealLearn() { const q=current(); if(!q||q.direction!=='learn'||state.answered)return; const response=els.answer.value.trim(); state.answered=true; state.typedChars+=response.length; els.answer.disabled=true; els.feedback.className='feedback';els.feedback.textContent='';const responseLine=document.createElement('span');responseLine.textContent=response?`your answer: ${response}`:'no answer entered';const expected=document.createElement('div');expected.className='learn-answer';els.feedback.append(responseLine,expected);renderField(expected,q.card.definition,q.card.definitionMedia,mediaRenderToken);els.learnControls.classList.remove('hidden'); }
function rateLearn(rating) { const q=current(); if(!q||q.direction!=='learn'||!state.answered)return; const recalled=rating!=='again',key=cardKey(q.card),previous=state.reviews[key]||{},interval=nextInterval(q.card,rating); state.reviews[key]={dueAt:Date.now()+interval.ms,intervalDays:interval.days,ease:interval.ease,reps:(previous.reps||0)+1,lapses:(previous.lapses||0)+(rating==='again'?1:0),lastRating:rating,reviewedAt:Date.now()};state.attempts++;recordActivity(recalled);if(recalled){state.correct++;state.streak++;state.bestStreak=Math.max(state.bestStreak,state.streak);}else state.streak=0; if(rating==='again'||rating==='hard'){if(!state.missed.some(card=>cardKey(card)===key))state.missed.push(q.card);if(rating==='again'&&q.repeats<2){const insertAt=Math.min(state.index+3,state.queue.length);state.queue.splice(insertAt,0,{...q,repeats:q.repeats+1});}} state.index++;renderCard(); }
function submitAnswer() {
  if(current()?.direction==='learn') return revealLearn();
  if(state.answered) return next();
  const q=current(), answer=els.answer.value, expected=q.direction==='term-def'?q.card.definition:q.card.term;
  if(!answer.trim()) return;
  const ok=norm(answer)===norm(expected); state.attempts++; state.typedChars+=answer.trim().length;recordActivity(ok);
  if(ok){state.correct++;state.streak++;state.bestStreak=Math.max(state.bestStreak,state.streak);els.feedback.className='feedback good';els.feedback.textContent='correct ';const hint=document.createElement('span');hint.textContent='press enter to continue';els.feedback.appendChild(hint);}
  else{state.streak=0;if(!state.missed.some(card=>cardKey(card)===cardKey(q.card)))state.missed.push(q.card);els.feedback.className='feedback bad';els.feedback.textContent='not quite';const expectedBlock=document.createElement('div');expectedBlock.className='learn-answer';els.feedback.appendChild(expectedBlock);renderField(expectedBlock,`answer: ${expected}`,q.direction==='term-def'?q.card.definitionMedia:q.card.termMedia,mediaRenderToken);const hint=document.createElement('span');hint.textContent='press enter to continue';els.feedback.appendChild(hint);}
  state.answered=true; els.answer.disabled=true; const st=stats(); els.accuracy.textContent=`${st.accuracy}%`;els.wpm.textContent=st.wpm;els.streak.textContent=state.streak;
}
function next(){state.index++;renderCard()}
function skip(){if(state.answered)return next();const q=current();if(!q)return;state.attempts++;recordActivity(false);state.streak=0;if(!state.missed.includes(q.card))state.missed.push(q.card);state.index++;renderCard()}
function finish(){const st=stats();els.bar.style.width='100%';$('#resultAccuracy').textContent=`${st.accuracy}%`;$('#resultWpm').textContent=st.wpm;$('#resultBest').textContent=state.bestStreak;$('#resultSummary').textContent=`You recalled ${state.correct} of ${state.attempts} cards${state.missed.length ? `, with ${state.missed.length} to revisit.` : ' with a perfect run.'}`;$('#missedBtn').disabled=!state.missed.length;show(els.results);}
function syncMode(){ $$('.mode-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.mode===state.mode)); const radio=$(`input[name=mode][value="${state.mode}"]`);if(radio)radio.checked=true;save(); }
function restart(){startSession(state.missedToggle.checked&&state.missed.length?state.missed:null)}

els.input.addEventListener('input',updateParse);
els.file.addEventListener('change',async e=>{const file=e.target.files[0];if(file)await handleImportFile(file);e.target.value=''});
document.addEventListener('dragenter',event=>{if(!hasDraggedFiles(event))return;event.preventDefault();fileDragDepth++;els.importCard.classList.add('is-dragging')});
document.addEventListener('dragover',event=>{if(!hasDraggedFiles(event))return;event.preventDefault();event.dataTransfer.dropEffect='copy'});
document.addEventListener('dragleave',event=>{if(!fileDragDepth)return;fileDragDepth=Math.max(0,fileDragDepth-1);if(!fileDragDepth||!event.relatedTarget)clearFileDrag()});
document.addEventListener('drop',handleFileDrop);
window.addEventListener('blur',clearFileDrag);
$('#sampleBtn').addEventListener('click',()=>{els.input.value='mitosis\tCell division producing two genetically identical daughter cells\nosmosis\tMovement of water across a selectively permeable membrane\nphotosynthesis\tProcess plants use to convert light energy into chemical energy\nhomeostasis\tMaintenance of a stable internal environment\nallele\tAn alternative form of a gene';updateParse();});
els.deckSelect.addEventListener('change',e=>{state.selectedDeck=e.target.value;updateCardSummary();save()});
els.deleteDeck.addEventListener('click',deleteSelectedDeck);
$$('input[name=mode]').forEach(r=>r.addEventListener('change',e=>{state.mode=e.target.value;save();}));
els.start.addEventListener('click',()=>startSession()); els.form.addEventListener('submit',e=>{e.preventDefault();submitAnswer();});
els.answer.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();e.stopPropagation();submitAnswer();}if(e.key==='Tab'){e.preventDefault();e.stopPropagation();skip();}});
$$('#learnControls button').forEach(button=>button.addEventListener('click',()=>rateLearn(button.dataset.rating)));
$$('.mode-tabs button').forEach(b=>b.addEventListener('click',()=>{state.mode=b.dataset.mode;syncMode();startSession();}));
els.missedToggle.addEventListener('change',()=>{if(els.missedToggle.checked){if(state.missed.length)startSession(state.missed);else els.missedToggle.checked=false;}else startSession();});
$('#shuffleBtn').addEventListener('click',()=>{state.queue=shuffle(state.queue);state.index=0;renderCard();}); $('#restartBtn').addEventListener('click',restart); $('#editBtn').addEventListener('click',()=>show(els.setup)); $('#brandBtn').addEventListener('click',()=>show(els.setup));
$('#againBtn').addEventListener('click',()=>startSession()); $('#missedBtn').addEventListener('click',()=>startSession(state.missed));
const dialog=$('#helpDialog'); $('#helpBtn').addEventListener('click',()=>dialog.showModal()); $('#closeHelp').addEventListener('click',()=>dialog.close()); dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();dialog.close()}});
const calendarDialog=$('#calendarDialog');$('#calendarBtn').addEventListener('click',()=>{renderCalendar();calendarDialog.showModal()});$('#closeCalendar').addEventListener('click',()=>calendarDialog.close());calendarDialog.addEventListener('click',e=>{if(e.target===calendarDialog)calendarDialog.close()});calendarDialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();calendarDialog.close()}});
const themeDialog=$('#themeDialog');$('#themeBtn').addEventListener('click',()=>{applyTheme(currentTheme(),false);themeDialog.showModal()});$('#closeThemes').addEventListener('click',()=>themeDialog.close());themeDialog.addEventListener('click',e=>{if(e.target===themeDialog)themeDialog.close()});themeDialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();themeDialog.close()}});$$('.theme-choice').forEach(button=>button.addEventListener('click',()=>{applyTheme(button.dataset.theme);themeDialog.close()}));
$('#exportBackup').addEventListener('click',e=>{const backup={app:'keystroke',version:1,exportedAt:new Date().toISOString(),reviews:state.reviews,activity:state.activity,settings:{mode:state.mode,theme:currentTheme()}};e.currentTarget.href=`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(backup,null,2))}`;e.currentTarget.download=`keystroke-backup-${localDateKey()}.json`});
$('#backupInput').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{const backup=JSON.parse(await file.text());if(!['keystroke','keystroak','clean-type-recall'].includes(backup.app)||!backup.reviews||!backup.activity)throw new Error('Invalid backup');if(!confirm('Replace the current review schedule and activity history with this backup?'))return;state.reviews=backup.reviews;state.activity=backup.activity;if(backup.settings?.mode&&$(`input[name=mode][value="${backup.settings.mode}"]`)){state.mode=backup.settings.mode;$(`input[name=mode][value="${state.mode}"]`).checked=true}if(THEMES.includes(backup.settings?.theme))applyTheme(backup.settings.theme,false);save();renderCalendar();alert('Backup restored.')}catch{alert('That file is not a valid Keystroke backup.')}finally{e.target.value=''}});
document.addEventListener('keydown',e=>{if(dialog.open||calendarDialog.open||themeDialog.open)return;if(e.key==='Escape'){if(!els.practice.classList.contains('hidden'))show(els.setup);return;}if(document.activeElement===els.input||document.activeElement===els.answer&&!els.answer.disabled)return;if(!els.practice.classList.contains('hidden')&&current()?.direction==='learn'){if(e.key==='Enter'){e.preventDefault();revealLearn();}const ratings={1:'again',2:'hard',3:'good',4:'easy'};if(ratings[e.key]){e.preventDefault();rateLearn(ratings[e.key]);}return;}if(!els.practice.classList.contains('hidden')&&state.answered&&e.key==='Enter'){e.preventDefault();next();return;}if(e.key==='r'&&!els.practice.classList.contains('hidden'))restart();if(e.key==='s'&&!els.practice.classList.contains('hidden')){$('#shuffleBtn').click();}if(e.key==='Enter'&&!els.setup.classList.contains('hidden')&&!els.start.disabled)startSession();});
load().catch(()=>{setImportNotice('Keystroke could not restore its saved data. You can still import your cards again.','bad');refreshDeckSelector()});
