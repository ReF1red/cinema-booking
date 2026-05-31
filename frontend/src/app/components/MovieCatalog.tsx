import React, { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Clock, Search, Star } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { fetchCinemasByCity, fetchCities, fetchMovies, getErrorMessage, fetchFeaturedMovies } from "../../lib/api";
import { formatDuration, getMovieAgeLabel, getMoviePoster } from "../../lib/formatters";
import type { Cinema, City, Movie } from "../../lib/types";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";

interface MovieRail {
  key: string;
  title: string;
  movies: Movie[];
}

function getSyntheticRating(movie: Movie): number {
  const hash = `${movie.movie_id}:${movie.title}`.split("").reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 0);
  return Number((7 + (hash % 26) / 10).toFixed(1));
}

function getMovieRating(movie: Movie): number {
  if (typeof movie.rating === "number" && Number.isFinite(movie.rating)) return movie.rating;
  return getSyntheticRating(movie);
}

function getShortDescription(movie: Movie, maxLength = 100): string {
  const text = (movie.description ?? "").trim();
  if (!text) return "Описание фильма пока не добавлено.";
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd().replace(/[.,!?;:]+$/, "") + "...";
}

function getShortGenre(movie: Movie, maxLength = 30): string {
  const genre = (movie.genre ?? "").trim();
  if (!genre) return "Фильм";
  if (genre.length <= maxLength) return genre;
  return genre.slice(0, maxLength).trimEnd().replace(/[,/]+$/, "") + "...";
}

function buildRailMovies(source: Movie[], predicate: (movie: Movie) => boolean, limit = 12): Movie[] {
  if (source.length === 0) return [];
  const matched = source.filter(predicate);
  const reserve = source.filter((m) => !matched.some((x) => x.movie_id === m.movie_id));
  return [...matched, ...reserve].slice(0, limit);
}

function convertToUsd(amount: number | null | undefined, currency: string | null | undefined): number {
    if (amount == null || amount <= 0) return 0;
    const curr = (currency || "RUB").toUpperCase();
    return curr === "RUB" ? amount / 90 : amount;
}

