import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { BrainCircuit, Building2, CheckCircle2, Clapperboard, Film, MapPinned, Rows3, Shield, Trash2, XCircle } from "lucide-react";
import { useApp } from "../../context/AppContext";
import {
  type CinemaPayload,
  type CityPayload,
  type HallPayload,
  type MoviePayload,
  createCinema,
  createCity,
  createHall,
  ApiError,
  createSession,
  deleteCinema,
  deleteCity,
  deleteHall,
  deleteMovie,
  deleteSession,
  fetchCinemasByCity,
  fetchCities,
  fetchHallsByCinema,
  fetchMovies,
  fetchSessionsByCinema,
  getErrorMessage,
  predictOccupancy,
  retrainAiModel,
  updateCinema,
  updateCity,
  updateHall,
  updateSession,
  fetchTrainingHistory,
  type TrainingMetrics,
} from "../../lib/api";
import { formatRubles } from "../../lib/formatters";
import type { Cinema, City, Hall, Movie, Session } from "../../lib/types";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

interface Toast {
  id: number;
  type: "success" | "error";
  message: string;
}

let toastCounter = 0;

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
              <motion.div
                  key={toast.id}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-md ${
                      toast.type === "success"
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
                          : "bg-red-500/10 border-red-500/30 text-red-200"
                  }`}
              >
                {toast.type === "success" ? (
                    <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" />
                ) : (
                    <XCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-400" />
                )}
                <p className="flex-1 text-sm leading-snug">{toast.message}</p>
                <button onClick={() => onDismiss(toast.id)} className="text-white/40 hover:text-white/80 transition-colors ml-1 shrink-0">
                  ✕
                </button>
              </motion.div>
          ))}
        </AnimatePresence>
      </div>
  );
}

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((type: "success" | "error", message: string) => {
    const id = ++toastCounter;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);
  const dismiss = useCallback((id: number) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);
  return { toasts, showSuccess: (msg: string) => show("success", msg), showError: (msg: string) => show("error", msg), dismiss };
}

interface CityForm extends CityPayload { city_id?: number; }
interface CinemaForm extends CinemaPayload { cinema_id?: number; }
interface MovieForm extends MoviePayload { movie_id?: number; main_actors_text?: string; posterFile?: File; age_rating?: string; }
interface HallForm extends HallPayload { hall_id?: number; }
interface SessionForm {
  session_id?: number;
  hall_id: number;
  movie_id: number;
  start_time_local: string;
  price: number;
}

function toLocalDatetimeInput(isoDate: string): string {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return "";
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}
function toIsoDatetime(localDate: string): string {
  const d = new Date(localDate);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString();
}
function getMinDatetimeLocal(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 16);
}
function isPastSession(startTime: string): boolean {
  return new Date(startTime).getTime() <= Date.now();
}
function createEmptyMovieForm(): MovieForm {
  return {
    title: "", description: "", duration_min: 90, genre: "",
    poster_url: "", release_year: new Date().getFullYear(),
    rating: undefined, director: "", writer: "", country: "",
    budget_amount: undefined, budget_currency: "RUB", main_actors_text: "", posterFile: undefined,
    age_rating: "",
  };
}
function getHallCapacity(hall?: Hall): number {
  if (!hall) return 100;
  return hall.total_seats || hall.rows_count * hall.seats_per_row || 100;
}
function formatOccupancyRate(value: number): string {
  const percent = value <= 1 ? value * 100 : value;
  return `${Math.max(0, Math.min(100, percent)).toFixed(0)}%`;
}
function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
      <div className="flex items-center gap-3 mb-4">
        <Icon className="w-5 h-5 text-[#E50914]" />
        <h2 className="text-2xl font-heading text-white tracking-wide uppercase">{title}</h2>
      </div>
  );
}

async function sendMovieRequest(method: "POST" | "PUT", url: string, formData: FormData): Promise<any> {
  const response = await fetch(url, {
    method,
    credentials: "include",
    body: formData,
  });
  if (!response.ok) {
    let errorMessage = `Ошибка ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.detail || JSON.stringify(errorData);
    } catch {
      errorMessage = await response.text();
    }
    throw new Error(errorMessage);
  }
  return response.json();
}

