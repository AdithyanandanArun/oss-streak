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

export declare function loadContributions(): Contribution[]
export declare function saveContributions(items: Contribution[]): void
export declare function loadSettings(): TrackerSettings
export declare function saveSettings(settings: TrackerSettings): void
export declare function fetchRecentActivity(username: string): Promise<Contribution[]>
export declare function getStats(items: Contribution[], today?: string): TrackerStats
