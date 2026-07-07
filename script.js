/* ============================================================
   NAVIGATION — scroll state + mobile toggle
   ============================================================ */
const nav        = document.getElementById('nav');
const navToggle  = document.getElementById('navToggle');
const navLinks   = document.getElementById('navLinks');
const navItems   = navLinks.querySelectorAll('.nav__link');

function updateNav() {
  nav.classList.toggle('nav--scrolled', window.scrollY > 40);
}

window.addEventListener('scroll', updateNav, { passive: true });
updateNav();

navToggle.addEventListener('click', () => {
  navLinks.classList.toggle('open');
});

navItems.forEach(link => {
  link.addEventListener('click', () => navLinks.classList.remove('open'));
});

// Active link highlight based on scroll position
const sections = document.querySelectorAll('section[id]');

function highlightNav() {
  const scrollY = window.scrollY + nav.offsetHeight + 20;
  sections.forEach(sec => {
    const top    = sec.offsetTop;
    const bottom = top + sec.offsetHeight;
    const id     = sec.getAttribute('id');
    const link   = navLinks.querySelector(`[href="#${id}"]`);
    if (link) link.classList.toggle('active', scrollY >= top && scrollY < bottom);
  });
}

window.addEventListener('scroll', highlightNav, { passive: true });
highlightNav();


/* ============================================================
   GALLERY — build from gallery.json
   ============================================================ */
const galleryGrid = document.getElementById('galleryGrid');

function titleFromFilename(src) {
  return src
    .split('/').pop()             // strip any path prefix
    .replace(/\.[^.]+$/, '')      // remove extension
    .replace(/[-_]/g, ' ')        // dashes/underscores → spaces
    .replace(/\b\w/g, c => c.toUpperCase()); // title case
}

function inquireHref(title) {
  return `mailto:bakerlaiart@gmail.com?subject=${encodeURIComponent('Inquiry: ' + title)}`;
}

function buildPriceRow(price, available, title) {
  if (!price && !available) return '';
  return `
    <p class="gallery-item__price-row">
      ${price ? `<span class="gallery-item__price">${price}</span>` : ''}
      ${available ? `<a href="${inquireHref(title)}" class="gallery-item__inquire">Inquire</a>` : ''}
    </p>
  `;
}

function buildGalleryItem(entry, index) {
  const src        = entry.src;
  const title      = entry.title      || titleFromFilename(src);
  const medium     = entry.medium     || '';
  const dimensions = entry.dimensions || '';
  const year       = entry.year       || '';
  const price      = entry.price      || '';
  const available  = Boolean(entry.available);
  const meta       = [medium, dimensions, year].filter(Boolean).join(' \u2014 ');

  const article = document.createElement('article');
  article.className = 'gallery-item';
  article.dataset.index = index;
  article.dataset.category = entry.category || '';

  article.innerHTML = `
    <div class="gallery-item__img-wrap">
      <img src="${src}" alt="${title}" loading="lazy" />
      <button class="gallery-item__overlay" aria-label="View ${title}">
        <span class="gallery-item__zoom">&#x2197;</span>
      </button>
    </div>
    <div class="gallery-item__info">
      <h3 class="gallery-item__title">${title}</h3>
      ${meta ? `<p class="gallery-item__meta">${meta}</p>` : ''}
      ${buildPriceRow(price, available, title)}
    </div>
  `;

  return article;
}

function loadGallery() {
  const data = window.GALLERY_DATA || [];
  data.forEach((entry, i) => galleryGrid.appendChild(buildGalleryItem(entry, i)));
  initGallery();
}

