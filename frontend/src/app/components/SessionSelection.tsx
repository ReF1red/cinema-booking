import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { Calendar, Clock, MapPin, Ticket } from "lucide-react";
import { addDays, format } from "date-fns";
import { ru } from "date-fns/locale";
import { useApp } from "../../context/AppContext";
import {
  fetchCinemasByCity,
  fetchCities,
  fetchHallsByCinema,
  fetchMovies,
  fetchSessionsByMovie,
  getErrorMessage,
} from "../../lib/api";
import { formatRubles, formatTime, getMoviePoster } from "../../lib/formatters";
import type { Cinema, Movie, Session } from "../../lib/types";
import { Card } from "./ui/card";
import { Button } from "./ui/button";

function isSessionStarted(startTime: string): boolean {
  const parsed = new Date(startTime).getTime();
  if (Number.isNaN(parsed)) return false;
  return parsed <= Date.now();
}

function isSessionWithinWeek(startTime: string): boolean {
  const parsed = new Date(startTime).getTime();
  if (Number.isNaN(parsed)) return false;
  return parsed <= addDays(new Date(), 7).getTime();
}

export function SessionSelection() {
  const { user, selectedCity, selectedCinema } = useApp();
  const { movieId } = useParams<{ movieId: string }>();
  const navigate = useNavigate();
  const isGuest = user?.role === "guest";

  const [movie, setMovie] = useState<Movie | null>(null);
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [hallToCinema, setHallToCinema] = useState<Record<number, Cinema>>({});
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const movieIdNumber = Number(movieId);

  const dates = useMemo(
      () => Array.from({ length: 7 }).map((_, i) => addDays(new Date(), i)),
      [],
  );

  useEffect(() => {
    if (!movieIdNumber) {
      setError("Некорректный идентификатор фильма.");
      setLoading(false);
      return;
    }

    let isMounted = true;

    const loadMovieAndSessions = async () => {
      setLoading(true);
      setError(null);
      try {
        const [movies, sessions] = await Promise.all([
          fetchMovies(),
          fetchSessionsByMovie(movieIdNumber, selectedDate),
        ]);

        if (!isMounted) return;

        const currentMovie = movies.find((item) => item.movie_id === movieIdNumber) ?? null;
        setMovie(currentMovie);

        setAllSessions(
            sessions.filter((s) => !isSessionStarted(s.start_time) && isSessionWithinWeek(s.start_time)),
        );
      } catch (loadError) {
        if (!isMounted) return;
        setError(getErrorMessage(loadError, "Не удалось загрузить сеансы."));
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadMovieAndSessions();
    return () => { isMounted = false; };
  }, [movieIdNumber, selectedDate]);

  useEffect(() => {
    let isMounted = true;

    const loadHallMap = async () => {
      try {
        let cinemaList: Cinema[] = [];

        if (selectedCity) {
          cinemaList = await fetchCinemasByCity(selectedCity);
        } else {
          const cities = await fetchCities();
          const cinemaGroups = await Promise.all(cities.map((city) => fetchCinemasByCity(city.city_id)));
          cinemaList = cinemaGroups.flat();
        }

        if (!isMounted) return;

        const hallMap: Record<number, Cinema> = {};
        const hallsByCinema = await Promise.all(
            cinemaList.map(async (cinema) => ({
              cinema,
              halls: await fetchHallsByCinema(cinema.cinema_id),
            })),
        );

        hallsByCinema.forEach(({ cinema, halls }) => {
          halls.forEach((hall) => { hallMap[hall.hall_id] = cinema; });
        });

        if (isMounted) setHallToCinema(hallMap);
      } catch (loadError) {
        if (isMounted) setError(getErrorMessage(loadError, "Не удалось сопоставить сеансы с кинотеатрами."));
      }
    };

    loadHallMap();
    return () => { isMounted = false; };
  }, [selectedCity]);

  const sessionsByCinema = useMemo(() => {
    const grouped = new Map<number, { cinema: Cinema; sessions: Session[] }>();

    allSessions.forEach((session) => {
      const cinema = hallToCinema[session.hall_id];
      if (!cinema) return;
      if (selectedCinema && cinema.cinema_id !== selectedCinema) return;

      if (!grouped.has(cinema.cinema_id)) {
        grouped.set(cinema.cinema_id, { cinema, sessions: [] });
      }
      grouped.get(cinema.cinema_id)!.sessions.push(session);
    });

    return Array.from(grouped.values()).map((entry) => ({
      ...entry,
      sessions: [...entry.sessions].sort((a, b) => a.start_time.localeCompare(b.start_time)),
    }));
  }, [allSessions, hallToCinema, selectedCinema]);

  const daysWithSessions = useMemo(() => {
    const days = new Set<string>();
    if (sessionsByCinema.length > 0) days.add(selectedDate);
    return days;
  }, [sessionsByCinema, selectedDate]);

  if (!user) return <Navigate to="/" replace />;
  if (!movieIdNumber) return <div className="p-8 text-center text-red-400">Некорректный id фильма.</div>;
  if (loading) return <div className="p-8 text-center text-[#9CA3AF]">Загружаем сеансы...</div>;
  if (error) return <div className="p-8 text-center text-red-400">{error}</div>;
  if (!movie) return <div className="p-8 text-center text-white">Фильм не найден</div>;

  const handleSessionClick = (sessionId: number) => {
    if (isGuest) {
      navigate("/");
      return;
    }
    navigate(`/seats/${sessionId}`);
  };

  return (
      <div className="flex-1 container mx-auto px-4 py-8 lg:py-16">
        <div className="max-w-4xl mx-auto space-y-12">
          <header>
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col md:flex-row gap-6 items-start md:items-center"
            >
              <div className="w-24 h-36 rounded-lg overflow-hidden shrink-0 shadow-lg border border-[#F5F5F7]/10">
                <img src={getMoviePoster(movie)} alt={movie.title} className="w-full h-full object-cover" />
              </div>
              <div>
                <h1 className="text-3xl md:text-5xl font-heading text-white uppercase tracking-wide mb-2">{movie.title}</h1>
                <p className="text-[#9CA3AF] text-lg flex items-center gap-2">
                  <Ticket className="w-5 h-5 text-[#E50914]" /> Выберите дату и время
                </p>
              </div>
            </motion.div>
          </header>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="space-y-6">
            <h2 className="text-xl font-heading text-[#FFC857] uppercase tracking-widest border-b border-[#F5F5F7]/10 pb-2 flex items-center gap-2">
              <Calendar className="w-5 h-5" /> 1. Выберите дату
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-4 px-4 sm:mx-0 sm:px-0">
              {dates.map((date) => {
                const dateStr = format(date, "yyyy-MM-dd");
                const isSelected = selectedDate === dateStr;
                const hasSessions = daysWithSessions.has(dateStr);
                return (
                    <button
                        key={dateStr}
                        onClick={() => setSelectedDate(dateStr)}
                        className={`flex-shrink-0 w-20 h-24 rounded-xl flex flex-col items-center justify-center transition-all duration-300 border relative ${
                            isSelected
                                ? "bg-[#E50914] border-[#E50914] text-white shadow-[0_10px_20px_rgba(229,9,20,0.3)] scale-105"
                                : "bg-[#1A1A1F] border-[#F5F5F7]/10 text-[#9CA3AF] hover:border-[#E50914]/50 hover:text-white hover:-translate-y-1"
                        }`}
                    >
                  <span className="text-xs uppercase font-medium tracking-wider mb-1 opacity-80">
                    {format(date, "LLL", { locale: ru })}
                  </span>
                      <span className="text-2xl font-heading tracking-wide text-white">{format(date, "dd")}</span>
                      <span className="text-xs font-medium opacity-80 mt-1">{format(date, "EEE", { locale: ru })}</span>
                      {hasSessions && !isSelected && (
                          <span className="absolute bottom-2 w-1.5 h-1.5 rounded-full bg-[#E50914]" />
                      )}
                    </button>
                );
              })}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="space-y-6">
            <h2 className="text-xl font-heading text-[#FFC857] uppercase tracking-widest border-b border-[#F5F5F7]/10 pb-2 flex items-center gap-2">
              <Clock className="w-5 h-5" /> 2. Выберите время
            </h2>

            <div className="space-y-6">
              <AnimatePresence mode="wait">
                {sessionsByCinema.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-[#1A1A1F] border border-[#F5F5F7]/10 rounded-xl p-12 text-center"
                    >
                      <Clock className="w-12 h-12 text-[#9CA3AF] mx-auto mb-4 opacity-50" />
                      <p className="text-xl text-white font-heading tracking-wide">На эту дату нет сеансов.</p>
                      <p className="text-[#9CA3AF] mt-2">Пожалуйста, выберите другую дату или кинотеатр.</p>
                    </motion.div>
                ) : (
                    sessionsByCinema.map(({ cinema, sessions }, index) => (
                        <motion.div
                            key={cinema.cinema_id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                        >
                          <Card className="bg-[#1A1A1F] border-[#F5F5F7]/10 overflow-hidden">
                            <div className="p-4 md:p-6 border-b border-[#F5F5F7]/10 bg-[#232329]/50 flex items-center gap-3">
                              <MapPin className="w-5 h-5 text-[#E50914]" />
                              <h3 className="text-xl font-semibold text-white">{cinema.cinema_name}</h3>
                            </div>
                            <div className="p-4 md:p-6 flex flex-wrap gap-4">
                              {sessions.map((session) => (
                                  <button
                                      key={session.session_id}
                                      onClick={() => handleSessionClick(session.session_id)}
                                      className={`group relative overflow-hidden bg-[#0B0B0D] border rounded-lg px-6 py-4 transition-all duration-300 ${
                                          isGuest
                                              ? "border-[#F5F5F7]/10 opacity-70 cursor-not-allowed"
                                              : "border-[#F5F5F7]/10 hover:border-[#E50914] hover:shadow-[0_0_20px_rgba(229,9,20,0.2)] hover:-translate-y-1"
                                      }`}
                                  >
                                    <div className="flex flex-col items-center">
                                      <span className={`text-2xl font-heading text-white tracking-widest ${!isGuest && "group-hover:text-[#E50914]"} transition-colors`}>
                                        {formatTime(session.start_time)}
                                      </span>
                                      <span className="text-sm text-[#9CA3AF] mt-1">{formatRubles(session.price)}</span>
                                    </div>
                                    {!isGuest && (
                                        <div className="absolute inset-0 bg-gradient-to-t from-[#E50914]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                                    )}
                                  </button>
                              ))}
                            </div>
                            {isGuest && (
                                <div className="p-4 text-center border-t border-[#F5F5F7]/10 bg-[#0B0B0D]">
                                  <Button
                                      variant="outline"
                                      className="text-sm"
                                      onClick={() => navigate("/")}
                                  >
                                    Войдите, чтобы забронировать место
                                  </Button>
                                </div>
                            )}
                          </Card>
                        </motion.div>
                    ))
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>
  );
}
