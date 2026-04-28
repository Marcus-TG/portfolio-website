import gsap from 'gsap';

const titles = [
  'Systems Administrator',
  'AI Integration Specialist',
  'Automation Developer',
  'Infrastructure Specialist',
  'Homelab Enthusiast',
];

const PAUSE = 2.75;       // seconds between transitions
const TRANSITION = 0.45;  // seconds per fade/slide
const SLIDE_PX = 12;      // subtle vertical shift

export function initTitleCycler(): () => void {
  const el = document.getElementById('job-title');
  if (!el) return () => {};

  let index = 0;

  // Entrance animation for initial title
  gsap.fromTo(el,
    { opacity: 0, y: SLIDE_PX },
    { opacity: 1, y: 0, duration: TRANSITION, ease: 'power2.out', delay: 0.3 },
  );

  function cycleNext(): void {
    // Exit: slide up + fade out
    gsap.to(el!, {
      opacity: 0,
      y: -SLIDE_PX,
      duration: TRANSITION,
      ease: 'power2.in',
      onComplete() {
        // Advance index
        index = (index + 1) % titles.length;
        el!.textContent = titles[index];

        // Entrance: slide up from below + fade in
        gsap.fromTo(el!,
          { opacity: 0, y: SLIDE_PX },
          { opacity: 1, y: 0, duration: TRANSITION, ease: 'power2.out' },
        );
      },
    });
  }

  // Start cycling after initial pause
  const intervalId = window.setInterval(cycleNext, (PAUSE + TRANSITION) * 1000);

  return () => {
    clearInterval(intervalId);
    gsap.killTweensOf(el);
  };
}
