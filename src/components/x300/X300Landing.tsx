"use client";

// Apple-style landing page for /products/visionint-x300.
// Facts come from the VisionInt X300 deck; comparison/scenario images are illustrative.

import { useEffect, useRef, useState, type ReactNode } from "react";

const IMG = "/images/products/visionint-x300";

type SpecGroup = { id: string; category: string; items: { id: string; label: string; value: string }[] };

function useInView<T extends HTMLElement>(threshold = 0.25) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === "undefined") {
      const r = requestAnimationFrame(() => setSeen(true));
      return () => cancelAnimationFrame(r);
    }
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [seen, threshold]);
  return [ref, seen] as const;
}

function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const [ref, seen] = useInView<HTMLDivElement>(0.15);
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-[900ms] ease-out motion-reduce:transition-none ${
        seen ? "opacity-100 translate-y-0" : "x300-pre"
      } ${className}`}
    >
      {children}
    </div>
  );
}

function CountUp({ to, run, ms = 1400 }: { to: number; run: boolean; ms?: number }) {
  // Starts at the real value so server HTML, crawlers and no-JS users see it.
  const [v, setV] = useState(to);
  const armed = useRef(false);
  useEffect(() => {
    if (armed.current || run) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    armed.current = true;
    const r = requestAnimationFrame(() => setV(0));
    return () => cancelAnimationFrame(r);
  }, [run]);
  useEffect(() => {
    if (!run || !armed.current) return;
    const dur = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 0 : ms;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = dur === 0 ? 1 : Math.min(1, (t - t0) / dur);
      setV(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, to, ms]);
  return (
    <>
      <span aria-hidden>{v}</span>
      <span className="sr-only">{to}</span>
    </>
  );
}

const NAV = [
  ["overview", "Overview"],
  ["design", "Design"],
  ["image", "Image"],
  ["battery", "Battery"],
  ["connect", "Connectivity"],
  ["partners", "Partners"],
  ["specs", "Specs"],
] as const;

const CTA_BTN = "bg-accent hover:bg-red-700 text-white rounded-full font-medium";

function SubNav() {
  const [active, setActive] = useState<string>("overview");
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: "-120px 0px -60% 0px" },
    );
    NAV.forEach(([id]) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, []);
  return (
    <div className="sticky top-16 z-40 bg-white/85 backdrop-blur-xl border-b border-black/5">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-3">
        <span className="hidden sm:block font-semibold text-gray-900 shrink-0">VisionInt X300</span>
        <nav aria-label="VisionInt X300 sections" className="flex-1 sm:flex-none flex items-center overflow-x-auto [scrollbar-width:none] -ml-3 sm:ml-0 md:gap-2">
          {NAV.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              aria-current={active === id ? "true" : undefined}
              className={`shrink-0 inline-flex items-center min-h-11 px-3 text-sm md:text-xs border-b-2 transition-colors ${
                active === id ? "text-gray-900 font-medium border-gray-900" : "text-gray-600 border-transparent hover:text-gray-900"
              }`}
            >
              {label}
            </a>
          ))}
        </nav>
        <a href="#contact" className={`${CTA_BTN} shrink-0 inline-flex items-center min-h-9 px-4 text-xs sm:text-sm`}>
          Request a Quote
        </a>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section id="overview" className="relative overflow-hidden bg-black text-white scroll-mt-28">
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_45%,rgba(221,50,50,0.28),transparent_55%),radial-gradient(ellipse_at_20%_90%,rgba(206,147,107,0.18),transparent_50%)]"
      />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-20 md:pt-24 md:pb-28 grid md:grid-cols-2 items-center gap-12">
        <div className="text-center md:text-left">
          <p className="text-accent-warm font-semibold tracking-wide mb-4">New · Sienovo Imaging</p>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.05]">VisionInt X300</h1>
            <p className="mt-6 text-2xl sm:text-3xl text-gray-300 font-medium leading-snug">
              4K video. 52 grams.
              <br />
              Ready when you are.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
              <a href="#contact" className={`${CTA_BTN} px-7 py-3 text-center`}>
                Request a Quote
              </a>
              <a href="#specs" className="text-white/90 hover:text-white px-7 py-3 rounded-full font-medium text-center border border-white/25 hover:border-white/60">
                Tech Specs
              </a>
            </div>
            <p className="mt-5 text-sm text-gray-400">Wholesale · OEM private label · ODM customization</p>
        </div>
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${IMG}/front.png`}
            alt="VisionInt X300 action camera, front view"
            width={451}
            height={886}
            fetchPriority="high"
            decoding="async"
            className="h-72 sm:h-96 md:h-[440px] w-auto drop-shadow-[0_40px_60px_rgba(221,50,50,0.25)] animate-[x300-float_6s_ease-in-out_infinite] motion-reduce:animate-none"
          />
        </div>
      </div>
    </section>
  );
}

