/**
 * AnimatedNumber — memaparkan nombor dengan animasi pembilang
 * yang hanya bermula apabila elemen kelihatan dalam viewport.
 *
 * Menggunakan CountingNumber dengan requestAnimationFrame
 * untuk prestasi optimum (elakkan render yang tidak perlu).
 */
import { useEffect, useRef, useState } from "react";

interface AnimatedNumberProps {
  /** Nilai akhir untuk dipaparkan */
  value: number | string;
  /** Tempoh animasi dalam saat (lalai 0.8s) */
  duration?: number;
  /** Awalan teks (cth "RM ") */
  prefix?: string;
  /** Akhiran teks (cth " hari") */
  suffix?: string;
  /** Kelas tambahan */
  className?: string;
}

export function AnimatedNumber({
  value,
  duration = 0.8,
  prefix = "",
  suffix = "",
  className,
}: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -50px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Jika value bukan nombor, papar terus
  if (typeof value !== "number" || isNaN(value)) {
    return (
      <span ref={ref} className={className}>
        {prefix}
        {value}
        {suffix}
      </span>
    );
  }

  return (
    <span ref={ref} className={className}>
      {isVisible ? (
        <CountingNumber
          to={value}
          duration={duration}
          prefix={prefix}
          suffix={suffix}
        />
      ) : (
        <span>
          {prefix}0{suffix}
        </span>
      )}
    </span>
  );
}

interface CountingNumberProps {
  to: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
}

/**
 * CountingNumber — sub-komponen yang melaksanakan animasi pembilang
 * sebenar menggunakan requestAnimationFrame.
 *
 * Easing: expo-like ease-out (1 - (1 - p)^4) — pantas pada permulaan,
 * perlahan pada penghujung, memberikan kesan "snappy".
 */
function CountingNumber({
  to,
  duration = 0.8,
  prefix = "",
  suffix = "",
}: CountingNumberProps) {
  const [count, setCount] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    function animate(timestamp: number) {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / (duration * 1000), 1);
      // Expo-like ease-out
      const eased = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(eased * to));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        // Set nilai tepat untuk mengelakkan ralat pembundaran
        setCount(to);
      }
    }

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [to, duration]);

  return (
    <span>
      {prefix}
      {count.toLocaleString("ms-MY")}
      {suffix}
    </span>
  );
}