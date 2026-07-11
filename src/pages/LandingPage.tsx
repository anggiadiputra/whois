import { Globe, ArrowRight, ShieldCheck, Zap, Bell, CheckCircle2, Server, Clock } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="w-full flex-1 flex flex-col items-center justify-center">
      {/* Hero Section Container */}
      <section className="max-w-7xl mx-auto px-6 py-12 md:py-24 w-full grid grid-cols-1 lg:grid-cols-12 items-center gap-12 flex-1">
        {/* Left Content Column */}
        <div className="lg:col-span-6 space-y-6 md:space-y-8 text-left">
          {/* Tagline Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-black/5 rounded-full border border-black/5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-gray-700 uppercase tracking-widest">
              Domain & Server Monitor
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-gray-900 leading-[1.1] tracking-tight">
            Satu Dashboard untuk <span className="bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">Pantau Semua Aset Digital</span> Anda.
          </h1>

          {/* Subheadline */}
          <p className="text-sm sm:text-base text-gray-500 max-w-lg leading-relaxed font-normal">
            Kelola masa kedaluwarsa domain (WHOIS), kesehatan server, dan dapatkan notifikasi pengingat via Email sebelum domain Anda kedaluwarsa secara otomatis.
          </p>

          {/* Call to Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href="/register"
              className="px-6 py-3 bg-black hover:bg-gray-900 hover:opacity-95 text-white rounded-xl text-sm font-bold transition-all duration-200 hover:shadow-md hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 group"
            >
              Mulai Sekarang (Gratis)
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </a>
            <a
              href="/whois"
              className="px-6 py-3 border border-gray-200 hover:border-gray-350 bg-white hover:bg-gray-50 text-gray-700 hover:text-black rounded-xl text-sm font-bold transition-all duration-200 hover:shadow-sm active:scale-[0.98] flex items-center justify-center gap-2"
            >
              Cek WHOIS Publik
            </a>
          </div>

          {/* Value Propositions */}
          <div className="grid grid-cols-3 gap-4 pt-6 border-t border-gray-200/60 max-w-md">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-gray-900">
                <ShieldCheck className="w-4.5 h-4.5 text-emerald-500" />
                <span className="text-xs font-bold">100% Aman</span>
              </div>
              <p className="text-[10px] text-gray-400">Database terisolasi & terenkripsi.</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-gray-900">
                <Zap className="w-4.5 h-4.5 text-amber-500" />
                <span className="text-xs font-bold">Instan & Cepat</span>
              </div>
              <p className="text-[10px] text-gray-400">Pencarian WHOIS instan tanpa antre.</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-gray-900">
                <Bell className="w-4.5 h-4.5 text-blue-500" />
                <span className="text-xs font-bold">Alert Otomatis</span>
              </div>
              <p className="text-[10px] text-gray-400">Pengingat berkala sebelum kedaluwarsa.</p>
            </div>
          </div>
        </div>

        {/* Right Dashboard Mockup Column */}
        <div className="lg:col-span-6 flex justify-center items-center select-none w-full">
          {/* Outer Browser Window Mockup */}
          <div className="w-full max-w-lg bg-white rounded-2xl border border-gray-200 shadow-2xl overflow-hidden aspect-[4/3] flex flex-col transform hover:scale-[1.01] transition-transform duration-300">
            {/* Browser Header Bar */}
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
              {/* Fake Window Dots */}
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-400" />
                <span className="w-3 h-3 rounded-full bg-yellow-400" />
                <span className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              {/* Fake URL Bar */}
              <div className="bg-white border border-gray-200 rounded-lg px-8 py-0.5 text-[10px] font-semibold font-mono text-gray-400 w-1/2 text-center truncate shadow-inner">
                app.domainwhois.com/dashboard
              </div>
              <div className="w-12" />
            </div>

            {/* Fake Dashboard Body Content */}
            <div className="p-5 flex-1 bg-gray-50/50 space-y-4 overflow-y-auto text-left">
              {/* Fake Greeting */}
              <div className="space-y-0.5">
                <h3 className="text-xs font-bold text-gray-900">Halo, Adi Putra 👋</h3>
                <p className="text-[9px] text-gray-400">Berikut adalah status ringkasan portofolio aset Anda hari ini.</p>
              </div>

              {/* Fake Mini Statistics */}
              <div className="grid grid-cols-2 gap-3">
                {/* Domain Stat */}
                <div className="bg-white p-3 border border-gray-200 rounded-xl shadow-sm flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center shrink-0">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[8px] text-gray-400 uppercase font-bold tracking-wider">Total Domain</p>
                    <p className="text-sm font-black text-gray-950">12 Domain</p>
                  </div>
                </div>

                {/* Server Stat */}
                <div className="bg-white p-3 border border-gray-200 rounded-xl shadow-sm flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
                    <Server className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[8px] text-gray-400 uppercase font-bold tracking-wider">Server Aktif</p>
                    <p className="text-sm font-black text-emerald-600">4 Online</p>
                  </div>
                </div>
              </div>

              {/* Fake List Assets */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 py-2 border-b border-gray-100 bg-gray-50/80 flex justify-between items-center">
                  <span className="text-[8px] uppercase font-bold text-gray-400 tracking-wider">Domain Terpantau</span>
                  <span className="text-[8px] font-bold text-gray-500">Urut: Terbaru</span>
                </div>
                <div className="divide-y divide-gray-100 text-[10px]">
                  {/* Row 1 */}
                  <div className="px-4 py-2 flex justify-between items-center hover:bg-gray-50/50">
                    <span className="font-mono font-bold text-gray-900">google.com</span>
                    <span className="inline-flex items-center gap-1 text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      Aktif (234 hari lagi)
                    </span>
                  </div>
                  {/* Row 2 */}
                  <div className="px-4 py-2 flex justify-between items-center hover:bg-gray-50/50">
                    <span className="font-mono font-bold text-gray-900">mywebsite.id</span>
                    <span className="inline-flex items-center gap-1 text-[8px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                      <Clock className="w-2.5 h-2.5" />
                      14 hari tersisa
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
