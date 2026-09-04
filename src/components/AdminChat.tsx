import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { Send, Image, Mic, MicOff, Smile, Trash2, Loader2, X, SmilePlus, Crown, Sparkles, Reply, XCircle } from 'lucide-react';

interface ChatMessage {
  id: string;
  user_id: string;
  user_email: string;
  display_name: string | null;
  avatar_url: string | null;
  message_type: string;
  content: string | null;
  media_url: string | null;
  created_at: string;
  nameplate: string | null;
  reply_to: string | null;
}

interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
}

interface ReactionGroup {
  emoji: string;
  count: number;
  userIds: string[];
  reactionIds: string[];
}

// Discord-style animated nameplates
interface NameplateConfig {
  label: string;
  gradient: string;
  textClass: string;
  icon?: string;
  border?: string;
  animation?: string;
  glow?: string;
  bgSize?: string;
}

const NAMEPLATES: Record<string, NameplateConfig> = {
  none: { label: 'None', gradient: '', textClass: 'text-foreground' },
  fire: {
    label: '🔥 Inferno',
    gradient: 'bg-gradient-to-r from-orange-500 via-red-500 to-yellow-500',
    textClass: 'text-white', icon: '🔥',
    border: 'border-orange-500',
    animation: 'animate-nameplate-fire',
    glow: 'shadow-[0_0_12px_rgba(249,115,22,0.6)]',
    bgSize: 'bg-[length:200%_100%]',
  },
  ocean: {
    label: '🌊 Tidal',
    gradient: 'bg-gradient-to-r from-cyan-400 via-blue-500 to-cyan-400',
    textClass: 'text-white', icon: '🌊',
    border: 'border-cyan-400',
    animation: 'animate-nameplate-shimmer',
    glow: 'shadow-[0_0_12px_rgba(34,211,238,0.5)]',
    bgSize: 'bg-[length:200%_100%]',
  },
  aurora: {
    label: '🌌 Aurora',
    gradient: 'bg-gradient-to-r from-purple-500 via-pink-500 via-indigo-400 to-purple-500',
    textClass: 'text-white', icon: '✦',
    border: 'border-purple-400',
    animation: 'animate-nameplate-shimmer',
    glow: 'shadow-[0_0_14px_rgba(168,85,247,0.5)]',
    bgSize: 'bg-[length:300%_100%]',
  },
  gold: {
    label: '👑 Royalty',
    gradient: 'bg-gradient-to-r from-yellow-300 via-amber-400 via-yellow-500 to-yellow-300',
    textClass: 'text-black font-extrabold', icon: '👑',
    border: 'border-yellow-400',
    animation: 'animate-nameplate-shimmer',
    glow: 'shadow-[0_0_16px_rgba(251,191,36,0.6)]',
    bgSize: 'bg-[length:200%_100%]',
  },
  emerald: {
    label: '💎 Crystal',
    gradient: 'bg-gradient-to-r from-emerald-300 via-teal-400 to-emerald-300',
    textClass: 'text-white', icon: '💎',
    border: 'border-emerald-400',
    animation: 'animate-nameplate-pulse-glow',
    glow: 'shadow-[0_0_12px_rgba(52,211,153,0.5)]',
    bgSize: 'bg-[length:200%_100%]',
  },
  neon: {
    label: '⚡ Voltage',
    gradient: 'bg-gradient-to-r from-lime-300 via-green-400 via-cyan-400 to-lime-300',
    textClass: 'text-black font-bold', icon: '⚡',
    border: 'border-lime-400',
    animation: 'animate-nameplate-neon',
    glow: 'shadow-[0_0_18px_rgba(163,230,53,0.7)]',
    bgSize: 'bg-[length:200%_100%]',
  },
  midnight: {
    label: '🌙 Void',
    gradient: 'bg-gradient-to-r from-slate-900 via-indigo-800 to-slate-900',
    textClass: 'text-blue-200', icon: '🌙',
    border: 'border-indigo-500',
    animation: 'animate-nameplate-shimmer',
    glow: 'shadow-[0_0_10px_rgba(99,102,241,0.4)]',
    bgSize: 'bg-[length:200%_100%]',
  },
  rose: {
    label: '🌸 Sakura',
    gradient: 'bg-gradient-to-r from-rose-300 via-pink-400 to-rose-300',
    textClass: 'text-white', icon: '🌸',
    border: 'border-rose-400',
    animation: 'animate-nameplate-pulse-glow',
    glow: 'shadow-[0_0_12px_rgba(251,113,133,0.5)]',
    bgSize: 'bg-[length:200%_100%]',
  },
  storm: {
    label: '⛈️ Tempest',
    gradient: 'bg-gradient-to-r from-gray-700 via-blue-600 via-purple-600 to-gray-700',
    textClass: 'text-blue-100', icon: '⛈️',
    border: 'border-blue-500',
    animation: 'animate-nameplate-fire',
    glow: 'shadow-[0_0_14px_rgba(59,130,246,0.5)]',
    bgSize: 'bg-[length:200%_100%]',
  },
  sunset: {
    label: '🌅 Dusk',
    gradient: 'bg-gradient-to-r from-orange-400 via-red-400 via-purple-500 to-orange-400',
    textClass: 'text-white', icon: '🌅',
    border: 'border-orange-400',
    animation: 'animate-nameplate-shimmer',
    glow: 'shadow-[0_0_12px_rgba(251,146,60,0.5)]',
    bgSize: 'bg-[length:300%_100%]',
  },
  galaxy: {
    label: '✨ Cosmos',
    gradient: 'bg-gradient-to-r from-violet-500 via-fuchsia-400 via-pink-400 to-violet-500',
    textClass: 'text-white', icon: '✨',
    border: 'border-violet-400',
    animation: 'animate-nameplate-shimmer',
    glow: 'shadow-[0_0_16px_rgba(139,92,246,0.6)]',
    bgSize: 'bg-[length:300%_100%]',
  },
  rainbow: {
    label: '🌈 Prismatic',
    gradient: 'bg-gradient-to-r from-red-400 via-yellow-400 via-green-400 via-blue-400 via-purple-400 to-red-400',
    textClass: 'text-white font-bold', icon: '🌈',
    border: 'border-red-400',
    animation: 'animate-nameplate-rainbow',
    glow: 'shadow-[0_0_20px_rgba(251,113,133,0.4)]',
    bgSize: 'bg-[length:400%_100%]',
  },
};

