import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(SplitText);

type RevealKind = 'title' | 'lines' | 'item';

interface RevealMotionOptions {
  reducedMotion?: boolean;
}

interface ItemState {
  element: HTMLElement;
  opacity: number;
}

const REVEAL_SELECTOR = '[data-reveal]';
const CHROME_SELECTOR = '#sidebar';

export type RevealMotion = ReturnType<typeof initRevealMotion>;

// Active instance, shared so component scripts (e.g. the projects slider)
// can trigger reveals without threading the instance through the page script.
let activeInstance: RevealMotion | undefined;

export function getRevealMotion(): RevealMotion | undefined {
  return activeInstance;
}

function getRevealTargets(scope: Document | HTMLElement): HTMLElement[] {
  return Array.from(scope.querySelectorAll<HTMLElement>(REVEAL_SELECTOR));
}

function getRevealKind(element: HTMLElement): RevealKind {
  const kind = element.dataset.reveal;
  return kind === 'title' || kind === 'lines' || kind === 'item'
    ? kind
    : 'item';
}

function getNaturalOpacity(element: HTMLElement): number {
  const opacity = Number.parseFloat(window.getComputedStyle(element).opacity);
  return Number.isFinite(opacity) ? opacity : 1;
}

function isConcealedByAncestor(
  element: HTMLElement,
  scope: Document | HTMLElement,
): boolean {
  const boundary = scope instanceof Document ? document.body : scope;
  let parent = element.parentElement;

  while (parent && parent !== boundary) {
    const style = window.getComputedStyle(parent);
    if (style.display === 'none' || Number.parseFloat(style.opacity) === 0) {
      return true;
    }

    parent = parent.parentElement;
  }

  return false;
}

