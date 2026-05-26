import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { Calendar, CheckCircle2, Clock, CreditCard, Loader2, MapPin, Ticket, XCircle } from "lucide-react";
import { useApp } from "../../context/AppContext";
import {
  cancelMultipleBookings,
  fetchCinemasByCity,
  fetchCities,
  fetchHallById,
  fetchMovies,
  fetchSessionById,
  getErrorMessage,
  payMultipleBookings,
} from "../../lib/api";
import { formatFullDate, formatRubles, formatTime, getMoviePoster } from "../../lib/formatters";
import type { Booking, Cinema, Hall, Movie, Session } from "../../lib/types";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

interface BookingGroup {
  groupKey: string;
  sessionId: number;
  bookingIds: number[];
  seatLabels: string[];
  totalPrice: number;
  bookingTime: string;
  paid: boolean;
}

function hasSessionStarted(startTime?: string): boolean {
  if (!startTime) return false;
  const parsed = new Date(startTime).getTime();
  if (Number.isNaN(parsed)) return false;
  return parsed <= Date.now();
}

function hasSessionPassed(startTime?: string): boolean {
  return hasSessionStarted(startTime);
}

function isLessThanHourBefore(startTime?: string): boolean {
  if (!startTime) return false;
  const parsed = new Date(startTime).getTime();
  if (Number.isNaN(parsed)) return false;
  return parsed - Date.now() < 60 * 60 * 1000;
}

function groupBookings(bookings: Booking[]): BookingGroup[] {
  const groups = new Map<string, BookingGroup>();

  for (const booking of bookings) {
    if (booking.status === "cancelled") continue;

    const minuteKey = booking.booking_time.slice(0, 16);
    const isPaid = booking.is_paid;
    const groupKey = `${booking.session_id}__${minuteKey}__${isPaid}`;

    const seatLabel = booking.seat
        ? `${booking.seat.row_letter}${booking.seat.seat_number}`
        : "—";

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        groupKey,
        sessionId: booking.session_id,
        bookingIds: [booking.booking_id],
        seatLabels: [seatLabel],
        totalPrice: booking.total_price,
        bookingTime: booking.booking_time,
        paid: isPaid,
      });
    } else {
      const group = groups.get(groupKey)!;
      group.bookingIds.push(booking.booking_id);
      group.seatLabels.push(seatLabel);
      group.totalPrice += booking.total_price;
      group.paid = group.paid && isPaid;
    }
  }

  return Array.from(groups.values()).sort((a, b) =>
      b.bookingTime.localeCompare(a.bookingTime),
  );
}

