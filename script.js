let isLoading = false;
let totalPages = 950; // Approximate total pages in the API

// Function to get random page numbers
function getRandomPages(count) {
    const pages = new Set();
    while(pages.size < count) {
        pages.add(Math.floor(Math.random() * totalPages) + 1);
    }
    return Array.from(pages);
}

function normalizeString(str) {
    return str.toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
        .replace(/[^a-z0-9\s]/g, ''); // Remove special characters
}

function calculateSimilarity(str1, str2) {
    str1 = normalizeString(str1);
    str2 = normalizeString(str2);
    
    // Exact match
    if (str1 === str2) return 1;
    
    // Contains full word match
    const words1 = str1.split(/\s+/);
    const words2 = str2.split(/\s+/);
    
    for (const word of words1) {
        if (word.length > 2 && words2.includes(word)) return 0.8;
    }
    
    // Partial match
    if (str1.includes(str2) || str2.includes(str1)) return 0.6;
    
    // Calculate word similarity
    const commonWords = words1.filter(word => 
        word.length > 2 && words2.some(w => w.includes(word) || word.includes(w))
    );
    
    if (commonWords.length > 0) {
        return 0.4 * (commonWords.length / Math.max(words1.length, words2.length));
    }
    
    return 0;
}

async function fetchAnimeData() {
    if (isLoading) return;
    isLoading = true;

    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = '<div class="loading">Loading amazing anime for you...</div>';

    try {
        const genre = document.getElementById('genreFilter').value;
        const rating = document.getElementById('ratingFilter').value;
        const status = document.getElementById('statusFilter').value;
        const sortBy = document.getElementById('sortBy').value;
        const searchQuery = document.getElementById('searchInput').value.trim();

        // If there's a search query, use the search endpoint instead of random pages
        let allData = [];
        
        if (searchQuery) {
            // Use the search endpoint for more accurate results
            const url = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(searchQuery)}&limit=25&order_by=${sortBy}&sort=desc`;
            const response = await fetch(url);
            if (!response.ok) throw new Error('Search request failed');
            
            const result = await response.json();
            allData = result.data || [];
        } else {
            // Use random pages for non-search browsing
            const randomPages = getRandomPages(5);
            
            for (const page of randomPages) {
                try {
                    let url = `https://api.jikan.moe/v4/anime?page=${page}&limit=25&order_by=${sortBy}&sort=desc`;
                    
                    if (genre) url += `&genres=${genre}`;
                    if (rating) url += `&rating=${rating}`;
                    if (status) url += `&status=${status}`;
                    
                    const response = await fetch(url);
                    if (!response.ok) continue;
                    
                    const result = await response.json();
                    if (result.data && result.data.length > 0) {
                        allData = [...allData, ...result.data];
                    }

                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (err) {
                    console.error(`Error fetching page ${page}:`, err);
                    continue;
                }
            }
            
            // Only shuffle if not searching
            allData = allData.sort(() => Math.random() - 0.5);
        }

        // Apply additional filters
        if (genre || rating || status) {
            allData = allData.filter(anime => {
                const genreMatch = !genre || anime.genres.some(g => g.mal_id.toString() === genre);
                const ratingMatch = !rating || anime.rating?.toLowerCase().includes(rating.toLowerCase());
                const statusMatch = !status || anime.status?.toLowerCase().includes(status.toLowerCase());
                return genreMatch && ratingMatch && statusMatch;
            });
        }

        if (allData.length === 0) {
            contentDiv.innerHTML = `
                <div class="error">
                    ${searchQuery ? 
                        `No anime found matching "${searchQuery}".<br>
                        Try:
                        <ul style="text-align: left; margin-top: 10px;">
                            <li>Checking for typos</li>
                            <li>Using fewer keywords</li>
                            <li>Using alternative spellings</li>
                            <li>Searching in English or Japanese</li>
                        </ul>` :
                        'No anime found matching your criteria.<br>Try adjusting your filters.'
                    }
                </div>
            `;
            return;
        }

        // Create grid and show results
        const grid = document.createElement('div');
        grid.className = 'anime-grid';

        // Add search stats if searching
        if (searchQuery) {
            const searchStats = document.createElement('div');
            searchStats.className = 'search-stats';
            searchStats.innerHTML = `Found ${allData.length} results for "${searchQuery}"`;
            contentDiv.innerHTML = '';
            contentDiv.appendChild(searchStats);
            contentDiv.appendChild(grid);
        } else {
            contentDiv.innerHTML = '';
            contentDiv.appendChild(grid);
        }

        // Create cards
        allData.forEach(anime => {
            if (anime.images?.jpg?.image_url) {
                const card = document.createElement('div');
                card.className = 'anime-card';
                
                const genres = anime.genres?.map(g => 
                    `<span class="genre-tag">${g.name}</span>`
                ).join('') || '';

                const synopsis = anime.synopsis ? 
                    `<p class="synopsis">${anime.synopsis.slice(0, 150)}...</p>` : '';

                card.innerHTML = `
                    <img src="${anime.images.jpg.image_url}" alt="${anime.title}">
                    <h3>${anime.title}</h3>
                    <div class="status">${anime.status}</div>
                    <p>Episodes: ${anime.episodes || 'Unknown'}</p>
                    ${anime.score ? `<div class="score-badge">★ ${anime.score}/10</div>` : ''}
                    <div class="anime-info">
                        ${genres}
                    </div>
                    ${synopsis}
                    <p style="font-size: 0.8em; margin-top: 10px;">${anime.rating || 'No rating'}</p>
                    <a href="${anime.url}" target="_blank" class="watch-btn">Watch Now</a>
                `;

                grid.appendChild(card);
            }
        });

    } catch (error) {
        contentDiv.innerHTML = `
            <div class="error">
                Error loading anime data. Please try again later.
                <br>
                Error details: ${error.message}
            </div>
        `;
        console.error('Error:', error);
    } finally {
        isLoading = false;
    }
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Add event listeners for filters with debouncing
const debouncedFetch = debounce(fetchAnimeData, 500);

document.getElementById('genreFilter').addEventListener('change', debouncedFetch);
document.getElementById('ratingFilter').addEventListener('change', debouncedFetch);
document.getElementById('statusFilter').addEventListener('change', debouncedFetch);
document.getElementById('sortBy').addEventListener('change', debouncedFetch);
document.getElementById('searchInput').addEventListener('input', debouncedFetch);

// Initial load
fetchAnimeData(); 