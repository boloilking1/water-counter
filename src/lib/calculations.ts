export interface Bottle {
  id: string;
  user_id: string;
  size_ml: number;
  is_active: boolean;
  started_at: string;
  finished_at: string | null;
}

export interface Sip {
  id: string;
  bottle_id: string;
  user_id: string;
  created_at: string;
}

const DEFAULT_SIP_ML = 90; // Stima media iniziale (circa 90 ml a sorso)

// Calcola il volume medio reale per sorso analizzando le bottiglie completate
export function getAverageSipMl(bottles: Bottle[], sips: Sip[]): number {
  const completedBottles = bottles.filter((b) => !b.is_active);
  if (completedBottles.length === 0) return DEFAULT_SIP_ML;

  let totalMl = 0;
  let totalSips = 0;

  completedBottles.forEach((b) => {
    const count = sips.filter((s) => s.bottle_id === b.id).length;
    if (count > 0) {
      totalMl += b.size_ml;
      totalSips += count;
    }
  });

  return totalSips > 0 ? Math.round(totalMl / totalSips) : DEFAULT_SIP_ML;
}

// Calcola i litri consumati per una singola data (YYYY-MM-DD)
export function calculateDailyStats(
  bottles: Bottle[],
  sips: Sip[],
  targetDate: string
) {
  const avgSipMl = getAverageSipMl(bottles, sips);
  const daySips = sips.filter((s) => s.created_at.slice(0, 10) === targetDate);

  let totalMl = 0;

  daySips.forEach((sip) => {
    const parentBottle = bottles.find((b) => b.id === sip.bottle_id);
    if (!parentBottle || parentBottle.is_active) {
      // Se la bottiglia è ancora aperta, usiamo la stima media
      totalMl += avgSipMl;
    } else {
      // Se la bottiglia è completata, ripartizione proporzionale esatta
      const sipsOfThisBottle = sips.filter((s) => s.bottle_id === parentBottle.id).length;
      totalMl += sipsOfThisBottle > 0 ? parentBottle.size_ml / sipsOfThisBottle : avgSipMl;
    }
  });

  return {
    liters: totalMl / 1000,
    sipsCount: daySips.length,
    avgSipMl,
  };
}

// Calcola i dati degli ultimi 7 giorni per il grafico
export function getWeeklyChartData(bottles: Bottle[], sips: Sip[]) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayLabel = d.toLocaleDateString('it-IT', { weekday: 'narrow' });
    const stats = calculateDailyStats(bottles, sips, dateStr);
    days.push({
      date: dateStr,
      label: dayLabel,
      liters: Number(stats.liters.toFixed(2)),
      sips: stats.sipsCount,
    });
  }
  return days;
}