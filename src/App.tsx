import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import {
  type Bottle,
  type Sip,
  calculateDailyStats,
  getAverageSipMl,
  getWeeklyChartData,
} from './lib/calculations';
import {
  Droplet,
  RotateCcw,
  Plus,
  BarChart2,
  AlertCircle,
  Sparkles,
  Trash2,
  Clock,
} from 'lucide-react';
import confetti from 'canvas-confetti';

// Funzione di utilità per formattare i numeri in italiano
const formatLiters = (liters: number) => liters.toFixed(2).replace('.', ',') + ' L';

const formatBottleSize = (ml: number) => {
  if (ml === 1000) return '1 Litro';
  if (ml >= 1000) return `${(ml / 1000).toString().replace('.', ',')} Litri`;
  return `${ml} ml`;
};

// Formattazione del tempo relativo per l'Opzione B
const formatRelativeTime = (isoString: string) => {
  const now = new Date().getTime();
  const past = new Date(isoString).getTime();
  const diffMinutes = Math.floor((now - past) / 60000);

  const timeStr = new Date(isoString).toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (diffMinutes < 1) return `${timeStr} (proprio ora)`;
  if (diffMinutes === 1) return `${timeStr} (1 min fa)`;
  if (diffMinutes < 60) return `${timeStr} (${diffMinutes} min fa)`;
  const hours = Math.floor(diffMinutes / 60);
  return `${timeStr} (${hours} ${hours === 1 ? 'ora' : 'ore'} fa)`;
};

