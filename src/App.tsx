import { useEffect, useRef, useState } from 'react'
import type { Contribution, ContributionKind } from './tracker'
import { fetchRecentActivity, getStats, loadContributions, loadSettings, saveContributions, saveSettings } from './tracker'
import './App.css'

const kinds: { value: ContributionKind; label: string; symbol: string; description: string }[] = [
  { value: 'comment', label: 'Comment', symbol: '◷', description: 'Start a conversation' },
  { value: 'pull_request', label: 'Pull request', symbol: '⑂', description: 'Ship something useful' },
  { value: 'review', label: 'Review', symbol: '✓', description: 'Help someone ship' },
  { value: 'commit', label: 'Commit', symbol: '◇', description: 'Make a little progress' },
]
const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const prettyDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = { grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z', activity: 'M3 12h4l3-8 4 16 3-8h4', settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2', arrow: 'M5 12h14m-5-5 5 5-5 5', github: 'M9 19c-4 1-4-2-6-2m12 5v-4c0-1-.2-1.6-1-2 3-.3 6-1.5 6-6 0-1.4-.5-2.4-1.3-3.3.2-.7.6-2.3-.2-3.7 0 0-1-.3-3.5 1.3a12 12 0 0 0-6 0C6.5 2.7 5.5 3 5.5 3c-.8 1.4-.4 3-.2 3.7C4.5 7.6 4 8.6 4 10c0 4.5 3 5.7 6 6-.6.4-1 1-1 2v4', flame: 'M12 3c1 5-4 6-4 10 0 2 1 3 2 3-1-3 3-3 3-6 4 4 6 6 4 9-3 5-12 3-12-3 0-6 6-7 7-13Z' }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.arrow} /></svg>
}

