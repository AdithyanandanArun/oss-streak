import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { fetchRecentActivity, getStats, loadContributions, loadSettings, saveContributions, saveSettings } from './tracker'

const contribution = (id: string, date: string) => ({ id, date, kind: 'commit' as const, title: 'Push', repository: 'owner/repo', source: 'manual' as const })

describe('getStats', () => {
  it('counts unique active dates and all actions, with Monday-based week totals', () => {
    const items = [contribution('1', '2026-11-16'), contribution('2', '2026-11-16'), contribution('3', '2026-11-15'), contribution('4', '2026-11-09')]
    expect(getStats(items, '2026-11-17')).toEqual({ activeDays: 3, currentStreak: 2, bestStreak: 2, totalActions: 4, weekActions: 2 })
  })

  it('keeps a streak through yesterday, resets after a gap, and handles empty input', () => {
    expect(getStats([contribution('a', '2026-11-15'), contribution('b', '2026-11-14')], '2026-11-16').currentStreak).toBe(2)
    expect(getStats([contribution('a', '2026-11-13')], '2026-11-16')).toMatchObject({ currentStreak: 0, bestStreak: 1, weekActions: 0 })
    expect(getStats([], '2026-11-16')).toEqual({ activeDays: 0, currentStreak: 0, bestStreak: 0, totalActions: 0, weekActions: 0 })
  })
})

describe('local storage', () => {
  const data = new Map<string, string>()
  const fakeStorage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value) },
    removeItem: (key: string) => { data.delete(key) },
    clear: () => data.clear(),
    key: (_index: number) => null,
    get length() { return data.size },
  } as Storage
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: fakeStorage } })
  afterEach(() => data.clear())
  afterAll(() => {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
    else Reflect.deleteProperty(globalThis, 'window')
  })

  it('round-trips normalized, deduplicated contributions and settings', () => {
    const first = contribution('x', '2026-11-16')
    saveContributions([first, first, { ...first, id: '' }])
    expect(loadContributions()).toEqual([first])
    saveSettings({ username: ' octocat ', weeklyGoal: 7.8 })
    expect(loadSettings()).toEqual({ username: 'octocat', weeklyGoal: 7 })
  })

  it('recovers from malformed persisted data', () => {
    data.set('oss-streak:contributions', '{bad')
    data.set('oss-streak:settings', 'null')
    expect(loadContributions()).toEqual([])
    expect(loadSettings()).toEqual({ username: '', weeklyGoal: 5 })
  })
})

describe('fetchRecentActivity', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('maps supported event types and skips unsupported events', async () => {
    const event = (id: string, type: string, payload: Record<string, unknown> = {}) => ({ id, type, created_at: '2026-11-16T12:00:00Z', repo: { name: 'octo/project' }, payload })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [
      event('1', 'IssueCommentEvent', { issue: { title: 'Bug' } }),
      event('2', 'PullRequestEvent', { action: 'opened', pull_request: { title: 'Feature', html_url: 'https://github.com/o/p/pull/2' } }),
      event('3', 'PullRequestReviewEvent', { pull_request: { title: 'Review me' } }),
      event('4', 'PushEvent', { commits: [{}, {}] }),
      event('5', 'WatchEvent'),
    ] }))
    const result = await fetchRecentActivity('octocat')
    expect(result.map(({ kind }) => kind)).toEqual(['comment', 'pull_request', 'review', 'commit'])
    expect(result[0]).toMatchObject({ id: 'github:1', title: 'Commented on Bug', repository: 'octo/project', date: '2026-11-16' })
    expect(result[3].title).toBe('Pushed 2 commits')
  })

  it('provides useful not-found and rate-limit errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, headers: new Headers() }))
    await expect(fetchRecentActivity('nobody')).rejects.toThrow('was not found')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, headers: new Headers() }))
    await expect(fetchRecentActivity('octocat')).rejects.toThrow('rate limit')
  })
})
