import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { CalendarClock, Clock3, MapPin, MonitorPlay, Search } from "lucide-react";
import { addDays, format, isToday, isTomorrow, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { useApp } from "../../context/AppContext";
import {
  fetchCinemasByCity,
  fetchCities,
  fetchHallsByCinema,
  fetchMovies,
  fetchSessionsByCinema,
  getErrorMessage,
} from "../../lib/api";
import { formatTime, getMoviePoster } from "../../lib/formatters";
import type { Cinema, City, Hall, Movie } from "../../lib/types";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";

interface SessionRow {
  sessionId: number;
  movieId: number;
  movieTitle: string;
  posterUrl: string;
  startTime: string;
  hallName: string;
}

function toTimestamp(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
}

function formatSessionDate(value: string): string {
  try {
    return format(parseISO(value), "d MMMM, EEEE", { locale: ru });
  } catch {
    return "Дата не указана";
  }
}

function getSessionDayKey(value: string): string {
  try {
    return format(parseISO(value), "yyyy-MM-dd");
  } catch {
    return "unknown";
  }
}

function formatSessionDayTitle(value: string): string {
  try {
    const parsed = parseISO(value);
    if (isToday(parsed)) return `Сегодня, ${format(parsed, "d MMMM", { locale: ru })}`;
    if (isTomorrow(parsed)) return `Завтра, ${format(parsed, "d MMMM", { locale: ru })}`;
    return format(parsed, "d MMMM, EEEE", { locale: ru });
  } catch {
    return "Дата не указана";
  }
}

export function SessionSchedule() {
  const { user, selectedCity, selectedCinema } = useApp();
  const navigate = useNavigate();

  const [cities, setCities] = useState<City[]>([]);
  const [cinemas, setCinemas] = useState<Cinema[]>([]);
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [searchQuery, setSearchQuery] = useState("");
  const [allMovies, setAllMovies] = useState<Movie[]>([]);

  const [searchResults, setSearchResults] = useState<SessionRow[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const dates = useMemo(
      () => Array.from({ length: 11 }).map((_, i) => addDays(new Date(), i)),
      [],
  );

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const cityList = await fetchCities();
        if (!isMounted) return;
        setCities(cityList);

        if (!selectedCity) {
          setCinemas([]);
          setRows([]);
          return;
        }

        const cinemaList = await fetchCinemasByCity(selectedCity);
        if (!isMounted) return;
        setCinemas(cinemaList);

        if (!selectedCinema) {
          setRows([]);
          return;
        }

        const [sessions, movies, halls] = await Promise.all([
          fetchSessionsByCinema(selectedCinema),
          fetchMovies(),
          fetchHallsByCinema(selectedCinema),
        ]);

        if (!isMounted) return;

        const movieById = new Map<number, Movie>(movies.map((m) => [m.movie_id, m]));
        const hallById = new Map<number, Hall>(halls.map((h) => [h.hall_id, h]));
        const now = Date.now();
        const weekEnd = addDays(new Date(), 11).getTime();

        const scheduleRows: SessionRow[] = sessions
            .filter((s) => {
              const ts = toTimestamp(s.start_time);
              return ts >= now && ts <= weekEnd;
            })
            .sort((a, b) => toTimestamp(a.start_time) - toTimestamp(b.start_time))
            .map((s) => {
              const movie = movieById.get(s.movie_id);
              const hall = hallById.get(s.hall_id);
              return {
                sessionId: s.session_id,
                movieId: s.movie_id,
                movieTitle: movie?.title ?? s.movie_title ?? "Фильм",
                posterUrl:
                    movie?.poster_url ||
                    (movie ? getMoviePoster(movie) : "https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=1080&q=80"),
                startTime: s.start_time,
                hallName: s.hall_name ?? hall?.hall_name ?? "—",
              };
            });

        setRows(scheduleRows);
        setAllMovies(movies);
      } catch (loadError) {
        if (!isMounted) return;
        setError(getErrorMessage(loadError, "Не удалось загрузить расписание сеансов."));
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void load();
    return () => {
      isMounted = false;
    };
  }, [selectedCity, selectedCinema]);

  const selectedCityName = useMemo(
      () => cities.find((c) => c.city_id === selectedCity)?.city_name ?? "Город не выбран",
      [cities, selectedCity],
  );

  const selectedCinemaName = useMemo(
      () => cinemas.find((c) => c.cinema_id === selectedCinema)?.cinema_name ?? "Кинотеатр не выбран",
      [cinemas, selectedCinema],
  );

  const handleSearch = async (value: string) => {
      setSearchQuery(value);
      if (value.trim().length < 2) {
          setSearchResults([]);
          return;
      }
      setSearchLoading(true);
      try {
          const q = value.trim().toLowerCase();
          const matchedIds = new Set(
              allMovies
                  .filter(m => m.title.toLowerCase().includes(q))
                  .map(m => m.movie_id)
          );
          setSearchResults(rows.filter(r => matchedIds.has(r.movieId)));
      } catch {
          setSearchResults([]);
      } finally {
          setSearchLoading(false);
      }
  };

  const rowsForSelectedDate = useMemo(
      () => rows.filter((row) => getSessionDayKey(row.startTime) === selectedDate),
      [rows, selectedDate],
  );

  const daysWithSessions = useMemo(
      () => new Set(rows.map((row) => getSessionDayKey(row.startTime))),
      [rows],
  );

  const nearestSession = rows[0] ?? null;

  if (!user) return <Navigate to="/" replace />;

  const renderSessionCards = (sessionsToRender: SessionRow[]) => {
    if (sessionsToRender.length === 0) {
      return (
          <Card className="bg-[#1A1A1F] border-[#F5F5F7]/10 p-8 text-center">
            <CalendarClock className="w-8 h-8 text-[#9CA3AF] mx-auto mb-3 opacity-50" />
            <p className="text-white">Сеансы не найдены</p>
            {searchQuery && <p className="text-[#9CA3AF] text-sm mt-1">Попробуйте изменить поисковый запрос.</p>}
          </Card>
      );
    }

    return (
        <div className="space-y-4">
          {sessionsToRender.map((row) => (
              <Card
                  key={row.sessionId}
                  className="bg-[#1A1A1F] border-[#F5F5F7]/10 p-4 md:p-5 cursor-pointer hover:border-[#E50914]/60 transition-colors"
                  onClick={() => navigate(`/seats/${row.sessionId}`)}
              >
                <div className="flex gap-4 md:gap-5">
                  <div className="w-24 sm:w-28 aspect-[2/3] rounded-lg overflow-hidden shrink-0 bg-black">
                    <img src={row.posterUrl} alt={row.movieTitle} className="w-full h-full object-cover" loading="lazy" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="text-xl font-heading text-white leading-tight">{row.movieTitle}</p>
                    <p className="text-[#D1D5DB] flex items-center gap-2">
                      <Clock3 className="w-4 h-4 text-[#E50914]" />
                      <span>Время сеанса: {formatTime(row.startTime)}</span>
                    </p>
                    <p className="text-[#D1D5DB] flex items-center gap-2">
                      <MonitorPlay className="w-4 h-4 text-[#E50914]" />
                      <span>Номер зала: {row.hallName}</span>
                    </p>
                    <p className="text-sm text-[#9CA3AF]">{formatSessionDate(row.startTime)}</p>
                  </div>
                </div>
              </Card>
          ))}
        </div>
    );
  };

  return (
      <div className="flex-1 container mx-auto px-4 py-8 lg:py-16">
        <div className="max-w-5xl mx-auto space-y-8">
          <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h1 className="text-4xl md:text-5xl font-heading text-white uppercase tracking-wide">Расписание сеансов</h1>
              <p className="mt-2 text-[#9CA3AF] flex flex-wrap items-center gap-x-2 gap-y-1">
                <MapPin className="w-4 h-4 text-[#E50914]" />
                <span className="text-white">{selectedCinemaName}</span>
                <span>•</span>
                <span>{selectedCityName}</span>
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate("/cities")} className="gap-2 self-start md:self-auto">
              <MapPin className="w-4 h-4" /> Выбрать локацию
            </Button>
          </header>

          {/* Поисковая строка */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
            <Input
                type="text"
                placeholder="Поиск по названию фильма..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10 bg-[#1A1A1F] border-[#F5F5F7]/10 text-white placeholder:text-[#9CA3AF]"
            />
          </div>

          {(!selectedCity || !selectedCinema) && (
              <Card className="bg-[#1A1A1F] border-[#F5F5F7]/10 p-8 text-center">
                <p className="text-white text-lg mb-3">Сначала выберите город и кинотеатр</p>
                <p className="text-[#9CA3AF] mb-6">После выбора локации здесь появится список ближайших сеансов.</p>
                <Button onClick={() => navigate("/cities")}>Открыть выбор локации</Button>
              </Card>
          )}

          {error && (
              <Card className="bg-red-500/10 border-red-500/30 p-5">
                <p className="text-red-300">{error}</p>
              </Card>
          )}

          {selectedCity && selectedCinema && (
              loading ? (
                  <div className="text-[#9CA3AF]">Загружаем расписание...</div>
              ) : rows.length === 0 ? (
                  <Card className="bg-[#1A1A1F] border-[#F5F5F7]/10 p-8 text-center">
                    <CalendarClock className="w-10 h-10 text-[#9CA3AF] mx-auto mb-3" />
                    <p className="text-white text-lg mb-2">Ближайшие сеансы не найдены</p>
                    <p className="text-[#9CA3AF]">Проверьте выбранный кинотеатр или добавьте сеансы в админ-панели.</p>
                  </Card>
              ) : (
                  <div className="space-y-8">
                    {searchQuery.trim() ? (
                        <div className="space-y-3">
                          <h2 className="text-lg font-heading uppercase tracking-wide text-white">
                            Результаты поиска: {searchResults.length}
                          </h2>
                          {searchLoading ? (
                          <p className="text-[#9CA3AF]">Поиск...</p>
                          ) : (
                              renderSessionCards(searchResults)
                          )}
                        </div>
                    ) : (
                        <>
                          {/* Ближайший сеанс */}
                          {nearestSession && (
                              <Card className="bg-[#16161A] border-[#E50914]/30 p-4 md:p-5">
                                <p className="text-xs uppercase tracking-widest text-[#9CA3AF] mb-2">Ближайший сеанс</p>
                                <p className="text-white text-lg md:text-xl font-heading">
                                  {nearestSession.movieTitle} • {formatSessionDayTitle(nearestSession.startTime)} • {formatTime(nearestSession.startTime)}
                                </p>
                                <p className="text-[#D1D5DB] mt-1">
                                  Зал: {nearestSession.hallName} • Всего сеансов на 11 дней: {rows.length}
                                </p>
                              </Card>
                          )}

                          {/* Пагинация по дням */}
                          <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden justify-start">
                            {dates.map((date) => {
                              const dateStr = format(date, "yyyy-MM-dd");
                              const isSelected = selectedDate === dateStr;
                              const hasSessions = daysWithSessions.has(dateStr);
                              return (
                                  <button
                                      key={dateStr}
                                      onClick={() => setSelectedDate(dateStr)}
                                      className={`flex-shrink-0 w-16 sm:w-20 h-20 sm:h-24 rounded-xl flex flex-col items-center justify-center transition-all duration-300 border relative ${
                                          isSelected
                                              ? "bg-[#E50914] border-[#E50914] text-white shadow-[0_10px_20px_rgba(229,9,20,0.3)] scale-105"
                                              : "bg-[#1A1A1F] border-[#F5F5F7]/10 text-[#9CA3AF] hover:border-[#E50914]/50 hover:text-white hover:-translate-y-1"
                                      }`}
                                  >
                          <span className="text-[10px] sm:text-xs uppercase font-medium tracking-wider mb-1 opacity-80">
                            {format(date, "LLL", { locale: ru })}
                          </span>
                                    <span className="text-lg sm:text-2xl font-heading tracking-wide text-white">{format(date, "dd")}</span>
                                    <span className="text-[10px] sm:text-xs font-medium opacity-80 mt-1">{format(date, "EEE", { locale: ru })}</span>
                                    {hasSessions && !isSelected && (
                                        <span className="absolute bottom-2 w-1.5 h-1.5 rounded-full bg-[#E50914]" />
                                    )}
                                  </button>
                              );
                            })}
                          </div>

                          {/* Сеансы выбранного дня */}
                          {rowsForSelectedDate.length === 0 ? (
                              <Card className="bg-[#1A1A1F] border-[#F5F5F7]/10 p-8 text-center">
                                <CalendarClock className="w-8 h-8 text-[#9CA3AF] mx-auto mb-3 opacity-50" />
                                <p className="text-white">На этот день сеансов нет</p>
                                <p className="text-[#9CA3AF] text-sm mt-1">Выберите другую дату</p>
                              </Card>
                          ) : (
                              <section className="space-y-3">
                                <div className="flex items-center gap-3">
                                  <h2 className="text-lg font-heading uppercase tracking-wide text-white whitespace-nowrap">
                                    {formatSessionDayTitle(rowsForSelectedDate[0].startTime)}
                                  </h2>
                                  <div className="h-px flex-1 bg-gradient-to-r from-[#E50914]/55 to-[#F5F5F7]/5" />
                                  <span className="text-[#9CA3AF] text-sm shrink-0">{rowsForSelectedDate.length} сеанс(а)</span>
                                </div>
                                {renderSessionCards(rowsForSelectedDate)}
                              </section>
                          )}
                        </>
                    )}
                  </div>
              )
          )}
        </div>
      </div>
  );
}