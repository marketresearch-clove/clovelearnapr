import { supabase } from './supabaseClient';

export interface CalendarEvent {
  id: string;
  courseId?: string;
  lessonId?: string;
  userId?: string;
  title: string;
  description?: string;
  eventType: 'deadline' | 'class' | 'assignment' | 'exam' | 'other';
  startDate: string;
  endDate?: string;
  isAllDay: boolean;
  createdAt: string;
  updatedAt: string;
}

export const calendarService = {
  async getEvents(userId: string, startDate?: string, endDate?: string) {
    try {
      let query = supabase
        .from('calendar_events')
        .select('*')
        .eq('userid', userId);

      if (startDate) {
        query = query.gte('startdate', startDate);
      }

      if (endDate) {
        query = query.lte('enddate', endDate);
      }

      const { data, error } = await query.order('startdate', { ascending: true });

      if (error) throw error;
      return (data || []).map(mapToEvent);
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      return [];
    }
  },

  async getCourseEvents(courseId: string) {
    try {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('courseid', courseId)
        .order('startdate', { ascending: true });

      if (error) throw error;
      return (data || []).map(mapToEvent);
    } catch (error) {
      console.error('Error fetching course events:', error);
      return [];
    }
  },

  async createEvent(event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) {
    try {
      const row = mapToRow(event);
      const { data, error } = await supabase
        .from('calendar_events')
        .insert([row])
        .select()
        .single();

      if (error) throw error;
      return mapToEvent(data);
    } catch (error) {
      console.error('Error creating event:', error);
      throw error;
    }
  },

  async updateEvent(eventId: string, updates: Partial<CalendarEvent>) {
    try {
      const row = mapToRow(updates);
      const { data, error } = await supabase
        .from('calendar_events')
        .update(row)
        .eq('id', eventId)
        .select()
        .single();

      if (error) throw error;
      return mapToEvent(data);
    } catch (error) {
      console.error('Error updating event:', error);
      throw error;
    }
  },

  async deleteEvent(eventId: string) {
    try {
      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', eventId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting event:', error);
      throw error;
    }
  },

  async getUpcomingDeadlines(userId: string, days = 7) {
    try {
      const today = new Date();
      const futureDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);

      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('userid', userId)
        .eq('eventtype', 'deadline')
        .gte('startdate', today.toISOString())
        .lte('startdate', futureDate.toISOString())
        .order('startdate', { ascending: true });

      if (error) throw error;
      return (data || []).map(mapToEvent);
    } catch (error) {
      console.error('Error fetching upcoming deadlines:', error);
      return [];
    }
  },
};

// Helper to map DB row to CalendarEvent
const mapToEvent = (row: any): CalendarEvent => ({
  id: row.id,
  courseId: row.courseid,
  lessonId: row.lessonid,
  userId: row.userid,
  title: row.title,
  description: row.description,
  eventType: row.eventtype,
  startDate: row.startdate,
  endDate: row.enddate,
  isAllDay: row.isallday,
  createdAt: row.createdat,
  updatedAt: row.updatedat,
});

// Helper to map CalendarEvent (partial) to DB row
const mapToRow = (event: Partial<CalendarEvent>): any => {
  const row: any = {};
  if (event.courseId !== undefined) row.courseid = event.courseId;
  if (event.lessonId !== undefined) row.lessonid = event.lessonId;
  if (event.userId !== undefined) row.userid = event.userId;
  if (event.title !== undefined) row.title = event.title;
  if (event.description !== undefined) row.description = event.description;
  if (event.eventType !== undefined) row.eventtype = event.eventType;
  if (event.startDate !== undefined) row.startdate = event.startDate;
  if (event.endDate !== undefined) row.enddate = event.endDate;
  if (event.isAllDay !== undefined) row.isallday = event.isAllDay;
  return row;
};
