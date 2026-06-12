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

export function initRevealMotion({ reducedMotion = false }: RevealMotionOptions = {}) {
  const splitTargets = new Map<HTMLElement, SplitText>();
  const itemTweens = new Map<HTMLElement, gsap.core.Animation>();

  function cleanupTarget(element: HTMLElement): void {
    itemTweens.get(element)?.kill();
    itemTweens.delete(element);

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

  function revealTitle(element: HTMLElement): void {
    const split = new SplitText(element, {
      type: 'words, chars',
      autoSplit: true,
      mask: 'chars',
      charsClass: 'char',
      onSplit: self => {
        gsap.set(element, { visibility: 'visible' });
        return gsap.from(self.chars, {
          duration: 1,
          yPercent: -120,
          scale: 1.2,
          stagger: 0.01,
          ease: 'expo.out',
          overwrite: true,
        });
      },
    });

    splitTargets.set(element, split);
  }

  function revealLines(element: HTMLElement): void {
    const split = new SplitText(element, {
      type: 'lines, words',
      autoSplit: true,
      mask: 'lines',
      linesClass: 'line',
      onSplit: self => {
        gsap.set(element, { visibility: 'visible' });
        return gsap.from(self.lines, {
          duration: 0.9,
          yPercent: 105,
          stagger: 0.04,
          ease: 'expo.out',
          overwrite: true,
        });
      },
    });

    splitTargets.set(element, split);
  }

  function revealItems(items: HTMLElement[]): void {
    const states: ItemState[] = items.map(element => ({
      element,
      opacity: getNaturalOpacity(element),
    }));

    const timeline = gsap.timeline({
      onComplete: () => {
        states.forEach(({ element }) => {
          itemTweens.delete(element);
          gsap.set(element, { clearProps: 'opacity,transform' });
          element.style.visibility = 'visible';
        });
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
      itemTweens.set(element, timeline);
    });
  }

  function revealScope(scope: Document | HTMLElement): void {
    if (reducedMotion) {
      showScope(scope);
      return;
    }

    cleanupScope(scope);

    const itemTargets: HTMLElement[] = [];

    getRevealTargets(scope).forEach(element => {
      const kind = getRevealKind(element);

      if (kind === 'title') {
        revealTitle(element);
      } else if (kind === 'lines') {
        revealLines(element);
      } else {
        itemTargets.push(element);
      }
    });

    revealItems(itemTargets);
  }

  function revealChrome(): void {
    const chrome = document.querySelector<HTMLElement>(CHROME_SELECTOR);
    if (chrome) revealScope(chrome);
  }

  function revealSection(id: string): void {
    const section = document.getElementById(id);
    if (section) revealScope(section);
  }

  function showAll(): void {
    showScope(document);
  }

  function destroy(): void {
    cleanupScope(document);
  }

  if (reducedMotion) showAll();

  return {
    revealChrome,
    revealSection,
    showAll,
    destroy,
  };
}
