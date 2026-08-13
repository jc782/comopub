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
  setupPubSubmissionModal();

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

  /**
   * Submission Modal Controller
   */
  function setupPubSubmissionModal() {
    const openBtn = document.getElementById('open-pub-modal-btn');
    const footerTrigger = document.getElementById('footer-modal-trigger');
    const closeBtn = document.getElementById('close-modal-btn');
    const cancelBtn = document.getElementById('cancel-modal-btn');
    const modalOverlay = document.getElementById('pub-modal');
    const form = document.getElementById('pub-form');

    const photoInput = document.getElementById('pub-photo');
    const previewBox = document.getElementById('photo-preview-box');
    const previewImg = document.getElementById('photo-preview-img');
    const previewName = document.getElementById('photo-preview-name');

    const workerUrlInput = document.getElementById('worker-url');
    const repoOwnerInput = document.getElementById('repo-owner');
    const pubDateInput = document.getElementById('pub-date');
    const statusConsole = document.getElementById('pub-modal-status');
    const statusText = document.getElementById('status-text');
    const submitBtn = document.getElementById('submit-pub-btn');

    if (!modalOverlay || !form) return;

    // Restore saved worker URL and username from localStorage
    const savedWorkerUrl = localStorage.getItem('como_worker_url');
    const savedRepoOwner = localStorage.getItem('como_repo_owner');
    if (savedWorkerUrl) workerUrlInput.value = savedWorkerUrl;
    if (savedRepoOwner) repoOwnerInput.value = savedRepoOwner;

    // Helper to open modal
    function openModal() {
      // Set default date to today
      if (!pubDateInput.value) {
        pubDateInput.value = new Date().toISOString().split('T')[0];
      }
      modalOverlay.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }

    // Helper to close modal
    function closeModal() {
      modalOverlay.classList.add('hidden');
      document.body.style.overflow = '';
      hideStatus();
    }

    if (openBtn) openBtn.addEventListener('click', openModal);
    if (footerTrigger) footerTrigger.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeModal();
    });

    // File Preview Handler
    let selectedFileBase64 = null;
    let selectedFileName = '';

    photoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) {
        previewBox.classList.add('hidden');
        selectedFileBase64 = null;
        selectedFileName = '';
        return;
      }

      selectedFileName = file.name;
      previewName.textContent = file.name;

      const reader = new FileReader();
      reader.onload = (event) => {
        selectedFileBase64 = event.target.result;
        previewImg.src = selectedFileBase64;
        previewBox.classList.remove('hidden');
      };
      reader.readAsDataURL(file);
    });

    // Status Helpers
    function showStatus(text, type = 'loading') {
      statusConsole.className = `modal-status-console status-${type}`;
      statusText.textContent = text;
      statusConsole.classList.remove('hidden');
    }

    function hideStatus() {
      statusConsole.classList.add('hidden');
    }

    // Form Submit Handler
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('pub-name').value.trim();
      const date = pubDateInput.value;
      const location = document.getElementById('pub-location').value.trim();
      const notes = document.getElementById('pub-notes').value.trim();
      const password = document.getElementById('admin-password').value;
      const workerUrl = workerUrlInput.value.trim();
      const repoOwner = repoOwnerInput.value.trim();

      if (!name || !date || !location || !password || !workerUrl || !repoOwner) {
        showStatus('[ERROR: MISSING_REQUIRED_FIELDS]', 'error');
        return;
      }

      if (!selectedFileBase64) {
        showStatus('[ERROR: PLEASE_ATTACH_PHOTO]', 'error');
        return;
      }

      // Save worker settings for convenience
      localStorage.setItem('como_worker_url', workerUrl);
      localStorage.setItem('como_repo_owner', repoOwner);

      showStatus('[ENCODING_IMAGE_PAYLOAD...]', 'loading');
      submitBtn.disabled = true;

      try {
        showStatus('[CONNECTING_TO_WORKER_RELAY...]', 'loading');

        const response = await fetch(workerUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name,
            date,
            location,
            notes,
            photoName: selectedFileName,
            photoBase64: selectedFileBase64,
            password,
            repoOwner,
            repoName: 'comopub'
          }),
        });

        const resData = await response.json();

        if (response.ok && resData.success) {
          showStatus('[SUCCESS! GITHUB_ACTION_TRIGGERED]', 'success');
          
          setTimeout(() => {
            alert(`🎉 Success! Pub trip to "${name}" has been logged.\n\nGitHub Action is updating the repository and GitHub Pages will deploy the change in ~1 minute.`);
            form.reset();
            previewBox.classList.add('hidden');
            selectedFileBase64 = null;
            submitBtn.disabled = false;
            closeModal();
          }, 1500);
        } else {
          submitBtn.disabled = false;
          if (resData.error === 'INVALID_PASSWORD') {
            showStatus('[ERROR: INVALID_ADMIN_PASSWORD]', 'error');
          } else {
            showStatus(`[ERROR: ${resData.error || resData.details || 'DISPATCH_FAILED'}]`, 'error');
          }
        }
      } catch (err) {
        submitBtn.disabled = false;
        console.error('Submission failed:', err);
        showStatus(`[NETWORK_ERROR: COULD_NOT_CONNECT_TO_WORKER]`, 'error');
      }
    });
  }
});