export function initRevealMotion({ reducedMotion = false }: RevealMotionOptions = {}) {
  const splitTargets = new Map<HTMLElement, SplitText>();
  const targetAnimations = new Map<HTMLElement, gsap.core.Animation>();

  function cleanupTarget(element: HTMLElement): void {
    targetAnimations.get(element)?.kill();
    targetAnimations.delete(element);
    element.classList.remove('is-revealing');

    const split = splitTargets.get(element);
    if (split) {
      split.revert();
      splitTargets.delete(element);
    }

    gsap.set(element, { clearProps: 'opacity,visibility,transform' });
  }

  function cleanupScope(scope: Document | HTMLElement): void {
    getRevealTargets(scope).forEach(cleanupTarget);
  }

  function showScope(scope: Document | HTMLElement): void {
    getRevealTargets(scope).forEach(element => {
      cleanupTarget(element);
      element.style.visibility = 'visible';
    });
  }

  function prepareTitle(element: HTMLElement): void {
    const split = new SplitText(element, {
      type: 'words, chars',
      autoSplit: false,
      mask: 'chars',
      charsClass: 'char',
      onSplit: self => {
        gsap.set(element, { visibility: 'visible' });
        const tween = gsap.from(self.chars, {
          duration: 1,
          yPercent: -120,
          scale: 1.2,
          stagger: 0.01,
          ease: 'expo.out',
          overwrite: true,
          paused: true,
          onStart: () => element.classList.add('is-revealing'),
          onComplete: () => element.classList.remove('is-revealing'),
          onInterrupt: () => element.classList.remove('is-revealing'),
        });
        targetAnimations.set(element, tween);
        return tween;
      },
    });

    splitTargets.set(element, split);
  }

  function prepareLines(element: HTMLElement): void {
    const split = new SplitText(element, {
      type: 'lines, words',
      autoSplit: true,
      mask: 'lines',
      linesClass: 'line',
      onSplit: self => {
        gsap.set(element, { visibility: 'visible' });
        const tween = gsap.from(self.lines, {
          duration: 0.9,
          yPercent: 105,
          stagger: 0.04,
          ease: 'expo.out',
          overwrite: true,
          paused: true,
          onStart: () => element.classList.add('is-revealing'),
          onComplete: () => element.classList.remove('is-revealing'),
          onInterrupt: () => element.classList.remove('is-revealing'),
        });
        targetAnimations.set(element, tween);
        return tween;
      },
    });

    splitTargets.set(element, split);
  }

  function prepareItems(items: HTMLElement[]): void {
    if (items.length === 0) return;

    const states: ItemState[] = items.map(element => ({
      element,
      opacity: getNaturalOpacity(element),
    }));

    const timeline = gsap.timeline({
      paused: true,
      onStart: () => {
        states.forEach(({ element }) => element.classList.add('is-revealing'));
      },
      onComplete: () => {
        states.forEach(({ element }) => {
          targetAnimations.delete(element);
          element.classList.remove('is-revealing');
          gsap.set(element, { clearProps: 'opacity,transform' });
          element.style.visibility = 'visible';
        });
      },
      onInterrupt: () => {
        states.forEach(({ element }) => element.classList.remove('is-revealing'));
      },
    });

    states.forEach(({ element, opacity }, index) => {
      timeline.fromTo(
        element,
        { y: 18, autoAlpha: 0 },
        {
          y: 0,
          autoAlpha: opacity,
          duration: 0.8,
          ease: 'power3.out',
          overwrite: true,
        },
        index * 0.08,
      );
      targetAnimations.set(element, timeline);
    });
  }

  function prepareScope(scope: Document | HTMLElement): void {
    if (reducedMotion) {
      showScope(scope);
      return;
    }

    cleanupScope(scope);

    const itemTargets: HTMLElement[] = [];

    getRevealTargets(scope).forEach(element => {
      if (isConcealedByAncestor(element, scope)) {
        element.style.visibility = 'visible';
        return;
      }

      const kind = getRevealKind(element);

      if (kind === 'title') {
        prepareTitle(element);
      } else if (kind === 'lines') {
        prepareLines(element);
      } else {
        itemTargets.push(element);
      }
    });

    prepareItems(itemTargets);
  }

  function playScope(scope: Document | HTMLElement): void {
    if (reducedMotion) {
      showScope(scope);
      return;
    }

    const animations = new Set<gsap.core.Animation>();

    getRevealTargets(scope).forEach(element => {
      const animation = targetAnimations.get(element);
      if (animation) animations.add(animation);
    });

    animations.forEach(animation => animation.restart(true));
  }

  function revealScope(scope: Document | HTMLElement): void {
    prepareScope(scope);
    playScope(scope);
  }

  function prepareChrome(): void {
    const chrome = document.querySelector<HTMLElement>(CHROME_SELECTOR);
    if (chrome) prepareScope(chrome);
  }

  function playChrome(): void {
    const chrome = document.querySelector<HTMLElement>(CHROME_SELECTOR);
    if (chrome) playScope(chrome);
  }

  function prepareSection(id: string): void {
    const section = document.getElementById(id);
    if (section) prepareScope(section);
  }

  function playSection(id: string): void {
    const section = document.getElementById(id);
    if (section) playScope(section);
  }

  function revealSection(id: string): void {
    prepareSection(id);
    playSection(id);
  }

  function resetSection(id: string): void {
    const section = document.getElementById(id);
    if (section) cleanupScope(section);
  }

  // Make a section's content visible immediately, with no reveal animation.
  // Used for section switches after the initial load, where we want content to
  // simply appear (and crossfade) rather than re-running the reveal each time.
  function showSection(id: string): void {
    const section = document.getElementById(id);
    if (section) showScope(section);
  }

  function revealElement(element: HTMLElement): void {
    revealScope(element);
  }

  function showAll(): void {
    showScope(document);
  }

  function destroy(): void {
    cleanupScope(document);
    if (activeInstance === api) activeInstance = undefined;
  }

  if (reducedMotion) showAll();

  const api = {
    prepareChrome,
    playChrome,
    prepareSection,
    playSection,
    revealSection,
    resetSection,
    showSection,
    revealElement,
    showAll,
    destroy,
  };

  activeInstance = api;
  return api;
}
