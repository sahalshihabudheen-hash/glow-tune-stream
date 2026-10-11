import { useState } from 'react';
import { Download, X, Check, AlertCircle, ChevronDown, ChevronUp, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDownloadManager } from '@/contexts/DownloadManagerContext';

const DownloadQueue = () => {
  const { downloads, clearCompleted } = useDownloadManager();
  const [expanded, setExpanded] = useState(true);

  const activeCount = downloads.filter(d => d.status === 'preparing' || d.status === 'downloading').length;
  const completedCount = downloads.filter(d => d.status === 'done').length;

  if (downloads.length === 0) return null;

  return (
    <div className="fixed bottom-[6rem] md:bottom-24 right-4 z-50 w-80 max-w-[calc(100vw-2rem)] glass-premium rounded-2xl border border-border shadow-2xl overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-secondary/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Download className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Downloads</span>
          {activeCount > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-primary text-primary-foreground rounded-full">
              {activeCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {completedCount > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); clearCompleted(); }}
              className="p-1 text-muted-foreground hover:text-destructive transition-colors rounded"
              title="Clear completed"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      {/* Items */}
      {expanded && (
        <div className="max-h-60 overflow-y-auto border-t border-border/50">
          {downloads.map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-border/30 last:border-0">
              <img src={item.thumbnail} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{item.title}</p>
                {/* Progress bar */}
                <div className="mt-1 h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-300',
                      item.status === 'error' ? 'bg-destructive' :
                      item.status === 'done' ? 'bg-green-500' :
                      'bg-primary'
                    )}
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              </div>
              <div className="flex-shrink-0">
                {item.status === 'preparing' && <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />}
                {item.status === 'downloading' && (
                  <span className="text-[10px] font-mono text-primary font-bold">{item.progress}%</span>
                )}
                {item.status === 'done' && <Check className="w-4 h-4 text-green-500" />}
                {item.status === 'error' && <AlertCircle className="w-4 h-4 text-destructive" />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DownloadQueue;
