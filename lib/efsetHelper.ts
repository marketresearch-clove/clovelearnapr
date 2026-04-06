export interface EFSETBadge {
  id: string;
  name: string;
  scoreRange: [number, number];
  cefrLevel: string;
  color: string;
  icon: string;
}

export const EFSET_BADGES: EFSETBadge[] = [
  {
    id: 'efset-pre-a1',
    name: 'pre-A1',
    scoreRange: [0, 20],
    cefrLevel: 'pre-A1',
    color: '#94a3b8', // Slate 400
    icon: 'text_snippet'
  },
  {
    id: 'efset-a1',
    name: 'A1 Beginner',
    scoreRange: [21, 30],
    cefrLevel: 'A1',
    color: '#f97316', // Orange 500
    icon: 'sentiment_satisfied'
  },
  {
    id: 'efset-a2',
    name: 'A2 Elementary',
    scoreRange: [31, 40],
    cefrLevel: 'A2',
    color: '#eab308', // Yellow 500
    icon: 'sentiment_very_satisfied'
  },
  {
    id: 'efset-b1',
    name: 'B1 Intermediate',
    scoreRange: [41, 50],
    cefrLevel: 'B1',
    color: '#84cc16', // Lime 500
    icon: 'grade'
  },
  {
    id: 'efset-b2',
    name: 'B2 Upper Intermediate',
    scoreRange: [51, 60],
    cefrLevel: 'B2',
    color: '#06b6d4', // Cyan 500
    icon: 'military_tech'
  },
  {
    id: 'efset-c1',
    name: 'C1 Advanced',
    scoreRange: [61, 70],
    cefrLevel: 'C1',
    color: '#3b82f6', // Blue 500
    icon: 'stars'
  },
  {
    id: 'efset-c2',
    name: 'C2 Proficient',
    scoreRange: [71, 100],
    cefrLevel: 'C2',
    color: '#a855f7', // Purple 500
    icon: 'workspace_premium'
  }
];

export const getEFSETBadge = (score: number): EFSETBadge | null => {
  return EFSET_BADGES.find(b => score >= b.scoreRange[0] && score <= b.scoreRange[1]) || null;
};