export function MyBookings() {
  const { user, bookings, refreshBookings } = useApp();
  const navigate = useNavigate();

  if (user?.role === "guest") {
    return <Navigate to="/" replace />;
  }

  const [movieMap, setMovieMap] = useState<Record<number, Movie>>({});
  const [sessionMap, setSessionMap] = useState<Record<number, Session>>({});
  const [hallMap, setHallMap] = useState<Record<number, Hall>>({});
  const [cinemaMap, setCinemaMap] = useState<Record<number, Cinema>>({});
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancellingKey, setCancellingKey] = useState<string | null>(null);
  const [payingKey, setPayingKey] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role !== "guest") {
      refreshBookings();
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadMaps = async () => {
      if (bookings.length === 0) {
        setSessionMap({});
        setHallMap({});
        setError(null);
        return;
      }

      setLoadingDetails(true);
      setError(null);

      try {
        const movies = await fetchMovies();
        const nextMovieMap: Record<number, Movie> = {};
        movies.forEach((m) => { nextMovieMap[m.movie_id] = m; });

        const uniqueSessionIds = Array.from(new Set(bookings.map((b) => b.session_id)));
        const sessionResults = await Promise.allSettled(uniqueSessionIds.map(fetchSessionById));
        const sessions = sessionResults
            .filter((r): r is PromiseFulfilledResult<Session> => r.status === "fulfilled")
            .map((r) => r.value);
        const nextSessionMap: Record<number, Session> = {};
        sessions.forEach((s) => { nextSessionMap[s.session_id] = s; });

        const uniqueHallIds = Array.from(new Set(sessions.map((s) => s.hall_id)));
        const hallResults = await Promise.allSettled(uniqueHallIds.map(fetchHallById));
        const halls = hallResults
            .filter((r): r is PromiseFulfilledResult<Hall> => r.status === "fulfilled")
            .map((r) => r.value);
        const nextHallMap: Record<number, Hall> = {};
        halls.forEach((h) => { nextHallMap[h.hall_id] = h; });

        const cities = await fetchCities();
        const cinemaGroups = await Promise.all(cities.map((c) => fetchCinemasByCity(c.city_id)));
        const nextCinemaMap: Record<number, Cinema> = {};
        cinemaGroups.flat().forEach((c) => { nextCinemaMap[c.cinema_id] = c; });

        if (!isMounted) return;
        setMovieMap(nextMovieMap);
        setSessionMap(nextSessionMap);
        setHallMap(nextHallMap);
        setCinemaMap(nextCinemaMap);
      } catch (loadError) {
        if (isMounted) setError(getErrorMessage(loadError, "Не удалось загрузить детали бронирований."));
      } finally {
        if (isMounted) setLoadingDetails(false);
      }
    };

    loadMaps();
    return () => { isMounted = false; };
  }, [bookings]);

  const allGroups = useMemo(() => groupBookings(bookings), [bookings]);

  const activeGroups = useMemo(() => {
    return allGroups.filter((group) => {
      const session = sessionMap[group.sessionId];
      if (!session) return true;
      return !hasSessionPassed(session.start_time);
    });
  }, [allGroups, sessionMap]);

  const unpaidGroups = useMemo(() => activeGroups.filter((g) => !g.paid), [activeGroups]);
  const paidGroups = useMemo(() => activeGroups.filter((g) => g.paid), [activeGroups]);

  if (!user) return <Navigate to="/" replace />;

  const handleCancelGroup = async (group: BookingGroup) => {
    setCancellingKey(group.groupKey);
    setError(null);
    try {
      await cancelMultipleBookings(group.bookingIds);
      await new Promise((resolve) => setTimeout(resolve, 300));
      await refreshBookings();
    } catch (e) {
      setError(getErrorMessage(e, "Не удалось отменить бронь."));
    } finally {
      setCancellingKey(null);
    }
  };

  const handlePayGroup = (group: BookingGroup) => {
    const session = sessionMap[group.sessionId];
    navigate("/checkout", {
      state: {
        sessionId: group.sessionId,
        selectedSeatIds: [],
        selectedSeatLabels: group.seatLabels,
        totalPrice: group.totalPrice,
        mode: "buy",
        existingBookingIds: group.bookingIds,
      },
    });
  };

  const renderGroup = (group: BookingGroup, index: number, paid: boolean) => {
    const session = sessionMap[group.sessionId];
    const hall = session ? hallMap[session.hall_id] : undefined;
    const cinema = hall ? cinemaMap[hall.cinema_id] : undefined;
    const movie = session ? movieMap[session.movie_id] : undefined;

    const sessionStarted = hasSessionStarted(session?.start_time);
    const lessThanHour = isLessThanHourBefore(session?.start_time);

    const canCancel = !paid;
    const canPay = !paid && !sessionStarted;

    const cancelTooltip = paid && lessThanHour
        ? "Нельзя отменить оплаченный билет менее чем за час до сеанса"
        : undefined;

    return (
        <motion.div
            key={group.groupKey}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ delay: index * 0.05 }}
        >
          <Card className="bg-[#1A1A1F] border-[#F5F5F7]/10 overflow-hidden flex flex-col md:flex-row shadow-2xl relative group">
            <div className="absolute right-0 top-0 bottom-0 w-8 flex flex-col justify-between py-4 translate-x-1/2 opacity-20 pointer-events-none hidden md:flex">
              {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="w-4 h-4 rounded-full bg-[#0B0B0D]" />
              ))}
            </div>

            <div className="w-full md:w-48 h-64 md:h-auto shrink-0 relative overflow-hidden bg-black">
              <img
                  src={movie ? getMoviePoster(movie) : undefined}
                  alt={movie?.title || "Фильм"}
                  className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A1F] via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:via-transparent md:to-[#1A1A1F]" />
              {paid && (
                  <div className="absolute top-3 left-3 bg-emerald-500/90 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-white" />
                    <span className="text-white text-[10px] font-semibold uppercase tracking-wider">Оплачено</span>
                  </div>
              )}
            </div>

            <div className="flex-1 p-6 md:p-8 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-[#FFC857] text-xs font-mono mb-2 tracking-widest">
                    #{group.bookingIds.join(", #")}
                  </p>
                  <h2 className="text-3xl font-heading text-white uppercase tracking-wider">{movie?.title || "Фильм"}</h2>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border ${
                    paid
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                        : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                }`}>
                {paid ? "Оплачено" : "Ожидает оплаты"}
              </span>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-8 text-sm">
                <div>
                  <p className="text-[#9CA3AF] mb-1 uppercase tracking-widest text-xs">Дата и время</p>
                  <p className="text-white font-medium flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> {session ? formatFullDate(session.start_time) : "—"}
                  </p>
                  <p className="text-white font-medium flex items-center gap-2 mt-1">
                    <Clock className="w-4 h-4" /> {session ? formatTime(session.start_time) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[#9CA3AF] mb-1 uppercase tracking-widest text-xs">Кинотеатр</p>
                  <p className="text-white font-medium flex items-center gap-2">
                    <MapPin className="w-4 h-4 shrink-0" /> {cinema?.cinema_name ?? "—"}
                  </p>
                  <p className="text-[#9CA3AF] text-xs mt-1">{hall?.hall_name ? `Зал: ${hall.hall_name}` : ""}</p>
                </div>
                <div>
                  <p className="text-[#9CA3AF] mb-1 uppercase tracking-widest text-xs">
                    {group.seatLabels.length > 1 ? "Места" : "Место"}
                  </p>
                  <p className="text-white font-medium text-lg">{group.seatLabels.join(", ") || "—"}</p>
                </div>
                <div>
                  <p className="text-[#9CA3AF] mb-1 uppercase tracking-widest text-xs">Сумма</p>
                  <p className="text-[#E50914] font-heading text-2xl tracking-wider">{formatRubles(group.totalPrice)}</p>
                </div>
              </div>

              <div className="mt-auto pt-6 border-t border-[#F5F5F7]/10 flex gap-3 justify-end flex-wrap">
                {canPay && (
                    <Button
                        className="bg-[#FFC857] hover:bg-[#FFC857]/90 text-black font-heading tracking-wide uppercase"
                        onClick={() => handlePayGroup(group)}
                        disabled={payingKey === group.groupKey}
                    >
                      {payingKey === group.groupKey ? (
                          <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Оплата...</span>
                      ) : (
                          <span className="flex items-center gap-2"><CreditCard className="w-4 h-4" /> Оплатить</span>
                      )}
                    </Button>
                )}
                {canCancel ? (
                    <Button
                        variant="destructive"
                        className="bg-transparent border border-red-500/50 text-red-500 hover:bg-red-500/10 font-heading tracking-wide uppercase"
                        onClick={() => handleCancelGroup(group)}
                        disabled={cancellingKey === group.groupKey}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      {cancellingKey === group.groupKey ? "Отмена..." : "Отменить"}
                    </Button>
                ) : paid && lessThanHour && !sessionStarted ? (
                    <span className="text-xs text-[#9CA3AF] self-center" title={cancelTooltip}>
                  Отмена недоступна
                </span>
                ) : null}
                {paid && (
                    <a
                        href={`/api/booking/ticket?booking_ids=${group.bookingIds.join(",")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] border border-[#F5F5F7]/20 bg-transparent hover:bg-[#F5F5F7]/10 text-[#F5F5F7] font-heading tracking-wide uppercase h-11 px-6 py-2"
                    >
                        Скачать PDF
                    </a>
                )}
              </div>
            </div>
          </Card>
        </motion.div>
    );
  };

  return (
      <div className="flex-1 container mx-auto px-4 py-8 lg:py-16">
        <div className="max-w-4xl mx-auto space-y-12">
          <header className="flex flex-col md:flex-row items-center justify-between gap-6 border-b border-[#F5F5F7]/10 pb-8">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
              <h1 className="text-4xl md:text-5xl font-heading text-white uppercase tracking-wide flex items-center gap-4">
                <Ticket className="w-10 h-10 text-[#E50914]" /> Мои билеты
              </h1>
              <p className="text-[#9CA3AF] text-lg mt-2">Управляйте вашими походами в кино</p>
            </motion.div>
          </header>

          {error && (
              <Card className="bg-red-500/10 border-red-500/40 p-4">
                <p className="text-red-300">{error}</p>
              </Card>
          )}

          {loadingDetails && bookings.length > 0 && (
              <p className="text-[#9CA3AF]">Загружаем детали бронирований...</p>
          )}

          {bookings.filter((b) => b.status !== "cancelled").length === 0 ? (
              <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-[#1A1A1F] border border-[#F5F5F7]/10 rounded-2xl p-16 text-center shadow-2xl"
              >
                <div className="w-24 h-24 rounded-full bg-[#232329] flex items-center justify-center mx-auto mb-6">
                  <Ticket className="w-10 h-10 text-[#9CA3AF]" />
                </div>
                <p className="text-2xl text-white font-heading tracking-widest uppercase mb-4">Пока нет билетов</p>
                <p className="text-[#9CA3AF] mb-8 max-w-md mx-auto">
                  Вы ещё не забронировали ни одного билета. Выберите фильм и начните ваше приключение.
                </p>
                <Button onClick={() => navigate("/home")} className="px-8 font-heading tracking-widest uppercase">
                  Выбрать фильм
                </Button>
              </motion.div>
          ) : (
              <div className="space-y-16">
                {unpaidGroups.length > 0 && (
                    <section>
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-2 h-6 rounded-full bg-[#FFC857]" />
                        <h2 className="text-2xl font-heading text-white uppercase tracking-widest">Забронировано</h2>
                        <span className="ml-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs font-semibold">
                    {unpaidGroups.length}
                  </span>
                      </div>
                      <div className="space-y-6">
                        <AnimatePresence mode="popLayout">
                          {unpaidGroups.map((g, i) => renderGroup(g, i, false))}
                        </AnimatePresence>
                      </div>
                    </section>
                )}

                {paidGroups.length > 0 && (
                    <section>
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-2 h-6 rounded-full bg-emerald-500" />
                        <h2 className="text-2xl font-heading text-white uppercase tracking-widest">Оплачено</h2>
                        <span className="ml-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-semibold">
                    {paidGroups.length}
                  </span>
                      </div>
                      <div className="space-y-6">
                        <AnimatePresence mode="popLayout">
                          {paidGroups.map((g, i) => renderGroup(g, i, true))}
                        </AnimatePresence>
                      </div>
                    </section>
                )}
              </div>
          )}
        </div>
      </div>
  );
}