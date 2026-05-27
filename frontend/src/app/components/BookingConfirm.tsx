import React, { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { CheckCircle2, Clock, CreditCard, Loader2, Ticket } from "lucide-react";
import { useApp } from "../../context/AppContext";
import {
  buyTicket,
  createBooking,
  fetchCinemasByCity,
  fetchCities,
  fetchHallById,
  fetchMovies,
  fetchSessionById,
  getErrorMessage,
  payMultipleBookings,
} from "../../lib/api";
import { formatFullDate, formatRubles, formatTime, getMoviePoster } from "../../lib/formatters";
import type { Cinema, Movie, Session } from "../../lib/types";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

interface CheckoutState {
  sessionId: number;
  selectedSeatIds: number[];
  selectedSeatLabels: string[];
  totalPrice: number;
  mode?: "buy" | "book";
  existingBookingIds?: number[];
}

function isSessionStarted(startTime: string): boolean {
  const parsed = new Date(startTime).getTime();
  if (Number.isNaN(parsed)) return false;
  return parsed <= Date.now();
}

export function BookingConfirmation() {
  const { user, refreshBookings } = useApp();
  const location = useLocation();
  const navigate = useNavigate();

  // === ЗАЩИТА ОТ ГОСТЯ ===
  if (user?.role === "guest") {
    return <Navigate to="/" replace />;
  }

  const [session, setSession] = useState<Session | null>(null);
  const [movie, setMovie] = useState<Movie | null>(null);
  const [cinema, setCinema] = useState<Cinema | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMode, setSuccessMode] = useState<"buy" | "book">("buy");
  const [error, setError] = useState<string | null>(null);

  const state = location.state as CheckoutState | null;
  const mode = state?.mode ?? "buy";

  useEffect(() => {
    if (!state?.sessionId) { setLoadingDetails(false); return; }
    let isMounted = true;

    const loadOrderDetails = async () => {
      setLoadingDetails(true);
      setError(null);
      try {
        const [sessionData, movies, cities] = await Promise.all([
          fetchSessionById(state.sessionId),
          fetchMovies(),
          fetchCities(),
        ]);
        const hall = await fetchHallById(sessionData.hall_id);
        const cinemaGroups = await Promise.all(cities.map((city) => fetchCinemasByCity(city.city_id)));
        const allCinemas = cinemaGroups.flat();
        if (!isMounted) return;
        setSession(sessionData);
        setMovie(movies.find((item) => item.movie_id === sessionData.movie_id) ?? null);
        setCinema(allCinemas.find((item) => item.cinema_id === hall.cinema_id) ?? null);
      } catch (loadError) {
        if (!isMounted) return;
        setError(getErrorMessage(loadError, "Не удалось загрузить детали бронирования."));
      } finally {
        if (isMounted) setLoadingDetails(false);
      }
    };

    loadOrderDetails();
    return () => { isMounted = false; };
  }, [state?.sessionId]);

  if (!user) return <Navigate to="/" replace />;
  if (!state) return <div className="p-8 text-center text-white">Некорректный сеанс бронирования</div>;

  const handleConfirm = async () => {
    const hasNoSelectedSeats = state.selectedSeatIds.length === 0;
    const hasNoExistingBookings = !state.existingBookingIds || state.existingBookingIds.length === 0;

    if (hasNoSelectedSeats && hasNoExistingBookings) {
      setError("Не выбраны места для бронирования.");
      return;
    }

    setIsProcessing(true);
    setError(null);
    try {
      const latestSession = await fetchSessionById(state.sessionId);
      if (isSessionStarted(latestSession.start_time)) {
        setError("Сеанс уже начался. Выберите другой сеанс.");
        return;
      }

      if (mode === "buy") {
        if (state.existingBookingIds && state.existingBookingIds.length > 0) {
          await payMultipleBookings(state.existingBookingIds);
        } else {
          const boughtBookings = await buyTicket({
            session_id: state.sessionId,
            seats: state.selectedSeatIds,
          });
        }
      } else {
        await createBooking({
          session_id: state.sessionId,
          seats: state.selectedSeatIds,
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
      await refreshBookings();

      setSuccessMode(mode);
      setIsSuccess(true);
      setTimeout(() => { navigate("/bookings"); }, 1800);
    } catch (confirmError) {
      setError(getErrorMessage(confirmError, "Не удалось завершить бронирование."));
    } finally {
      setIsProcessing(false);
    }
  };

  if (isSuccess) {
    return (
        <div className="flex-1 flex flex-col items-center justify-center bg-[#0B0B0D] p-4 text-center">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-6">
            <div className="w-24 h-24 rounded-full bg-[#E50914]/10 flex items-center justify-center mx-auto mb-8 border border-[#E50914]/50 shadow-[0_0_50px_rgba(229,9,20,0.5)]">
              <CheckCircle2 className="w-12 h-12 text-[#E50914]" />
            </div>
            <h1 className="text-4xl md:text-5xl font-heading text-white uppercase tracking-wide">
              {successMode === "buy" ? "Билеты куплены!" : "Бронирование подтверждено!"}
            </h1>
            <p className="text-[#9CA3AF] text-lg max-w-md mx-auto">
              {successMode === "buy"
                  ? "Ваши электронные билеты готовы. Найдите их в разделе «Мои билеты»."
                  : "Места забронированы. Оплатить можно в разделе «Мои билеты» до начала сеанса."}
            </p>
          </motion.div>
        </div>
    );
  }

  return (
      <div className="flex-1 container mx-auto px-4 py-8 lg:py-16">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-4xl md:text-5xl font-heading text-white uppercase tracking-wide mb-8">
              {mode === "buy" ? "Оформление заказа" : "Подтверждение брони"}
            </h1>

            {error && (
                <Card className="bg-red-500/10 border-red-500/40 p-4 mb-6">
                  <p className="text-red-300">{error}</p>
                </Card>
            )}

            <div className="grid md:grid-cols-3 gap-8">
              <div className="md:col-span-2 space-y-6">
                {mode === "buy" && (
                    <Card className="bg-[#1A1A1F] border-[#F5F5F7]/10 p-6 md:p-8">
                      <h2 className="text-xl font-heading text-[#FFC857] uppercase tracking-widest mb-6 border-b border-[#F5F5F7]/10 pb-4">
                        Способ оплаты
                      </h2>
                      <div className="space-y-4">
                        <div>
                          <label className="text-[#9CA3AF] text-xs uppercase tracking-widest mb-2 block">Номер карты</label>
                          <input type="text" placeholder="0000 0000 0000 0000" maxLength={19}
                                 className="w-full bg-[#0B0B0D] border border-[#F5F5F7]/10 rounded-xl px-4 py-3 text-white placeholder-[#9CA3AF]/50 focus:outline-none focus:border-[#E50914]/50 transition-colors font-mono tracking-widest"
                                 onChange={(e) => { const val = e.target.value.replace(/\D/g, "").slice(0, 16); e.target.value = val.replace(/(.{4})/g, "$1 ").trim(); }} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[#9CA3AF] text-xs uppercase tracking-widest mb-2 block">Срок действия</label>
                            <input type="text" placeholder="MM/YY" maxLength={5}
                                   className="w-full bg-[#0B0B0D] border border-[#F5F5F7]/10 rounded-xl px-4 py-3 text-white placeholder-[#9CA3AF]/50 focus:outline-none focus:border-[#E50914]/50 transition-colors font-mono tracking-widest"
                                   onChange={(e) => { const val = e.target.value.replace(/\D/g, "").slice(0, 4); e.target.value = val.length > 2 ? `${val.slice(0, 2)}/${val.slice(2)}` : val; }} />
                          </div>
                          <div>
                            <label className="text-[#9CA3AF] text-xs uppercase tracking-widest mb-2 block">CVV</label>
                            <input type="password" placeholder="•••" maxLength={3}
                                   className="w-full bg-[#0B0B0D] border border-[#F5F5F7]/10 rounded-xl px-4 py-3 text-white placeholder-[#9CA3AF]/50 focus:outline-none focus:border-[#E50914]/50 transition-colors font-mono tracking-widest"
                                   onChange={(e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 3); }} />
                          </div>
                        </div>
                        <div>
                          <label className="text-[#9CA3AF] text-xs uppercase tracking-widest mb-2 block">Имя владельца</label>
                          <input type="text" placeholder="IVAN IVANOV"
                                 className="w-full bg-[#0B0B0D] border border-[#F5F5F7]/10 rounded-xl px-4 py-3 text-white placeholder-[#9CA3AF]/50 focus:outline-none focus:border-[#E50914]/50 transition-colors uppercase tracking-widest"
                                 onChange={(e) => { e.target.value = e.target.value.toUpperCase(); }} />
                        </div>
                      </div>
                    </Card>
                )}

                {mode === "book" && (
                    <Card className="bg-[#1A1A1F] border-[#F5F5F7]/10 p-6 md:p-8">
                      <h2 className="text-xl font-heading text-[#FFC857] uppercase tracking-widest mb-6 border-b border-[#F5F5F7]/10 pb-4">
                        Бронирование без оплаты
                      </h2>
                      <div className="flex gap-4 items-start">
                        <Clock className="w-6 h-6 text-[#FFC857] shrink-0 mt-1" />
                        <div>
                          <h3 className="text-white font-medium mb-1">Оплатите позже</h3>
                          <p className="text-[#9CA3AF] text-sm leading-relaxed">
                            Места будут зарезервированы. Оплатить можно в разделе «Мои билеты» до начала сеанса.
                          </p>
                        </div>
                      </div>
                    </Card>
                )}

                <div className="bg-[#E50914]/10 border border-[#E50914]/20 rounded-xl p-6 flex gap-4 items-start">
                  <Ticket className="w-6 h-6 text-[#E50914] shrink-0 mt-1" />
                  <div>
                    <h3 className="text-white font-medium mb-1">
                      {mode === "buy" ? "Невозвратные билеты" : "Условия бронирования"}
                    </h3>
                    <p className="text-[#9CA3AF] text-sm leading-relaxed">
                      {mode === "buy"
                          ? "Билеты не подлежат возврату после покупки. Убедитесь, что детали сеанса верны."
                          : "Бронь можно отменить до сеанса. Оплаченные брони нельзя отменить менее чем за час до начала."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <Card className="bg-[#1A1A1F] border-[#F5F5F7]/10 overflow-hidden sticky top-24 shadow-2xl">
                  <div className="p-6 bg-[#232329]/50 border-b border-[#F5F5F7]/10">
                    <h2 className="text-xl font-heading text-white uppercase tracking-widest">Детали заказа</h2>
                  </div>
                  <div className="p-6 space-y-6">
                    {loadingDetails ? (
                        <p className="text-[#9CA3AF]">Загружаем детали...</p>
                    ) : (
                        <div className="flex gap-4">
                          <div className="w-16 h-24 rounded-md overflow-hidden shrink-0 border border-[#F5F5F7]/10 shadow-lg">
                            <img src={movie ? getMoviePoster(movie) : ""} alt={movie?.title ?? "Фильм"} className="w-full h-full object-cover" />
                          </div>
                          <div>
                            <h3 className="text-lg font-heading tracking-wider text-white uppercase">{movie?.title ?? "Фильм"}</h3>
                            <p className="text-[#9CA3AF] text-sm mt-1">{cinema?.cinema_name ?? "Кинотеатр"}</p>
                            {session && (
                                <p className="text-[#9CA3AF] text-sm">
                                  {formatFullDate(session.start_time)} • {formatTime(session.start_time)}
                                </p>
                            )}
                          </div>
                        </div>
                    )}
                    <div className="space-y-3 pt-6 border-t border-[#F5F5F7]/10 text-sm">
                      <div className="flex justify-between text-[#9CA3AF]">
                        <span>Места ({state.selectedSeatLabels.join(", ")})</span>
                        <span className="text-white">{formatRubles(state.totalPrice)}</span>
                      </div>
                    </div>
                    <div className="pt-6 border-t border-[#F5F5F7]/10 flex justify-between items-center">
                      <span className="text-white font-medium">Итого</span>
                      <span className="text-3xl font-heading text-[#E50914] tracking-wider">{formatRubles(state.totalPrice)}</span>
                    </div>
                    <Button
                        className={`w-full py-6 text-lg font-heading transition-all duration-300 ${
                            mode === "book" ? "bg-[#FFC857] hover:bg-[#FFC857]/90 text-black tracking-wide" : "tracking-widest uppercase"
                        }`}
                        onClick={handleConfirm}
                        disabled={isProcessing || loadingDetails || (state.selectedSeatIds.length === 0 && !state.existingBookingIds?.length)}
                    >
                      {isProcessing ? (
                          <span className="flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Обработка...</span>
                      ) : mode === "buy" ? "Оплатить" : "Подтвердить бронь"}
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
  );
}