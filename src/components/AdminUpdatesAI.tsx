import { useEffect, useRef, useState } from 'react';
import { Copy, Loader2, Send, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { SECTION_META, type UpdateRelease } from '@/lib/updates';

type Msg = { role: 'user' | 'assistant'; content: string };

const QUICK_PROMPTS = [
  'Write release notes from my rough points',
  'Make all items shorter',
  'Make this sound more exciting',
  'Which section should each item go in?',
];

/** Plain-text summary of the release being edited, so the AI knows what it is working on. */
const releaseContext = (r: UpdateRelease | null) => {
  if (!r) return '';
  const lines = [`Version ${r.version || '(no version yet)'}`];
  for (const s of r.sections) {
    if (!s.items.length) continue;
    lines.push(`${SECTION_META[s.type].label}:`);
    for (const it of s.items) lines.push(`- ${it.title || '(untitled)'}: ${it.text || '(no text)'}`);
  }
  return lines.join('\n');
};

/** Admin-only AI helper (Groq, via the admin-updates-ai edge function) that elaborates or trims release notes. */
const AdminUpdatesAI = ({ release }: { release: UpdateRelease | null }) => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, busy]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    const next: Msg[] = [...messages, { role: 'user', content }];
    setMessages(next);
    setInput('');
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-updates-ai', {
        body: { mode: 'chat', messages: next, context: releaseContext(release) },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setMessages((prev) => [...prev, { role: 'assistant', content: String(data.reply ?? '') }]);
    } catch (err: any) {
      toast.error(err?.message ? `AI: ${err.message}` : 'AI could not answer');
      // Put the message back so nothing typed is lost.
      setMessages(messages);
      setInput(content);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="w-4 h-4 text-primary" /> AI writing helper
        </p>
        {messages.length > 0 && (
          <Button size="sm" variant="ghost" className="h-8 gap-1" onClick={() => setMessages([])} disabled={busy}>
            <Trash2 className="w-4 h-4" /> Clear
          </Button>
        )}
      </div>

      {messages.length === 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Chat with AI to write, elaborate or shorten your notes. It can see the release you are editing. You can also
            use the Elaborate and Shorten buttons on each item.
          </p>
          <div className="flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((p) => (
              <Button key={p} size="sm" variant="outline" className="h-auto whitespace-normal py-1.5 text-left text-xs" onClick={() => send(p)} disabled={busy}>
                {p}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div
                className={
                  m.role === 'user'
                    ? 'max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground'
                    : 'max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-secondary px-3 py-2 text-sm'
                }
              >
                {m.content}
                {m.role === 'assistant' && (
                  <button
                    type="button"
                    className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                    onClick={() => navigator.clipboard.writeText(m.content).then(() => toast.success('Copied'))}
                  >
                    <Copy className="w-3 h-3" /> Copy
                  </button>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking…
            </div>
          )}
          <div ref={endRef} />
        </div>
      )}

      <div className="flex items-end gap-2">
        <Textarea
          rows={2}
          value={input}
          maxLength={2000}
          placeholder="Ask AI, e.g. “turn these bullets into release notes”"
          aria-label="Message the AI helper"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
        />
        <Button size="icon" className="h-10 w-10 shrink-0" onClick={() => send(input)} disabled={busy || !input.trim()} aria-label="Send">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
};

export default AdminUpdatesAI;
