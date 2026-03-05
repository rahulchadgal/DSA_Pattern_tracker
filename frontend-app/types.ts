
export interface Question {
  id: string; // The problem number as a string (e.g. "11")
  title: string; // The problem name (e.g. "Container With Most Water")
  fullTitle: string; // "11. Container With Most Water"
  link: string; // LeetCode URL
  difficulty: 'Easy' | 'Medium' | 'Hard';
}

export interface Pattern {
  id: string;
  name: string;
  questions: Question[];
  videoLink?: string;
}

export interface Section {
  id: string;
  title: string;
  patterns: Pattern[];
}

export interface ProgressState {
  completedIds: string[];
}
