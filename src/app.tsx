import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Aperture, ArrowLeft, ArrowRight, AudioLines, BookOpen, Check, ChevronRight, Circle, Download, Film, GitBranch, History, Layers, LoaderCircle, Maximize2, Mic, Pause, Pin, Play, Plus, Radio, RotateCcw, Search, Settings2, Share2, Sparkles, Trees, Upload, Users, VolumeX, X, ZoomIn, ZoomOut } from 'lucide-react';
import { ancestors, appendStatement, finishLayer, hexSpiral, newSession, pruneForest, refKey, type Card, type Forest, type Layer, type Session, type Statement } from './domain';
import { api, extract, hydrateCards, search } from './api';
import { demoCards, demoTurns, searchDemo } from './demo';
import { decodeShare, download, encodeShare, loadForest, parseImport, saveForest, snapshot } from './storage';
import { startAudio } from './audio';
import { appUrl } from './urls';

const operationLabels = { new: 'Nouveau sujet', refine: 'Affinage', fork: 'Branche sœur', back: 'Retour au sujet' };
const speakerColor = (speaker: string) => speaker === 'Malik' || speaker === 'Orateur 2' ? '#edb38c' : '#95d4c7';
const localDate = (date: string) => new Date(date).toLocaleDateString('fr-FR',{ day: 'numeric', month: 'short' });
const initial = () => { const f = loadForest(); if (!f.sessions.length) { const s = newSession(); f.sessions.push(s); f.activeSessionId = s.id; } return f; };

