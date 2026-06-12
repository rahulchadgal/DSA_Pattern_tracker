import React from 'react';
import { cn } from '../lib/utils';

export const GlassPanel: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={cn('glass-panel rounded-[20px]', className)} {...props} />
);

export const PageContainer: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={cn('page-shell gradient-bg', className)} {...props} />
);

