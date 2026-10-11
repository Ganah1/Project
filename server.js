// ============================================================
//  🎬 Movie Discovery — Express + OMDb API + EJS
// ============================================================
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const OMDB_KEY = process.env.OMDB_API_KEY;

// ---------- App Config ----------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

// ---------- OMDb Base URL ----------
const OMDB_BASE = 'https://www.omdbapi.com/';

// ---------- Helpers ----------
const PLACEHOLDER_POSTER = 'N/A';

function safePoster(poster) {
  return poster && poster !== PLACEHOLDER_POSTER ? poster : null;
}

/**
 * Fetch a single movie by exact title
 */
async function fetchMovieByTitle(title) {
  const { data } = await axios.get(OMDB_BASE, {
    params: { apikey: OMDB_KEY, t: title, plot: 'full' },
    timeout: 8000,
  });
  if (data.Response === 'False') throw new Error(data.Error || 'Movie not found');
  return data;
}

/**
 * Search movies by keyword (returns array)
 */
async function searchMovies(query, page = 1) {
  const { data } = await axios.get(OMDB_BASE, {
    params: { apikey: OMDB_KEY, s: query, page, type: 'movie' },
    timeout: 8000,
  });
  if (data.Response === 'False') return { results: [], total: 0, error: data.Error };
  return {
    results: data.Search || [],
    total: parseInt(data.totalResults, 10) || 0,
    error: null,
  };
}

// ---------- Routes ----------

// Home — no query, show hero + trending placeholders
app.get('/', (req, res) => {
  res.render('index', {
    searchQuery: '',
    movie: null,
    results: [],
    total: 0,
    error: null,
    notFound: false,
  });
});

// Search route — handles both "exact title" + "search list"
app.get('/search', async (req, res) => {
  const q = (req.query.q || '').trim();

  if (!q) {
    return res.redirect('/');
  }

  try {
    // Try an exact match first — gives the nice "hero" card
    let movie = null;
    let results = [];
    let total = 0;
    let error = null;
    let notFound = false;

    try {
      movie = await fetchMovieByTitle(q);
    } catch (_) {
      // Exact match failed → fall back to list search
      const searchRes = await searchMovies(q);
      if (searchRes.error) {
        error = searchRes.error;
        notFound = true;
      } else {
        results = searchRes.results;
        total = searchRes.total;
      }
    }

    res.render('index', {
      searchQuery: q,
      movie,
      results,
      total,
      error,
      notFound,
    });
  } catch (err) {
    console.error('OMDb error:', err.message);
    res.render('index', {
      searchQuery: q,
      movie: null,
      results: [],
      total: 0,
      error: 'Unable to reach OMDb API. Check your API key or connection.',
      notFound: false,
    });
  }
});

// View a specific movie by IMDb ID (from result cards)
app.get('/movie/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { data } = await axios.get(OMDB_BASE, {
      params: { apikey: OMDB_KEY, i: id, plot: 'full' },
      timeout: 8000,
    });
    if (data.Response === 'False') throw new Error(data.Error);

    res.render('index', {
      searchQuery: data.Title,
      movie: data,
      results: [],
      total: 0,
      error: null,
      notFound: false,
    });
  } catch (err) {
    res.render('index', {
      searchQuery: '',
      movie: null,
      results: [],
      total: 0,
      error: err.message || 'Movie not found',
      notFound: true,
    });
  }
});

// ---------- Health check ----------
app.get('/health', (_, res) => res.json({ status: 'ok', time: new Date() }));

// ---------- 404 ----------
app.use((req, res) => {
  res.status(404).render('index', {
    searchQuery: '',
    movie: null,
    results: [],
    total: 0,
    error: '404 — Page not found',
    notFound: true,
  });
});

// ---------- Boot ----------
app.listen(PORT, () => {
  console.log(`\n🎬  Movie Discovery running on http://localhost:${PORT}`);
  if (!OMDB_KEY) {
    console.warn('⚠️   OMDb API key missing — add OMDB_API_KEY to your .env file');
  }
});