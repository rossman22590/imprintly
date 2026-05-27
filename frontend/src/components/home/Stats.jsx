import { useRef, useEffect, useState } from "react";
import { motion, useInView, useSpring, useMotionValue } from "framer-motion";

const statsData = [
  {
    prefix: "",
    value: 50,
    suffix: "K+",
    label: "Books Created",
    description: "Authors have published their stories with Bookify",
  },
  {
    prefix: "",
    value: 4.9,
    suffix: "/5",
    label: "Star Rating",
    description: "Average satisfaction score from verified users",
    isDecimal: true,
  },
  {
    prefix: "",
    value: 10,
    suffix: "min",
    label: "Avg. Creation",
    description: "From idea to complete book outline in minutes",
  },
];

function AnimatedNumber({ value, suffix, isDecimal = false, isInView: triggered }) {
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { stiffness: 60, damping: 18, mass: 0.8 });
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    if (triggered) {
      motionVal.set(value);
    }
  }, [triggered, motionVal, value]);

  useEffect(() => {
    const unsubscribe = spring.on("change", (v) => {
      setDisplay(isDecimal ? v.toFixed(1) : Math.round(v).toString());
    });
    return unsubscribe;
  }, [spring, isDecimal]);

  return (
    <span>
      {display}
      {suffix}
    </span>
  );
}

function Stats() {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-80px" });

  return (
    <section ref={sectionRef} className="bg-zinc-950 relative overflow-hidden">
      {/* Subtle background grain */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJub2lzZSI+PGZlVHVyYnVsZW5jZSB0eXBlPSJmcmFjdGFsTm9pc2UiIGJhc2VGcmVxdWVuY3k9IjAuNjUiIG51bU9jdGF2ZXM9IjMiIHN0aXRjaFRpbGVzPSJzdGl0Y2giLz48ZmVDb2xvck1hdHJpeCB0eXBlPSJzYXR1cmF0ZSIgdmFsdWVzPSIwIi8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9IjMwMCIgaGVpZ2h0PSIzMDAiIGZpbHRlcj0idXJsKCNub2lzZSkiIG9wYWNpdHk9IjEiLz48L3N2Zz4=')]" />

      {/* Violet glow accent */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 size-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl px-6 lg:px-8 mx-auto py-20 lg:py-28 relative">

        {/* Label */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-x-2 bg-white/5 border border-white/10 rounded-full px-4 py-2 text-zinc-400 text-xs font-semibold tracking-widest uppercase">
            By the numbers
          </span>
        </motion.div>

        {/* Stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-white/5 rounded-3xl overflow-hidden border border-white/5">
          {statsData.map(({ prefix, value, suffix, label, description, isDecimal }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.65, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
              className="bg-zinc-950 px-8 py-12 sm:py-14 flex flex-col items-center text-center gap-3 relative group"
            >
              {/* Hover glow */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(ellipse_at_center,rgba(109,40,217,0.08),transparent_70%)] pointer-events-none" />

              {/* Number */}
              <div className="font-headline text-6xl sm:text-7xl lg:text-8xl font-extrabold text-white leading-none tracking-tighter">
                {prefix}
                <AnimatedNumber
                  value={value}
                  suffix={suffix}
                  isDecimal={isDecimal}
                  isInView={isInView}
                />
              </div>

              {/* Violet underline */}
              <div className="h-px w-12 bg-violet-600 rounded-full" />

              {/* Label */}
              <p className="font-headline text-sm font-bold text-white uppercase tracking-widest">
                {label}
              </p>

              {/* Description */}
              <p className="text-zinc-500 text-sm leading-relaxed max-w-[180px]">
                {description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Stats;
