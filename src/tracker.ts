export type ContributionKind = 'comment' | 'pull_request' | 'review' | 'commit'
export type ContributionSource = 'github' | 'manual'

export interface Contribution {
  id: string
  date: string
  kind: ContributionKind
  title: string
  repository: string
  url?: string
  source: ContributionSource
}

export interface TrackerSettings {
  username: string
  weeklyGoal: number
}

export interface TrackerStats {
  activeDays: number
  currentStreak: number
  bestStreak: number
  totalActions: number
  weekActions: number
}

const CONTRIBUTIONS_KEY = 'oss-streak:contributions'
const SETTINGS_KEY = 'oss-streak:settings'
const DEFAULT_SETTINGS: TrackerSettings = { username: '', weeklyGoal: 5 }
const KINDS = new Set<ContributionKind>(['comment', 'pull_request', 'review', 'commit'])
const SOURCES = new Set<ContributionSource>(['github', 'manual'])

function storage(): Storage | undefined {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined
  } catch {
    return undefined
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeContribution(value: unknown): Contribution | undefined {
  if (!isRecord(value)) return undefined
  const { id, date, kind, title, repository, source, url } = value
  if (typeof id !== 'string' || !id.trim() || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined
  const parsedDate = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsedDate.getTime()) || formatDate(parsedDate) !== date) return undefined
  if (typeof kind !== 'string' || !KINDS.has(kind as ContributionKind)) return undefined
  if (typeof source !== 'string' || !SOURCES.has(source as ContributionSource)) return undefined
  if (typeof title !== 'string' || typeof repository !== 'string') return undefined
  const normalized: Contribution = {
    id: id.trim(), date, kind: kind as ContributionKind,
    title: title.trim(), repository: repository.trim(), source: source as ContributionSource,
  }
  if (typeof url === 'string' && url.trim()) normalized.url = url.trim()
  return normalized
}

/** Drop malformed records and keep only the first record for each stable ID. */
export function normalizeContributions(items: unknown): Contribution[] {
  if (!Array.isArray(items)) return []
  const seen = new Set<string>()
  const result: Contribution[] = []
  for (const item of items) {
    const contribution = normalizeContribution(item)
    if (!contribution || seen.has(contribution.id)) continue
    seen.add(contribution.id)
    result.push(contribution)
  }
  return result
}

export function loadContributions(): Contribution[] {
  try {
    const raw = storage()?.getItem(CONTRIBUTIONS_KEY)
    return raw ? normalizeContributions(JSON.parse(raw)) : []
  } catch {
    return []
  }
}

export function saveContributions(items: Contribution[]): void {
  try {
    storage()?.setItem(CONTRIBUTIONS_KEY, JSON.stringify(normalizeContributions(items)))
  } catch {
    // Storage can be disabled or full; the in-memory app can still operate.
  }
}

