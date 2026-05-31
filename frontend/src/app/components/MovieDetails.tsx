import React, { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowLeft, Clock, Star, Ticket } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { fetchMovieById, getErrorMessage } from "../../lib/api";
import { formatDuration, getMovieAgeLabel, getMovieBackdrop, getMoviePoster } from "../../lib/formatters";
import type { Movie } from "../../lib/types";
import { Button } from "./ui/button";

function formatBudget(amount?: number | null, currency?: string | null): string {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return "Не указан";
  }

  const normalizedCurrency = (currency || "RUB").toUpperCase();
  try {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: normalizedCurrency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(amount)} ${normalizedCurrency}`;
  }
}

export function MovieDetails() {
  const { user } = useApp();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isGuest = user?.role === "guest";

  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const movieId = Number(id);
    if (!movieId) {
      setLoading(false);
      setError("Некорректный id фильма.");
      return;
    }

    let isMounted = true;

    const loadMovie = async () => {
      setLoading(true);
      setError(null);
      try {
        const currentMovie = await fetchMovieById(movieId);
        if (!isMounted) {
          return;
        }
        setMovie(currentMovie ?? null);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }
        setError(getErrorMessage(loadError, "Не удалось загрузить информацию о фильме."));
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadMovie();

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return <div className="p-8 text-center text-[#9CA3AF]">Загружаем фильм...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-400">{error}</div>;
  }

  if (!movie) {
    return <div className="p-8 text-center text-white">Фильм не найден</div>;
  }

  const ratingText =
      typeof movie.rating === "number" && Number.isFinite(movie.rating)
          ? movie.rating.toFixed(1)
          : "—";
  const actors = Array.isArray(movie.main_actors)
      ? movie.main_actors.map((actor) => actor.trim()).filter((actor) => actor.length > 0)
      : [];
  const budgetText = formatBudget(movie.budget_amount, movie.budget_currency);
  const ageLabel = getMovieAgeLabel(movie);

  return (
      <div className="flex-1 relative bg-[#0B0B0D]">
        <div className="absolute top-0 left-0 w-full h-[70vh] md:h-[80vh] overflow-hidden">
          <img
              src={getMovieBackdrop(movie)}
              alt={movie.title}
              className="w-full h-full object-cover opacity-40 scale-105 transform translate-y-[-5%] transition-transform duration-[20s] ease-linear hover:translate-y-[-10%]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0D] via-[#0B0B0D]/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0B0B0D] via-[#0B0B0D]/50 to-transparent" />
        </div>

        <div className="relative z-10 container mx-auto px-4 pt-8 lg:pt-16 pb-24">
          <motion.button
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-[#9CA3AF] hover:text-white transition-colors mb-8 bg-[#1A1A1F]/50 backdrop-blur-md px-4 py-2 rounded-full w-fit border border-[#F5F5F7]/10"
          >
            <ArrowLeft className="w-4 h-4" /> К фильмам
          </motion.button>

          <div className="flex flex-col md:flex-row gap-12 lg:gap-16 mt-8 lg:mt-24">
            <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="w-[280px] md:w-[350px] shrink-0 mx-auto md:mx-0"
            >
              <div className="relative rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-[#F5F5F7]/10">
                <img
                    src={getMoviePoster(movie)}
                    alt={movie.title}
                    className="w-full h-auto object-cover"
                />
              </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="flex-1 space-y-8"
            >
              <div>
                <div className="flex flex-wrap items-center gap-3 mb-4 text-[#FFC857] text-sm font-semibold uppercase tracking-widest">
                <span className="flex items-center gap-1 bg-[#FFC857]/10 px-3 py-1 rounded-full border border-[#FFC857]/20">
                  <Star className="w-4 h-4 fill-[#FFC857]" /> {ratingText === "—" ? "Без рейтинга" : `${ratingText} Оценка`}
                </span>
                  <span className="flex items-center gap-1 bg-[#1A1A1F]/80 px-3 py-1 rounded-full border border-[#F5F5F7]/10 text-[#F5F5F7]">
                  <Clock className="w-4 h-4" /> {formatDuration(movie.duration_min)}
                </span>
                  <span className="bg-[#1A1A1F]/80 px-3 py-1 rounded-full border border-[#F5F5F7]/10 text-[#F5F5F7]">
                  {ageLabel}
                </span>
                </div>

                <h1 className="text-5xl md:text-7xl font-heading text-white tracking-wide uppercase leading-none drop-shadow-2xl">
                  {movie.title}
                </h1>
                <p className="text-xl text-[#9CA3AF] mt-4 max-w-2xl font-light leading-relaxed">
                  {movie.description || "Описание фильма пока не добавлено."}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-6 border-y border-[#F5F5F7]/10">
                <div className="md:col-span-2">
                  <p className="text-sm text-[#9CA3AF] mb-1 font-medium uppercase tracking-widest">Жанр</p>
                  <p className="text-white text-lg">{movie.genre || "Жанр не указан"}</p>
                </div>
                <div>
                  <p className="text-sm text-[#9CA3AF] mb-1 font-medium uppercase tracking-widest">Год выпуска</p>
                  <p className="text-white text-lg">{movie.release_year ?? "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-[#9CA3AF] mb-1 font-medium uppercase tracking-widest">Длительность</p>
                  <p className="text-white text-lg">{formatDuration(movie.duration_min)}</p>
                </div>
                <div>
                  <p className="text-sm text-[#9CA3AF] mb-1 font-medium uppercase tracking-widest">Рейтинг</p>
                  <p className="text-white text-lg">{ratingText === "—" ? "Не указан" : `${ratingText} / 10`}</p>
                </div>
                <div>
                  <p className="text-sm text-[#9CA3AF] mb-1 font-medium uppercase tracking-widest">Возраст</p>
                  <p className="text-white text-lg">{ageLabel}</p>
                </div>
              </div>

              <div className="space-y-3 text-white text-lg">
                <p>Режиссер: {movie.director?.trim() || "Не указан"}</p>
                <p>Сценарист: {movie.writer?.trim() || "Не указан"}</p>
                <p>Страна: {movie.country?.trim() || "Не указана"}</p>
                <p>В главных ролях: {actors.length > 0 ? actors.join(", ") : "Не указаны"}</p>
                <p>Бюджет: {budgetText}</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                {isGuest ? (
                    <Button
                        size="lg"
                        variant="outline"
                        className="w-full sm:w-auto text-xl font-heading tracking-widest px-12 h-16"
                        onClick={() => {
                          localStorage.clear();
                          window.location.href = "/";
                      }}
                    >
                      <Ticket className="w-6 h-6 mr-2" /> Войти, чтобы купить
                    </Button>
                ) : (
                    <Button
                        size="lg"
                        className="w-full sm:w-auto text-xl font-heading tracking-widest px-12 h-16 group relative overflow-hidden"
                        onClick={() => navigate(`/sessions/${movie.movie_id}`)}
                    >
                    <span className="relative z-10 flex items-center gap-3">
                      <Ticket className="w-6 h-6" /> Купить билет
                    </span>
                      <div className="absolute inset-0 bg-white/20 translate-y-[100%] group-hover:translate-y-[0%] transition-transform duration-300 ease-out" />
                    </Button>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
  );
}