export function MovieCatalog() {
  const { user, selectedCity, selectedCinema } = useApp();
  const navigate = useNavigate();
  const isGuest = user?.role === "guest";

  const [movies, setMovies] = useState<Movie[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [cityCinemas, setCityCinemas] = useState<Cinema[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownMovies, setDropdownMovies] = useState<Movie[]>([]);

  useEffect(() => {
      setSearchQuery("");
      
      const load = async () => {
          setLoading(true);
          try {
              const moviesList = await fetchMovies();
              setMovies(moviesList);
          } catch {}
          finally { setLoading(false); }
      };
      load();
  }, []);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [moviesList, citiesList] = await Promise.all([fetchMovies(), fetchCities()]);
        if (!isMounted) return;
        setMovies(moviesList);
        setCities(citiesList);
        if (selectedCity) {
          const cinemas = await fetchCinemasByCity(selectedCity);
          if (isMounted) setCityCinemas(cinemas);
        } else {
          setCityCinemas([]);
        }
      } catch (loadError) {
        if (!isMounted) return;
        setError(getErrorMessage(loadError, "Не удалось загрузить каталог фильмов."));
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    void load();
    return () => { isMounted = false; };
  }, [selectedCity]);

  const selectedCityName = useMemo(
    () => cities.find((city) => city.city_id === selectedCity)?.city_name,
    [cities, selectedCity],
  );
  const selectedCinemaName = useMemo(
    () => cityCinemas.find((cinema) => cinema.cinema_id === selectedCinema)?.cinema_name,
    [cityCinemas, selectedCinema],
  );

  const moviesByRating = useMemo(
    () => [...movies].sort((a, b) => getMovieRating(b) - getMovieRating(a)),
    [movies],
  );
  const moviesByReleaseYear = useMemo(
    () => [...movies].sort((a, b) => (b.release_year ?? 0) - (a.release_year ?? 0)),
    [movies],
  );
  const moviesByBudget = useMemo(
    () => [...movies].sort((a, b) => convertToUsd(b.budget_amount, b.budget_currency) - convertToUsd(a.budget_amount, a.budget_currency) || getMovieRating(b) - getMovieRating(a)),
    [movies],
  );

  const [featuredMovies, setFeaturedMovies] = useState<Movie[]>([]);

  useEffect(() => {
      if (selectedCinema) {
          fetchFeaturedMovies(selectedCinema).then(setFeaturedMovies).catch(() => setFeaturedMovies([]));
      }
  }, [selectedCinema]);

  const showcaseMovies = useMemo(() => {
      if (featuredMovies.length > 0) return featuredMovies;
      return moviesByRating.slice(0, 4);
  }, [featuredMovies, moviesByRating]);

  const currentYear = new Date().getFullYear();

  const movieRails = useMemo<MovieRail[]>(() => [
    { key: "high-rating", title: "Высокий рейтинг", movies: buildRailMovies(moviesByRating, (m) => typeof m.rating === "number" && m.rating >= 7.5) },
    { key: "new-releases", title: "Новинки", movies: buildRailMovies(moviesByReleaseYear, (m) => (m.release_year ?? 0) >= currentYear - 1) },
    { key: "big-budget", title: "Большой бюджет", movies: buildRailMovies(moviesByBudget, (m) => (m.budget_amount ?? 0) > 0) },
  ], [moviesByRating, moviesByReleaseYear, moviesByBudget, currentYear]);

  if (!user) return <Navigate to="/" replace />;

  return (
    <div className="flex-1 container mx-auto px-4 py-8 lg:py-16">
      <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-4xl md:text-5xl font-heading text-white mb-2 uppercase tracking-wide">Сейчас в кино</h1>
          <p className="text-[#9CA3AF] text-lg flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#E50914] animate-pulse" />
            Сеансы в <span className="text-white font-medium">{selectedCinemaName || "всех кинотеатрах"}</span>
            {selectedCityName ? `, ${selectedCityName}` : ", все города"}
          </p>
        </motion.div>
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <Button variant="outline" onClick={() => navigate("/cities")} className="gap-2">
            Изменить локацию
          </Button>
        </motion.div>
      </header>

      <div className="relative mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
        <Input
          type="text"
          placeholder="Поиск фильма..."
          value={searchQuery}
          onChange={(e) => {
            const value = e.target.value;
            setSearchQuery(value);
            if (value.trim().length >= 2) {
              const q = value.trim().toLowerCase();
              setDropdownMovies(movies.filter(m => m.title.toLowerCase().includes(q)).slice(0, 12));
              setShowDropdown(true);
            } else {
              setShowDropdown(false);
            }
          }}
          onFocus={() => {
              if (searchQuery.trim().length >= 2) setShowDropdown(true);
          }}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          className="pl-10 bg-[#1A1A1F] border-[#F5F5F7]/10 text-white placeholder:text-[#9CA3AF]"
      />
      {showDropdown && dropdownMovies.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-[#1A1A1F] border border-[#F5F5F7]/10 rounded-xl overflow-hidden z-50 shadow-2xl">
              {dropdownMovies.map(movie => (
                  <button
                      key={movie.movie_id}
                      onClick={() => {
                          navigate(`/movie/${movie.movie_id}`);
                          setSearchQuery("");
                          setShowDropdown(false);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-[#232329] transition-colors flex items-center gap-3"
                  >
                      <img src={getMoviePoster(movie)} alt="" className="w-8 h-12 rounded object-cover" />
                      <div>
                          <p className="text-white text-sm font-medium">{movie.title}</p>
                          <p className="text-[#9CA3AF] text-xs">{movie.release_year} • {movie.genre?.split("/")[0]}</p>
                      </div>
                  </button>
              ))}
          </div>
      )}
  </div>

      {error && (
        <Card className="bg-red-500/10 border-red-500/30 p-6 mb-8">
          <p className="text-red-300">{error}</p>
        </Card>
      )}

      {loading ? (
        <div className="text-[#9CA3AF]">Загружаем фильмы...</div>
      ) : movies.length === 0 ? (
        <Card className="bg-[#1A1A1F] border-[#F5F5F7]/10 p-10 text-center">
          <h2 className="text-2xl font-heading text-white uppercase tracking-wide mb-3">Фильмы не найдены</h2>
          <p className="text-[#9CA3AF]">{searchQuery ? "По вашему запросу ничего не найдено." : "В базе пока нет фильмов для отображения."}</p>
        </Card>
      ) : (
        <div className="space-y-12">
          <section className="space-y-5">
            <h2 className="text-xl font-heading tracking-widest uppercase text-[#FFC857] border-b border-[#F5F5F7]/10 pb-3">Основные премьеры</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
              {showcaseMovies.map((movie, index) => (
                <motion.article key={movie.movie_id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.08 }}>
                  <Card className="bg-[#1A1A1F] border-transparent overflow-hidden shadow-2xl h-full">
                    <div className="relative aspect-[2/3] overflow-hidden bg-black cursor-pointer" onClick={() => navigate(`/movie/${movie.movie_id}`)}>
                      <img src={getMoviePoster(movie)} alt={movie.title} className="w-full h-full object-cover" loading="lazy" />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0D] via-transparent to-transparent opacity-80" />
                      <div className="absolute top-3 right-3 bg-[#0B0B0D]/80 backdrop-blur-md px-2.5 py-1 rounded-lg text-xs font-semibold text-[#FFC857] border border-[#F5F5F7]/10 flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-[#FFC857]" /> {getMovieRating(movie).toFixed(1)}
                      </div>
                      <div className="absolute top-3 left-3 bg-[#0B0B0D]/80 border border-[#F5F5F7]/10 text-white text-xs px-2 py-1 rounded-md">{getMovieAgeLabel(movie)}</div>
                    </div>
                    <div className="p-4 space-y-3">
                      <h3 className="text-lg font-heading text-white tracking-wide uppercase leading-tight min-h-[3.5rem]">{movie.title}</h3>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#9CA3AF]">
                        <span className="flex items-center gap-1 bg-[#232329] px-2 py-1 rounded-md"><Clock className="w-3.5 h-3.5" />{formatDuration(movie.duration_min)}</span>
                        <span className="px-2 py-1 rounded-md border border-[#F5F5F7]/10 max-w-[540px] truncate">{getShortGenre(movie)}</span>
                      </div>
                      <p className="text-sm text-[#D1D5DB] leading-relaxed min-h-[4.5rem]">{getShortDescription(movie)}</p>
                      {isGuest ? (
                          <Button className="w-full font-heading tracking-widest uppercase" variant="outline" onClick={() => { localStorage.clear(); window.location.href = "/"; }}>Войти, чтобы купить</Button>
                      ) : (
                          <Button className="w-full font-heading tracking-widest uppercase" onClick={(e) => { e.stopPropagation(); navigate(`/movie/${movie.movie_id}`); }}>Купить билет</Button>
                      )}
                    </div>
                  </Card>
                </motion.article>
              ))}
            </div>
          </section>

          <div className="space-y-8">
            {movieRails.map((rail, railIndex) => (
              <motion.section key={rail.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: railIndex * 0.06 }} className={`space-y-3 ${railIndex > 0 ? "pt-6" : ""}`}>
                {railIndex > 0 && <div className="h-px w-full bg-gradient-to-r from-transparent via-[#E50914]/45 to-transparent" />}
                <h3 className="text-lg font-heading text-white uppercase tracking-widest">{rail.title}</h3>
                {rail.movies.length === 0 ? (
                  <Card className="p-4 bg-[#1A1A1F] border-[#F5F5F7]/10 text-[#9CA3AF]">Пока нет фильмов, подходящих для этой подборки.</Card>
                ) : (
                  <div className="flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {rail.movies.map((movie) => (
                      <button key={`${rail.key}-${movie.movie_id}`} onClick={() => navigate(`/movie/${movie.movie_id}`)} className="text-left w-[168px] md:w-[184px] shrink-0">
                        <div className="relative aspect-[2/3] rounded-xl overflow-hidden border border-[#F5F5F7]/10 bg-[#1A1A1F]">
                          <img src={getMoviePoster(movie)} alt={movie.title} className="w-full h-full object-cover" loading="lazy" />
                          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0D] via-transparent to-transparent opacity-80" />
                          <div className="absolute top-2 right-2 bg-[#0B0B0D]/85 px-2 py-1 rounded-md text-[11px] text-[#FFC857] border border-[#F5F5F7]/10 flex items-center gap-1">
                            <Star className="w-3 h-3 fill-[#FFC857]" />{getMovieRating(movie).toFixed(1)}
                          </div>
                          <div className="absolute top-2 left-2 bg-[#0B0B0D]/85 px-2 py-1 rounded-md text-[11px] text-white border border-[#F5F5F7]/10">{getMovieAgeLabel(movie)}</div>
                        </div>
                        <div className="pt-2 space-y-1">
                          <p className="text-sm text-white font-medium truncate">{movie.title}</p>
                          <p className="text-xs text-[#9CA3AF]">{movie.release_year ?? "—"} • {formatDuration(movie.duration_min)}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </motion.section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}