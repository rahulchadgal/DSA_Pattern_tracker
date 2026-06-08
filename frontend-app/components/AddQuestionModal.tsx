import React from 'react';
import type { DifficultyLevel } from '../types';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface LcMetadata {
  questionId: string;
  title: string;
  difficulty: DifficultyLevel;
  category: string;
  link: string;
}

interface AddQuestionModalProps {
  open: boolean;
  questionIdInput: string;
  aiSuggestion: LcMetadata | null;
  manualCategory: string;
  categoryOptions: string[];
  isClassifying: boolean;
  isSavingQuestion: boolean;
  onOpenChange: (open: boolean) => void;
  onQuestionIdChange: (value: string) => void;
  onManualCategoryChange: (value: string) => void;
  onClassifyQuestion: (event: React.FormEvent) => void;
  onSaveQuestion: () => void;
}

export const AddQuestionModal: React.FC<AddQuestionModalProps> = ({
  open,
  questionIdInput,
  aiSuggestion,
  manualCategory,
  categoryOptions,
  isClassifying,
  isSavingQuestion,
  onOpenChange,
  onQuestionIdChange,
  onManualCategoryChange,
  onClassifyQuestion,
  onSaveQuestion
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-lg rounded-[2.5rem] border-slate-800 bg-[#0f172a] p-8">
      <DialogHeader className="mb-6 text-left">
        <DialogTitle className="text-xl font-black tracking-tight text-white">Add New Question</DialogTitle>
      </DialogHeader>
      <form onSubmit={onClassifyQuestion} className="space-y-4">
        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">LeetCode Question ID</label>
        <Input
          value={questionIdInput}
          onChange={(event) => onQuestionIdChange(event.target.value)}
          placeholder="e.g. 76"
          className="h-auto rounded-2xl border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 focus-visible:ring-indigo-500/40"
        />
        <Button type="submit" disabled={isClassifying} className="w-full rounded-2xl bg-indigo-600 py-3 text-xs font-black uppercase tracking-[0.2em] text-white hover:bg-indigo-500">
          {isClassifying ? 'Classifying...' : 'Get AI Suggestion'}
        </Button>
      </form>

      {aiSuggestion && (
        <Card className="mt-6 rounded-2xl border-slate-800 bg-slate-900/60">
          <CardContent className="space-y-3 p-4">
            <p className="text-xs text-slate-300"><span className="text-slate-500">Title:</span> {aiSuggestion.title}</p>
            <p className="text-xs text-slate-300"><span className="text-slate-500">Difficulty:</span> {aiSuggestion.difficulty}</p>
            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Confirm Category</label>
              <Select value={manualCategory} onValueChange={onManualCategoryChange}>
                <SelectTrigger className="rounded-xl border-slate-700 bg-slate-950 text-sm text-slate-100">
                  <SelectValue placeholder="Confirm category" />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={onSaveQuestion} disabled={isSavingQuestion} className="w-full rounded-2xl bg-emerald-600 py-3 text-xs font-black uppercase tracking-[0.2em] text-white hover:bg-emerald-500">
              {isSavingQuestion ? 'Saving...' : 'Confirm & Save'}
            </Button>
          </CardContent>
        </Card>
      )}
    </DialogContent>
  </Dialog>
);