function Highlights() {
  const [ref, seen] = useInView<HTMLDivElement>(0.3);
  const items: { big: ReactNode; label: string; sub: string }[] = [
    { big: <>4K</>, label: "True 4K", sub: "4K @ 24 fps · 720P @ 120 fps" },
    { big: <><CountUp to={140} run={seen} />°</>, label: "Wide angle", sub: "140° DFOV with distortion correction" },
    { big: <><CountUp to={52} run={seen} /> g</>, label: "Light body", sub: "63 × 32 × 31.5 mm" },
    { big: <>~<CountUp to={150} run={seen} /></>, label: "Minutes per charge", sub: "At 2K @ 30 fps" },
  ];
  return (
    <section className="bg-black text-white border-t border-white/10">
      <div ref={ref} className="max-w-6xl mx-auto px-4 sm:px-6 py-14 grid grid-cols-2 md:grid-cols-4 gap-y-10 gap-x-6">
        {items.map((it, i) => (
          <Reveal key={it.label} delay={i * 100} className="text-center">
            <div className="text-4xl sm:text-5xl font-semibold tracking-tight bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent">
              {it.big}
            </div>
            <div className="mt-2 font-medium">{it.label}</div>
            <div className="mt-1 text-sm text-gray-400">{it.sub}</div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Design() {
  return (
    <section id="design" className="bg-[#f5f5f7] scroll-mt-28">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-24 md:py-32 grid md:grid-cols-2 gap-12 items-center">
        <Reveal>
          <p className="text-[#b82424] font-semibold mb-3">Design</p>
          <h2 className="text-4xl sm:text-5xl font-semibold tracking-tight text-gray-900 leading-tight">
            52 grams.
            <br />
            Clips right on.
          </h2>
          <p className="mt-6 text-lg text-gray-600 leading-relaxed max-w-md">
            At 52 g and 63 × 32 × 31.5 mm, X300 clips to a helmet, handlebar or lanyard and stays out of the way. It fits
            common action-camera mounts.
          </p>
        </Reveal>
        <Reveal delay={150} className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${IMG}/pair.png`} alt="VisionInt X300 front and three-quarter views" width={808} height={729} className="w-full max-w-md h-auto" loading="lazy" />
        </Reveal>
      </div>
    </section>
  );
}

const COMPARE = [
  { key: "4k", tab: "4K detail", title: "Detail you can zoom into.", body: "Noise reduction and edge sharpening tuned at the ISP level, for sharper, lower-noise 4K.", src: `${IMG}/4k.jpg`, alt: "2K versus 4K detail comparison" },
  { key: "hdr", tab: "HDR", title: "Bright skies. Visible shadows.", body: "HDR tuned for high-contrast outdoor light, to recover highlight and shadow detail, with auto white balance.", src: `${IMG}/hdr.jpg`, alt: "HDR off versus HDR on comparison" },
  { key: "fov", tab: "140° view", title: "See the whole scene.", body: "A 140° field of view with distortion correction, digital zoom and one-tap portrait/landscape switching.", src: `${IMG}/fov.jpg`, alt: "110 degree versus 140 degree field of view comparison" },
];

function ImageQuality() {
  const [i, setI] = useState(0);
  const c = COMPARE[i];
  return (
    <section id="image" className="bg-black text-white scroll-mt-28">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-24 md:py-32">
        <Reveal className="text-center max-w-3xl mx-auto">
          <p className="text-accent-warm font-semibold mb-3">Image</p>
          <h2 className="text-4xl sm:text-6xl font-semibold tracking-tight leading-tight">Tuned by smartphone imaging engineers.</h2>
          <p className="mt-6 text-lg text-gray-400 leading-relaxed">
            Our team tunes camera ISPs on Qualcomm and MediaTek smartphone platforms, and brought that experience to
            X300&apos;s 1/2.7-inch 8 MP sensor: noise reduction, edge sharpening, HDR and auto white balance.
          </p>
        </Reveal>
        <Reveal delay={150} className="mt-14">
          <div role="tablist" aria-label="Image features" className="flex justify-center gap-2 mb-8">
            {COMPARE.map((x, j) => (
              <button
                key={x.key}
                id={`x300-tab-${x.key}`}
                role="tab"
                aria-selected={i === j}
                aria-controls="x300-panel"
                tabIndex={i === j ? 0 : -1}
                onClick={() => setI(j)}
                onKeyDown={(e) => {
                  const k = COMPARE.length;
                  const n = e.key === "ArrowRight" ? (j + 1) % k : e.key === "ArrowLeft" ? (j + k - 1) % k : e.key === "Home" ? 0 : e.key === "End" ? k - 1 : -1;
                  if (n < 0) return;
                  e.preventDefault();
                  setI(n);
                  document.getElementById(`x300-tab-${COMPARE[n].key}`)?.focus();
                }}
                className={`min-h-11 px-5 rounded-full text-sm font-medium transition-colors ${
                  i === j ? "bg-white text-black" : "bg-white/10 text-white/80 hover:bg-white/20"
                }`}
              >
                {x.tab}
              </button>
            ))}
          </div>
          <div role="tabpanel" id="x300-panel" aria-labelledby={`x300-tab-${c.key}`} tabIndex={0} className="focus:outline-none">
            <div className="rounded-3xl overflow-hidden bg-[#111] ring-1 ring-white/10 max-w-4xl mx-auto aspect-[3/1]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={c.src}
                src={c.src}
                alt={c.alt}
                width={1024}
                height={342}
                className="w-full h-full object-contain animate-[x300-fade_.5s_ease-out] motion-reduce:animate-none"
              />
            </div>
            <div className="max-w-2xl mx-auto text-center mt-8">
              <h3 className="text-2xl font-semibold">{c.title}</h3>
              <p className="mt-3 text-gray-400">{c.body}</p>
              <p className="mt-3 text-xs text-gray-400">Illustrative comparison.</p>
            </div>
          </div>
          {/* preload the other comparison images so tab switches are instant */}
          <div hidden>
            {COMPARE.map((x) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={x.key} src={x.src} alt="" />
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Battery() {
  const [ref, seen] = useInView<HTMLDivElement>(0.4);
  return (
    <section id="battery" className="bg-white scroll-mt-28">
      <div ref={ref} className="max-w-6xl mx-auto px-4 sm:px-6 py-24 md:py-32 text-center">
        <Reveal>
          <p className="text-[#b82424] font-semibold mb-3">Battery</p>
          <h2 className="text-4xl sm:text-6xl font-semibold tracking-tight text-gray-900">About 150 minutes at 2K.</h2>
        </Reveal>
        <div className="mt-14 flex flex-col items-center">
          <div className="text-7xl sm:text-9xl font-semibold tracking-tight text-gray-900">
            ~<CountUp to={150} run={seen} ms={1800} />
            <span className="text-3xl sm:text-5xl text-accent ml-2">min</span>
          </div>
          <p className="mt-3 text-gray-500">of recording per charge, measured at <span className="whitespace-nowrap">2K @ 30 fps</span></p>
          <div className="mt-10 w-full max-w-xl" aria-hidden>
            <div className="relative h-14 rounded-2xl border-4 border-gray-900 p-1.5">
              <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-2 h-6 rounded-r bg-gray-900" />
              <div
                className="h-full rounded-lg bg-gradient-to-r from-accent to-accent-warm transition-[width] duration-[1800ms] ease-out motion-reduce:transition-none"
                style={{ width: seen ? "8%" : "100%" }}
              />
            </div>
          </div>
          <div className="mt-12 grid sm:grid-cols-2 gap-4 w-full max-w-xl">
            <Reveal className="rounded-2xl bg-[#f5f5f7] p-6 text-left">
              <div className="text-2xl font-semibold text-gray-900">800 mAh</div>
              <div className="mt-1 text-gray-500 text-sm">Built-in battery</div>
            </Reveal>
            <Reveal delay={100} className="rounded-2xl bg-[#f5f5f7] p-6 text-left">
              <div className="text-2xl font-semibold text-gray-900">USB 5V</div>
              <div className="mt-1 text-gray-500 text-sm">Record while charging, or run on external power</div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

const CONNECT = [
  { t: "Wi-Fi 6 live view", d: "About 180 ms preview latency on your phone.", icon: "M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" },
  { t: "Auto-connect", d: "Pair once. After that, power on and the app connects by itself.", icon: "M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" },
  { t: "OTA for camera + app", d: "Firmware and the Android/iOS app both update over the air.", icon: "M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" },
  { t: "Portrait or landscape", d: "Switch orientation for short video or widescreen in one tap.", icon: "M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" },
];

function Connect() {
  return (
    <section id="connect" className="bg-[#f5f5f7] scroll-mt-28">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-24 md:py-32">
        <Reveal className="text-center max-w-2xl mx-auto">
          <p className="text-[#b82424] font-semibold mb-3">Connectivity</p>
          <h2 className="text-4xl sm:text-5xl font-semibold tracking-tight text-gray-900">On your phone in a blink.</h2>
        </Reveal>
        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {CONNECT.map((c, i) => (
            <Reveal key={c.t} delay={i * 80} className="rounded-3xl bg-white p-7 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
              <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d={c.icon} />
              </svg>
              <h3 className="mt-5 text-lg font-semibold text-gray-900">{c.t}</h3>
              <p className="mt-2 text-sm text-gray-500 leading-relaxed">{c.d}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Scenes() {
  const scenes = [
    { src: `${IMG}/cycling.jpg`, t: "Ride", d: "Helmet or handlebar POV at 140°.", alt: "Mountain biker with helmet-mounted camera" },
    { src: `${IMG}/camping.jpg`, t: "Explore", d: "About 150 minutes per charge, HDR for sunsets.", alt: "Tent by a mountain lake at dusk" },
  ];
  return (
    <section className="bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-24 md:py-32">
        <Reveal className="text-center">
          <p className="text-[#b82424] font-semibold mb-3">In use</p>
          <h2 className="text-4xl sm:text-5xl font-semibold tracking-tight text-gray-900">Made to be taken along.</h2>
        </Reveal>
        <div className="mt-14 grid md:grid-cols-2 gap-6">
          {scenes.map((s, i) => (
            <Reveal key={s.t} delay={i * 120}>
              <figure className="relative rounded-3xl overflow-hidden aspect-[4/3]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.src} alt={s.alt} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <figcaption className="absolute bottom-0 p-7 text-white">
                  <div className="text-3xl font-semibold">{s.t}</div>
                  <div className="mt-1 text-white/80">{s.d}</div>
                </figcaption>
                <span className="absolute top-4 right-4 text-xs text-white bg-black/60 rounded-full px-2.5 py-1">Illustrative</span>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Business() {
  const tiles = [
    { t: "Wholesale", d: "Complete units, built to order for distributors and retailers." },
    { t: "OEM", d: "Your logo on the body, your packaging, your startup sound and app branding." },
    { t: "ODM", d: "Industrial design and hardware/software customization on the X300 platform, scoped per project." },
  ];
  return (
    <section id="partners" className="bg-black text-white scroll-mt-28">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-24 md:py-28">
        <Reveal className="text-center max-w-2xl mx-auto">
          <p className="text-accent-warm font-semibold mb-3">For partners</p>
          <h2 className="text-4xl sm:text-5xl font-semibold tracking-tight">Built for your brand.</h2>
        </Reveal>
        <div className="mt-14 grid md:grid-cols-3 gap-5">
          {tiles.map((x, i) => (
            <Reveal key={x.t} delay={i * 100} className="rounded-3xl bg-white/[0.06] ring-1 ring-white/10 p-8">
              <h3 className="text-2xl font-semibold">{x.t}</h3>
              <p className="mt-3 text-gray-400 leading-relaxed">{x.d}</p>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-12 text-center">
          <a href="#contact" className={`${CTA_BTN} inline-block px-8 py-3`}>
            Request a Quote
          </a>
        </Reveal>
      </div>
    </section>
  );
}

function Specs({ groups }: { groups: SpecGroup[] }) {
  return (
    <section id="specs" className="bg-white scroll-mt-28">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-24 md:py-28">
        <p className="text-[#b82424] font-semibold mb-3">Specs</p>
        <h2 className="text-4xl sm:text-5xl font-semibold tracking-tight text-gray-900">Tech Specs</h2>
        <div className="mt-12 divide-y divide-gray-200 border-t-2 border-gray-900">
          {groups.map((g) => (
            <div key={g.id} className="py-8 grid md:grid-cols-[200px_1fr] gap-4">
              <h3 className="font-semibold text-gray-900">{g.category}</h3>
              <dl className="space-y-3">
                {g.items.map((it) => (
                  <div key={it.id} className="grid sm:grid-cols-[160px_1fr] gap-x-4">
                    <dt className="text-sm text-gray-500">{it.label}</dt>
                    <dd className="text-gray-900">{it.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function X300Landing({ specGroups }: { specGroups: SpecGroup[] }) {
  return (
    <>
      <SubNav />
      <Hero />
      <Highlights />
      <Design />
      <ImageQuality />
      <Battery />
      <Connect />
      <Scenes />
      <Business />
      <Specs groups={specGroups} />
    </>
  );
}
