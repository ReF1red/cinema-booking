import React, { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { Armchair, ChevronLeft } from "lucide-react";
import { useApp } from "../../context/AppContext";
import {
  fetchCinemasByCity,
  fetchCities,
  fetchHallById,
  fetchMovies,
  fetchSeatsByHall,
  fetchSessionById,
  getErrorMessage,
} from "../../lib/api";
import { formatFullDate, formatRubles, formatTime, getMoviePoster } from "../../lib/formatters";
import type { Cinema, Hall, Movie, Seat, Session } from "../../lib/types";
import { Button } from "./ui/button";

function isSessionStarted(startTime: string): boolean {
  const parsed = new Date(startTime).getTime();
  if (Number.isNaN(parsed)) {
    return false;
  }
  return parsed <= Date.now();
}

export function SeatMap() {
  const { user } = useApp();
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<Session | null>(null);
  const [hall, setHall] = useState<Hall | null>(null);
  const [movie, setMovie] = useState<Movie | null>(null);
  const [cinema, setCinema] = useState<Cinema | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [selectedSeatIds, setSelectedSeatIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sessionIdNumber = Number(sessionId);

  useEffect(() => {
    if (!sessionIdNumber) {
      setError("Некорректный идентификатор сеанса.");
      setLoading(false);
      return;
    }

    let isMounted = true;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [sessionData, movies] = await Promise.all([
          fetchSessionById(sessionIdNumber),
          fetchMovies(),
        ]);

        if (isSessionStarted(sessionData.start_time)) {
          throw new Error("Сеанс уже начался. Выберите другой сеанс.");
        }

        const hallData = await fetchHallById(sessionData.hall_id);
        const seatsData = await fetchSeatsByHall(hallData.hall_id, sessionIdNumber);

        const cities = await fetchCities();
        const cinemaGroups = await Promise.all(cities.map((city) => fetchCinemasByCity(city.city_id)));
        const allCinemas = cinemaGroups.flat();
        const matchedCinema = allCinemas.find((item) => item.cinema_id === hallData.cinema_id) ?? null;
        const matchedMovie = movies.find((item) => item.movie_id === sessionData.movie_id) ?? null;

        if (!isMounted) {
          return;
        }

        setSession(sessionData);
        setHall(hallData);
        setSeats(seatsData);
        setCinema(matchedCinema);
        setMovie(matchedMovie);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }
        setError(getErrorMessage(loadError, "Не удалось загрузить схему зала."));
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [sessionIdNumber]);

  const seatsByRow = useMemo(() => {
    const grouped: Record<string, Seat[]> = {};

    seats.forEach((seat) => {
      if (!grouped[seat.row_letter]) {
        grouped[seat.row_letter] = [];
      }
      grouped[seat.row_letter].push(seat);
    });

    return Object.entries(grouped)
        .sort(([rowA], [rowB]) => rowA.localeCompare(rowB))
        .map(([row, rowSeats]) => ({
          row,
          seats: rowSeats.sort((a, b) => a.seat_number - b.seat_number),
        }));
  }, [seats]);

  const selectedSeatLabels = useMemo(() => {
    const selectedSet = new Set(selectedSeatIds);
    return seats
        .filter((seat) => selectedSet.has(seat.seat_id))
        .sort((a, b) => a.row_letter.localeCompare(b.row_letter) || a.seat_number - b.seat_number)
        .map((seat) => `${seat.row_letter}${seat.seat_number}`);
  }, [seats, selectedSeatIds]);

  const isGuest = user?.role === "guest";

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return <div className="p-8 text-center text-[#9CA3AF]">Загружаем схему зала...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-400">{error}</div>;
  }

  if (!session || !movie || !cinema || !hall) {
    return <div className="p-8 text-center text-white">Сеанс не найден</div>;
  }

  const ticketPrice = Math.round(session.price);
  const totalPrice = selectedSeatIds.length * ticketPrice;
  const formattedDate = formatFullDate(session.start_time);

  const toggleSeat = (seat: Seat) => {
    if (isGuest) return;
    if (seat.is_booked) {
      return;
    }
    setSelectedSeatIds((prev) =>
        prev.includes(seat.seat_id) ? prev.filter((id) => id !== seat.seat_id) : [...prev, seat.seat_id],
    );
  };

  const handleProceed = (mode: "buy" | "book") => {
    if (isGuest) return;
    if (selectedSeatIds.length === 0) {
      return;
    }

    if (mode === "book" && selectedSeatIds.length > 4) {
      setError("Нельзя забронировать более 4 мест за раз.");
      return;
    }

    navigate("/checkout", {
      state: {
        sessionId: session.session_id,
        selectedSeatIds,
        selectedSeatLabels,
        totalPrice,
        mode,
      },
    });
  };

  return (
      <div className="flex-1 flex flex-col md:flex-row bg-[#0B0B0D] min-h-[calc(100vh-64px)] overflow-hidden">
        <div className="hidden md:flex w-[520px] bg-[#1A1A1F] border-r border-[#F5F5F7]/10 flex-col shrink-0 overflow-y-auto">
          <div className="p-8 space-y-8 flex-1">
            <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-[#9CA3AF] hover:text-white transition-colors mb-4">
              <ChevronLeft className="w-5 h-5" /> Назад к сеансам
            </button>

            <div className="space-y-4">
              <div className="w-24 h-36 rounded-lg overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-[#F5F5F7]/10 mb-4 mx-auto md:mx-0">
                <img src={getMoviePoster(movie)} alt={movie.title} className="w-full h-full object-cover" />
              </div>
              <h2 className="text-3xl font-heading text-white uppercase tracking-wider leading-tight">{movie.title}</h2>
              <div className="text-[#9CA3AF] space-y-2 text-sm">
                <p className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-[#E50914] flex items-center justify-center text-[8px] text-white">К</span>
                  {cinema.cinema_name}
                </p>
                <p className="flex items-center gap-2 text-[#F5F5F7] font-medium">
                  {formattedDate} • {formatTime(session.start_time)}
                </p>
                <p>Зал: {hall.hall_name}</p>
              </div>
            </div>

            <div className="bg-[#0B0B0D] p-6 rounded-xl border border-[#F5F5F7]/10">
              <h3 className="text-lg font-heading text-[#FFC857] uppercase tracking-widest mb-4">Ваш заказ</h3>

              <div className="flex justify-between text-[#9CA3AF] mb-2 text-sm">
                <span>Места</span>
                <span className="text-white font-medium">{selectedSeatLabels.length > 0 ? selectedSeatLabels.join(", ") : "-"}</span>
              </div>

              <div className="flex justify-between text-[#9CA3AF] mb-4 text-sm">
                <span>Цена билета</span>
                <span className="text-white font-medium">{formatRubles(ticketPrice)} / шт</span>
              </div>

              <div className="pt-4 border-t border-[#F5F5F7]/10 flex justify-between items-center">
                <span className="text-white font-medium">Итого</span>
                <span className="text-2xl font-heading text-[#E50914] tracking-wider">{formatRubles(totalPrice)}</span>
              </div>
            </div>
          </div>

          {isGuest ? (
              <div className="p-6 border-t border-[#F5F5F7]/10 bg-[#0B0B0D]/50 text-center">
                <p className="text-[#9CA3AF] mb-3">Для бронирования или покупки билетов необходимо войти.</p>
                <Link to="/">
                  <Button variant="default" className="w-full">Войти или зарегистрироваться</Button>
                </Link>
              </div>
          ) : (
              <div className="p-6 border-t border-[#F5F5F7]/10 bg-[#0B0B0D]/50 backdrop-blur-md space-y-3">
                <Button
                    className="w-full py-6 text-lg font-heading tracking-widest uppercase transition-all duration-300 disabled:opacity-50 group relative overflow-hidden"
                    disabled={selectedSeatIds.length === 0}
                    onClick={() => handleProceed("buy")}
                >
                  <span className="relative z-10">К оплате</span>
                  <div className="absolute inset-0 bg-white/20 translate-y-[100%] group-hover:translate-y-[0%] transition-transform duration-300 ease-out" />
                </Button>
                <Button
                    variant="outline"
                    className="w-full py-5 text-base font-heading tracking-widest uppercase border-[#FFC857]/40 text-[#FFC857] hover:bg-[#FFC857]/10 hover:border-[#FFC857] transition-all duration-300 disabled:opacity-50"
                    disabled={selectedSeatIds.length === 0}
                    onClick={() => handleProceed("book")}
                >
                  Забронировать
                </Button>
              </div>
          )}
        </div>

        <div className="flex-1 flex flex-col overflow-y-auto relative">
          <div className="flex-1 flex flex-col items-center justify-center p-8 lg:p-16 min-h-[600px]">
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-3xl mb-12">
              <div className="h-4 w-full bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-full opacity-50 shadow-[0_20px_50px_rgba(255,255,255,0.2)] mb-8 transform -skew-x-12" />
              <div className="text-center w-full uppercase tracking-[1em] text-[#9CA3AF] text-sm font-heading mb-16 opacity-50 shadow-inner rounded-xl py-2 bg-gradient-to-b from-[#1A1A1F] to-transparent">
                Экран
              </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col gap-4 mx-auto bg-[#1A1A1F]/30 p-8 rounded-3xl border border-[#F5F5F7]/5 shadow-2xl backdrop-blur-sm"
            >
              {seatsByRow.map((row) => (
                  <div key={row.row} className="flex items-center gap-4 justify-center">
                    <span className="w-8 text-center text-[#9CA3AF] font-heading text-lg shrink-0">{row.row}</span>
                    <div className="flex gap-2">
                      {row.seats.map((seat) => {
                        const isSelected = selectedSeatIds.includes(seat.seat_id);
                        const isBooked = seat.is_booked;
                        return (
                            <button
                                key={seat.seat_id}
                                disabled={isBooked || isGuest}
                                onClick={() => toggleSeat(seat)}
                                className={`
                          w-8 h-8 md:w-10 md:h-10 rounded-t-lg rounded-b-sm flex items-center justify-center transition-all duration-300 relative group
                          ${
                                    isBooked
                                        ? "bg-[#232329] border border-[#F5F5F7]/5 cursor-not-allowed opacity-50"
                                        : isSelected && !isGuest
                                            ? "bg-[#E50914] shadow-[0_0_15px_rgba(229,9,20,0.6)] border border-[#E50914] scale-110"
                                            : "bg-[#1A1A1F] border border-[#F5F5F7]/20 hover:border-[#FFC857] hover:bg-[#1A1A1F]/80 hover:scale-105"
                                }
                        `}
                            >
                              <Armchair
                                  className={`w-5 h-5 md:w-6 md:h-6 ${
                                      isBooked
                                          ? "text-[#0B0B0D]"
                                          : isSelected && !isGuest
                                              ? "text-white"
                                              : "text-[#9CA3AF] group-hover:text-[#FFC857]"
                                  }`}
                              />
                              {!isBooked && !isGuest && (
                                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-[#0B0B0D] text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-[#F5F5F7]/10 z-20">
                                    Место {seat.row_letter}{seat.seat_number}
                                  </div>
                              )}
                            </button>
                        );
                      })}
                    </div>
                  </div>
              ))}

              {seatsByRow.length > 0 && (
                  <div className="flex items-center gap-4 justify-center mt-1">
                    <span className="w-8 shrink-0" />
                    <div className="flex gap-2">
                      {seatsByRow[seatsByRow.length - 1].seats.map((seat) => (
                          <div
                              key={seat.seat_id}
                              className="w-8 md:w-10 text-center text-[#9CA3AF] font-heading text-lg"
                          >
                            {seat.seat_number}
                          </div>
                      ))}
                    </div>
                  </div>
              )}
            </motion.div>

            <div className="flex gap-8 mt-16 text-sm text-[#9CA3AF] bg-[#1A1A1F] px-8 py-4 rounded-full border border-[#F5F5F7]/10 shadow-lg backdrop-blur-md">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-[#1A1A1F] border border-[#F5F5F7]/20 flex items-center justify-center">
                  <Armchair className="w-4 h-4 text-[#9CA3AF]" />
                </div>
                <span>Свободно</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-[#E50914] shadow-[0_0_10px_rgba(229,9,20,0.4)] flex items-center justify-center">
                  <Armchair className="w-4 h-4 text-white" />
                </div>
                <span className="text-white">Выбрано</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-[#232329] border border-[#F5F5F7]/5 flex items-center justify-center opacity-50">
                  <Armchair className="w-4 h-4 text-[#0B0B0D]" />
                </div>
                <span>Занято</span>
              </div>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {!isGuest && selectedSeatIds.length > 0 && (
              <motion.div
                  initial={{ y: 100 }}
                  animate={{ y: 0 }}
                  exit={{ y: 100 }}
                  className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0B0B0D]/90 backdrop-blur-xl border-t border-[#F5F5F7]/10 p-4 pb-safe z-50 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-[#9CA3AF] text-xs uppercase tracking-wider mb-1">{selectedSeatIds.length} мест(а)</p>
                    <p className="text-2xl font-heading text-white">{formatRubles(totalPrice)}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button
                      onClick={() => handleProceed("book")}
                      variant="outline"
                      className="flex-1 font-heading tracking-widest uppercase border-[#FFC857]/40 text-[#FFC857] hover:bg-[#FFC857]/10"
                  >
                    Забронировать
                  </Button>
                  <Button
                      onClick={() => handleProceed("buy")}
                      className="flex-1 font-heading tracking-widest uppercase"
                  >
                    Оплатить
                  </Button>
                </div>
              </motion.div>
          )}
        </AnimatePresence>
      </div>
  );
}