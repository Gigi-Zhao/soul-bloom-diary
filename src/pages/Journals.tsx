import { BottomNav } from "@/components/ui/bottom-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, ChevronLeft, ChevronRight, MessageCircle, Activity } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, startOfWeek, endOfWeek } from "date-fns";
import { MoodSelector } from "@/components/journals/MoodSelector";
import { DiaryEntryForm } from "@/components/journals/DiaryEntryForm";

const MOOD_IMAGE_BASE = import.meta.env.BASE_URL || "/";

/**
 * Mood emoji mapping for different moods
 */
const MOOD_EMOJIS: Record<string, { image: string; color: string }> = {
  happy: { image: `${MOOD_IMAGE_BASE}moods/happy.png`, color: "bg-[#FFD166]" },
  excited: { image: `${MOOD_IMAGE_BASE}moods/excited.png`, color: "bg-[#EF476F]" },
  content: { image: `${MOOD_IMAGE_BASE}moods/content.png`, color: "bg-[#C8E7C8]" },
  calm: { image: `${MOOD_IMAGE_BASE}moods/calm.png`, color: "bg-[#A8A39D]" },
  tired: { image: `${MOOD_IMAGE_BASE}moods/tired.png`, color: "bg-[#9C8574]" },
  sad: { image: `${MOOD_IMAGE_BASE}moods/sad.png`, color: "bg-[#6C8EAD]" },
  worried: { image: `${MOOD_IMAGE_BASE}moods/worried.png`, color: "bg-[#7FA99B]" },
  confused: { image: `${MOOD_IMAGE_BASE}moods/confused.png`, color: "bg-[#8FB5D3]" },
  anxious: { image: `${MOOD_IMAGE_BASE}moods/anxious.png`, color: "bg-[#C5A3D9]" },
  angry: { image: `${MOOD_IMAGE_BASE}moods/angry.png`, color: "bg-[#06FFA5]" },
};

interface JournalEntry {
  id: string;
  created_at: string;
  content: string;
  mood: string;
  comment_count: number;
  date?: string;
  time?: string;
  unread_comments?: number;
}

/**
 * Journals Page Component
 * Displays a mood calendar and journal entries feed
 * Users can view entries by date and create new entries
 */