export function loadSettings(): TrackerSettings {
  try {
    const raw = storage()?.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const value: unknown = JSON.parse(raw)
    if (!isRecord(value)) return { ...DEFAULT_SETTINGS }
    return {
      username: typeof value.username === 'string' ? value.username.trim() : DEFAULT_SETTINGS.username,
      weeklyGoal: typeof value.weeklyGoal === 'number' && Number.isFinite(value.weeklyGoal) && value.weeklyGoal >= 0
        ? Math.floor(value.weeklyGoal) : DEFAULT_SETTINGS.weeklyGoal,
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: TrackerSettings): void {
  const clean: TrackerSettings = {
    username: typeof settings.username === 'string' ? settings.username.trim() : '',
    weeklyGoal: Number.isFinite(settings.weeklyGoal) && settings.weeklyGoal >= 0 ? Math.floor(settings.weeklyGoal) : DEFAULT_SETTINGS.weeklyGoal,
  }
  try {
    storage()?.setItem(SETTINGS_KEY, JSON.stringify(clean))
  } catch {
    // Ignore unavailable browser storage.
  }
}

interface GitHubEvent {
  id?: unknown
  type?: unknown
  created_at?: unknown
  repo?: { name?: unknown }
  payload?: Record<string, unknown>
}

function eventContribution(event: GitHubEvent): Contribution | undefined {
  if (typeof event.id !== 'string' || typeof event.created_at !== 'string') return undefined
  const timestamp = new Date(event.created_at)
  if (Number.isNaN(timestamp.getTime())) return undefined
  const date = formatDate(timestamp)
  const repository = typeof event.repo?.name === 'string' ? event.repo.name : ''
  const payload = event.payload ?? {}
  let kind: ContributionKind
  let title: string
  let url: string | undefined
  switch (event.type) {
    case 'IssueCommentEvent': {
      kind = 'comment'
      const issue = isRecord(payload.issue) ? payload.issue : {}
      title = typeof issue.title === 'string' ? `Commented on ${issue.title}` : 'Commented on an issue'
      url = typeof payload.comment === 'object' && payload.comment !== null && 'html_url' in payload.comment && typeof payload.comment.html_url === 'string'
        ? payload.comment.html_url : undefined
      break
    }
    case 'PullRequestEvent': {
      kind = 'pull_request'
      const pr = isRecord(payload.pull_request) ? payload.pull_request : {}
      const action = typeof payload.action === 'string' ? payload.action : 'updated'
      title = `${action[0]?.toUpperCase() ?? ''}${action.slice(1)} pull request${typeof pr.title === 'string' ? `: ${pr.title}` : ''}`
      url = typeof pr.html_url === 'string' ? pr.html_url : undefined
      break
    }
    case 'PullRequestReviewEvent': {
      kind = 'review'
      const pr = isRecord(payload.pull_request) ? payload.pull_request : {}
      title = `Reviewed pull request${typeof pr.title === 'string' ? `: ${pr.title}` : ''}`
      url = typeof payload.review === 'object' && payload.review !== null && 'html_url' in payload.review && typeof payload.review.html_url === 'string'
        ? payload.review.html_url : (typeof pr.html_url === 'string' ? pr.html_url : undefined)
      break
    }
    case 'PushEvent': {
      kind = 'commit'
      const count = Array.isArray(payload.commits) ? payload.commits.length : 0
      title = `Pushed ${count || 'a'} commit${count === 1 ? '' : 's'}`
      url = typeof payload.url === 'string' ? payload.url : undefined
      break
    }
    default: return undefined
  }
  const contribution: Contribution = { id: `github:${event.id}`, date, kind, title, repository, source: 'github' }
  if (url) contribution.url = url
  return contribution
}

export async function fetchRecentActivity(username: string): Promise<Contribution[]> {
  const cleanUsername = username.trim()
  if (!cleanUsername) throw new Error('Enter a GitHub username.')
  const response = await fetch(`https://api.github.com/users/${encodeURIComponent(cleanUsername)}/events/public?per_page=100`, {
    headers: { Accept: 'application/vnd.github+json' },
  })
  if (!response.ok) {
    if (response.status === 403 || response.status === 429) {
      const reset = response.headers.get('x-ratelimit-reset')
      const resetHint = reset ? ` Try again after ${new Date(Number(reset) * 1000).toLocaleTimeString()}.` : ' Try again later.'
      throw new Error(`GitHub API rate limit reached.${resetHint}`)
    }
    if (response.status === 404) throw new Error(`GitHub user “${cleanUsername}” was not found.`)
    throw new Error(`GitHub activity could not be loaded (HTTP ${response.status}).`)
  }
  let data: unknown
  try {
    data = await response.json()
  } catch {
    throw new Error('GitHub returned an unreadable activity response.')
  }
  if (!Array.isArray(data)) throw new Error('GitHub returned an unexpected activity response.')
  return normalizeContributions(data.map((event) => isRecord(event) ? eventContribution(event as GitHubEvent) : undefined))
}

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dateFromKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function shiftDate(date: Date, days: number): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  result.setDate(result.getDate() + days)
  return result
}

export function getStats(items: Contribution[], today = formatDate(new Date())): TrackerStats {
  const validItems = normalizeContributions(items)
  const counts = new Map<string, number>()
  for (const item of validItems) counts.set(item.date, (counts.get(item.date) ?? 0) + 1)
  const activeDates = [...counts.keys()].sort()
  const todayDate = dateFromKey(today)
  const todayKey = formatDate(todayDate)
  const currentWeekStart = shiftDate(todayDate, -((todayDate.getDay() + 6) % 7))
  const weekStartKey = formatDate(currentWeekStart)
  const weekActions = validItems.filter((item) => item.date >= weekStartKey && item.date <= todayKey).length

  let bestStreak = 0
  let run = 0
  let previous: Date | undefined
  for (const key of activeDates) {
    const current = dateFromKey(key)
    if (previous && Math.round((current.getTime() - previous.getTime()) / 86400000) === 1) run++
    else run = 1
    bestStreak = Math.max(bestStreak, run)
    previous = current
  }

  const startsToday = counts.has(todayKey)
  const startsYesterday = counts.has(formatDate(shiftDate(todayDate, -1)))
  let currentStreak = 0
  if (startsToday || startsYesterday) {
    let cursor = startsToday ? todayDate : shiftDate(todayDate, -1)
    while (counts.has(formatDate(cursor))) {
      currentStreak++
      cursor = shiftDate(cursor, -1)
    }
  }
  return { activeDays: counts.size, currentStreak, bestStreak, totalActions: validItems.length, weekActions }
}
