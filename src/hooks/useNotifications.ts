import { ScheduleEvent } from '../types'

export function useNotifications() {
  const scheduleNotification = (event: ScheduleEvent) => {
    (window as any).horizon.notify.schedule(event)
  }

  const cancelNotification = (id: string) => {
    (window as any).horizon.notify.cancel(id)
  }

  return { schedule: scheduleNotification, cancel: cancelNotification }
}