const Journals = () => {
  const navigate = useNavigate();
  const location = useLocation();
  // State for selected date and current month
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [isCalendarCollapsed, setIsCalendarCollapsed] = useState(false);
  
  // State for journal entries
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [entriesByDate, setEntriesByDate] = useState<Map<string, JournalEntry[]>>(new Map());
  const [loading, setLoading] = useState(true);

  // State for entry creation flow
  const [showMoodSelector, setShowMoodSelector] = useState(false);
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [selectedMood, setSelectedMood] = useState<string>("");
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);

  /**
   * Fetch journal entries from Supabase
   */
  const fetchEntries = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;

      // Get start and end of current month
      const monthStart = format(startOfMonth(currentMonth), 'yyyy.MM.dd');
      const monthEnd = format(endOfMonth(currentMonth), 'yyyy.MM.dd');

      const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .order('date', { ascending: false });

      if (error) throw error;

      if (data) {
        // Fetch unread comment counts for each entry
        const entriesWithUnread = await Promise.all(
          data.map(async (entry) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const e = entry as any;
            const { data: comments, error: commentError } = await supabase
              .from('journal_comments')
              .select('id', { count: 'exact' })
              .eq('journal_entry_id', e.id)
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .eq('is_read' as any, false);
            
            const unreadCount = comments?.length || 0;
            console.log(`[Journals] Entry ${e.id} has ${unreadCount} unread comments`);
            return { ...e, unread_comments: unreadCount };
          })
        );

        setEntries(entriesWithUnread as unknown as JournalEntry[]);

        // Group entries by date
        const grouped = new Map<string, JournalEntry[]>();
        entriesWithUnread.forEach((entry) => {
          const dateKey = (entry as unknown as { date?: string; created_at: string }).date || format(new Date((entry as unknown as { created_at: string }).created_at), 'yyyy-MM-dd');
          const normalizedKey = dateKey.replace(/\./g, '-');
          if (!grouped.has(normalizedKey)) {
            grouped.set(normalizedKey, []);
          }
          grouped.get(normalizedKey)?.push(entry as JournalEntry);
        });
        setEntriesByDate(grouped);
      }
    } catch (error) {
      console.error('[Journals] Error fetching entries:', error);
    } finally {
      setLoading(false);
    }
  }, [currentMonth]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Refresh entries when returning to the page with refresh flag
  useEffect(() => {
    if (location.pathname === '/journals' && location.state?.refresh) {
      fetchEntries();
      // Clear the refresh flag to prevent reloading on subsequent visits
      navigate('/journals', { replace: true, state: {} });
    }
  }, [location.pathname, location.state, fetchEntries, navigate]);

  /**
   * Get all days in the current month up to today only
   * Does not show previous month padding or future dates
   */
  const getDaysInMonth = () => {
    const monthStart = startOfMonth(currentMonth);
    const today = new Date();
    
    // If viewing current month, show up to today
    // If viewing past month, show entire month
    // If viewing future month, show nothing
    const currentMonthYear = format(currentMonth, 'yyyy-MM');
    const todayMonthYear = format(today, 'yyyy-MM');
    
    if (currentMonthYear === todayMonthYear) {
      // Current month: show from start to today
      return eachDayOfInterval({ start: monthStart, end: today });
    } else if (currentMonth < today) {
      // Past month: show entire month
      const monthEnd = endOfMonth(currentMonth);
      return eachDayOfInterval({ start: monthStart, end: monthEnd });
    } else {
      // Future month: show nothing
      return [];
    }
  };

  /**
   * Get the primary mood for a given date
   */
  const getMoodForDate = (date: Date): string | null => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const dayEntries = entriesByDate.get(dateKey);
    return dayEntries && dayEntries.length > 0 ? dayEntries[0].mood : null;
  };

  /**
   * Get entries for the currently selected date
   */
  const getEntriesForSelectedDate = (): JournalEntry[] => {
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    return entriesByDate.get(dateKey) || [];
  };

  /**
   * Navigate to previous month
   */
  const handlePreviousMonth = () => {
    const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1);
    setCurrentMonth(newMonth);
    
    // If navigating to current month, select today; otherwise select last day of that month
    const today = new Date();
    const isCurrentMonth = format(newMonth, 'yyyy-MM') === format(today, 'yyyy-MM');
    
    if (isCurrentMonth) {
      setSelectedDate(today);
    } else {
      const monthEnd = endOfMonth(newMonth);
      const lastAvailableDay = newMonth < today ? monthEnd : today;
      setSelectedDate(lastAvailableDay);
    }
  };

  /**
   * Navigate to next month
   */
  const handleNextMonth = () => {
    const today = new Date();
    const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1);
    
    // Prevent navigating to future months
    if (newMonth > today) {
      return;
    }
    
    setCurrentMonth(newMonth);
    
    // If navigating to current month, select today; otherwise select last day of that month
    const isCurrentMonth = format(newMonth, 'yyyy-MM') === format(today, 'yyyy-MM');
    
    if (isCurrentMonth) {
      setSelectedDate(today);
    } else {
      const monthEnd = endOfMonth(newMonth);
      const lastAvailableDay = newMonth < today ? monthEnd : today;
      setSelectedDate(lastAvailableDay);
    }
  };

  /**
   * Handle mood selection - show entry form
   */
  const handleMoodSelect = (mood: string) => {
    setSelectedMood(mood);
    setShowMoodSelector(false);
    setShowEntryForm(true);
  };

  /**
   * Handle successful entry creation - refresh entries
   */
  const handleEntrySuccess = () => {
    fetchEntries();
  };

  /**
   * Handle clicking on an existing entry to view/edit it
   */
  const handleEntryClick = (entry: JournalEntry) => {
    console.log('[Journals] Entry clicked, navigating to detail:', entry.id);
    navigate(`/journal/${entry.id}`);
  };

  const days = getDaysInMonth();
  // Always show selected date's entries, regardless of calendar state
  const displayDateKey = format(selectedDate, 'yyyy-MM-dd');
  const selectedEntries = entriesByDate.get(displayDateKey) || [];

  // Touch and swipe gesture handling
  const touchStartY = useRef<number>(0);
  const touchEndY = useRef<number>(0);
  const lastWheelTime = useRef<number>(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchEndY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = () => {
    const deltaY = touchStartY.current - touchEndY.current;
    const minSwipeDistance = 30;

    if (Math.abs(deltaY) > minSwipeDistance) {
      if (deltaY > 0) {
        handleNextMonth();
      } else {
        handlePreviousMonth();
      }
    }
  };

  const calendarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = calendarRef.current;
    if (!element) return;

    const preventDefault = (e: Event) => {
      if (e.cancelable) {
        e.preventDefault();
      }
    };

    // Add non-passive event listeners to prevent default scrolling
    element.addEventListener('wheel', preventDefault, { passive: false });
    element.addEventListener('touchmove', preventDefault, { passive: false });

    return () => {
      element.removeEventListener('wheel', preventDefault);
      element.removeEventListener('touchmove', preventDefault);
    };
  }, []);

  const handleWheel = (e: React.WheelEvent) => {
    const now = Date.now();
    if (now - lastWheelTime.current < 200) return;
    lastWheelTime.current = now;
    
    if (Math.abs(e.deltaY) > 7) {
      if (e.deltaY > 0) {
        handleNextMonth();
      } else {
        handlePreviousMonth();
      }
    }
  };

  return (
    <div className="min-h-screen pb-24 bg-gradient-to-b from-background to-muted/20">
      {/* Top Section: Mood Calendar */}
      <div 
        ref={calendarRef}
        className="max-w-md mx-auto px-4 pt-0"
        style={{ touchAction: 'none' }}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Month Navigation Header */}
        <div className="mb-6 flex flex-col items-center select-none relative">
          <button
            type="button"
            className="text-base font-normal text-foreground mt-10 p-0 bg-transparent border-0 cursor-pointer"
            onClick={() => setIsCalendarCollapsed(!isCalendarCollapsed)}
          >
            {format(currentMonth, 'yyyy')}
          </button>
          <div 
            className="relative inline-block px-8 py-1.5 -mt-1 cursor-pointer"
            onClick={() => setIsCalendarCollapsed(!isCalendarCollapsed)}
          >
            <img 
                src="/date_bg.png" 
                alt="" 
                className="absolute w-full h-full object-cover opacity-50"
                style={{ zIndex: 0, top: '20%', left: 0 }}
              />
              <span className="relative text-lg font-medium text-foreground" style={{ zIndex: 1 }}>
                {['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'][currentMonth.getMonth()]}
              </span>
            </div>
        </div>

        {/* Collapsible Calendar Grid */}
        {!isCalendarCollapsed && (
          <div className="grid grid-cols-6 gap-2 mb-8 transition-all duration-300">
            {days.map((day, index) => {
              const mood = getMoodForDate(day);
              const isSelected = isSameDay(day, selectedDate);
              const moodConfig = mood ? MOOD_EMOJIS[mood] : null;

              return (
                <button
                  key={index}
                  onClick={() => setSelectedDate(day)}
                  className={`
                    aspect-square flex items-center justify-center text-sm
                    transition-all duration-200
                    ${isSelected ? 'ring-2 ring-primary ring-offset-2' : ''}
                    ${moodConfig ? '' : 'border border-border hover:bg-accent'}
                  `}
                  style={{
                    borderRadius: moodConfig 
                      ? '45% 55% 52% 48% / 48% 50% 50% 52%'
                      : '48% 52% 50% 50% / 52% 48% 52% 48%'
                  }}
                >
                  {moodConfig ? (
                    <img 
                      src={moodConfig.image} 
                      alt="mood" 
                      className="w-14 h-14 object-cover"
                    />
                  ) : (
                    <span className="text-foreground">
                      {format(day, 'd')}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Section: Journal Entries Feed */}
      <div className="max-w-md mx-auto px-4">
        {/* Selected Date Header */}
        <div className="mb-4 text-lg font-semibold flex items-center justify-between">
          <span>{format(selectedDate, 'M月d日 EEEE', { locale: undefined })}</span>
          <img src="/圣诞帽.png" alt="Christmas Hat" className="w-6 h-6 object-contain translate-y-1" />
        </div>

        {/* Entries List */}
        {loading ? (
          <div className="text-center text-muted-foreground py-8">Loading...</div>
        ) : selectedEntries.length > 0 ? (
          <div className="space-y-3">
            {selectedEntries.map((entry) => {
              const moodConfig = MOOD_EMOJIS[entry.mood];
              return (
                <Card 
                  key={entry.id} 
                  className="bg-card/80 backdrop-blur cursor-pointer hover:bg-card transition-colors"
                  onClick={() => handleEntryClick(entry)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Mood Icon */}
                      <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                        {moodConfig ? (
                          <img 
                            src={moodConfig.image} 
                            alt="mood" 
                            className="w-10 h-10 object-contain"
                          />
                        ) : (
                          <span className="text-xl">📝</span>
                        )}
                      </div>

                      {/* Entry Content */}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-muted-foreground mb-1">
                          {format(new Date(entry.created_at), 'hh:mm a').toUpperCase()}
                        </div>
                        <p className="text-sm text-foreground line-clamp-2">
                          {entry.content}
                        </p>
                      </div>

                      {/* Comment Count */}
                      <div className="flex items-center gap-1 text-muted-foreground flex-shrink-0 relative">
                        <MessageCircle className="w-4 h-4" />
                        <span className="text-xs">{entry.comment_count}</span>
                        {/* Unread indicator - red dot */}
                        {(entry.unread_comments || 0) > 0 && (
                          <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            No entries for this day
          </div>
        )}
      </div>

      {/* Floating Add Button */}
      <button
        className="fixed bottom-24 right-6 w-16 h-16 rounded-full bg-foreground text-background shadow-lg hover:scale-110 transition-transform flex items-center justify-center z-40"
        onClick={() => setShowMoodSelector(true)}
      >
        <Plus className="w-8 h-8" />
      </button>

      {/* Mood Selection Dialog */}
      <MoodSelector
        open={showMoodSelector}
        onClose={() => setShowMoodSelector(false)}
        onSelectMood={handleMoodSelect}
      />

      {/* Diary Entry Form */}
      <DiaryEntryForm
        open={showEntryForm}
        onClose={() => {
          setShowEntryForm(false);
          setSelectedEntry(null);
        }}
        mood={selectedMood}
        onSuccess={handleEntrySuccess}
        entry={selectedEntry}
        selectedDate={selectedDate}
      />

      <BottomNav />
    </div>
  );
};

export default Journals;