function App() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 60000); return () => window.clearInterval(timer) }, [])
  const [items, setItems] = useState<Contribution[]>(loadContributions)
  const [settings, setSettings] = useState(loadSettings)
  const [username, setUsername] = useState(settings.username)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [dialog, setDialog] = useState<'checkin' | 'settings' | null>(null)
  const [kind, setKind] = useState<ContributionKind>('comment')
  const [title, setTitle] = useState('')
  const [repository, setRepository] = useState('')
  const [date, setDate] = useState(localDate())
  const [filter, setFilter] = useState('all')
  const [goalDraft, setGoalDraft] = useState(String(settings.weeklyGoal))
  const dialogRef = useRef<HTMLDialogElement>(null)
  const today = localDate(now)
  const stats = getStats(items, today)
  const todayCount = items.filter(item => item.date === today).length
  const progress = Math.min(100, Math.round(stats.weekActions / settings.weeklyGoal * 100))
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const recent = [...items].filter(item => filter === 'all' || item.kind === filter).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8)
  const end = new Date(now); end.setHours(12, 0, 0, 0)
  const start = new Date(end); start.setDate(end.getDate() - 181); start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  const days = Array.from({ length: Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1 }, (_, index) => { const day = new Date(start); day.setDate(start.getDate() + index); return { date: localDate(day), count: items.filter(item => item.date === localDate(day)).length, month: day.getDate() <= 7 ? day.toLocaleDateString(undefined, { month: 'short' }) : '' } })
  function openDialog(value: 'checkin' | 'settings') { setDialog(value); setGoalDraft(String(settings.weeklyGoal)); setError(''); dialogRef.current?.showModal() }
  function closeDialog() { dialogRef.current?.close(); setDialog(null); setError('') }
  function persist(next: Contribution[]) { saveContributions(next); setItems(next) }
  async function importActivity() {
    if (!username.trim()) { setError('Enter your GitHub username to get started.'); return }
    setLoading(true); setError(''); setNotice('')
    try {
      const imported = await fetchRecentActivity(username.trim())
      const known = new Set(items.map(item => item.id))
      const newItems = imported.filter(item => !known.has(item.id))
      persist([...items, ...newItems])
      const next = { ...settings, username: username.trim() }; saveSettings(next); setSettings(next)
      setNotice(newItems.length ? `Imported ${newItems.length} public contributions. You're all caught up.` : 'All caught up. No new public activity found.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not connect to GitHub. Please try again.') }
    finally { setLoading(false) }
  }
  function addContribution(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    try { persist([...items, { id: `manual-${crypto.randomUUID()}`, date, kind, title: title.trim(), repository: repository.trim(), source: 'manual' }]); setNotice('Contribution logged. Small steps add up.'); setTitle(''); setRepository(''); closeDialog() }
    catch { setError('Unable to save. Please check that browser storage is available.') }
  }
  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#overview" aria-label="Streak home"><span className="brand-icon"><Icon name="flame" /></span>streak<span className="brand-dot">.</span></a>
      <div className="workspace-label">YOUR WORKSPACE</div>
      <nav aria-label="Main navigation"><a className="nav-item active" href="#overview"><Icon name="grid" />Overview<span className="nav-dot" /></a><a className="nav-item" href="#activity"><Icon name="activity" />Activity</a><button className="nav-item" onClick={() => openDialog('settings')}><Icon name="settings" />Settings</button></nav>
      <div className="sidebar-note"><span className="note-star">✳</span><h3>A little, every day.</h3><p>Great open source starts with showing up.</p><span className="note-line" /></div>
      <div className="sidebar-footer"><span className="avatar">{settings.username ? settings.username.slice(0, 2).toUpperCase() : 'YOU'}</span><div><strong>{settings.username || 'Your workspace'}</strong><span>Personal account</span></div><span className="online-dot" /></div>
    </aside>
    <main id="overview">
      <header className="topbar"><span>Workspace <span className="breadcrumb">/</span> <strong>Overview</strong></span><span className="local-badge"><span />Local-first, always</span></header>
      <div className="page-content">
        <section className="page-heading"><div><div className="eyebrow">BUILD IN THE OPEN</div><h1>{greeting}<span className="greeting-mark">✳</span></h1><p>A little contribution. A lasting impact. Keep your momentum going.</p></div><span className="date-chip">◷<span>{now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span></span></section>
        <section className="hero-card"><div className="hero-copy"><span className="hero-eyebrow"><span />{todayCount ? 'YOU SHOWED UP TODAY' : 'YOUR NEXT SMALL STEP'}</span><h2>{todayCount ? 'Momentum looks good on you.' : 'Big things start\nwith a small contribution.'}</h2><p>{todayCount ? `${todayCount} contribution${todayCount === 1 ? '' : 's'} today. Keep building something that matters.` : 'Leave a thoughtful comment. Review a pull request.\nMake open source a little better, one day at a time.'}</p><button className="primary-button" onClick={() => { setDate(today); openDialog('checkin') }}>＋ Log a contribution <Icon name="arrow" /></button><span className="hero-footnote">Every kind of contribution counts.</span></div><div className="hero-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="art-grid" /><span className="floating-code code-one">&lt;/&gt;</span><span className="floating-code code-two">＋</span><div className="flame-tile"><Icon name="flame" /></div><span className="art-caption">KEEP THE SPARK ALIVE</span><span className="spark spark-one">✦</span><span className="spark spark-two">✳</span></div></section>
        <section className="stats-grid" aria-label="Contribution statistics"><article className="stat-card"><div className="stat-label">Current streak <span className="stat-icon orange"><Icon name="flame" /></span></div><div className="stat-number">{stats.currentStreak}<span>days</span></div><p>{stats.currentStreak ? 'One day at a time. Keep it going.' : 'Your next contribution starts it.'}</p></article><article className="stat-card"><div className="stat-label">Longest streak <span className="stat-icon">♧</span></div><div className="stat-number">{stats.bestStreak}<span>days</span></div><p>Your personal best. Yours to beat.</p></article><article className="stat-card"><div className="stat-label">Total contributions <span className="stat-icon">⑂</span></div><div className="stat-number">{stats.totalActions}<span>actions</span></div><p>Small efforts, real impact.</p></article><article className="stat-card goal-card"><div className="stat-label">This week's goal <span className="stat-icon">◎</span></div><div className="stat-number">{stats.weekActions}<span>/ {settings.weeklyGoal} contributions</span></div><div className="progress-track" role="progressbar" aria-label="Weekly goal" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></div><p>{progress === 100 ? 'Goal reached. Look at you go!' : `${Math.max(0, settings.weeklyGoal - stats.weekActions)} more to reach your weekly goal`}</p></article></section>
        <section className="panel calendar-panel"><div className="section-heading"><div><h2>Your contribution rhythm</h2><p>{stats.activeDays} active days. Every square tells a story.</p></div><span className="small-badge">Last 6 months</span></div><div className="calendar-scroll"><div className="calendar-wrap"><div className="month-labels">{days.filter((_, i) => i % 7 === 0).map(day => <span key={day.date}>{day.month}</span>)}</div><div className="heatmap-main"><div className="day-labels"><span>Mon</span><span>Wed</span><span>Fri</span></div><div className="heatmap">{days.map(day => <div key={day.date} className={`heat-cell level-${Math.min(day.count, 4)} ${day.date === today ? 'is-today' : ''}`} role="img" aria-label={`${prettyDate(day.date)}: ${day.count} contributions`} title={`${prettyDate(day.date)} · ${day.count} contributions`} />)}</div></div></div></div><div className="calendar-footer"><span><span className="tiny-spark">✳</span> Consistency over intensity.</span><div className="legend">Less{[0, 1, 2, 3, 4].map(level => <span key={level} className={`heat-cell level-${level}`} />)}More</div></div></section>
        <div className="bottom-grid"><section className="panel activity-panel" id="activity"><div className="section-heading"><div><h2>Recent activity</h2><p>Your small wins, all in one place.</p></div><select aria-label="Filter activity" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All activity</option>{kinds.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>{recent.length ? <ul className="activity-list">{recent.map(item => <li key={item.id}><span className={`activity-symbol kind-${item.kind}`}>{kinds.find(k => k.value === item.kind)?.symbol}</span><div className="activity-detail">{item.url ? <a href={item.url} target="_blank" rel="noreferrer">{item.title} ↗</a> : <strong>{item.title}</strong>}<span>{item.repository || 'Personal contribution'} <b>·</b> {item.source === 'manual' ? 'Manually logged' : 'GitHub'}</span></div><time dateTime={item.date}>{prettyDate(item.date)}</time></li>)}</ul> : <div className="empty-state"><span>⑂</span><h3>{filter === 'all' ? 'Your story starts here.' : 'Nothing here just yet.'}</h3><p>Import your GitHub activity or log your first contribution.</p><button className="text-button" onClick={() => openDialog('checkin')}>Log a contribution <Icon name="arrow" /></button></div>}</section>
        <section className="panel github-panel"><div className="github-icon"><Icon name="github" /></div><h2>Connect your open source life.</h2><p>Bring in your recent public GitHub activity. No sign-in or access token needed.</p><form onSubmit={event => { event.preventDefault(); void importActivity() }}><label htmlFor="github-username">GitHub username</label><div className="username-input"><span>@</span><input id="github-username" value={username} onChange={event => setUsername(event.target.value)} placeholder="your-username" autoComplete="username" disabled={loading} maxLength={39} /></div><button className="import-button" disabled={loading}><Icon name="github" />{loading ? 'Importing activity…' : 'Import GitHub activity'}{!loading && <span>↗</span>}</button></form><p className="privacy-note">⌑ Public activity only. Your data stays in this browser.</p><p className="import-note">GitHub's public event feed is limited. Older or private contributions can be logged manually.</p></section></div>
        {(notice || (error && !dialog)) && <div role={error ? 'alert' : 'status'} className={`notice ${error ? 'error' : ''}`}>{error || notice}<button aria-label="Dismiss notification" onClick={() => { setNotice(''); setError('') }}>×</button></div>}
        <footer className="page-footer"><span><span className="footer-brand">streak.</span> Built for the long game.</span><span>Small contributions. Open possibilities. <span className="footer-star">✳</span></span></footer>
      </div>
    </main>
    <dialog ref={dialogRef} onCancel={() => { setDialog(null); setError('') }} onClick={event => { if (event.target === event.currentTarget) closeDialog() }}><div className="dialog-heading"><div><span className="eyebrow">YOUR WORKSPACE</span><h2>{dialog === 'settings' ? 'Make it yours.' : 'A small step forward.'}</h2></div><button className="close-button" aria-label="Close dialog" onClick={closeDialog}>×</button></div>{dialog === 'checkin' ? <form onSubmit={addContribution}><p className="dialog-description">Code is only part of the story. Every contribution counts.</p><div className="kind-options">{kinds.map(item => <button type="button" className={kind === item.value ? 'selected' : ''} aria-pressed={kind === item.value} key={item.value} onClick={() => setKind(item.value)}><span>{item.symbol}</span>{item.label}</button>)}</div><label htmlFor="contribution-title">What did you contribute?</label><input autoFocus id="contribution-title" required maxLength={180} placeholder="e.g. Helped troubleshoot an installation issue" value={title} onChange={event => setTitle(event.target.value)} pattern=".*\S.*" /><label htmlFor="repository">Repository <span className="optional">(optional)</span></label><input id="repository" placeholder="owner / repository" value={repository} onChange={event => setRepository(event.target.value)} maxLength={120} /><label htmlFor="contribution-date">Date</label><input id="contribution-date" type="date" required max={today} value={date} onChange={event => setDate(event.target.value)} /><button className="primary-button dialog-submit">Save contribution <Icon name="arrow" /></button></form> : <form onSubmit={event => { event.preventDefault(); try { const next = { ...settings, weeklyGoal: Number(goalDraft) }; saveSettings(next); setSettings(next); setNotice('Your preferences are saved in this browser.'); closeDialog() } catch { setError('Unable to save settings in this browser.') } }}><p className="dialog-description">Set a sustainable pace. You can change it anytime.</p><label htmlFor="weekly-goal">Weekly contribution goal</label><input id="weekly-goal" type="number" min={1} max={100} required value={goalDraft} onChange={event => setGoalDraft(event.target.value)} /><p className="settings-note">All contribution data is stored locally on this browser. GitHub import reads public activity only and does not require account access.</p><button className="primary-button dialog-submit">Save preferences <Icon name="arrow" /></button></form>}{error && <p role="alert" className="error-text">{error}</p>}</dialog>
  </div>
}
export default App