function initGallery() {
  const items = Array.from(galleryGrid.querySelectorAll('.gallery-item'));

  /* ---- Lightbox ---- */
  const lightbox      = document.getElementById('lightbox');
  const lightboxImg   = document.getElementById('lightboxImg');
  const lightboxTitle = document.getElementById('lightboxTitle');
  const lightboxMeta  = document.getElementById('lightboxMeta');
  const lightboxPriceRow = document.getElementById('lightboxPriceRow');
  const lightboxClose = document.getElementById('lightboxClose');
  const lightboxPrev  = document.getElementById('lightboxPrev');
  const lightboxNext  = document.getElementById('lightboxNext');

  let currentIndex = 0;
  let visibleItems = [];

  function getVisibleItems() {
    return items.filter(item => !item.classList.contains('hidden'));
  }

  function openLightbox(index) {
    visibleItems = getVisibleItems();
    currentIndex = index;
    showImage(currentIndex);
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
    lightboxClose.focus();
  }

  function closeLightbox() {
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
  }

  function showImage(index) {
    const item  = visibleItems[index];
    const img   = item.querySelector('img');
    const title = item.querySelector('.gallery-item__title');
    const meta     = item.querySelector('.gallery-item__meta');
    const priceRow = item.querySelector('.gallery-item__price-row');

    lightboxImg.classList.add('loading');

    const tmpImg  = new Image();
    tmpImg.src    = img.src;
    tmpImg.onload = () => {
      lightboxImg.src            = img.src;
      lightboxImg.alt            = img.alt;
      lightboxTitle.textContent  = title ? title.textContent : '';
      lightboxMeta.textContent   = meta ? meta.textContent : '';
      lightboxPriceRow.innerHTML = priceRow ? priceRow.innerHTML : '';
      lightboxImg.classList.remove('loading');
    };
  }

  function prevImage() {
    visibleItems = getVisibleItems();
    currentIndex = (currentIndex - 1 + visibleItems.length) % visibleItems.length;
    showImage(currentIndex);
  }

  function nextImage() {
    visibleItems = getVisibleItems();
    currentIndex = (currentIndex + 1) % visibleItems.length;
    showImage(currentIndex);
  }

  items.forEach(item => {
    const btn = item.querySelector('.gallery-item__overlay');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const visible = getVisibleItems();
      const visIdx  = visible.indexOf(item);
      if (visIdx > -1) openLightbox(visIdx);
    });
    const inquire = item.querySelector('.gallery-item__inquire');
    if (inquire) inquire.addEventListener('click', (e) => e.stopPropagation());
    item.addEventListener('click', () => {
      const visible = getVisibleItems();
      const visIdx  = visible.indexOf(item);
      if (visIdx > -1) openLightbox(visIdx);
    });
  });

  lightboxClose.addEventListener('click', closeLightbox);
  lightboxPrev.addEventListener('click',  prevImage);
  lightboxNext.addEventListener('click',  nextImage);

  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('open')) return;
    if (e.key === 'Escape')     closeLightbox();
    if (e.key === 'ArrowLeft')  prevImage();
    if (e.key === 'ArrowRight') nextImage();
  });

  let touchStartX = 0;
  lightbox.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].clientX;
  }, { passive: true });
  lightbox.addEventListener('touchend', (e) => {
    const delta = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(delta) > 50) delta < 0 ? nextImage() : prevImage();
  }, { passive: true });

  /* ---- Category filters ---- */
  const categories = [...new Set(
    (window.GALLERY_DATA || []).map(e => e.category).filter(Boolean)
  )].sort();

  if (categories.length > 0) {
    const galleryTabs = document.getElementById('galleryFilterTabs');

    galleryTabs.removeAttribute('hidden');

    function filterGallery(category) {
      items.forEach(item => {
        const match = category === 'All' || item.dataset.category === category;
        item.classList.toggle('hidden', !match);
      });
    }

    ['All', ...categories].forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'filter-tab' + (cat === 'All' ? ' active' : '');
      btn.textContent = cat;
      btn.dataset.category = cat;
      btn.addEventListener('click', () => {
        galleryTabs.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        filterGallery(cat);
      });
      galleryTabs.appendChild(btn);
    });
  }

  /* ---- Scroll reveal ---- */
  function addRevealClass(selector, stagger = false) {
    document.querySelectorAll(selector).forEach(el => {
      el.classList.add(stagger ? 'reveal-stagger' : 'reveal');
    });
  }

  addRevealClass('.section-header');
  addRevealClass('.about-section__image-col');
  addRevealClass('.about-section__text-col');
  addRevealClass('.about-section__stats', true);
  addRevealClass('.contact-form');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  document.querySelectorAll('.reveal, .reveal-stagger').forEach(el => observer.observe(el));

  // Stagger gallery items on load
  items.forEach(item => {
    item.style.opacity    = '0';
    item.style.transform  = 'translateY(20px)';
    item.style.transition = 'opacity 0.55s ease, transform 0.55s ease';
  });

  const gridObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        getVisibleItems().forEach((item, i) => {
          setTimeout(() => {
            item.style.opacity   = '1';
            item.style.transform = 'translateY(0)';
          }, i * 60);
        });
        gridObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.05 });

  gridObserver.observe(galleryGrid);
}

loadGallery();