export default function App() {
  // Impostazione predefinita su "Miele"
  const [userId] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('u');
    if (fromUrl) {
      localStorage.setItem('sorsi_user', fromUrl);
      return fromUrl;
    }
    return localStorage.getItem('sorsi_user') || 'Miele';
  });

  const [activeBottle, setActiveBottle] = useState<Bottle | null>(null);
  const [allBottles, setAllBottles] = useState<Bottle[]>([]);
  const [allSips, setAllSips] = useState<Sip[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'recap'>('home');
  const [, setTick] = useState(0);

  const todayStr = new Date().toISOString().slice(0, 10);

  // Aggiorna il calcolo del tempo relativo ogni 30 secondi
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      setErrorMessage(null);
      const { data: bottles, error: bError } = await supabase
        .from('bottles')
        .select('*')
        .eq('user_id', userId)
        .order('started_at', { ascending: false });

      if (bError) throw bError;

      const { data: sips, error: sError } = await supabase
        .from('sips')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (sError) throw sError;

      const bottleList: Bottle[] = bottles || [];
      const sipList: Sip[] = sips || [];

      setAllBottles(bottleList);
      setAllSips(sipList);

      const current = bottleList.find((b) => b.is_active) || null;
      setActiveBottle(current);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Errore nel caricamento';
      setErrorMessage(`Errore database: ${message}`);
    }
  };

  useEffect(() => {
    loadData();
  }, [userId]);

  const handleDrink = async () => {
    if (!activeBottle) {
      setIsModalOpen(true);
      return;
    }

    if ('vibrate' in navigator) navigator.vibrate(35);

    const { error } = await supabase.from('sips').insert({
      bottle_id: activeBottle.id,
      user_id: userId,
    });

    if (error) alert(`Errore: ${error.message}`);
    else loadData();
  };

  const handleUndo = async () => {
    if (allSips.length === 0) return;
    const lastSip = allSips[0];
    if (!confirm('Annullare l’ultimo sorso registrato?')) return;

    const { error } = await supabase.from('sips').delete().eq('id', lastSip.id);
    if (!error) loadData();
  };

  const startNewBottle = async (sizeMl: number) => {
    if (activeBottle) {
      await supabase
        .from('bottles')
        .update({ is_active: false, finished_at: new Date().toISOString() })
        .eq('id', activeBottle.id);

      try {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
      } catch {
        // Fallback silenzioso
      }
    }

    const { error } = await supabase.from('bottles').insert({
      user_id: userId,
      size_ml: sizeMl,
      is_active: true,
    });

    if (!error) {
      setIsModalOpen(false);
      loadData();
    }
  };

  const handleResetData = async () => {
    if (!confirm('Attenzione: vuoi davvero cancellare tutti i dati di prova per Miele?')) return;
    await supabase.from('sips').delete().eq('user_id', userId);
    await supabase.from('bottles').delete().eq('user_id', userId);
    loadData();
  };

  // Metriche
  const avgSip = getAverageSipMl(allBottles, allSips);
  const todayStats = calculateDailyStats(allBottles, allSips, todayStr);
  const weeklyData = getWeeklyChartData(allBottles, allSips);

  const activeBottleSips = activeBottle
    ? allSips.filter((s) => s.bottle_id === activeBottle.id).length
    : 0;
  const estimatedMlConsumed = activeBottleSips * avgSip;
  const bottleProgressPct = activeBottle
    ? Math.min(100, Math.round((estimatedMlConsumed / activeBottle.size_ml) * 100))
    : 0;

  // Trova il singolo ultimo sorso registrato oggi
  const lastTodaySip = allSips.find((s) => s.created_at.slice(0, 10) === todayStr);

  const completedBottlesCount = allBottles.filter((b) => !b.is_active).length;
  const totalBottlesCount = allBottles.length;
  const totalWeeklyLiters = weeklyData.reduce((acc, curr) => acc + curr.liters, 0);

  return (
    <div className="max-w-md mx-auto h-[100dvh] max-h-[100dvh] flex flex-col justify-between p-5 pb-6 bg-[#F7F7F6] text-[#222222] select-none overflow-hidden">
      {/* Header pulito con nome Miele */}
      <header className="flex justify-between items-center pt-1 shrink-0">
        <div>
          <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
            {new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'short' })}
          </span>
          <h1 className="text-2xl font-bold tracking-tight">Sorsi d'Acqua</h1>
        </div>
        <span className="px-3.5 py-1 bg-white border border-neutral-200/80 shadow-xs text-neutral-800 text-xs font-bold rounded-full">
          {userId}
        </span>
      </header>

      {errorMessage && (
        <div className="bg-red-50 text-red-700 p-3 rounded-2xl flex items-center gap-2 text-xs border border-red-200 my-1 shrink-0">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* TAB REGISTRA */}
      {activeTab === 'home' && (
        <main className="flex-1 flex flex-col justify-around py-2 overflow-hidden">
          {/* Card Bottiglia */}
          <section
            onClick={() => setIsModalOpen(true)}
            className="bg-white rounded-3xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)] border border-neutral-100 cursor-pointer active:scale-[0.99] transition-all"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-block px-2.5 py-0.5 bg-neutral-100 text-neutral-600 text-[11px] font-semibold rounded-full">
                    {activeBottle ? `Bottiglia #${totalBottlesCount}` : 'Nessuna bottiglia'}
                  </span>
                  {activeBottle && bottleProgressPct >= 90 && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full">
                      <Sparkles className="w-3 h-3" /> Quasi finita!
                    </span>
                  )}
                </div>
                <h2 className="text-2xl font-extrabold mt-1 text-neutral-900">
                  {activeBottle ? formatBottleSize(activeBottle.size_ml) : 'Inizia nuova bottiglia'}
                </h2>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-sky-50 flex items-center justify-center text-sky-500">
                <Droplet className="w-6 h-6 fill-sky-500/20" />
              </div>
            </div>

            {/* Barra di avanzamento bottiglia */}
            {activeBottle && (
              <div className="space-y-1.5 my-2.5">
                <div className="flex justify-between text-xs font-medium text-neutral-400">
                  <span>{activeBottleSips} sorsi registrati</span>
                  <span>~{bottleProgressPct}%</span>
                </div>
                <div className="w-full h-2.5 bg-neutral-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-400 to-sky-500 transition-all duration-300 rounded-full"
                    style={{ width: `${bottleProgressPct}%` }}
                  />
                </div>
              </div>
            )}

            <div className="mt-3 pt-3 border-t border-neutral-100 flex justify-between text-sm">
              <div>
                <span className="text-xs text-neutral-400 block">Stima oggi</span>
                <span className="font-bold text-base text-neutral-800">{formatLiters(todayStats.liters)}</span>
              </div>
              <div className="text-right">
                <span className="text-xs text-neutral-400 block">Sorsi oggi</span>
                <span className="font-bold text-base text-neutral-800">{todayStats.sipsCount} volte</span>
              </div>
            </div>
          </section>

          {/* Area Azione: Goccia + Tasto Annulla a sinistra */}
          <section className="flex flex-col items-center my-1">
            <div className="relative flex items-center justify-center w-full">
              <button
                onClick={handleUndo}
                disabled={allSips.length === 0}
                title="Annulla ultimo sorso"
                className="absolute left-4 bottom-4 w-12 h-12 rounded-full bg-white border border-neutral-200 shadow-sm flex items-center justify-center text-neutral-600 active:scale-90 disabled:opacity-30 disabled:pointer-events-none transition-transform"
              >
                <RotateCcw className="w-5 h-5" />
              </button>

              {/* Goccia d'azione principale */}
              <button
                onClick={handleDrink}
                style={{ borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%' }}
                className="w-48 h-56 bg-gradient-to-b from-cyan-400 via-sky-500 to-blue-600 text-white flex flex-col items-center justify-center shadow-[0_18px_35px_rgba(14,165,233,0.35)] active:scale-95 transition-all duration-150 relative overflow-hidden group"
              >
                <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center mb-2 group-active:scale-110 transition-transform">
                  <Plus className="w-8 h-8 text-white" />
                </div>
                <span className="text-xl font-extrabold tracking-tight">Ho bevuto</span>
              </button>
            </div>

            {/* Opzione B: Singolo orario con tempo relativo */}
            {lastTodaySip && (
              <div className="flex items-center gap-2 mt-4 px-4 py-1.5 bg-white border border-neutral-200/80 rounded-full text-xs text-neutral-500 shadow-xs">
                <Clock className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                <span>Ultimo sorso:</span>
                <strong className="text-neutral-800 font-semibold">
                  {formatRelativeTime(lastTodaySip.created_at)}
                </strong>
              </div>
            )}
          </section>
        </main>
      )}

      {/* TAB RECAP */}
      {activeTab === 'recap' && (
        <main className="flex-1 py-3 flex flex-col gap-3.5 overflow-y-auto pr-0.5">
          {/* Card Grafico Settimanale */}
          <section className="bg-white rounded-3xl p-5 shadow-sm border border-neutral-100 shrink-0">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Ultimi 7 Giorni</h3>
                <p className="text-xl font-bold mt-0.5">{formatLiters(totalWeeklyLiters)} totali</p>
              </div>
              <span className="text-xs bg-neutral-100 text-neutral-600 px-2.5 py-1 rounded-full font-medium">
                Media: {formatLiters(totalWeeklyLiters / 7)} / g
              </span>
            </div>

            <div className="flex justify-between items-end h-32 pt-2 border-b border-neutral-100 pb-2">
              {weeklyData.map((d, i) => {
                const maxLiters = Math.max(...weeklyData.map((x) => x.liters), 2.5);
                const heightPct = Math.min(100, Math.round((d.liters / maxLiters) * 100));
                const isToday = d.date === todayStr;

                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                    <span className="text-[10px] text-neutral-400 font-semibold">
                      {d.liters > 0 ? d.liters.toFixed(1).replace('.', ',') : ''}
                    </span>
                    <div className="w-5 bg-neutral-100 rounded-full h-20 flex items-end justify-center overflow-hidden">
                      <div
                        className={`w-full rounded-full transition-all duration-300 ${
                          isToday ? 'bg-sky-500' : 'bg-neutral-800'
                        }`}
                        style={{ height: `${Math.max(8, heightPct)}%` }}
                      />
                    </div>
                    <span className={`text-xs font-bold uppercase ${isToday ? 'text-sky-500' : 'text-neutral-400'}`}>
                      {d.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Card Statistiche */}
          <section className="bg-white rounded-3xl p-5 shadow-sm border border-neutral-100 space-y-3 shrink-0">
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Statistiche Idriche</h3>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3.5 bg-neutral-50 rounded-2xl">
                <span className="text-xs text-neutral-400 block font-medium">Sorso medio</span>
                <span className="text-lg font-extrabold text-neutral-900 mt-0.5 block">~{avgSip} ml</span>
                <span className="text-[10px] text-neutral-400">Media sorsi storici</span>
              </div>
              <div className="p-3.5 bg-neutral-50 rounded-2xl">
                <span className="text-xs text-neutral-400 block font-medium">Bottiglie concluse</span>
                <span className="text-lg font-extrabold text-neutral-900 mt-0.5 block">{completedBottlesCount}</span>
                <span className="text-[10px] text-neutral-400">{totalBottlesCount} aperte</span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 text-sm text-neutral-500">
              <span>Sorsi totali registrati:</span>
              <strong className="text-neutral-900">{allSips.length} tocchi</strong>
            </div>

            <div className="pt-2 border-t border-neutral-100">
              <button
                onClick={handleResetData}
                className="w-full py-2 text-xs text-red-500 hover:text-red-700 font-semibold flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Azzera dati di prova
              </button>
            </div>
          </section>
        </main>
      )}

      {/* Navigazione Bottom */}
      <nav className="bg-white rounded-full p-1.5 shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-neutral-100 flex justify-around items-center shrink-0">
        <button
          onClick={() => setActiveTab('home')}
          className={`flex-1 py-2.5 rounded-full text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'home' ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:text-black'
          }`}
        >
          <Droplet className="w-4 h-4" />
          Registra
        </button>
        <button
          onClick={() => setActiveTab('recap')}
          className={`flex-1 py-2.5 rounded-full text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'recap' ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:text-black'
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          Recap
        </button>
      </nav>

      {/* Modale Nuova Bottiglia */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-t-[2.5rem] p-6 shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-xl font-bold">Nuova bottiglia</h3>
              {activeBottle && (
                <span className="text-xs bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full font-medium">
                  Chiude la precedente
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-500 mb-6">Che formato ha la bottiglia che stai aprendo?</p>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {[
                { label: '500 ml', value: 500, desc: 'Bottiglietta' },
                { label: '1 Litro', value: 1000, desc: 'Borraccia' },
                { label: '1,5 Litri', value: 1500, desc: 'Standard' },
                { label: '2 Litri', value: 2000, desc: 'Grande' },
              ].map((b) => (
                <button
                  key={b.value}
                  onClick={() => startNewBottle(b.value)}
                  className="p-4 rounded-2xl border border-neutral-200 flex flex-col items-center justify-center active:bg-neutral-50 active:border-black transition-all"
                >
                  <span className="font-bold text-base">{b.label}</span>
                  <span className="text-[11px] text-neutral-400 mt-0.5">{b.desc}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setIsModalOpen(false)}
              className="w-full py-3.5 rounded-2xl bg-neutral-100 text-neutral-800 font-bold text-sm hover:bg-neutral-200 active:scale-[0.98] transition-all"
            >
              Annulla
            </button>
          </div>
        </div>
      )}
    </div>
  );
}