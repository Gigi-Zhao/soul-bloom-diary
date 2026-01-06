/**
 * Weekly Letter Generation Utilities
 * 周度总结生成工具函数
 */

import { supabase } from '@/integrations/supabase/client';

interface JournalEntry {
  date: string;
  mood?: string;
  content: string;
}

/**
 * Get the start and end date of a week (Monday to Sunday)
 */
export function getWeekRange(date: Date): { start: Date; end: Date } {
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  
  const monday = new Date(date);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  
  return { start: monday, end: sunday };
}

/**
 * Get all weeks from December 2024 to now
 */
export function getWeeksSinceDecember(): Array<{ start: Date; end: Date }> {
  const weeks: Array<{ start: Date; end: Date }> = [];
  const startDate = new Date('2024-12-01'); // December 1, 2024
  const today = new Date();
  
  let currentWeek = getWeekRange(startDate);
  
  while (currentWeek.start <= today) {
    weeks.push(currentWeek);
    
    // Move to next week
    const nextMonday = new Date(currentWeek.start);
    nextMonday.setDate(nextMonday.getDate() + 7);
    currentWeek = getWeekRange(nextMonday);
  }
  
  return weeks;
}

/**
 * Fetch journal entries for a specific week
 */
export async function getJournalEntriesForWeek(
  userId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<JournalEntry[]> {
  try {
    const { data, error } = await supabase
      .from('journal_entries')
      .select('date, mood, content')
      .eq('user_id', userId)
      .gte('date', weekStart.toISOString().split('T')[0])
      .lte('date', weekEnd.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (error) throw error;
    
    return (data || []).map(entry => ({
      date: entry.date,
      mood: entry.mood,
      content: entry.content
    }));
  } catch (error) {
    console.error('Error fetching journal entries:', error);
    return [];
  }
}

/**
 * Generate a weekly letter for a specific week
 */
export async function generateWeeklyLetter(
  userId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<{ content: string; model: string } | null> {
  try {
    // Fetch journal entries for this week
    const journalEntries = await getJournalEntriesForWeek(userId, weekStart, weekEnd);
    
    if (journalEntries.length === 0) {
      console.log(`No journal entries for week ${weekStart.toISOString()} - ${weekEnd.toISOString()}`);
      return null;
    }

    // Call API to generate letter
    // Use production API endpoint to avoid CORS issues in development
    const apiUrl = import.meta.env.PROD 
      ? '/api/generate-weekly-letter'
      : 'https://soul-bloom-diary.vercel.app/api/generate-weekly-letter';
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        journalEntries,
        weekStartDate: weekStart.toISOString().split('T')[0],
        weekEndDate: weekEnd.toISOString().split('T')[0],
      }),
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();
    return {
      content: data.content,
      model: data.model,
    };
  } catch (error) {
    console.error('Error generating weekly letter:', error);
    return null;
  }
}

/**
 * Save a weekly letter to database
 */
export async function saveWeeklyLetter(
  userId: string,
  weekStart: Date,
  weekEnd: Date,
  content: string
): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('weekly_letters')
      .insert({
        user_id: userId,
        week_start_date: weekStart.toISOString().split('T')[0],
        week_end_date: weekEnd.toISOString().split('T')[0],
        content,
        created_at: new Date().toISOString(),
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error saving weekly letter:', error);
    return false;
  }
}

/**
 * Initialize all missing weekly letters from December to now
 */
export async function initializeWeeklyLetters(userId: string): Promise<number> {
  let generatedCount = 0;

  try {
    const weeks = getWeeksSinceDecember();
    
    for (const week of weeks) {
      // Check if letter already exists
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (supabase as any)
        .from('weekly_letters')
        .select('id')
        .eq('user_id', userId)
        .eq('week_start_date', week.start.toISOString().split('T')[0])
        .maybeSingle();

      if (existing) {
        console.log(`Letter already exists for week ${week.start.toISOString()}`);
        continue;
      }

      // Generate letter
      console.log(`Generating letter for week ${week.start.toISOString()} - ${week.end.toISOString()}`);
      const result = await generateWeeklyLetter(userId, week.start, week.end);
      
      if (result) {
        // Save to database
        const saved = await saveWeeklyLetter(userId, week.start, week.end, result.content);
        if (saved) {
          generatedCount++;
          console.log(`✅ Generated and saved letter for week ${week.start.toISOString()}`);
        }
      }

      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return generatedCount;
  } catch (error) {
    console.error('Error initializing weekly letters:', error);
    return generatedCount;
  }
}