export function AdminPanel() {
  const { user } = useApp();
  const { toasts, showSuccess, showError, dismiss } = useToast();
  const posterInputRef = useRef<HTMLInputElement | null>(null);
  const isCinemaAdmin = user?.role === "cinema_admin";
  const cinemaAdminCinemaIdRaw = (import.meta.env.VITE_CINEMA_ADMIN_CINEMA_ID as string | undefined)?.trim() ?? "";
  const parsedCinemaAdminCinemaId = Number(cinemaAdminCinemaIdRaw);
  const cinemaAdminLockedCinemaId =
      isCinemaAdmin && Number.isFinite(parsedCinemaAdminCinemaId) && parsedCinemaAdminCinemaId > 0 ? parsedCinemaAdminCinemaId : null;

  const [cities, setCities] = useState<City[]>([]);
  const [cinemas, setCinemas] = useState<Cinema[]>([]);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [halls, setHalls] = useState<Hall[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedCinemaId, setSelectedCinemaId] = useState<number | null>(null);

  const [cityForm, setCityForm] = useState<CityForm>({ city_name: "" });
  const [cinemaForm, setCinemaForm] = useState<CinemaForm>({ city_id: 0, cinema_name: "", cinema_address: "" });
  const [movieForm, setMovieForm] = useState<MovieForm>(createEmptyMovieForm());
  const [hallForm, setHallForm] = useState<HallForm>({ cinema_id: 0, hall_name: "", rows_count: 8, seats_per_row: 10 });
  const [sessionForm, setSessionForm] = useState<SessionForm>({ hall_id: 0, movie_id: 0, start_time_local: "", price: 500 });
  const [aiSessionId, setAiSessionId] = useState<number>(0);
  const [aiPrediction, setAiPrediction] = useState<number | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRetrainLoading, setAiRetrainLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [latestMetrics, setLatestMetrics] = useState<TrainingMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  const selectedCinema = useMemo(() => cinemas.find((c) => c.cinema_id === selectedCinemaId) ?? null, [cinemas, selectedCinemaId]);
  const futureSessions = useMemo(() => sessions.filter((s) => !isPastSession(s.start_time)), [sessions]);
  const hallNameMap = useMemo(() => new Map(halls.map((h) => [h.hall_id, h.hall_name])), [halls]);
  const movieNameMap = useMemo(() => new Map(movies.map((m) => [m.movie_id, m.title])), [movies]);

  const loadMetrics = async () => {
    setMetricsLoading(true);
    setMetricsError(null);
    try {
      const history = await fetchTrainingHistory();
      if (history && history.length > 0) {
        const last = history[history.length - 1];
        setLatestMetrics(last);
      } else {
        setLatestMetrics(null);
      }
    } catch (err) {
      console.error("Ошибка загрузки метрик:", err);
      if (err instanceof ApiError && err.status === 403) {
        setMetricsError("Недостаточно прав для просмотра метрик (требуется роль admin).");
      } else {
        setMetricsError(getErrorMessage(err, "Не удалось загрузить метрики модели."));
      }
      setLatestMetrics(null);
    } finally {
      setMetricsLoading(false);
    }
  };

  const loadCoreData = async () => {
    const [citiesResult, moviesResult] = await Promise.allSettled([fetchCities(), fetchMovies()]);
    if (citiesResult.status === "rejected") throw citiesResult.reason;
    const cityList = citiesResult.value;
    const movieList = moviesResult.status === "fulfilled" ? moviesResult.value : [];
    if (moviesResult.status === "rejected") showError("Не удалось загрузить фильмы. Раздел фильмов будет пустым.");

    const cinemaResults = await Promise.allSettled(cityList.map((city) => fetchCinemasByCity(city.city_id)));
    const allCinemas = cinemaResults.filter((r): r is PromiseFulfilledResult<Cinema[]> => r.status === "fulfilled").flatMap((r) => r.value);
    const cinemaList = cinemaAdminLockedCinemaId ? allCinemas.filter((c) => c.cinema_id === cinemaAdminLockedCinemaId) : allCinemas;

    setCities(cityList);
    setMovies(movieList);
    setCinemas(cinemaList);

    const nextCinemaId = selectedCinemaId && cinemaList.some((c) => c.cinema_id === selectedCinemaId) ? selectedCinemaId : cinemaList[0]?.cinema_id ?? null;
    setSelectedCinemaId(nextCinemaId);

    if (cinemaList.length > 0) {
      setCinemaForm((prev) => ({ ...prev, city_id: prev.city_id || cinemaList[0].city_id || cityList[0]?.city_id || 0 }));
    } else if (cityList.length > 0) {
      setCinemaForm((prev) => ({ ...prev, city_id: prev.city_id || cityList[0].city_id }));
    }

    if (nextCinemaId) {
      const [hallsResult, sessionsResult] = await Promise.allSettled([fetchHallsByCinema(nextCinemaId), fetchSessionsByCinema(nextCinemaId)]);
      const hallList = hallsResult.status === "fulfilled" ? hallsResult.value : [];
      const sessionList = sessionsResult.status === "fulfilled" ? sessionsResult.value : [];
      setHalls(hallList);
      setSessions(sessionList);
      setHallForm((prev) => ({ ...prev, cinema_id: prev.cinema_id || nextCinemaId }));
      setSessionForm((prev) => ({
        ...prev,
        hall_id: prev.hall_id || hallList[0]?.hall_id || 0,
        movie_id: prev.movie_id || movieList[0]?.movie_id || 0,
      }));
      const futureList = sessionList.filter((s) => !isPastSession(s.start_time));
      setAiSessionId(futureList[0]?.session_id ?? 0);
      setAiPrediction(null);
    } else {
      setHalls([]); setSessions([]); setAiSessionId(0); setAiPrediction(null);
    }
  };

  const loadCinemaScopedData = async (cinemaId: number) => {
    const [hallsResult, sessionsResult] = await Promise.allSettled([fetchHallsByCinema(cinemaId), fetchSessionsByCinema(cinemaId)]);
    const hallList = hallsResult.status === "fulfilled" ? hallsResult.value : [];
    const sessionList = sessionsResult.status === "fulfilled" ? sessionsResult.value : [];
    setHalls(hallList);
    setSessions(sessionList);
    setHallForm((prev) => ({ ...prev, cinema_id: prev.cinema_id || cinemaId }));
    setSessionForm((prev) => ({
      ...prev,
      hall_id: prev.hall_id || hallList[0]?.hall_id || 0,
      movie_id: prev.movie_id || movies[0]?.movie_id || 0,
    }));
    const futureList = sessionList.filter((s) => !isPastSession(s.start_time));
    setAiSessionId(futureList[0]?.session_id ?? 0);
    setAiPrediction(null);
  };

  const safeReload = async () => {
    setLoading(true);
    try {
      await loadCoreData();
    } catch (loadError) {
      showError(getErrorMessage(loadError, "Не удалось загрузить данные админ-панели."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void safeReload(); }, []);
  useEffect(() => {
    if (!selectedCinemaId) return;
    void loadCinemaScopedData(selectedCinemaId).catch((err) => showError(getErrorMessage(err, "Не удалось загрузить залы и сеансы.")));
  }, [selectedCinemaId]);

  useEffect(() => {
      if (user?.role === "admin") {
        void loadMetrics();
    }
  }, []);

  if (!user) return <Navigate to="/" replace />;
  const canManageCinemaData = user.role === "admin" || user.role === "cinema_admin";
  const canManageGlobalData = user.role === "admin";
  const isCinemaSelectionLocked = isCinemaAdmin && cinemas.length > 0;
  const filteredCinemas = useMemo(() => {
      if (!cinemaForm.city_id) return [];
      return cinemas.filter(c => c.city_id === cinemaForm.city_id);
  }, [cinemas, cinemaForm.city_id]);

  if (!canManageCinemaData) {
    return (
        <div className="flex-1 flex items-center justify-center p-6">
          <Card className="max-w-lg w-full p-8 text-center bg-[#1A1A1F] border-red-500/40">
            <Shield className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h1 className="text-3xl font-heading text-white uppercase tracking-wide mb-3">Доступ запрещён</h1>
            <p className="text-[#9CA3AF]">Эта страница доступна только администраторам.</p>
          </Card>
        </div>
    );
  }

  const withSubmit = async (action: () => Promise<void>, successText: string) => {
    setSubmitting(true);
    try {
      await action();
      showSuccess(successText);
    } catch (err) {
      showError(getErrorMessage(err, "Не удалось выполнить действие."));
    } finally {
      setSubmitting(false);
    }
  };
  const handleDelete = async (entityName: string, action: () => Promise<void>, successText: string) => {
    if (!window.confirm(`Удалить ${entityName}?`)) return;
    await withSubmit(action, successText);
  };
  const handlePosterFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showError("Поддерживаются только изображения.");
      event.target.value = "";
      return;
    }
    setMovieForm((prev) => ({ ...prev, posterFile: file }));
    const objectUrl = URL.createObjectURL(file);
    setMovieForm((prev) => ({ ...prev, poster_url: objectUrl }));
  };
  const handlePredictOccupancy = async () => {
    if (!aiSessionId) {
      showError("Выберите сеанс для прогноза.");
      return;
    }
    setAiLoading(true);
    setAiPrediction(null);
    try {
      const result = await predictOccupancy({ session_id: aiSessionId });
      setAiPrediction(result.predicted_occupancy_rate);
      showSuccess("Прогноз заполняемости рассчитан.");
    } catch (err) {
      console.error("Ошибка прогноза:", err);
      showError(getErrorMessage(err, "Не удалось рассчитать прогноз заполняемости."));
    } finally {
      setAiLoading(false);
    }
  };
  const handleRetrainAiModel = async () => {
    setAiRetrainLoading(true);
    try {
      const result = await retrainAiModel();
      showSuccess(result.message || "Переобучение AI-модели запущено.");
      await loadMetrics();
    } catch (err) {
      showError(getErrorMessage(err, "Не удалось запустить переобучение AI-модели."));
    } finally {
      setAiRetrainLoading(false);
    }
  };
  const isSessionDateInvalid = sessionForm.start_time_local !== "" && new Date(sessionForm.start_time_local).getTime() <= Date.now();

  const handleSaveMovie = async () => {
    if (!movieForm.title.trim() || movieForm.duration_min <= 0) {
      showError("Заполните название и длительность фильма.");
      return;
    }
    if (movieForm.rating !== undefined && movieForm.rating !== null && (movieForm.rating < 0 || movieForm.rating > 10)) {
      showError("Рейтинг должен быть от 0 до 10.");
      return;
    }
    const formData = new FormData();
    formData.append("title", movieForm.title.trim());
    if (movieForm.description) formData.append("description", movieForm.description.trim());
    formData.append("duration_min", String(movieForm.duration_min));
    if (movieForm.genre) formData.append("genre", movieForm.genre.trim());
    if (movieForm.release_year) formData.append("release_year", String(movieForm.release_year));
    if (movieForm.rating !== undefined && movieForm.rating !== null) formData.append("rating", String(movieForm.rating));
    if (movieForm.director) formData.append("director", movieForm.director.trim());
    if (movieForm.writer) formData.append("writer", movieForm.writer.trim());
    if (movieForm.country) formData.append("country", movieForm.country.trim());
    if (movieForm.budget_amount !== undefined && movieForm.budget_amount !== null) formData.append("budget_amount", String(movieForm.budget_amount));
    if (movieForm.budget_currency) formData.append("budget_currency", movieForm.budget_currency.trim());
    if (movieForm.age_rating) formData.append("age_rating", movieForm.age_rating.trim());
    if (movieForm.main_actors_text) {
      const actorsArray = movieForm.main_actors_text.split(",").map(s => s.trim()).filter(s => s);
      formData.append("main_actors", JSON.stringify(actorsArray));
    }
    if (movieForm.posterFile) {
      formData.append("poster", movieForm.posterFile);
    }

    try {
      if (movieForm.movie_id) {
        await sendMovieRequest("PUT", `/api/movies/admin/movies/${movieForm.movie_id}`, formData);
        showSuccess("Фильм обновлён.");
      } else {
        await sendMovieRequest("POST", "/api/movies/admin/movies", formData);
        showSuccess("Фильм добавлен.");
      }
      setMovieForm(createEmptyMovieForm());
      await loadCoreData();
    } catch (err) {
      showError(getErrorMessage(err, "Не удалось сохранить фильм."));
    }
  };

  return (
      <div className="flex-1 container mx-auto px-4 py-8 lg:py-12 space-y-8">
        <ToastContainer toasts={toasts} onDismiss={dismiss} />
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <h1 className="text-4xl md:text-5xl font-heading text-white uppercase tracking-wide">Админ-панель</h1>
          <p className="text-[#9CA3AF] text-lg">Управление городами, кинотеатрами, фильмами, залами и сеансами.</p>
        </motion.div>
        {loading ? (
            <Card className="p-6 text-[#9CA3AF]">Загрузка админ-данных...</Card>
        ) : (
            <>
              {/* Города */}
              <Card className="p-6 bg-[#1A1A1F] border-[#F5F5F7]/10">
                <SectionTitle icon={MapPinned} title="Города" />
                <div className={`grid gap-5 ${canManageGlobalData ? "lg:grid-cols-2" : ""}`}>
                  {canManageGlobalData && (
                      <div className="space-y-3">
                        <Input placeholder="Название города" value={cityForm.city_name} onChange={(e) => setCityForm((p) => ({ ...p, city_name: e.target.value }))} />
                        <div className="flex gap-2">
                          <Button disabled={submitting || !cityForm.city_name.trim()} onClick={() =>
                              withSubmit(async () => {
                                if (cityForm.city_id) await updateCity(cityForm.city_id, { city_name: cityForm.city_name.trim() });
                                else await createCity({ city_name: cityForm.city_name.trim() });
                                setCityForm({ city_name: "" });
                                await safeReload();
                              }, cityForm.city_id ? "Город обновлён." : "Город добавлен.")
                          }>{cityForm.city_id ? "Сохранить" : "Добавить город"}</Button>
                          {cityForm.city_id && <Button variant="outline" onClick={() => setCityForm({ city_name: "" })}>Отмена</Button>}
                        </div>
                      </div>
                  )}
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {cities.length === 0 && <Card className="p-4 border-[#F5F5F7]/10 text-[#9CA3AF]">Города пока не найдены.</Card>}
                    {cities.map((city) => (
                        <div key={city.city_id} className="rounded-lg border border-[#F5F5F7]/10 p-3 flex items-center justify-between gap-2">
                          <span className="text-white">{city.city_name}</span>
                          {canManageGlobalData ? (
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => setCityForm({ city_id: city.city_id, city_name: city.city_name })}>Изменить</Button>
                                <Button size="sm" variant="destructive" onClick={() => handleDelete(`город «${city.city_name}»`, async () => { await deleteCity(city.city_id); await safeReload(); }, "Город удалён.")}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                          ) : <span className="text-xs text-[#9CA3AF]">Только просмотр</span>}
                        </div>
                    ))}
                  </div>
                </div>
              </Card>

              {/* Кинотеатры */}
              <Card className="p-6 bg-[#1A1A1F] border-[#F5F5F7]/10">
                <SectionTitle icon={Building2} title="Кинотеатры" />
                <div className={`grid gap-5 ${canManageGlobalData ? "lg:grid-cols-2" : ""}`}>
                  {canManageGlobalData && (
                      <div className="space-y-3">
                        <label className="text-sm text-[#9CA3AF]">Город</label>
                        <select value={cinemaForm.city_id || 0} onChange={(e) => setCinemaForm((p) => ({ ...p, city_id: Number(e.target.value) }))} className="w-full h-11 rounded-xl border border-[#F5F5F7]/10 bg-[#0B0B0D] px-3 text-white">
                          <option value={0}>Выберите город</option>
                          {cities.map((city) => <option key={city.city_id} value={city.city_id}>{city.city_name}</option>)}
                        </select>
                        <Input placeholder="Название кинотеатра" value={cinemaForm.cinema_name} onChange={(e) => setCinemaForm((p) => ({ ...p, cinema_name: e.target.value }))} />
                        <Input placeholder="Адрес" value={cinemaForm.cinema_address ?? ""} onChange={(e) => setCinemaForm((p) => ({ ...p, cinema_address: e.target.value }))} />
                        <div className="flex gap-2">
                          <Button disabled={submitting || !cinemaForm.city_id || !cinemaForm.cinema_name.trim()} onClick={() =>
                              withSubmit(async () => {
                                const payload = { city_id: cinemaForm.city_id, cinema_name: cinemaForm.cinema_name.trim(), cinema_address: (cinemaForm.cinema_address ?? "").trim() };
                                if (cinemaForm.cinema_id) await updateCinema(cinemaForm.cinema_id, payload);
                                else await createCinema(payload);
                                setCinemaForm({ city_id: cities[0]?.city_id ?? 0, cinema_name: "", cinema_address: "" });
                                await safeReload();
                              }, cinemaForm.cinema_id ? "Кинотеатр обновлён." : "Кинотеатр добавлен.")
                          }>{cinemaForm.cinema_id ? "Сохранить" : "Добавить кинотеатр"}</Button>
                          {cinemaForm.cinema_id && <Button variant="outline" onClick={() => setCinemaForm({ city_id: cities[0]?.city_id ?? 0, cinema_name: "", cinema_address: "" })}>Отмена</Button>}
                        </div>
                      </div>
                  )}
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                        {filteredCinemas.length === 0 && <Card className="p-4 border-[#F5F5F7]/10 text-[#9CA3AF]">Кинотеатры пока не найдены.</Card>}
                        {filteredCinemas.map((cinema) => (
                            <div key={cinema.cinema_id} className="rounded-lg border border-[#F5F5F7]/10 p-3">
                              <p className="text-white font-medium">{cinema.cinema_name}</p>
                              <p className="text-[#9CA3AF] text-xs">{cinema.city_name}</p>
                              <p className="text-[#9CA3AF] text-xs">{cinema.cinema_address || "Адрес не указан"}</p>
                              {canManageGlobalData ? (
                                  <div className="flex gap-2 mt-3">
                                    <Button size="sm" variant="outline" onClick={() => setCinemaForm({ cinema_id: cinema.cinema_id, city_id: cinema.city_id, cinema_name: cinema.cinema_name, cinema_address: cinema.cinema_address ?? "" })}>Изменить</Button>
                                    <Button size="sm" variant="destructive" onClick={() => handleDelete(`кинотеатр «${cinema.cinema_name}»`, async () => { await deleteCinema(cinema.cinema_id); await safeReload(); }, "Кинотеатр удалён.")}><Trash2 className="w-4 h-4" /></Button>
                                  </div>
                              ) : <p className="text-xs text-[#9CA3AF] mt-2">Только просмотр</p>}
                            </div>
                        ))}
                  </div>
                </div>
              </Card>

              {/* Фильмы */}
              {(canManageGlobalData || user?.role === "cinema_admin") && (
                  <Card className="p-6 bg-[#1A1A1F] border-[#F5F5F7]/10">
                    <SectionTitle icon={Clapperboard} title="Фильмы" />
                    <div className="grid lg:grid-cols-2 gap-5">
                      <div className="space-y-3">
                        <Input placeholder="Название фильма" value={movieForm.title} onChange={(e) => setMovieForm((prev) => ({ ...prev, title: e.target.value }))} />
                        <Input placeholder="Описание" value={movieForm.description ?? ""} onChange={(e) => setMovieForm((prev) => ({ ...prev, description: e.target.value }))} />
                        <div className="grid grid-cols-2 gap-2">
                          <Input type="number" placeholder="Длительность, мин" value={movieForm.duration_min} onChange={(e) => setMovieForm((prev) => ({ ...prev, duration_min: Number(e.target.value) || 0 }))} />
                          <Input type="number" placeholder="Год" value={movieForm.release_year ?? ""} onChange={(e) => setMovieForm((prev) => ({ ...prev, release_year: Number(e.target.value) || new Date().getFullYear() }))} />
                        </div>
                        <Input placeholder="Жанр" value={movieForm.genre ?? ""} onChange={(e) => setMovieForm((prev) => ({ ...prev, genre: e.target.value }))} />
                        <div className="grid grid-cols-2 gap-2">
                          <Input type="number" step="0.1" min="0" max="10" placeholder="Рейтинг (0-10)" value={movieForm.rating ?? ""} onChange={(e) => setMovieForm((prev) => ({ ...prev, rating: e.target.value === "" ? undefined : Number(e.target.value) }))} />
                          <Input placeholder="Страна" value={movieForm.country ?? ""} onChange={(e) => setMovieForm((prev) => ({ ...prev, country: e.target.value }))} />
                        </div>
                        <Input placeholder="Режиссер" value={movieForm.director ?? ""} onChange={(e) => setMovieForm((prev) => ({ ...prev, director: e.target.value }))} />
                        <Input placeholder="Сценарист" value={movieForm.writer ?? ""} onChange={(e) => setMovieForm((prev) => ({ ...prev, writer: e.target.value }))} />
                        <div className="grid grid-cols-2 gap-2">
                          <Input type="number" step="1" min="0" placeholder="Бюджет" value={movieForm.budget_amount ?? ""} onChange={(e) => setMovieForm((prev) => ({ ...prev, budget_amount: e.target.value === "" ? undefined : Number(e.target.value) }))} />
                          <Input placeholder="Валюта (RUB/USD)" value={movieForm.budget_currency ?? ""} onChange={(e) => setMovieForm((prev) => ({ ...prev, budget_currency: e.target.value }))} />
                        </div>
                        <Input placeholder="Возрастное ограничение" value={movieForm.age_rating ?? ""} onChange={(e) => setMovieForm((prev) => ({ ...prev, age_rating: e.target.value }))} />
                        <Input placeholder="Известные актеры" value={movieForm.main_actors_text ?? ""} onChange={(e) => setMovieForm((prev) => ({ ...prev, main_actors_text: e.target.value }))} />

                        <div className="space-y-2">
                          <label className="text-sm text-[#9CA3AF]">Постер</label>
                          <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              ref={posterInputRef}
                              onChange={handlePosterFileChange}
                              className="w-full text-sm text-[#9CA3AF] file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#E50914]/20 file:text-white hover:file:bg-[#E50914]/30 cursor-pointer"
                          />
                          <p className="text-xs text-[#9CA3AF]">Поддерживаются JPG, PNG, WebP.</p>
                          {movieForm.poster_url && (
                              <div className="w-24 aspect-[2/3] rounded-md overflow-hidden border border-[#F5F5F7]/20 mt-2">
                                <img src={movieForm.poster_url} alt="Предпросмотр" className="w-full h-full object-cover" />
                              </div>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <Button disabled={submitting || !movieForm.title.trim() || movieForm.duration_min <= 0} onClick={handleSaveMovie}>
                            {movieForm.movie_id ? "Сохранить" : "Добавить фильм"}
                          </Button>
                          {movieForm.movie_id && <Button variant="outline" onClick={() => setMovieForm(createEmptyMovieForm())}>Отмена</Button>}
                        </div>
                      </div>
                      <div className="space-y-2 max-h-178 overflow-y-auto pr-1">
                        {movies.map((movie) => (
                            <div key={movie.movie_id} className="rounded-lg border border-[#F5F5F7]/10 p-3">
                              <p className="text-white font-medium">{movie.title}</p>
                              <p className="text-[#9CA3AF] text-xs">{movie.duration_min} мин • {movie.release_year ?? "—"} • {movie.genre || "Жанр не указан"}</p>
                              <div className="flex gap-2 mt-3">
                                <Button size="sm" variant="outline" onClick={() => setMovieForm({
                                  movie_id: movie.movie_id,
                                  title: movie.title,
                                  description: movie.description ?? "",
                                  duration_min: movie.duration_min,
                                  genre: movie.genre ?? "",
                                  poster_url: movie.poster_url ?? "",
                                  release_year: movie.release_year ?? new Date().getFullYear(),
                                  rating: movie.rating ?? undefined,
                                  director: movie.director ?? "",
                                  writer: movie.writer ?? "",
                                  country: movie.country ?? "",
                                  budget_amount: movie.budget_amount ?? undefined,
                                  budget_currency: movie.budget_currency ?? "RUB",
                                  main_actors_text: movie.main_actors?.join(", ") ?? "",
                                  posterFile: undefined,
                                  age_rating: movie.age_rating ?? "",
                                })}>Изменить</Button>
                                <Button size="sm" variant="destructive" onClick={() => handleDelete(`фильм «${movie.title}»`, async () => { await deleteMovie(movie.movie_id); await loadCoreData(); }, "Фильм удалён.")}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                        ))}
                      </div>
                    </div>
                  </Card>
              )}

              <Card className="p-6 bg-[#1A1A1F] border-[#F5F5F7]/10">
                <SectionTitle icon={Rows3} title="Залы и сеансы" />
                <div className="mb-5">
                  <label className="text-sm text-[#9CA3AF]">Активный кинотеатр</label>
                  <select value={selectedCinemaId ?? 0} onChange={(e) => { const id = Number(e.target.value); setSelectedCinemaId(id || null); setHallForm((p) => ({ ...p, cinema_id: id || p.cinema_id })); }} disabled={isCinemaSelectionLocked} className="w-full md:w-[420px] mt-2 h-11 rounded-xl border border-[#F5F5F7]/10 bg-[#0B0B0D] px-3 text-white">
                    <option value={0}>Выберите кинотеатр</option>
                    {cinemas.map((cinema) => <option key={cinema.cinema_id} value={cinema.cinema_id}>{cinema.cinema_name} ({cinema.city_name})</option>)}
                  </select>
                </div>

                {selectedCinema && (
                    <div className="mb-6 rounded-lg border border-[#F5F5F7]/10 bg-[#0B0B0D] p-4 space-y-4">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                        <div>
                          <h3 className="text-xl text-white font-heading uppercase tracking-wide flex items-center gap-2"> AI-прогноз заполняемости
                          </h3>
                          <p className="text-sm text-[#9CA3AF] mt-1">Прогноз рассчитывается на основе выбранного сеанса.</p>
                        </div>
                        {aiPrediction !== null && (() => {
                          const percent = aiPrediction <= 1 ? aiPrediction * 100 : aiPrediction;
                          const color = percent < 30 ? "text-red-400" : percent < 70 ? "text-yellow-400" : "text-emerald-400";
                          const borderColor = percent < 30 ? "border-red-500/30" : percent < 70 ? "border-yellow-500/30" : "border-emerald-500/30";
                          const bgColor = percent < 30 ? "bg-red-500/10" : percent < 70 ? "bg-yellow-500/10" : "bg-emerald-500/10";
                          return (
                              <div className={`rounded-lg border ${borderColor} ${bgColor} px-4 py-3 text-right`}>
                                <p className="text-xs text-[#9CA3AF] uppercase tracking-widest">Ожидаемая заполняемость</p>
                                <p className={`text-3xl font-heading ${color}`}>{formatOccupancyRate(aiPrediction)}</p>
                              </div>
                          );
                        })()}
                      </div>

                      <div className="grid md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs text-[#9CA3AF] uppercase tracking-widest">Сеанс</label>
                          <select value={aiSessionId} onChange={(e) => { setAiSessionId(Number(e.target.value)); setAiPrediction(null); }} className="w-full h-11 rounded-xl border border-[#F5F5F7]/10 bg-[#1A1A1F] px-3 text-white">
                            <option value={0}>Выберите сеанс</option>
                            {futureSessions.map((session) => (
                                <option key={session.session_id} value={session.session_id}>
                                  {movieNameMap.get(session.movie_id) ?? `Фильм #${session.movie_id}`} · {new Date(session.start_time).toLocaleString("ru-RU")}
                                </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 justify-between items-start">
                        <div className="flex flex-wrap gap-2">
                          <Button onClick={handlePredictOccupancy} disabled={aiLoading || !aiSessionId}>{aiLoading ? "Считаем..." : "Рассчитать прогноз"}</Button>
                          {canManageGlobalData && <Button variant="outline" onClick={handleRetrainAiModel} disabled={aiRetrainLoading}>{aiRetrainLoading ? "Запускаем..." : "Переобучить модель"}</Button>}
                          {canManageGlobalData && (
                              <Button variant="outline" onClick={async () => {
                                  try {
                                      const resp = await fetch("/api/admin/backup", { method: "POST", credentials: "include" });
                                      const data = await resp.json();
                                      if (resp.ok) showSuccess(data.message);
                                      else showError(data.detail || "Ошибка бэкапа");
                                  } catch { showError("Не удалось создать бэкап"); }
                              }}>
                                  Бэкап БД
                              </Button>
                          )}
                        </div>

                        {user?.role === "admin" && (    
                          <div className="bg-[#1A1A1F] rounded-lg border border-[#F5F5F7]/10 p-4 md:max-w-[700px]">
                            <h4 className="text-xs text-[#9CA3AF] uppercase tracking-wider mb-3">Метрики качества модели</h4>
                            {metricsLoading ? (
                                <p className="text-white text-sm">Загрузка метрик...</p>
                            ) : metricsError ? (
                                <p className="text-yellow-400 text-sm">{metricsError}</p>
                            ) : latestMetrics ? (
                                <div className="space-y-2 text-sm">
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                    <span className="text-[#9CA3AF]">MAE (Средняя абсолютная ошибка):</span>
                                    <span className="text-white">{latestMetrics.mae.toFixed(4)}%</span>
                                    <span className="text-[#9CA3AF]">MAPE (Средняя абсолютная процентная ошибка):</span>
                                    <span className="text-white">{latestMetrics.mape.toFixed(4)}%</span>
                                    <span className="text-[#9CA3AF]">MSE (Среднеквадратичная ошибка):</span>
                                    <span className="text-white">{latestMetrics.mse.toFixed(4)}</span>
                                    <span className="text-[#9CA3AF]">RMSE (Корень среднеквадратичной ошибки):</span>
                                    <span className="text-white">{latestMetrics.rmse.toFixed(4)}%</span>
                                    <span className="text-[#9CA3AF]">R² (Коэффициент детерминации):</span>
                                    <span className="text-white">{latestMetrics.r2.toFixed(4)}</span>
                                  </div>
                                </div>
                            ) : (
                                <p className="text-white text-sm">Нет данных об обучении модели. Нажмите «Переобучить модель».</p>
                            )}
                          </div>
                        )}  
                      </div>
                    </div>
                )}

                {!selectedCinema ? (
                    <Card className="p-4 border-[#F5F5F7]/10 text-[#9CA3AF]">Сначала создайте и выберите кинотеатр.</Card>
                ) : (
                    <div className="flex flex-col gap-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <h3 className="text-xl text-white font-heading uppercase tracking-wide flex items-center gap-2">
                            <Film className="w-5 h-5 text-[#E50914]" /> Добавить/редактировать зал
                          </h3>
                          <Input placeholder="Название зала" value={hallForm.hall_name} onChange={(e) => setHallForm((p) => ({ ...p, hall_name: e.target.value }))} />
                          <div className="grid grid-cols-2 gap-2">
                            <Input type="number" placeholder="Рядов" value={hallForm.rows_count} onChange={(e) => setHallForm((p) => ({ ...p, rows_count: Number(e.target.value) || 0 }))} />
                            <Input type="number" placeholder="Мест в ряду" value={hallForm.seats_per_row} onChange={(e) => setHallForm((p) => ({ ...p, seats_per_row: Number(e.target.value) || 0 }))} />
                          </div>
                          <div className="flex gap-2">
                            <Button disabled={submitting || !hallForm.hall_name.trim() || hallForm.rows_count <= 0 || hallForm.seats_per_row <= 0} onClick={() =>
                                withSubmit(async () => {
                                  const payload = { cinema_id: selectedCinema.cinema_id, hall_name: hallForm.hall_name.trim(), rows_count: Number(hallForm.rows_count), seats_per_row: Number(hallForm.seats_per_row) };
                                  if (hallForm.hall_id) await updateHall(hallForm.hall_id, payload);
                                  else await createHall(payload);
                                  setHallForm({ cinema_id: selectedCinema.cinema_id, hall_name: "", rows_count: 8, seats_per_row: 10 });
                                  await loadCinemaScopedData(selectedCinema.cinema_id);
                                }, hallForm.hall_id ? "Зал обновлён." : "Зал создан.")
                            }>{hallForm.hall_id ? "Сохранить" : "Добавить зал"}</Button>
                            {hallForm.hall_id && <Button variant="outline" onClick={() => setHallForm({ cinema_id: selectedCinema.cinema_id, hall_name: "", rows_count: 8, seats_per_row: 10 })}>Отмена</Button>}
                          </div>
                        </div>
                        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                          <h3 className="text-xl text-white font-heading uppercase tracking-wide flex items-center gap-2">
                            <Film className="w-5 h-5 text-[#E50914]" /> Список залов
                          </h3>
                          {halls.map((hall) => (
                              <div key={hall.hall_id} className="rounded-lg border border-[#F5F5F7]/10 p-3">
                                <p className="text-white font-medium">{hall.hall_name}</p>
                                <p className="text-[#9CA3AF] text-xs">{hall.rows_count} рядов × {hall.seats_per_row} мест</p>
                                <div className="flex gap-2 mt-3">
                                  <Button size="sm" variant="outline" onClick={() => setHallForm({ hall_id: hall.hall_id, cinema_id: hall.cinema_id, hall_name: hall.hall_name, rows_count: hall.rows_count, seats_per_row: hall.seats_per_row })}>Изменить</Button>
                                  <Button size="sm" variant="destructive" onClick={() => handleDelete(`зал «${hall.hall_name}»`, async () => { await deleteHall(hall.hall_id); await loadCinemaScopedData(selectedCinema.cinema_id); }, "Зал удалён.")}><Trash2 className="w-4 h-4" /></Button>
                                </div>
                              </div>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <h3 className="text-xl text-white font-heading uppercase tracking-wide flex items-center gap-2">
                            <Film className="w-5 h-5 text-[#E50914]" /> Добавить/редактировать сеанс
                          </h3>
                          <label className="text-sm text-[#9CA3AF]">Зал</label>
                          <select value={sessionForm.hall_id || 0} onChange={(e) => setSessionForm((p) => ({ ...p, hall_id: Number(e.target.value) }))} className="w-full h-11 rounded-xl border border-[#F5F5F7]/10 bg-[#0B0B0D] px-3 text-white">
                            <option value={0}>Выберите зал</option>
                            {halls.map((hall) => <option key={hall.hall_id} value={hall.hall_id}>{hall.hall_name}</option>)}
                          </select>
                          <label className="text-sm text-[#9CA3AF]">Фильм</label>
                          <select value={sessionForm.movie_id || 0} onChange={(e) => setSessionForm((p) => ({ ...p, movie_id: Number(e.target.value) }))} className="w-full h-11 rounded-xl border border-[#F5F5F7]/10 bg-[#0B0B0D] px-3 text-white">
                            <option value={0}>Выберите фильм</option>
                            {movies.map((movie) => <option key={movie.movie_id} value={movie.movie_id}>{movie.title}</option>)}
                          </select>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Input type="datetime-local" min={getMinDatetimeLocal()} value={sessionForm.start_time_local} onChange={(e) => setSessionForm((p) => ({ ...p, start_time_local: e.target.value }))} className={isSessionDateInvalid ? "border-red-500/70" : ""} />
                              {isSessionDateInvalid && <p className="text-red-400 text-xs">Нельзя добавить сеанс в прошлом</p>}
                            </div>
                            <Input type="number" placeholder="Цена" value={sessionForm.price} onChange={(e) => setSessionForm((p) => ({ ...p, price: Number(e.target.value) || 0 }))} />
                          </div>
                          <div className="flex gap-2">
                            <Button disabled={submitting || !sessionForm.hall_id || !sessionForm.movie_id || !sessionForm.start_time_local || sessionForm.price <= 0 || isSessionDateInvalid} onClick={() =>
                                withSubmit(async () => {
                                  const payload = { hall_id: sessionForm.hall_id, movie_id: sessionForm.movie_id, start_time: toIsoDatetime(sessionForm.start_time_local), price: Number(sessionForm.price) };
                                  if (sessionForm.session_id) await updateSession(sessionForm.session_id, payload);
                                  else await createSession(payload);
                                  setSessionForm({ hall_id: halls[0]?.hall_id ?? 0, movie_id: movies[0]?.movie_id ?? 0, start_time_local: "", price: 500 });
                                  await loadCinemaScopedData(selectedCinema.cinema_id);
                                }, sessionForm.session_id ? "Сеанс обновлён." : "Сеанс добавлен.")
                            }>{sessionForm.session_id ? "Сохранить" : "Добавить сеанс"}</Button>
                            {sessionForm.session_id && <Button variant="outline" onClick={() => setSessionForm({ hall_id: halls[0]?.hall_id ?? 0, movie_id: movies[0]?.movie_id ?? 0, start_time_local: "", price: 500 })}>Отмена</Button>}
                          </div>
                        </div>
                        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                          <h3 className="text-xl text-white font-heading uppercase tracking-wide flex items-center gap-2">
                            <Film className="w-5 h-5 text-[#E50914]" /> Список предстоящих сеансов
                          </h3>
                          {futureSessions.length === 0 && <p className="text-[#9CA3AF] text-sm">Нет предстоящих сеансов.</p>}
                          {futureSessions.map((session) => (
                              <div key={session.session_id} className="rounded-lg border border-[#F5F5F7]/10 p-3">
                                <p className="text-white font-medium">{movieNameMap.get(session.movie_id) ?? `Фильм #${session.movie_id}`}</p>
                                <p className="text-[#9CA3AF] text-xs">{hallNameMap.get(session.hall_id) ?? `Зал #${session.hall_id}`} • {new Date(session.start_time).toLocaleString("ru-RU")} • {formatRubles(session.price)}</p>
                                <div className="flex gap-2 mt-3">
                                  <Button size="sm" variant="outline" onClick={() => setSessionForm({ session_id: session.session_id, hall_id: session.hall_id, movie_id: session.movie_id, start_time_local: toLocalDatetimeInput(session.start_time), price: Math.round(session.price) })}>Изменить</Button>
                                  <Button size="sm" variant="destructive" onClick={() => handleDelete(`сеанс #${session.session_id}`, async () => { await deleteSession(session.session_id); await loadCinemaScopedData(selectedCinema.cinema_id); }, "Сеанс удалён.")}><Trash2 className="w-4 h-4" /></Button>
                                </div>
                              </div>
                          ))}
                        </div>
                      </div>
                    </div>
                )}
              </Card>
            </>
        )}
      </div>
  );
}