const STICKERS = ['😀','😂','🤣','😍','🥳','🎉','🔥','💯','👏','🎵','🎶','🎸','🎤','🎧','💿','🎹','🥁','🎺','🪗','🎻'];
const REACTION_EMOJIS = ['👍','❤️','😂','😮','😢','🔥','🎉','👎'];

const AdminChat = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [showNameplatePicker, setShowNameplatePicker] = useState(false);
  const [selectedNameplate, setSelectedNameplate] = useState<string>('none');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [typingUsers, setTypingUsers] = useState<{ email: string; name: string }[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Load saved nameplate preference
  useEffect(() => {
    const saved = localStorage.getItem('admin_nameplate');
    if (saved && NAMEPLATES[saved]) setSelectedNameplate(saved);
  }, []);

  // Typing indicator channel
  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel('admin-chat-typing');
    typingChannelRef.current = channel;

    channel.on('broadcast', { event: 'typing' }, (payload) => {
      const { userId, email, name } = payload.payload as { userId: string; email: string; name: string };
      if (userId === user.id) return;

      setTypingUsers(prev => {
        const exists = prev.find(t => t.email === email);
        if (!exists) return [...prev, { email, name }];
        return prev;
      });

      // Auto-remove after 3s
      setTimeout(() => {
        setTypingUsers(prev => prev.filter(t => t.email !== email));
      }, 3000);
    }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const broadcastTyping = () => {
    if (!user || !typingChannelRef.current) return;
    typingChannelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: user.id, email: user.email, name: user.email?.split('@')[0] || 'Admin' },
    });
  };

  // Fetch messages & reactions
  useEffect(() => {
    fetchMessages();
    fetchReactions();

    const channel = supabase
      .channel('admin-chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_chat_messages' }, (payload) => {
        setMessages(prev => [...prev, payload.new as ChatMessage]);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'admin_chat_messages' }, (payload) => {
        setMessages(prev => prev.filter(m => m.id !== (payload.old as any).id));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_chat_reactions' }, (payload) => {
        setReactions(prev => [...prev, payload.new as Reaction]);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'admin_chat_reactions' }, (payload) => {
        setReactions(prev => prev.filter(r => r.id !== (payload.old as any).id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchMessages = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('admin_chat_messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(200);
    if (error) toast.error('Failed to load messages');
    else setMessages(data || []);
    setLoading(false);
  };

  const fetchReactions = async () => {
    const { data } = await supabase
      .from('admin_chat_reactions')
      .select('*');
    if (data) setReactions(data);
  };

  const getProfile = async () => {
    if (!user) return { display_name: null, avatar_url: null };
    const { data } = await supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('user_id', user.id)
      .maybeSingle();
    return { display_name: data?.display_name || null, avatar_url: data?.avatar_url || null };
  };

  const sendMessage = async (type: string, content?: string, mediaUrl?: string) => {
    if (!user) return;
    setSending(true);
    try {
      const profile = await getProfile();
      const { error } = await supabase.from('admin_chat_messages').insert({
        user_id: user.id,
        user_email: user.email || '',
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        message_type: type,
        content: content || null,
        media_url: mediaUrl || null,
        nameplate: selectedNameplate !== 'none' ? selectedNameplate : null,
        reply_to: replyTo?.id || null,
      });
      if (error) throw error;
      setReplyTo(null);
    } catch {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleSendText = async () => {
    const text = newMessage.trim();
    if (!text) return;
    setNewMessage('');
    await sendMessage('text', text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    // Broadcast typing
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    broadcastTyping();
    typingTimeoutRef.current = setTimeout(() => {}, 2000);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSendImage = async () => {
    if (!imageFile || !user) return;
    setSending(true);
    try {
      const ext = imageFile.name.split('.').pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('admin-chat').upload(path, imageFile);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('admin-chat').getPublicUrl(path);
      await sendMessage('image', undefined, urlData.publicUrl);
      setImageFile(null);
      setImagePreview(null);
    } catch {
      toast.error('Failed to upload image');
    } finally {
      setSending(false);
    }
  };

  const handleSendSticker = async (sticker: string) => {
    setShowStickers(false);
    await sendMessage('sticker', sticker);
  };

  const handleSelectNameplate = (key: string) => {
    setSelectedNameplate(key);
    localStorage.setItem('admin_nameplate', key);
    setShowNameplatePicker(false);
    toast.success(`Nameplate set to ${NAMEPLATES[key].label}`);
  };

  // Reactions
  const getReactionsForMessage = useCallback((messageId: string): ReactionGroup[] => {
    const msgReactions = reactions.filter(r => r.message_id === messageId);
    const groups: Record<string, ReactionGroup> = {};
    msgReactions.forEach(r => {
      if (!groups[r.emoji]) {
        groups[r.emoji] = { emoji: r.emoji, count: 0, userIds: [], reactionIds: [] };
      }
      groups[r.emoji].count++;
      groups[r.emoji].userIds.push(r.user_id);
      groups[r.emoji].reactionIds.push(r.id);
    });
    return Object.values(groups);
  }, [reactions]);

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    setShowReactionPicker(null);
    const existing = reactions.find(r => r.message_id === messageId && r.user_id === user.id && r.emoji === emoji);
    if (existing) {
      await supabase.from('admin_chat_reactions').delete().eq('id', existing.id);
    } else {
      await supabase.from('admin_chat_reactions').insert({
        message_id: messageId,
        user_id: user.id,
        emoji,
      });
    }
  };

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      setRecordingTime(0);
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (blob.size < 1000) { toast.error('Recording too short'); return; }
        await uploadVoice(blob);
      };
      mediaRecorder.start();
      setIsRecording(true);
      recordingIntervalRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } catch {
      toast.error('Microphone access denied');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
    setIsRecording(false);
    if (recordingIntervalRef.current) { clearInterval(recordingIntervalRef.current); recordingIntervalRef.current = null; }
  };

  const uploadVoice = async (blob: Blob) => {
    if (!user) return;
    setSending(true);
    try {
      const path = `${user.id}/voice_${Date.now()}.webm`;
      const { error: uploadError } = await supabase.storage.from('admin-chat').upload(path, blob, { contentType: 'audio/webm' });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('admin-chat').getPublicUrl(path);
      await sendMessage('voice', `${recordingTime}s`, urlData.publicUrl);
    } catch {
      toast.error('Failed to upload voice message');
    } finally {
      setSending(false);
      setRecordingTime(0);
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    const { error } = await supabase.from('admin_chat_messages').delete().eq('id', msgId);
    if (error) toast.error('Failed to delete');
  };

  const formatTime = (dateStr: string) => new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric' });
  const getInitials = (email: string, name?: string | null) => (name ? name.charAt(0) : email.charAt(0)).toUpperCase();

  // Get reply parent message
  const getReplyParent = (replyToId: string | null): ChatMessage | undefined => {
    if (!replyToId) return undefined;
    return messages.find(m => m.id === replyToId);
  };

  // Render nameplate badge - animated Discord style
  const renderNameplate = (nameplateKey: string | null, displayName: string | null, email: string) => {
    const name = displayName || email.split('@')[0];
    if (!nameplateKey || nameplateKey === 'none' || !NAMEPLATES[nameplateKey]) {
      return <span className="text-[10px] text-muted-foreground">{name}</span>;
    }
    const plate = NAMEPLATES[nameplateKey];
    return (
      <span className={`nameplate-badge text-[10px] font-bold px-2 py-0.5 rounded-md ${plate.gradient} ${plate.textClass} ${plate.animation || ''} ${plate.glow || ''} ${plate.bgSize || ''} inline-flex items-center gap-1`}>
        {plate.icon && <span className="text-[9px]">{plate.icon}</span>}
        {name}
      </span>
    );
  };

  const getReplyPreview = (msg: ChatMessage) => {
    if (msg.message_type === 'text') return msg.content?.slice(0, 50) || '';
    if (msg.message_type === 'sticker') return msg.content || '🎭';
    if (msg.message_type === 'image') return '📷 Image';
    if (msg.message_type === 'voice') return '🎙️ Voice';
    return msg.content || '';
  };

  // Group messages by date
  const groupedMessages: { date: string; msgs: ChatMessage[] }[] = [];
  messages.forEach(msg => {
    const date = formatDate(msg.created_at);
    const last = groupedMessages[groupedMessages.length - 1];
    if (last && last.date === date) last.msgs.push(msg);
    else groupedMessages.push({ date, msgs: [msg] });
  });

  return (
    <div className="flex flex-col h-[calc(100vh-280px)] min-h-[400px]">
      {/* Nameplate selector header */}
      <div className="px-4 py-2 border-b border-border flex items-center justify-between bg-muted/30">
        <div className="flex items-center gap-2 text-sm">
          <Crown className="w-4 h-4 text-yellow-500" />
          <span className="text-muted-foreground">Your nameplate:</span>
          {renderNameplate(selectedNameplate, user?.email?.split('@')[0] || 'You', user?.email || '')}
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowNameplatePicker(!showNameplatePicker)} className="text-xs gap-1">
          <Sparkles className="w-3 h-3" />
          Change
        </Button>
      </div>

      {/* Nameplate picker */}
      {showNameplatePicker && (
        <div className="px-4 py-3 border-b border-border bg-muted/50 space-y-2">
          <p className="text-xs font-medium text-muted-foreground mb-2">Choose your nameplate:</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {Object.entries(NAMEPLATES).map(([key, plate]) => (
              <button
                key={key}
                onClick={() => handleSelectNameplate(key)}
                className={`rounded-lg p-2.5 text-left border transition-all hover:scale-[1.03] ${
                  selectedNameplate === key 
                    ? 'ring-2 ring-primary border-primary bg-primary/5' 
                    : 'border-border hover:border-muted-foreground/30'
                }`}
              >
                {key === 'none' ? (
                  <span className="text-xs text-muted-foreground">No nameplate</span>
                ) : (
                  <span className={`nameplate-badge text-xs font-bold px-2 py-1 rounded-md ${plate.gradient} ${plate.textClass} ${plate.animation || ''} ${plate.glow || ''} ${plate.bgSize || ''} inline-flex items-center gap-1`}>
                    {plate.icon && <span>{plate.icon}</span>}
                    {plate.label}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            No messages yet. Start the conversation! 💬
          </div>
        ) : (
          groupedMessages.map(group => (
            <div key={group.date}>
              <div className="flex justify-center my-3">
                <span className="text-[10px] bg-muted px-2.5 py-0.5 rounded-full text-muted-foreground">{group.date}</span>
              </div>
              {group.msgs.map((msg) => {
                const isMe = msg.user_id === user?.id;
                const msgReactions = getReactionsForMessage(msg.id);
                const plateConfig = msg.nameplate && NAMEPLATES[msg.nameplate] ? NAMEPLATES[msg.nameplate] : null;
                const bubbleBorder = plateConfig?.border || '';
                const replyParent = getReplyParent(msg.reply_to);
                return (
                  <div key={msg.id} className={`flex gap-2 mb-3 ${isMe ? 'flex-row-reverse' : ''} group/msg`}>
                    {/* Avatar */}
                    <Avatar className={`w-8 h-8 mt-1 shrink-0 transition-shadow ${bubbleBorder ? `border-2 ${bubbleBorder} ${plateConfig?.glow || ''}` : ''}`}>
                      <AvatarImage src={msg.avatar_url || ''} />
                      <AvatarFallback className="text-[10px] bg-primary/20">{getInitials(msg.user_email, msg.display_name)}</AvatarFallback>
                    </Avatar>

                    <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                      {/* Name with nameplate */}
                      <div className="mb-0.5 px-1">
                        {renderNameplate(msg.nameplate, msg.display_name, msg.user_email)}
                      </div>

                      {/* Reply preview */}
                      {replyParent && (
                        <div className={`text-[10px] px-2 py-1 mb-0.5 rounded-t-lg border-l-2 border-primary/50 bg-muted/60 text-muted-foreground max-w-full truncate ${isMe ? 'self-end' : 'self-start'}`}>
                          <span className="font-semibold">{replyParent.display_name || replyParent.user_email.split('@')[0]}</span>
                          {': '}
                          {getReplyPreview(replyParent)}
                        </div>
                      )}

                      <div className="relative">
                        <div className={`rounded-2xl px-3 py-2 transition-shadow ${
                          isMe 
                            ? 'bg-primary text-primary-foreground rounded-br-md' 
                            : 'bg-muted rounded-bl-md'
                        } ${bubbleBorder ? `border ${bubbleBorder}` : ''} ${plateConfig?.glow || ''}`}>
                          {msg.message_type === 'text' && (
                            <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                          )}
                          {msg.message_type === 'image' && msg.media_url && (
                            <img src={msg.media_url} alt="shared" className="max-w-[250px] rounded-lg cursor-pointer" onClick={() => window.open(msg.media_url!, '_blank')} />
                          )}
                          {msg.message_type === 'sticker' && (
                            <span className="text-4xl">{msg.content}</span>
                          )}
                          {msg.message_type === 'gif' && (
                            <span className="text-4xl">{msg.content}</span>
                          )}
                          {msg.message_type === 'voice' && msg.media_url && (
                            <div className="flex items-center gap-2">
                              <audio controls src={msg.media_url} className="h-8 max-w-[200px]" />
                              <span className="text-[10px] opacity-70">{msg.content}</span>
                            </div>
                          )}
                          <span className={`text-[9px] mt-0.5 block ${isMe ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                            {formatTime(msg.created_at)}
                          </span>
                        </div>

                        {/* Action buttons (reply + react) */}
                        <div className={`absolute -bottom-1 ${isMe ? '-left-12' : '-right-12'} opacity-0 group-hover/msg:opacity-100 transition-opacity flex gap-0.5`}>
                          <button
                            onClick={() => setReplyTo(msg)}
                            className="bg-background border border-border rounded-full p-0.5 shadow-sm hover:bg-muted"
                            title="Reply"
                          >
                            <Reply className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                          <button
                            onClick={() => setShowReactionPicker(showReactionPicker === msg.id ? null : msg.id)}
                            className="bg-background border border-border rounded-full p-0.5 shadow-sm hover:bg-muted"
                          >
                            <SmilePlus className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                        </div>

                        {/* Reaction picker popup */}
                        {showReactionPicker === msg.id && (
                          <div className={`absolute -bottom-9 ${isMe ? 'right-0' : 'left-0'} z-50 flex gap-0.5 bg-background border border-border rounded-full px-1.5 py-1 shadow-lg`}>
                            {REACTION_EMOJIS.map(emoji => {
                              const myReaction = reactions.find(r => r.message_id === msg.id && r.user_id === user?.id && r.emoji === emoji);
                              return (
                                <button
                                  key={emoji}
                                  onClick={() => toggleReaction(msg.id, emoji)}
                                  className={`text-base hover:scale-125 transition-transform px-0.5 rounded ${myReaction ? 'bg-primary/20' : ''}`}
                                >
                                  {emoji}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Reaction display */}
                      {msgReactions.length > 0 && (
                        <div className={`flex flex-wrap gap-1 mt-0.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
                          {msgReactions.map(rg => {
                            const iReacted = user ? rg.userIds.includes(user.id) : false;
                            return (
                              <button
                                key={rg.emoji}
                                onClick={() => toggleReaction(msg.id, rg.emoji)}
                                className={`flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full border transition-colors ${
                                  iReacted 
                                    ? 'bg-primary/15 border-primary/30 text-foreground' 
                                    : 'bg-muted/50 border-border text-muted-foreground hover:bg-muted'
                                }`}
                              >
                                <span>{rg.emoji}</span>
                                <span className="text-[10px] font-medium">{rg.count}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {isMe && (
                        <button
                          onClick={() => handleDeleteMessage(msg.id)}
                          className="opacity-0 group-hover/msg:opacity-100 transition-opacity mt-0.5 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 px-2 py-1">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-[11px] text-muted-foreground italic">
              {typingUsers.map(t => t.name).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
            </span>
          </div>
        )}
      </div>

      {/* Reply preview bar */}
      {replyTo && (
        <div className="px-4 py-2 border-t border-border bg-primary/5 flex items-center gap-3">
          <Reply className="w-4 h-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-primary">{replyTo.display_name || replyTo.user_email.split('@')[0]}</p>
            <p className="text-xs text-muted-foreground truncate">{getReplyPreview(replyTo)}</p>
          </div>
          <button onClick={() => setReplyTo(null)} className="shrink-0 hover:text-destructive text-muted-foreground">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Image preview */}
      {imagePreview && (
        <div className="px-4 py-2 border-t border-border bg-muted/30 flex items-center gap-3">
          <img src={imagePreview} alt="preview" className="w-16 h-16 rounded-lg object-cover" />
          <div className="flex-1 text-sm text-muted-foreground">Ready to send image</div>
          <Button size="sm" variant="ghost" onClick={() => { setImagePreview(null); setImageFile(null); }}><X className="w-4 h-4" /></Button>
          <Button size="sm" onClick={handleSendImage} disabled={sending}><Send className="w-4 h-4" /></Button>
        </div>
      )}

      {/* Sticker picker */}
      {showStickers && (
        <div className="px-4 py-3 border-t border-border bg-muted/30">
          <div className="flex flex-wrap gap-2">
            {STICKERS.map(s => (
              <button key={s} onClick={() => handleSendSticker(s)} className="text-2xl hover:scale-125 transition-transform">{s}</button>
            ))}
          </div>
        </div>
      )}

      {/* Recording indicator */}
      {isRecording && (
        <div className="px-4 py-2 border-t border-border bg-destructive/10 flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
          <span className="text-sm font-medium text-destructive">Recording... {recordingTime}s</span>
          <div className="flex-1" />
          <Button size="sm" variant="destructive" onClick={stopRecording}><MicOff className="w-4 h-4 mr-1" /> Stop</Button>
        </div>
      )}

      {/* Input bar */}
      <div className="p-3 border-t border-border bg-background flex items-center gap-2">
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => fileInputRef.current?.click()} title="Send image">
          <Image className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setShowStickers(!showStickers)} title="Stickers">
          <Smile className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className={`shrink-0 ${isRecording ? 'text-destructive' : ''}`} onClick={isRecording ? stopRecording : startRecording} title="Voice message">
          {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </Button>
        <Input
          value={newMessage}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={replyTo ? `Reply to ${replyTo.display_name || replyTo.user_email.split('@')[0]}...` : "Type a message..."}
          className="flex-1 rounded-full bg-muted border-0"
          disabled={isRecording}
        />
        <Button size="icon" className="shrink-0 rounded-full" onClick={handleSendText} disabled={!newMessage.trim() || sending}>
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
};

export default AdminChat;
