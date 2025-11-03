import { BottomNav } from "@/components/ui/bottom-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, startOfWeek, endOfWeek } from "date-fns";
import { MoodSelector } from "@/components/journals/MoodSelector";
import { DiaryEntryForm } from "@/components/journals/DiaryEntryForm";

/**
 * Mood emoji mapping for different moods
 */
const MOOD_EMOJIS: Record<string, { emoji: string; color: string }> = {
  happy: { emoji: "😊", color: "bg-yellow-300" },
  content: { emoji: "😌", color: "bg-purple-300" },
  sad: { emoji: "😢", color: "bg-purple-400" },
  sleepy: { emoji: "😴", color: "bg-green-200" },
  excited: { emoji: "😃", color: "bg-orange-300" },
  anxious: { emoji: "😰", color: "bg-blue-300" },
};

interface JournalEntry {
  id: string;
  created_at: string;
  content: string;
  mood: string;
  comment_count: number;
  date?: string;
  time?: string;
}

/**
 * Journals Page Component
 * Displays a mood calendar and journal entries feed
 * Users can view entries by date and create new entries
 */
const Journals = () => {
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
  useEffect(() => {
    fetchEntries();
  }, [currentMonth]);

  const fetchEntries = async () => {
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
        setEntries(data);

        // Group entries by date
        const grouped = new Map<string, JournalEntry[]>();
        data.forEach((entry: any) => {
          const dateKey = entry.date || format(new Date(entry.created_at), 'yyyy-MM-dd');
          const normalizedKey = dateKey.replace(/\./g, '-');
          if (!grouped.has(normalizedKey)) {
            grouped.set(normalizedKey, []);
          }
          grouped.get(normalizedKey)?.push(entry as JournalEntry);
        });
        setEntriesByDate(grouped);
      }
    } catch (error) {
      console.error('Error fetching entries:', error);
    } finally {
      setLoading(false);
    }
  };

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
    const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1);
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
    setSelectedEntry(entry);
    setSelectedMood(entry.mood);
    setShowEntryForm(true);
  };

  const days = getDaysInMonth();
  // When collapsed, show today's entries; when expanded, show selected date's entries
  const displayDate = isCalendarCollapsed ? new Date() : selectedDate;
  const displayDateKey = format(displayDate, 'yyyy-MM-dd');
  const selectedEntries = entriesByDate.get(displayDateKey) || [];

  return (
    <div className="min-h-screen pb-24 bg-gradient-to-b from-background to-muted/20">
      {/* Top Section: Mood Calendar */}
      <div className="max-w-md mx-auto px-4 pt-8">
        {/* Month Navigation Header */}
        <div 
          className="flex items-center justify-between mb-6 cursor-pointer"
          onClick={() => setIsCalendarCollapsed(!isCalendarCollapsed)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePreviousMonth();
            }}
            className="p-2 hover:bg-accent rounded-full transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          
          <div className="text-center">
            <div className="text-2xl font-bold">{format(currentMonth, 'yyyy')}</div>
            <div className="inline-block px-4 py-1 bg-accent/30 rounded-full text-sm">
              {format(currentMonth, 'M月')}
            </div>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleNextMonth();
            }}
            className="p-2 hover:bg-accent rounded-full transition-colors"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
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
                    ${moodConfig ? moodConfig.color : 'border border-border hover:bg-accent'}
                  `}
                  style={{
                    borderRadius: moodConfig 
                      ? '45% 55% 52% 48% / 48% 50% 50% 52%'  // Irregular circle for mood days
                      : '48% 52% 50% 50% / 52% 48% 52% 48%'  // Irregular circle for empty days
                  }}
                >
                  {moodConfig ? (
                    <span className="text-2xl">{moodConfig.emoji}</span>
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
        <div className="mb-4 text-lg font-semibold">
          {format(isCalendarCollapsed ? new Date() : selectedDate, 'M月d日 EEEE', { locale: undefined })}
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
                      <div className={`w-10 h-10 rounded-full ${moodConfig?.color || 'bg-accent'} flex items-center justify-center flex-shrink-0`}>
                        <span className="text-xl">{moodConfig?.emoji || '📝'}</span>
                      </div>

                      {/* Entry Content */}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-muted-foreground mb-1">
                          {format(new Date(entry.created_at), 'hh:mm a')}
                        </div>
                        <p className="text-sm text-foreground line-clamp-2">
                          {entry.content}
                        </p>
                      </div>

                      {/* Comment Count */}
                      <div className="flex items-center gap-1 text-muted-foreground flex-shrink-0">
                        <MessageCircle className="w-4 h-4" />
                        <span className="text-xs">{entry.comment_count}</span>
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
