const benefitList = document.querySelector(".benefit-list");

if (benefitList) {
  const items = [...benefitList.querySelectorAll("li")];
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const centers = [];
  const progress = items.map(() => 0);
  let frame = 0;
  let lastTime = 0;
  let initialized = false;

  const targetProgress = (index) => {
    if (motion.matches) return 1;
    const viewportHeight = window.innerHeight;
    const relativeCenter = centers[index] - window.scrollY;
    // A longer scroll interval makes both reveal and reversal gradual.
    const value = Math.max(0, Math.min(1,
      (viewportHeight * .92 - relativeCenter) / (viewportHeight * .42)));
    return value * value * (3 - 2 * value);
  };

  const renderProgress = () => {
    items.forEach((item, index) => {
      const value = progress[index];
      item.style.setProperty("--benefit-reveal", value.toFixed(4));
      item.style.setProperty("--benefit-text-shift", `${24 * (1 - value)}px`);
      item.style.setProperty("--benefit-icon-scale", String(.94 + .06 * value));
      if (index < items.length - 1) {
        item.style.setProperty("--benefit-line-reveal", progress[index + 1].toFixed(4));
      }
    });
  };

  const animate = (time) => {
    frame = 0;
    const elapsed = lastTime ? Math.min(time - lastTime, 64) : 16;
    lastTime = time;
    const smoothing = 1 - Math.exp(-elapsed / 240);
    let unsettled = false;

    items.forEach((item, index) => {
      const target = targetProgress(index);
      const difference = target - progress[index];
      if (motion.matches || Math.abs(difference) < .001) {
        progress[index] = target;
      } else {
        progress[index] += difference * smoothing;
        unsettled = true;
      }
    });
    renderProgress();
    if (unsettled) frame = requestAnimationFrame(animate);
    else lastTime = 0;
  };

  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(animate);
  };

  const updateBenefitLines = () => {
    const listTop = benefitList.getBoundingClientRect().top + window.scrollY;
    items.forEach((item, index) => {
      const icon = item.querySelector("img");
      centers[index] = listTop + item.offsetTop + icon.offsetTop + icon.offsetHeight / 2;
    });
    items.slice(0, -1).forEach((item, index) => {
      item.style.setProperty("--benefit-line-top", `${centers[index] - listTop - item.offsetTop}px`);
      item.style.setProperty("--benefit-line-height", `${centers[index + 1] - centers[index]}px`);
    });
    if (!initialized) {
      items.forEach((item, index) => { progress[index] = targetProgress(index); });
      renderProgress();
      initialized = true;
      benefitList.classList.add("is-animated");
    }
    schedule();
  };

  updateBenefitLines();
  if ("ResizeObserver" in window) {
    const resizeObserver = new ResizeObserver(updateBenefitLines);
    items.forEach((item) => resizeObserver.observe(item));
  }
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", updateBenefitLines, { passive: true });
  motion.addEventListener("change", schedule);
  document.fonts?.ready.then(updateBenefitLines);
}
const form = document.querySelector("#lead-form");
const formStatus = document.querySelector("#form-status");
const reviewTrack = document.querySelector(".review-track");

form.addEventListener("submit", (event) => {
  event.preventDefault();
  formStatus.textContent = "Спасибо! Форма готова к подключению сервиса регистрации.";
});

if (reviewTrack) {
  const reviewGroup = reviewTrack.querySelector(".review-group");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let repeatedGroup;

  const updateReviewMotion = () => {
    repeatedGroup?.remove();
    repeatedGroup = undefined;
    reviewTrack.classList.remove("is-moving");

    if (reducedMotion.matches) return;

    repeatedGroup = reviewGroup.cloneNode(true);
    repeatedGroup.setAttribute("aria-hidden", "true");
    repeatedGroup.inert = true;
    // Decorative copies stay readable while their source waits to reveal.
    repeatedGroup.querySelectorAll(".heading-reveal").forEach((heading) => {
      heading.classList.remove("heading-reveal", "is-revealed");
    });
    reviewTrack.append(repeatedGroup);

    const gap = parseFloat(getComputedStyle(reviewTrack).gap) || 0;
    const distance = reviewGroup.getBoundingClientRect().width + gap;
    reviewTrack.style.setProperty("--review-loop-distance", `${distance}px`);
    reviewTrack.style.setProperty("--review-loop-duration", `${distance / 28}s`);
    reviewTrack.classList.add("is-moving");
  };

  updateReviewMotion();
  window.addEventListener("resize", updateReviewMotion, { passive: true });
  reducedMotion.addEventListener("change", updateReviewMotion);

  reviewTrack.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    reviewTrack.classList.add("is-held");
  });
  document.addEventListener("pointerup", () => reviewTrack.classList.remove("is-held"));
  document.addEventListener("pointercancel", () => reviewTrack.classList.remove("is-held"));
}

// Heading blur reveal: once per heading, with nonbreaking word groups preserved.
(() => {
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (motion.matches || !("IntersectionObserver" in window)) return;

  const headings = [...document.querySelectorAll("h1, h2, h3, h4, h5, h6, .bonus-title")]
    .filter((heading) => !heading.closest('[aria-hidden="true"], .benefit-list'));
  const pending = new Set(headings);
  const timers = new Map();

  const finish = (heading) => {
    clearTimeout(timers.get(heading));
    timers.delete(heading);
    heading.classList.remove("heading-reveal", "is-revealed");
    heading.querySelectorAll(".heading-reveal-word").forEach((word) => {
      word.replaceWith(document.createTextNode(word.textContent));
    });
    heading.normalize();
    pending.delete(heading);
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => {
      if (!isIntersecting) return;
      observer.unobserve(target);
      target.classList.add("is-revealed");
      // Remove temporary filters and wrappers after the last word finishes.
      timers.set(target, setTimeout(() => finish(target), 1750));
    });
  }, { threshold: 0.12 });

  headings.forEach((heading) => {
    const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    let wordIndex = 0;
    nodes.forEach((node) => {
      const fragment = document.createDocumentFragment();
      // Ordinary whitespace may wrap; NBSP stays inside its word group.
      node.textContent.split(/([ \t\r\n\f]+)/).forEach((part) => {
        if (!part) return;
        if (/^[ \t\r\n\f]+$/.test(part)) {
          fragment.append(document.createTextNode(part));
        } else {
          const word = document.createElement("span");
          word.className = "heading-reveal-word";
          word.textContent = part;
          word.style.setProperty("--reveal-delay", Math.min(wordIndex++ * 81.25, 487.5) + "ms");
          fragment.append(word);
        }
      });
      node.replaceWith(fragment);
    });
    heading.classList.add("heading-reveal");
    observer.observe(heading);
  });

  motion.addEventListener("change", ({ matches }) => {
    if (!matches) return;
    observer.disconnect();
    [...pending].forEach(finish);
  });
})();