export function App() {
  const [forest,setForest] = useState<Forest>(initial);
  const forestRef = useRef(forest);
  const [cards,setCards] = useState<Record<string,Card>>({});
  const cardsRef = useRef(cards);
  const [viewSessionId,setViewSessionId] = useState<string | null>(null);
  const [viewLayerId,setViewLayerId] = useState<string | null>(null);
  const [sidebar,setSidebar] = useState(() => window.innerWidth > 760);
  const [settings,setSettings] = useState(false);
  const [pinned,setPinned] = useState(false);
  const [remaining,setRemaining] = useState(10);
  const lastInteraction = useRef(Date.now());
  const [text,setText] = useState('');
  const [notice,setNotice] = useState('');
  const [phase,setPhase] = useState('Prêt à écouter');
  const [listening,setListening] = useState(false);
  const [connecting,setConnecting] = useState(false);
  const [partial,setPartial] = useState('');
  const [level,setLevel] = useState(0);
  const [source,setSource] = useState<'microphone' | 'tab'>('microphone');
  const [speaker,setSpeaker] = useState('Orateur 1');
  const speakerRef = useRef(speaker);
  const stopAudio = useRef<(() => void) | null>(null);
  const brainQueue = useRef(Promise.resolve());
  const [pending,setPending] = useState(0);
  const [demoIndex,setDemoIndex] = useState(() => Math.min(demoTurns.length,forest.sessions.find(s => s.id === forest.activeSessionId)?.demo ? forest.sessions.find(s => s.id === forest.activeSessionId)!.transcripts.length : 0));
  const [demoPlaying,setDemoPlaying] = useState(false);
  const [selected,setSelected] = useState<Card | null>(null);
  const [health,setHealth] = useState<{openai: boolean; cinema: boolean} | null>(null);
  const [hydrating,setHydrating] = useState(false);
  const importing = useRef<HTMLInputElement>(null);
  const audioFile = useRef<HTMLInputElement>(null);
  const [fileProcessing,setFileProcessing] = useState(false);

  const commit = (change: (f: Forest) => Forest) => { const next = change(forestRef.current); forestRef.current = next; setForest(next); try { saveForest(next); } catch { setNotice('L’espace de stockage du navigateur est plein. Exportez la séance pour la conserver.'); } };
  const update = (id: string, change: (s: Session) => Session) => commit(f => ({ ...f, sessions: f.sessions.map(s => s.id === id ? change(s) : s) }));
  const cache = (items: Card[]) => { const next = { ...cardsRef.current }; items.forEach(c => next[refKey(c)] = c); cardsRef.current = next; setCards(next); };
  const active = forest.sessions.find(s => s.id === forest.activeSessionId)!;
  const visibleSession = forest.sessions.find(s => s.id === viewSessionId) ?? active;
  const layer = visibleSession.layers.find(l => l.id === (viewLayerId ?? visibleSession.liveId));
  const history = visibleSession.id !== active.id || (!!viewLayerId && viewLayerId !== active.liveId);
  const chain = layer ? ancestors(visibleSession,layer.id) : [];
  const roots = visibleSession.layers.filter((l,i,all) => !l.parentId && all.findIndex(other => other.pileId === l.pileId) === i);
  const live = () => { setViewSessionId(null); setViewLayerId(null); setPinned(false); setRemaining(10); lastInteraction.current = Date.now(); };
  const interact = () => { lastInteraction.current = Date.now(); };
  const view = (s: Session,id: string) => { setViewSessionId(s.id); setViewLayerId(id); setPinned(false); setRemaining(10); interact(); };

  useEffect(() => { speakerRef.current = speaker; },[speaker]);
  useEffect(() => { void api<{openai: boolean;cinema: boolean}>('health').then(setHealth).catch(() => setNotice('Le serveur local ne répond pas.')); return () => stopAudio.current?.(); },[]);
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(''),10000); return () => clearTimeout(t); },[notice]);
  useEffect(() => {
    if (!history || pinned) return;
    const t = setInterval(() => { const seconds = Math.max(0,10-Math.floor((Date.now()-lastInteraction.current)/1000)); setRemaining(seconds); if (!seconds) live(); },500);
    return () => clearInterval(t);
  },[history,pinned]);
  useEffect(() => {
    if (!layer || layer.status !== 'ready') return;
    if (visibleSession.demo) { cache(demoCards); return; }
    const missing = layer.refs.filter(r => !cardsRef.current[refKey(r)]);
    if (!missing.length) return;
    let cancelled = false;
    setHydrating(true);
    void hydrateCards(missing).then(r => { if (!cancelled) cache(r.cards); }).catch(e => { if (!cancelled) setNotice(e.message); }).finally(() => { if (!cancelled) setHydrating(false); });
    return () => { cancelled = true; };
  },[layer?.id,layer?.refs.length,visibleSession.demo]);
  useEffect(() => {
    if (!location.hash.startsWith('#snapshot=')) return;
    try {
      const imported = parseImport(decodeShare(location.hash.slice(10)));
      const restored = { ...imported.session,id: crypto.randomUUID(),title: `${imported.session.title} · copie` };
      commit(f => ({ ...f,sessions: [...f.sessions,restored],activeSessionId: restored.id }));
      cache(Object.values(imported.appearance)); setPinned(true); setNotice('Copie figée ouverte. « Rejouer » interrogera le catalogue actuel.');
    } catch { setNotice('Le lien partagé est incomplet ou invalide.'); }
    window.history.replaceState(null,'',location.pathname);
  },[]);

  async function resolveLayer(sessionId: string, current: Layer, demo: boolean, page = 1) {
    try {
      const result = demo ? { cards: searchDemo(current.criteria), answer: 'Démonstration illustrative', hasMore: false, query: current.query } : await search(current.criteria,current.statement.named,page);
      cache(result.cards);
      update(sessionId,s => finishLayer(s,current.id,result,page));
    } catch (e) {
      update(sessionId,s => ({ ...s,layers: s.layers.map(l => l.id === current.id ? { ...l,status: 'error',error: e instanceof Error ? e.message : 'La recherche a échoué.' } : l) }));
    }
  }

  function acceptText(heard: string, who = speakerRef.current, supplied?: Statement[], sessionId = forestRef.current.activeSessionId!) {
    if (!heard.trim()) return;
    const transcriptId = crypto.randomUUID();
    update(sessionId,s => ({ ...s,updatedAt: new Date().toISOString(), transcripts: [...s.transcripts,{ id: transcriptId,text: heard,speaker: who,at: new Date().toISOString() }] }));
    setPending(n => n+1); setPhase('Énoncés en cours d’extraction');
    brainQueue.current = brainQueue.current.then(async () => {
      try {
        const current = forestRef.current.sessions.find(s => s.id === sessionId)!;
        const statements = supplied ?? (await extract(heard,current)).statements;
        if (!statements.length) { setPhase('Aucun nouvel énoncé cinéma'); return; }
        const searches: Layer[] = [];
        for (const statement of statements) {
          let created!: Layer;
          update(sessionId,s => { const result = appendStatement(s,statement,who,heard); created = result.layer; return result.session; });
          searches.push(created);
        }
        setPhase('Recherche cinéma en cours');
        // Searches do not block the live ear or the next extraction.
        void Promise.all(searches.map(l => resolveLayer(sessionId,l,!!current.demo))).then(() => setPhase('À jour avec la conversation'));
      } catch (e) { setNotice(e instanceof Error ? e.message : 'Extraction impossible.'); setPhase('Énoncé à reprendre'); }
      finally { setPending(n => n-1); }
    });
  }

  function createSession(demo = false) {
    const session = { ...newSession(demo ? 'Hors Champ · Nouvelle Vague' : `Écoute du ${localDate(new Date().toISOString())}`),demo };
    commit(f => ({ ...pruneForest(f),sessions: [...f.sessions,session],activeSessionId: session.id }));
    live(); setDemoIndex(0); setDemoPlaying(false); setPhase('Prêt à écouter');
    return session;
  }
  const demoNext = () => { if (demoIndex >= demoTurns.length) return; const turn = demoTurns[demoIndex]; acceptText(turn.text,turn.speaker,turn.statements); setDemoIndex(i => i+1); };
  useEffect(() => { if (!demoPlaying) return; if (demoIndex >= demoTurns.length) { setDemoPlaying(false); return; } const t = setTimeout(demoNext, demoIndex === 0 ? 300 : 4800); return () => clearTimeout(t); },[demoPlaying,demoIndex]);
  const beginDemo = () => { stopAudio.current?.(); stopAudio.current = null; setListening(false); createSession(true); setDemoPlaying(true); cache(demoCards); };
  async function toggleListen() {
    if (listening) { stopAudio.current?.(); stopAudio.current = null; setListening(false); setPartial(''); setPhase('Écoute en pause'); return; }
    if (active.demo) createSession();
    setConnecting(true); setDemoPlaying(false); live();
    try {
      stopAudio.current = await startAudio(source,{ partial: setPartial, transcript: text => acceptText(text), level: setLevel, error: message => { setNotice(message); setListening(false); setConnecting(false); } });
      setListening(true); setPhase('À l’écoute de la conversation');
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Microphone indisponible.'); }
    finally { setConnecting(false); }
  }
  async function replay() {
    if (!layer) return;
    update(visibleSession.id,s => ({ ...s,layers: s.layers.map(l => l.id === layer.id ? { ...l,status: 'loading',error: undefined } : l) }));
    await resolveLayer(visibleSession.id,layer,!!visibleSession.demo);
  }
  async function exportSession(share = false) {
    try {
      const refs = visibleSession.layers.flatMap(l => l.refs);
      const needed = refs.filter(r => !cardsRef.current[refKey(r)]);
      if (needed.length && !visibleSession.demo) cache((await hydrateCards(needed)).cards);
      const keys = new Set(refs.map(refKey));
      const appearance = Object.fromEntries(Object.entries(cardsRef.current).filter(([key]) => keys.has(key)));
      const data = snapshot(visibleSession,appearance);
      if (!share) { download('hors-champ-seance.json',data); setNotice('La séance et l’apparence actuelle des cartes sont exportées.'); return; }
      const url = `${location.origin}${location.pathname}#snapshot=${encodeShare(data)}`;
      if (url.length > 60000) { download('hors-champ-partage.json',data); setNotice('Cette séance est trop grande pour un lien. Le fichier partagé a été exporté.'); }
      else { await navigator.clipboard.writeText(url); setNotice('Lien de copie figée copié. Il fonctionne sur une installation accessible de cette application.'); }
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Export impossible.'); }
  }

  const shown = layer?.refs.map(r => cards[refKey(r)]).filter((c): c is Card => !!c) ?? [];
  const previous = chain.at(-2);
  const transcripts = visibleSession.transcripts.slice(-3);
  return <div className="app-shell" onPointerDown={interact} onKeyDown={interact} onWheel={interact}>
    <header className="app-header">
      <button className="brand" onClick={() => setSidebar(v => !v)} aria-label="Afficher ou masquer la forêt"><span className="brand-mark"><Aperture size={25}/></span><span>hors champ<small>LE CINÉMA, AU FIL DE LA VOIX</small></span></button>
      <div className="header-center"><VolumeX size={15}/><span>Un compagnon qui écoute. Un écran qui raconte.</span></div>
      <div className="header-actions"><button className="icon-button" title="Exporter la séance" aria-label="Exporter la séance" onClick={() => void exportSession()}><Download size={18}/></button><button className="icon-button" title="Partager une copie figée" aria-label="Partager une copie figée" onClick={() => void exportSession(true)}><Share2 size={18}/></button><button className="icon-button" aria-label="Réglages" onClick={() => setSettings(true)}><Settings2 size={18}/></button></div>
    </header>
    <div className="workspace">
      {sidebar && <aside className="sidebar">
        <div className="section-heading"><span><Trees size={15}/> MA FORÊT</span><button className="icon-button" aria-label="Nouvelle séance" onClick={() => createSession()}><Plus size={16}/></button></div>
        <p className="sidebar-intro">Les conversations passent.<br/>Leurs chemins restent.</p>
        <div className="session-list">{[...forest.sessions].reverse().map(s => <button className={`session-button ${s.id === visibleSession.id ? 'selected' : ''}`} key={s.id} onClick={() => { if (s.liveId) view(s,s.liveId); else { setViewSessionId(s.id); setViewLayerId(null); } }}><span className="session-icon"><AudioLines size={18}/></span><span><strong>{s.title}</strong><small>{localDate(s.createdAt)} · {s.layers.length} couches{s.demo ? ' · démo' : ''}</small></span>{s.id === active.id && <span className="tiny-dot" title="Séance active"/>}</button>)}</div>
        <div className="tree-heading"><Layers size={14}/><span>LES SUJETS DE CETTE SÉANCE</span></div>
        <div className="tree-list">{roots.map(root => <div className="pile-group" key={root.id}><button className="pile-title" onClick={() => view(visibleSession,root.id)}><Film size={15}/>{root.topic || root.label}</button>{visibleSession.layers.filter(l => l.pileId === root.pileId).map(l => <button className={`layer-row ${l.id === layer?.id ? 'current' : ''}`} key={l.id} style={{ paddingLeft: 14 + Math.min(ancestors(visibleSession,l.id).length-1,4)*12 }} onClick={() => view(visibleSession,l.id)}><span className="speaker-dot" style={{ background: speakerColor(l.speaker) }}/><span>{l.label}</span>{l.statement.operation === 'fork' ? <GitBranch size={12}/> : l.status === 'loading' ? <LoaderCircle className="spinning" size={12}/> : <ChevronRight size={12}/>}</button>)}</div>)}{!roots.length && <div className="tree-empty"><GitBranch size={23}/><p>Une idée, puis une autre.<br/>Votre premier arbre naîtra ici.</p></div>}</div>
        <button className="demo-launch" onClick={beginDemo}><Play size={14}/><span>Explorer une conversation<small>Démonstration « Hors Champ »</small></span><ArrowRight size={15}/></button>
        <div className="sidebar-footer"><span className={`connection-dot ${health?.openai && health?.cinema ? 'connected' : ''}`}/>{health ? health.openai && health.cinema ? 'Services configurés' : 'Configuration incomplète' : 'Connexion…'}<small>Conservation sur cet appareil</small></div>
      </aside>}
      <main className="main-pane">
        <div className="context-bar"><div className="breadcrumbs"><button className="icon-button" aria-label="Afficher la forêt" onClick={() => setSidebar(v => !v)}><Trees size={18}/></button><span>{visibleSession.title}</span>{layer && <><ChevronRight size={13}/><strong>{layer.topic}</strong></>}</div><button className={`live-pill ${history ? 'history' : ''}`} onClick={live}>{history ? <History size={13}/> : <Radio size={13}/>} {history ? 'Dans l’historique' : 'Suivre le direct'}{listening && !history && <span className="tiny-dot"/>}</button></div>
        <div className="board-header"><div><p className="eyebrow">{layer ? operationLabels[layer.statement.operation] : 'UNE AUTRE FAÇON D’ÉCOUTER'}</p><h1>{layer?.label ?? 'Le cinéma prend forme.'}</h1>{layer && <p className="layer-summary"><span className="speaker-dot" style={{ background: speakerColor(layer.speaker) }}/>{layer.speaker}<span>·</span>{layer.criteria.map(c => c.value).join(' + ')}<span>·</span>{layer.refs.length} cartes chargées{visibleSession.demo && <span className="demo-badge">Démonstration</span>}</p>}</div><div className="board-actions">{layer && <><button className="soft-button" onClick={replay} disabled={layer.status === 'loading'}><RotateCcw size={14}/>Rejouer</button><button className="icon-button" title="Couche précédente" aria-label="Couche précédente" disabled={!previous} onClick={() => previous && view(visibleSession,previous.id)}><ArrowLeft size={16}/></button></>}</div></div>
        {layer ? <Board layer={layer} cards={shown} chain={chain} session={visibleSession} onSelect={setSelected} loading={hydrating} onLayer={id => view(visibleSession,id)} /> : <div className="welcome"><div className="welcome-orbit"><span/><span/><span/><Aperture size={48}/></div><p className="eyebrow">LE COMPAGNON VISUEL DES CONVERSATIONS CINÉMA</p><h2>Écoutez.<br/><em>Le reste apparaît.</em></h2><p>Un réalisateur, un film, une idée.<br/>Des cartes émergent, les sujets se relient,<br/>et vous gardez le fil de la conversation.</p><button className="primary-button" onClick={beginDemo}><Play size={16}/>Découvrir avec Hors Champ<ArrowRight size={16}/></button><div className="welcome-hints"><span><Mic size={14}/>Écoute en direct</span><span><Layers size={14}/>Cartes & couches</span><span><GitBranch size={14}/>Mémoire des sujets</span></div></div>}
        {layer?.warning && <div className="query-warning"><BookOpen size={16}/>{layer.warning}</div>}
        {layer?.status === 'error' && <div className="query-error" role="alert"><span>{layer.error}</span><button onClick={replay}>Réessayer</button></div>}
        {layer?.hasMore && <button className="more-button" disabled={layer.status === 'loading'} onClick={() => void resolveLayer(visibleSession.id,layer,!!visibleSession.demo,layer.page+1)}>Charger 50 cartes de plus <Plus size={14}/></button>}
        {history && <div className="return-banner"><History size={14}/><span>{pinned ? 'Vous restez dans cette couche' : remaining <= 5 ? `Retour au direct dans ${remaining} s` : 'La conversation continue pendant votre exploration'}</span><button onClick={() => setPinned(v => !v)}><Pin size={13}/>{pinned ? 'Libérer' : 'Rester ici'}</button><button onClick={live}>Au direct<ArrowRight size={13}/></button></div>}
        <div className="transcript-dock"><div className="transcript-heading"><span><AudioLines size={14}/>LE FIL DE LA VOIX</span><span className="pipeline-status">{pending > 0 ? <LoaderCircle className="spinning" size={13}/> : listening ? <span className="tiny-dot"/> : <Circle size={10}/>} {phase}{pending > 1 ? ` · ${pending} passages en attente` : ''}</span></div><div className="transcript-lines" aria-live="polite">{transcripts.length ? transcripts.map((t,i) => <p key={t.id} className={i === transcripts.length-1 ? 'recent' : ''}><span style={{ color: speakerColor(t.speaker) }}>{t.speaker}</span>{t.text}</p>) : <p className="transcript-placeholder">« On pourrait commencer par les films de Jean-Luc Godard… »</p>}{partial && <p className="partial-transcript"><span>En cours</span>{partial}<span className="typing-caret"/></p>}</div>
          {active.demo && <div className="demo-controls"><span>DÉMONSTRATION · {demoIndex}/{demoTurns.length} passages</span><button className="soft-button" onClick={() => setDemoPlaying(v => !v)}>{demoPlaying ? <Pause size={13}/> : <Play size={13}/>} {demoPlaying ? 'Pause' : 'Lire'}</button><button className="soft-button" disabled={demoIndex >= demoTurns.length} onClick={() => { setDemoPlaying(false); demoNext(); }}>Passage suivant<ArrowRight size={13}/></button></div>}
          <form className="input-bar" onSubmit={e => { e.preventDefault(); if (active.demo) { const session = createSession(); acceptText(text,speakerRef.current,undefined,session.id); } else acceptText(text); setText(''); }}><Search size={17}/><input aria-label="Énoncé ou question cinéma" placeholder="Ajoutez une phrase ou posez une question cinéma…" value={text} onChange={e => setText(e.target.value)}/><button className="send-button" aria-label="Analyser l’énoncé" disabled={!text.trim()} type="submit"><ArrowRight size={18}/></button><span className="input-divider"/><button type="button" className={`listen-button ${listening ? 'listening' : ''}`} onClick={toggleListen} disabled={connecting}>{connecting ? <LoaderCircle size={17} className="spinning"/> : listening ? <Pause size={17}/> : <Mic size={17}/>}<span>{connecting ? 'Connexion…' : listening ? 'En écoute' : 'Écouter'}</span>{listening && <span className="audio-meter">{[0,1,2,3,4].map(i => <i key={i} style={{ height: 3+level*16*(i%2 ? .7 : 1) }}/>)}</span>}</button></form>
          <div className="input-options"><label>Source <select aria-label="Source audio" value={source} onChange={e => setSource(e.target.value as 'microphone' | 'tab')} disabled={listening || connecting}><option value="microphone">Microphone</option><option value="tab">Audio d’un onglet</option></select></label><label><Users size={12}/>Voix <select aria-label="Orateur" value={speaker} onChange={e => setSpeaker(e.target.value)}><option>Orateur 1</option><option>Orateur 2</option><option>Claire</option><option>Malik</option></select></label><button className="audio-file-button" type="button" onClick={() => audioFile.current?.click()} disabled={fileProcessing || listening}>{fileProcessing ? <LoaderCircle className="spinning" size={12}/> : <Upload size={12}/>} Fichier audio</button><span><VolumeX size={12}/>Toujours muet</span></div>
        </div>
      </main>
    </div>
    {notice && <div className="toast" role="status"><span>{notice}</span><button className="icon-button" aria-label="Fermer la notification" onClick={() => setNotice('')}><X size={16}/></button></div>}
    {selected && <div className="modal-backdrop" onClick={() => setSelected(null)}><section className="detail-modal" role="dialog" aria-modal="true" aria-label={selected.title} onClick={e => e.stopPropagation()}><button className="icon-button modal-close" aria-label="Fermer la fiche" onClick={() => setSelected(null)}><X size={20}/></button><Poster card={selected}/><div><p className="eyebrow">{selected.entity === 'person' ? 'PERSONNE' : selected.entity === 'serie' ? 'SÉRIE' : 'ŒUVRE'}</p><h2>{selected.title}</h2><p>{selected.subtitle}{selected.score !== null && ` · IMDb ${selected.score.toFixed(1)}`}</p><p className="detail-description">{selected.description || 'Cette carte provient du catalogue cinéma. Vous pouvez explorer son sujet avec un nouvel énoncé.'}</p><button className="soft-button" onClick={() => { acceptText(`Parlons maintenant de ${selected.title}.`); setSelected(null); live(); }}>Explorer ce sujet<ArrowRight size={14}/></button></div></section></div>}
    {settings && <div className="modal-backdrop" onClick={() => setSettings(false)}><section className="settings-modal" role="dialog" aria-modal="true" aria-label="Réglages" onClick={e => e.stopPropagation()}><div className="modal-title"><h2>Votre compagnon</h2><button className="icon-button" aria-label="Fermer les réglages" onClick={() => setSettings(false)}><X size={18}/></button></div><label className="setting-row"><span>Conserver les séances<small>Sur ce navigateur et cet appareil</small></span><select value={forest.retentionDays} onChange={e => commit(f => pruneForest({ ...f,retentionDays: Number(e.target.value) }))}><option value={0}>Sans limite</option><option value={7}>7 jours</option><option value={30}>30 jours</option><option value={90}>90 jours</option></select></label><label className="setting-row"><span>Nom de la séance active</span><input value={active.title} onChange={e => update(active.id,s => ({ ...s,title: e.target.value }))}/></label><p className="settings-note">Le microphone est envoyé à OpenAI pendant l’écoute. Les questions vont au catalogue cinéma. Aucun son n’est enregistré par l’application. Les voix sont attribuées par le sélecteur d’orateur.</p><div className="settings-actions"><button className="soft-button" onClick={() => importing.current?.click()}><Upload size={15}/>Importer une séance</button><button className="soft-button" onClick={() => void exportSession()}><Download size={15}/>Exporter</button></div></section></div>}
    <input ref={importing} hidden type="file" accept="application/json,.json" onChange={async e => { const file = e.target.files?.[0]; if (!file) return; try { if (file.size > 8e6) throw new Error('Ce fichier dépasse 8 Mo.'); const imported = parseImport(JSON.parse(await file.text())); const restored = { ...imported.session,id: crypto.randomUUID(),title: `${imported.session.title} · import` }; commit(f => ({ ...f,sessions: [...f.sessions,restored],activeSessionId: restored.id })); cache(Object.values(imported.appearance)); live(); setSettings(false); setNotice('Séance importée.'); } catch (error) { setNotice(error instanceof Error ? error.message : 'Import impossible.'); } e.target.value = ''; }}/>
    <input ref={audioFile} hidden type="file" accept="audio/*,.wav,.mp3,.m4a,.webm,.ogg" onChange={async e => {
      const file = e.target.files?.[0]; if (!file) return;
      setFileProcessing(true);
      try {
        if (file.size > 25e6) throw new Error('Le fichier audio doit faire moins de 25 Mo.');
        const session = createSession();
        update(session.id,s => ({ ...s,title: file.name.replace(/\.[^.]+$/,'') }));
        setPhase('Transcription du fichier et repérage des voix');
        const response = await fetch(appUrl('api/transcribe'),{ method: 'POST',headers: {'Content-Type': file.type || 'application/octet-stream','X-Audio-Filename': encodeURIComponent(file.name)},body: file });
        const body = await response.json(); if (!response.ok) throw new Error(body.error);
        for (const segment of body.segments ?? [{text: body.text,speaker: 'A'}]) if (segment.text?.trim()) acceptText(segment.text,`Voix ${segment.speaker ?? 'A'}`,undefined,session.id);
      } catch (error) { setNotice(error instanceof Error ? error.message : 'Transcription impossible.'); }
      finally { setFileProcessing(false); e.target.value = ''; }
    }}/>
  </div>;
}

function Poster({ card }: {card: Card}) {
  const [failed,setFailed] = useState(false);
  useEffect(() => setFailed(false),[card.image]);
  const hue = Array.from(card.title).reduce((s,c) => s+c.charCodeAt(0),0)%360;
  if (card.mosaic?.length) return <div className="mosaic">{card.mosaic.slice(0,4).map(url => <img key={url} src={url} alt="" loading="lazy" onError={e => { e.currentTarget.style.visibility = 'hidden'; }}/>)}</div>;
  return card.image && !failed ? <img className="poster-image" src={card.image} alt="" loading="lazy" onError={() => setFailed(true)}/> : <div className="typographic-poster" style={{ '--poster-hue': hue } as CSSProperties}><span className="poster-top">{card.entity === 'person' ? 'PORTRAIT' : 'CINÉMA'}</span><div className="poster-art"><i/><i/><i/></div><strong>{card.title}</strong><span className="poster-year">{card.subtitle}</span></div>;
}

function Board({ layer, cards, chain, session, onSelect, loading, onLayer }: {layer: Layer; cards: Card[]; chain: Layer[]; session: Session; onSelect: (card: Card) => void; loading: boolean; onLayer: (id: string) => void}) {
  const [pan,setPan] = useState({ x: 0,y: 0 });
  const [zoom,setZoom] = useState(1);
  const pointers = useRef(new Map<number,{x: number;y: number}>());
  const pinch = useRef(0);
  const dragging = useRef(false);
  const single = layer.statement.named && cards.length === 1 ? cards[0] : null;
  const resultCards = single ? [] : cards;
  const positions = hexSpiral(resultCards.length+1).slice(1);
  const factImages = ['mouvement','liste','collection','sujet'].includes(layer.statement.property) ? cards.map(c => c.image).filter((url): url is string => !!url).slice(0,4) : [];
  useEffect(() => { setPan({ x: 0,y: 0 }); setZoom(1); },[layer.id]);
  const siblings = session.layers.filter(l => l.parentId === layer.parentId && l.id !== layer.id && l.pileId === layer.pileId);
  return <div className="board" aria-label="Mur de cartes cinéma" onWheel={e => setZoom(z => Math.max(.45,Math.min(2,z-e.deltaY*.001)))} onPointerDown={e => { if ((e.target as HTMLElement).closest('.board-controls,.sibling-branches,.ghost-layer')) return; pointers.current.set(e.pointerId,{x: e.clientX,y: e.clientY}); dragging.current = false; }} onPointerMove={e => {
    const old = pointers.current.get(e.pointerId); if (!old) return;
    pointers.current.set(e.pointerId,{x: e.clientX,y: e.clientY});
    if (pointers.current.size === 2) { const [a,b] = [...pointers.current.values()]; const distance = Math.hypot(a.x-b.x,a.y-b.y); if (pinch.current) setZoom(z => Math.max(.45,Math.min(2,z*distance/pinch.current))); pinch.current = distance; }
    else if (Math.hypot(e.clientX-old.x,e.clientY-old.y) > 2 || dragging.current) { e.currentTarget.setPointerCapture(e.pointerId); setPan(p => ({x: p.x+e.clientX-old.x,y: p.y+e.clientY-old.y})); dragging.current = true; }
  }} onPointerUp={e => { pointers.current.delete(e.pointerId); pinch.current = 0; }} onPointerCancel={e => { pointers.current.delete(e.pointerId); pinch.current = 0; }}>
    <div className="lens-outline"/><div className="board-coordinate north">LE FILM SE TROUVE AU CENTRE DU REGARD</div>
    {chain.slice(-4,-1).map((old,i) => <button className="ghost-layer" key={old.id} style={{ transform: `translate(${pan.x+30+(3-i)*17}px,${pan.y-35-(3-i)*22}px)`, opacity: .13+i*.06 }} onClick={() => onLayer(old.id)} title={`Revoir ${old.label}`}><Layers size={18}/><span>{old.label}</span></button>)}
    <article className={`fact-card ${single ? 'named-fact' : ''} ${factImages.length ? 'mosaic-fact' : ''}`} role={single ? 'button' : undefined} tabIndex={single ? 0 : undefined} aria-label={single ? `${single.title}, ${single.subtitle}${single.score !== null ? ', IMDb '+single.score : ''}` : undefined} onClick={() => single && !dragging.current && onSelect(single)} onKeyDown={e => { if (single && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSelect(single); } }} style={{ transform: `translate(calc(-50% + ${pan.x}px),calc(-50% + ${pan.y}px))`, '--speaker-color': speakerColor(layer.speaker) } as CSSProperties}>{single && <div className="fact-image"><Poster card={single}/></div>}{!!factImages.length && !single && <div className="fact-image"><div className="mosaic">{factImages.map(url => <img src={url} key={url} alt=""/>)}</div></div>}<div className="fact-symbol"><Sparkles size={23}/></div><p>CE QUI VIENT D’ÊTRE DIT</p><h2>{layer.statement.value}</h2><small>{single ? `${single.subtitle}${single.score !== null ? ' · IMDb '+single.score.toFixed(1) : ''}` : layer.statement.property}</small><div className="fact-footer"><span className="speaker-dot" style={{background: speakerColor(layer.speaker)}}/>{layer.speaker}{layer.status === 'loading' && <LoaderCircle size={12} className="spinning"/>}</div></article>
    {resultCards.map((card,i) => {
      const p = positions[i], x = (p.q*150+p.r*75)*zoom+pan.x, y = p.r*173*zoom+pan.y;
      const distance = Math.hypot(x,y), scale = .52+1.08*Math.exp(-Math.pow(distance/290,2));
      return <button className={`result-card ${distance < 115 ? 'in-focus' : ''}`} key={refKey(card)} style={{ transform: `translate(calc(-50% + ${x}px),calc(-50% + ${y}px)) scale(${scale})`, zIndex: Math.round(1000-distance) }} aria-label={`${card.title}${card.subtitle ? ', '+card.subtitle : ''}${card.score !== null ? ', IMDb '+card.score : ''}`} onClick={() => !dragging.current && onSelect(card)} onPointerDown={() => dragging.current = false}><Poster card={card}/><div className="card-caption"><strong>{card.title}</strong><span>{card.subtitle}{card.score !== null && <><i>IMDb</i>{card.score.toFixed(1)}</>}</span></div></button>;
    })}
    {!cards.length && layer.status === 'ready' && !loading && <div className="empty-result"><Search size={22}/><strong>{layer.refs.length ? 'Cartes à reconstruire' : layer.answer && layer.warning?.includes('identifiants') ? 'Réponse cinéma' : 'Pas de résultat'}</strong><p>{layer.answer || 'Ce croisement n’a donné aucune carte. Essayez un autre énoncé.'}</p></div>}
    {(layer.status === 'loading' || loading) && <div className="board-progress"><LoaderCircle className="spinning" size={14}/>{loading ? 'Les cartes retrouvent leur apparence actuelle' : 'La recherche construit cette couche…'}</div>}
    <div className="board-controls"><button className="icon-button" aria-label="Éloigner les cartes" onClick={() => setZoom(z => Math.max(.45,z-.15))}><ZoomOut size={16}/></button><button className="icon-button" aria-label="Recentrer le mur" onClick={() => { setPan({x: 0,y: 0}); setZoom(1); }}><Maximize2 size={16}/></button><button className="icon-button" aria-label="Rapprocher les cartes" onClick={() => setZoom(z => Math.min(2,z+.15))}><ZoomIn size={16}/></button></div><div className="board-help">Glissez pour explorer<span>·</span>Pincez pour déplacer la lisière</div>
    {siblings.length > 0 && <div className="sibling-branches"><GitBranch size={13}/>{siblings.map(s => <button key={s.id} onClick={() => onLayer(s.id)}>{s.label}</button>)}</div>}
  </div>;
}
