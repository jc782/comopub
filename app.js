/**
 * COMO'S PUB LOG - APP ENGINE
 * Controls dynamic rendering, statistics, search/sorting, scroll animations,
 * and nostalgic Web 1.0 details.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Check if PUBS_DATA is defined
  if (typeof PUBS_DATA === 'undefined') {
    console.error('PUBS_DATA not loaded. Check pubs.js.');
    const feed = document.getElementById('pubs-feed');
    if (feed) feed.innerHTML = '<div class="empty-state">ERROR: Data file "pubs.js" could not be loaded.</div>';
    return;
  }

  // State Variables
  let searchFilter = '';
  let sortBy = 'newest'; // 'newest' or 'oldest'
  let scrollObserver = null;

  // DOM Elements
  const feedContainer = document.getElementById('pubs-feed');
  const searchInput = document.getElementById('search-input');
  const clearSearchBtn = document.getElementById('clear-search');
  const sortNewestBtn = document.getElementById('sort-newest');
  const sortOldestBtn = document.getElementById('sort-oldest');
  
  const statTotal = document.getElementById('stat-total');
  const statLocations = document.getElementById('stat-locations');
  const statLastDate = document.getElementById('stat-last-date');
  const hitCounter = document.getElementById('hit-counter');

  // --- Initial Setup & Page Load ---
  initVisitorCounter();
  updateStats();
  renderPubs();
  setupTicker();

  // --- Event Listeners ---
  searchInput.addEventListener('input', (e) => {
    searchFilter = e.target.value.toLowerCase();
    renderPubs();
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchFilter = '';
    renderPubs();
    searchInput.focus();
  });

  sortNewestBtn.addEventListener('click', () => {
    if (sortBy !== 'newest') {
      sortBy = 'newest';
      sortNewestBtn.classList.add('active');
      sortOldestBtn.classList.remove('active');
      renderPubs();
    }
  });

  sortOldestBtn.addEventListener('click', () => {
    if (sortBy !== 'oldest') {
      sortBy = 'oldest';
      sortOldestBtn.classList.add('active');
      sortNewestBtn.classList.remove('active');
      renderPubs();
    }
  });

  // --- Core Functions ---

  /**
   * Calculate summary stats from the raw data and render them.
   */
  function updateStats() {
    if (!PUBS_DATA.length) return;

    // 1. Total Pubs Visited
    statTotal.textContent = String(PUBS_DATA.length).padStart(2, '0');

    // 2. Unique Cities/Locations
    // Extract the city name (usually after comma, or whole location if no comma)
    const cities = PUBS_DATA.map(pub => {
      const parts = pub.location.split(',');
      // Take the last part (e.g. London or Oxfordshire) or the full string if no comma
      return parts[parts.length - 1].trim();
    });
    const uniqueCities = new Set(cities);
    statLocations.textContent = String(uniqueCities.size).padStart(2, '0');

    // 3. Last Crawl Date (formatted as YYYY/MM/DD)
    const dates = PUBS_DATA.map(pub => new Date(pub.date));
    const maxDate = new Date(Math.max(...dates));
    if (!isNaN(maxDate)) {
      const formattedDate = maxDate.toISOString().split('T')[0].replace(/-/g, '/');
      statLastDate.textContent = formattedDate;
    } else {
      statLastDate.textContent = '----/--/--';
    }
  }

  /**
   * Sort and filter pub data, then render cards into the HTML feed.
   */
  function renderPubs() {
    // Clear feed
    feedContainer.innerHTML = '';

    // Filter
    let filtered = PUBS_DATA.filter(pub => {
      const nameMatch = pub.name.toLowerCase().includes(searchFilter);
      const locMatch = pub.location.toLowerCase().includes(searchFilter);
      const notesMatch = pub.notes.toLowerCase().includes(searchFilter);
      return nameMatch || locMatch || notesMatch;
    });

    // Sort
    filtered.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
    });

    // Render Empty State if no pubs match search
    if (filtered.length === 0) {
      feedContainer.innerHTML = `
        <div class="empty-state">
          [NO_ESTABLISHMENTS_FOUND_MATCHING_FILTER: "${searchFilter}"]
        </div>
      `;
      return;
    }

    // Render Cards
    filtered.forEach((pub, index) => {
      const card = createPubCard(pub, index + 1);
      feedContainer.appendChild(card);
    });

    // Initialize/Refresh Lucide Icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }

    // Set up viewport scroll animations
    setupScrollAnimations();
  }

  /**
   * Construct a retro pub-card DOM element.
   */
  function createPubCard(pub, indexNumber) {
    const card = document.createElement('article');
    card.className = 'retro-panel pub-card';

    // Format display date
    let displayDate = pub.date;
    try {
      const d = new Date(pub.date);
      const options = { year: 'numeric', month: 'short', day: 'numeric' };
      displayDate = d.toLocaleDateString('en-GB', options); // e.g. "28 Jun 2026"
    } catch (e) {
      console.warn('Could not parse date:', pub.date);
    }

    card.innerHTML = `
      <div class="pub-card-header">
        <div class="pub-title-bar">
          <div class="dot"></div>
          <h2>${pub.name}</h2>
        </div>
        <div class="pub-meta-list">
          <div class="pub-meta-item" title="Date visited">
            <i data-lucide="calendar" size="14"></i>
            <span>${displayDate}</span>
          </div>
          <div class="pub-meta-item" title="Location">
            <i data-lucide="map-pin" size="14"></i>
            <span>${pub.location}</span>
          </div>
        </div>
      </div>
      <div class="pub-card-body">
        <!-- Photo Frame -->
        <div class="pub-photo-frame">
          <div class="pub-photo-header">
            <span>IMAGE_RECORD //</span>
            <span>${pub.photo.split('/').pop().toUpperCase()}</span>
          </div>
          <div class="pub-photo-container">
            <img src="${pub.photo}" alt="Photo of ${pub.name}" loading="lazy">
          </div>
        </div>

        <!-- Notes and details -->
        <div class="pub-details">
          <div class="pub-notes-box">
            <p>${pub.notes}</p>
          </div>
          <div class="visited-stamp">
            [APPROVED.BY.COMO]
          </div>
        </div>
      </div>
    `;

    return card;
  }

  /**
   * Viewport Intersection Observer for scroll animation effects.
   */
  function setupScrollAnimations() {
    // Disconnect old observer if it exists
    if (scrollObserver) {
      scrollObserver.disconnect();
    }

    const cards = document.querySelectorAll('.pub-card');

    scrollObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          // Once animated, we don't need to observe it anymore
          scrollObserver.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.15, // Trigger when 15% of card is visible
      rootMargin: '0px 0px -50px 0px' // Offset slightly to trigger naturally
    });

    cards.forEach(card => scrollObserver.observe(card));
  }

  /**
   * Nostalgic 7-digit visitor hit counter.
   */
  function initVisitorCounter() {
    let count = localStorage.getItem('como_pub_visitor_count');
    if (!count) {
      // Set a fun retro starting point
      count = 84092;
    } else {
      count = parseInt(count);
    }
    
    // Increment on each load
    count += 1;
    localStorage.setItem('como_pub_visitor_count', count);
    
    // Format to 7 digits
    if (hitCounter) {
      hitCounter.textContent = String(count).padStart(7, '0');
    }
  }

  /**
   * Fun ticker status log rotation.
   */
  function setupTicker() {
    const tickerText = document.querySelector('.ticker-text');
    if (!tickerText) return;

    const messages = [
      "Searching for dropped chips...",
      "Patrolling beer gardens for belly rubs...",
      "Optimal tail-wagging index reached.",
      "Total pints snuffed: 104 and counting.",
      "Como says: 'Stay pawsitive and support local pubs!'",
      "Treat scanner: ONLINE. Analyzing bar counter...",
      "Connecting to snack server..."
    ];

    let currentMsgIndex = 0;
    
    // Cycle messages every 5 seconds
    setInterval(() => {
      currentMsgIndex = (currentMsgIndex + 1) % messages.length;
      
      // Add a fading effect when shifting text
      tickerText.style.opacity = '0';
      setTimeout(() => {
        tickerText.textContent = messages[currentMsgIndex];
        tickerText.style.opacity = '1';
      }, 300);
    }, 5000);
  }
});
