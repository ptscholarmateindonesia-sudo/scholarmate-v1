export function formatExcelDateToJsDate(serial: number | null): Date | null {
  if (!serial) return null;
  const utcDays = serial - 25569;
  const utcValue = utcDays * 86400;
  return new Date(utcValue * 1000);
}

export function getDeadlineRelativeStatus(serial: number | null, status?: string): { text: string; isClosed: boolean; isUrgent: boolean; daysLeft: number } {
  if (status === 'CLOSED') {
    return { text: 'Pendaftaran ditutup', isClosed: true, isUrgent: false, daysLeft: -1 };
  }
  const date = formatExcelDateToJsDate(serial);
  if (!date) {
    return { text: 'Belum ditentukan', isClosed: false, isUrgent: false, daysLeft: 999 };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { text: 'Pendaftaran ditutup', isClosed: true, isUrgent: false, daysLeft: diffDays };
  }
  if (diffDays === 0) {
    return { text: 'Hari ini', isClosed: false, isUrgent: true, daysLeft: 0 };
  }
  if (diffDays === 1) {
    return { text: 'Besok', isClosed: false, isUrgent: true, daysLeft: 1 };
  }
  return { 
    text: `Tampil ${diffDays} hari lagi`, 
    isClosed: false, 
    isUrgent: diffDays <= 7,
    daysLeft: diffDays 
  };
}
