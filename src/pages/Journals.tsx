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
  
  // State for journal entries
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [entriesByDate, setEntriesByDate] = useState<Map<string, JournalEntry[]>>(new Map());
  const [loading, setLoading] = useState(true);

  // State for entry creation flow
  const [showMoodSelector, setShowMoodSelector] = useState(false);
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [selectedMood, setSelectedMood] = useState<string>("");

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
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);

      const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        setEntries(data);
        
        // Group entries by date
        const grouped = new Map<string, JournalEntry[]>();
        data.forEach((entry) => {
          const dateKey = format(new Date(entry.created_at), 'yyyy-MM-dd');
          if (!grouped.has(dateKey)) {
            grouped.set(dateKey, []);
          }
          grouped.get(dateKey)?.push(entry);
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
   * Get all days in the current month view (including padding days)
   */
  const getDaysInMonth = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    
    return eachDayOfInterval({ start: startDate, end: endDate });
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
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  /**
   * Navigate to next month
   */
  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
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

  const days = getDaysInMonth();
  const selectedEntries = getEntriesForSelectedDate();

  return (
    <div className="min-h-screen pb-24 bg-gradient-to-b from-background to-muted/20">
      {/* Top Section: Mood Calendar */}
      <div className="max-w-md mx-auto px-4 pt-8">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={handlePreviousMonth}
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
            onClick={handleNextMonth}
            className="p-2 hover:bg-accent rounded-full transition-colors"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-6 gap-2 mb-8">
          {days.map((day, index) => {
            const mood = getMoodForDate(day);
            const isSelected = isSameDay(day, selectedDate);
            const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
            const moodConfig = mood ? MOOD_EMOJIS[mood] : null;

            return (
              <button
                key={index}
                onClick={() => setSelectedDate(day)}
                className={`
                  aspect-square rounded-full flex items-center justify-center text-sm
                  transition-all duration-200
                  ${!isCurrentMonth ? 'text-muted-foreground/40' : ''}
                  ${isSelected ? 'ring-2 ring-primary ring-offset-2' : ''}
                  ${moodConfig ? moodConfig.color : 'border border-border hover:bg-accent'}
                `}
              >
                {moodConfig ? (
                  <span className="text-2xl">{moodConfig.emoji}</span>
                ) : (
                  <span className={isCurrentMonth ? 'text-foreground' : 'text-muted-foreground/40'}>
                    {format(day, 'd')}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Section: Journal Entries Feed */}
      <div className="max-w-md mx-auto px-4">
        {/* Selected Date Header */}
        <div className="mb-4 text-lg font-semibold">
          {format(selectedDate, 'M月d日 EEEE', { locale: undefined })}
        </div>

        {/* Entries List */}
        {loading ? (
          <div className="text-center text-muted-foreground py-8">Loading...</div>
        ) : selectedEntries.length > 0 ? (
          <div className="space-y-3">
            {selectedEntries.map((entry) => {
              const moodConfig = MOOD_EMOJIS[entry.mood];
              return (
                <Card key={entry.id} className="bg-card/80 backdrop-blur">
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
        onClose={() => setShowEntryForm(false)}
        mood={selectedMood}
        onSuccess={handleEntrySuccess}
      />

      <BottomNav />
    </div>
  );
};

export default Journals;
